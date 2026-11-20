#!/usr/bin/env python3
"""按CAS 号比对欧盟化妆品禁限用清单。

数据来源：欧盟化妆品法规 Annex II 禁限用物质清单。
以 CAS 号为主键匹配，因为该清单以化学名称与 CAS 登记，不提供 INCI 俗名列。

清单条目分两类，本脚本予以区分：
  全面禁用   条目无例外条款，命中即不可用。
  附条件限制 条目含 except、unless、maximum 等限定语，属限量或特定条件下使用，
             命中不等于不可用，须提示具体条件。常见成分中有相当比例属此类，
             例如凡士林仅在精炼史不可考时受限。

用法：
    python3 check_restricted.py --inci "hydroquinone,retinol"
    python3 check_restricted.py --cas "123319"

输出 JSON 到标准输出。退出码 0 表示无全面禁用项，1 表示有全面禁用项，
2 表示参数或数据错误。
仅使用 Python 标准库，不联网，不写文件。
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "assets"
ANNEX_II = DATA_DIR / "cosing_annex_ii_restricted.csv"
INCI_INDEX = DATA_DIR / "ingredient_index.csv"

# 条目含这些限定语时属附条件限制，不等于全面禁用。
# 不含 "with the exception of entry ... in Annex ..." 这类交叉引用，
# 那种写法只是把某条款指向另一附件，物质本身仍属禁用。
CONDITION_PATTERN = re.compile(
    r"except if|except where|unless|only if|provided that|subject to|"
    r"no more than|not exceeding|maximum|when used|for fragrance",
    re.IGNORECASE,
)


def normalize_cas(value):
    """CAS 号只保留数字，容忍 '123-31-9' 与 '123319' 两种写法。"""
    return re.sub(r"[^0-9]", "", value or "")


def normalize_name(value):
    """名称归一化：NFKC 归一、去空格、转小写。"""
    return unicodedata.normalize("NFKC", value or "").strip().lower()


def load_restricted():
    """读取 Annex II，返回 CAS -> 记录，含限制类型标记。"""
    restricted = {}
    if not ANNEX_II.exists():
        return restricted
    with ANNEX_II.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            cas = normalize_cas(row.get("cas"))
            if not cas:
                continue
            name = (row.get("official_name") or "").strip()
            restricted[cas] = {
                "cas": cas,
                "official_name": name,
                "restriction_type": (
                    "conditional"
                    if CONDITION_PATTERN.search(name)
                    else "prohibited"
                ),
                "is_cmr": (row.get("is_cmr") or "").strip()
                in ("1", "true", "True"),
                "update_date": (row.get("update_date") or "").strip(),
            }
    return restricted


def load_inci_index():
    """读取成分索引，返回小写 INCI 名 -> CAS 候选列表。"""
    index = {}
    if not INCI_INDEX.exists():
        return index
    with INCI_INDEX.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            name = normalize_name(row.get("inci"))
            if name:
                index.setdefault(name, []).append(normalize_cas(row.get("cas")))
    return index


def build_entry(query, candidates, restricted):
    """构建单条检查结果。

    索引的 CAS 字段存在脏数据：少数条目填的是 EINECS 号或多个号拼接。
    同一 INCI 名可能对应多个 CAS 候选，任一候选命中即视为命中，
    并标注命中的具体 CAS 以便人工复核。
    """
    entry = {
        "query": query,
        "matched_in_index": bool(candidates),
        "cas_candidates": candidates or [],
        "prohibited": False,
        "conditional": False,
        "hits": [],
        "status": "",
    }
    if not candidates:
        entry["status"] = "not_found"
        return entry

    for cas in candidates:
        if cas and cas in restricted:
            entry["hits"].append(dict(restricted[cas]))

    if entry["hits"]:
        entry["prohibited"] = any(
            hit["restriction_type"] == "prohibited" for hit in entry["hits"]
        )
        entry["conditional"] = any(
            hit["restriction_type"] == "conditional" for hit in entry["hits"]
        )

    if entry["prohibited"]:
        entry["status"] = "prohibited"
    elif entry["conditional"]:
        entry["status"] = "conditional"
    else:
        entry["status"] = "clear"
    return entry


def check(names, restricted, index):
    """逐个成分检查，返回结果列表。"""
    results = []
    for raw in names:
        name = raw.strip()
        if name:
            results.append(
                build_entry(name, index.get(normalize_name(name)), restricted)
            )
    return results


def main():
    parser = argparse.ArgumentParser(
        description="按 CAS 号比对欧盟化妆品禁限用清单"
    )
    parser.add_argument("--inci", help="逗号分隔的 INCI 名")
    parser.add_argument("--cas", help="逗号分隔的 CAS 号")
    args = parser.parse_args()

    if not args.inci and not args.cas:
        print(
            json.dumps(
                {"error": "必须提供 --inci 或 --cas 之一"},
                ensure_ascii=False,
            )
        )
        return 2

    restricted = load_restricted()
    if not restricted:
        print(
            json.dumps(
                {
                    "error": "禁限用清单缺失或为空",
                    "expected_path": str(ANNEX_II),
                },
                ensure_ascii=False,
            )
        )
        return 2

    results = []
    if args.cas:
        for cas in args.cas.split(","):
            key = normalize_cas(cas)
            entry = build_entry(key, [key] if key else [], restricted)
            results.append(entry)
    if args.inci:
        results.extend(check(args.inci.split(","), restricted, load_inci_index()))

    has_prohibited = any(item["prohibited"] for item in results)
    has_conditional = any(item["conditional"] for item in results)
    has_unverified = any(item["status"] == "not_found" for item in results)

    if has_prohibited:
        verdict = "prohibited_found"
    elif has_conditional:
        verdict = "conditional_only"
    elif has_unverified:
        verdict = "unverified"
    else:
        verdict = "clear"

    print(
        json.dumps(
            {
                "data_source": "EU Cosmetics Regulation Annex II",
                "restricted_total": len(restricted),
                "matched_criteria": "CAS number",
                "results": results,
                "verdict": verdict,
                "note": (
                    "prohibited 为全面禁用；conditional 为附条件限制，"
                    "不等于不可用，须按条目具体条件判断；unverified 为本地"
                    "索引未收录，状态未经校验。"
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 1 if has_prohibited else 0


if __name__ == "__main__":
    sys.exit(main())