"""Import a collected product workbook into the local consumer-market demo.

Usage:
  python3 scripts/import-consumer-demo-workbook.py /path/to/products.xlsx

Requires openpyxl and Pillow. Product images are resized and encoded as WebP.
"""

from __future__ import annotations

import json
import hashlib
import io
import re
import sys
from collections import defaultdict
from pathlib import Path

import openpyxl
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "public/consumer-market"
DATA_PATH = ROOT / "components/consumer-market/data/collected-demo-products.json"
IMAGE_FALLBACK = "/consumer-market/product-image-pending.svg"
IMAGE_ASSET_BY_DIGEST: dict[str, str] = {}


def text(value: object) -> str:
    return str(value).strip() if value is not None else ""


def key(value: object) -> str:
    return text(value).casefold()


def rows_by_header(sheet):
    rows = sheet.iter_rows(values_only=True)
    headers = [text(value) for value in next(rows)]
    return [dict(zip(headers, row)) for row in rows if any(value is not None for value in row)]


def price_label(value: float) -> str:
    return f"¥{value:,.2f}".rstrip("0").rstrip(".")


def save_webp(image, filename: str) -> tuple[str, float]:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(image.ref) as photo:
        photo.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        if photo.mode not in ("RGB", "L"):
            background = Image.new("RGB", photo.size, "white")
            if "A" in photo.getbands():
                background.paste(photo, mask=photo.getchannel("A"))
            else:
                background.paste(photo.convert("RGB"))
            photo = background
        elif photo.mode == "L":
            photo = photo.convert("RGB")
        ratio = round(photo.width / photo.height, 3)
        output = io.BytesIO()
        photo.save(output, "WEBP", quality=82, method=6)
    content = output.getvalue()
    digest = hashlib.sha256(content).hexdigest()
    existing_path = IMAGE_ASSET_BY_DIGEST.get(digest)
    if existing_path:
        return existing_path, ratio
    destination = IMAGE_DIR / filename
    destination.write_bytes(content)
    image_path = f"/consumer-market/{filename}"
    IMAGE_ASSET_BY_DIGEST[digest] = image_path
    return image_path, ratio


def main(source: Path) -> None:
    IMAGE_ASSET_BY_DIGEST.clear()
    workbook = openpyxl.load_workbook(source, data_only=True)
    products = rows_by_header(workbook["01_商品主表"])
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for stale_image in IMAGE_DIR.glob("collected-*.webp"):
        stale_image.unlink()

    primary_images: dict[str, str] = {}
    primary_ratios: dict[str, float] = {}
    main_sheet = workbook["01_商品主表"]
    for image in main_sheet._images:
        row_index = image.anchor._from.row + 1
        product_id = text(main_sheet.cell(row_index, 1).value)
        if not re.fullmatch(r"P\d{4}", product_id):
            continue
        filename = f"collected-{product_id.lower()}-main.webp"
        image_path, ratio = save_webp(image, filename)
        primary_images[product_id] = image_path
        primary_ratios[product_id] = ratio

    attributes: dict[str, dict[str, str]] = defaultdict(dict)
    for row in rows_by_header(workbook["02_分类属性"]):
        product_id = text(row.get("product_id"))
        name = text(row.get("属性名称"))
        value = text(row.get("属性值"))
        if product_id and name and value:
            previous = attributes[product_id].get(name)
            if previous and value not in previous.split("；"):
                attributes[product_id][name] = f"{previous}；{value}"
            else:
                attributes[product_id][name] = value

    options: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    if "07_香味SKU" in workbook:
        for row in rows_by_header(workbook["07_香味SKU"]):
            product_id = text(row.get("商品编号"))
            value = text(row.get("SKU选项原文")) or text(row.get("香味名称"))
            if product_id and value and value not in options[product_id]["香味"]:
                options[product_id]["香味"].append(value)
    if "08_颜色SKU" in workbook:
        for row in rows_by_header(workbook["08_颜色SKU"]):
            product_id = text(row.get("商品编号"))
            value = text(row.get("SKU选项原文")) or text(row.get("颜色/配色"))
            if product_id and value and value not in options[product_id]["颜色/款式"]:
                options[product_id]["颜色/款式"].append(value)

    image_paths: dict[str, list[str]] = defaultdict(list)
    if "06_商品图片" in workbook:
        sheet = workbook["06_商品图片"]
        row_product_ids: dict[int, str] = {}
        previous_id = ""
        last_anchor_row = max((image.anchor._from.row + 1 for image in sheet._images), default=0)
        for row_index in range(1, max(sheet.max_row, last_anchor_row) + 1):
            current = text(sheet.cell(row_index, 1).value)
            if re.fullmatch(r"P\d{4}", current):
                previous_id = current
            row_product_ids[row_index] = previous_id

        for image in sheet._images:
            row_index = image.anchor._from.row + 1
            product_id = row_product_ids.get(row_index, "")
            if not product_id:
                continue
            sequence = len(image_paths[product_id]) + 1
            filename = f"collected-{product_id.lower()}-detail-{sequence}.webp"
            image_path, _ = save_webp(image, filename)
            image_paths[product_id].append(image_path)

    result = []
    for row in products:
        product_id = text(row.get("product_id"))
        if not re.fullmatch(r"P\d{4}", product_id):
            continue
        name = text(row.get("商品名称"))
        if not name:
            continue
        try:
            price = float(row.get("价格") or 0)
        except (TypeError, ValueError):
            price = 0

        product_attributes = attributes[product_id]
        images = image_paths.get(product_id, [])
        main_image = primary_images.get(product_id, IMAGE_FALLBACK)
        aspect_ratio = primary_ratios.get(product_id, 0.8)

        specs = {
            spec_name: spec_value[:240]
            for spec_name, spec_value in product_attributes.items()
            if spec_name not in {"平台商品ID", "店铺名", "商品名称", "商品标题"}
        }
        for option_name, values in options.get(product_id, {}).items():
            if values:
                specs[f"可选{option_name}"] = "、".join(values)[:240]

        brand = text(row.get("品牌"))
        store_name = product_attributes.get("店铺名") or brand or "精选商品"
        description = text(row.get("统一语义描述（自然语言）") or row.get("统一语义描述"))
        note = text(row.get("备注"))
        result.append({
            "id": product_id,
            "name": name,
            "creator": brand or store_name,
            "price": price,
            "formattedPrice": price_label(price),
            "mainImage": main_image,
            "aspectRatio": aspect_ratio,
            "secondaryImages": [image for image in images if image != main_image],
            "category": text(row.get("一级类目")) or text(row.get("二级类目")) or "精选商品",
            "shortDescription": description,
            "aiSummary": description,
            "reviews": [],
            "specs": specs,
            "storeName": store_name,
            "storeImage": main_image,
            "contextStory": note or None,
            "currency": text(row.get("货币")) or "CNY",
            "sourceDate": "2026-10-14",
            "sourceUrl": text(row.get("来源URL")) or None,
        })

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(result)} products; {len(primary_images)} main images and {sum(len(items) for items in image_paths.values())} detail images.")
    print(f"Data: {DATA_PATH}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: import-consumer-demo-workbook.py <workbook.xlsx>")
    main(Path(sys.argv[1]))
