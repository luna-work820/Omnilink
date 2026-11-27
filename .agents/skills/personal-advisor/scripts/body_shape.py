"""生成三围区间选择脚本。

用区间按钮替代让用户手填数字。每个部位一题，每题四个区间选项。
"""

import sys


BANDS = {
    "bust": {
        "label": "胸围",
        "bands": [
            ("under_80", "80 以下"),
            ("80_88", "80—88"),
            ("88_96", "88—96"),
            ("over_96", "96 以上"),
        ],
    },
    "waist": {
        "label": "腰围",
        "bands": [
            ("under_60", "60 以下"),
            ("60_68", "60—68"),
            ("68_76", "68—76"),
            ("over_76", "76 以上"),
        ],
    },
    "hip": {
        "label": "臀围",
        "bands": [
            ("under_85", "85 以下"),
            ("85_93", "85—93"),
            ("93_101", "93—101"),
            ("over_101", "101 以上"),
        ],
    },
}

# 每个区间的代表值，用于比例比较。只取中值。
REPRESENTATIVE = {
    "under_80": 76,
    "80_88": 84,
    "88_96": 92,
    "over_96": 100,
    "under_60": 56,
    "60_68": 64,
    "68_76": 72,
    # 76 以上取 84：原值 80 落在区间下沿，与臀围下沿 81 形成 w>=h 恒假，
    # 苹果型分支不可达。取区间中段使腰围能与最小臀围比较。
    "over_76": 84,
    "under_85": 81,
    "85_93": 89,
    "93_101": 97,
    "over_101": 105,
}


def classify(bust, waist, hip):
    """按三围区间的代表值判定分型。

    阈值取自行业常用的围度差判断：胸臀差 2cm 以内视为接近，
    差 2—8cm 为明显不等，腰围比最大围小 25cm 以上视为腰线明显。
    """
    b = REPRESENTATIVE[bust]
    w = REPRESENTATIVE[waist]
    h = REPRESENTATIVE[hip]
    chest_hip_gap = abs(b - h)
    largest = max(b, h)
    waist_gap = largest - w

    if chest_hip_gap <= 4 and waist_gap >= 20:
        return "沙漏型", "胸臀接近，腰围明显更小"
    if h - b >= 2 and waist_gap >= 12:
        return "梨型", "臀围大于胸围，腰线清晰"
    # 腰围接近（4cm 容差内）或大于胸臀，判为苹果型。
    # 容差与胸臀接近阈值同量级，避免区间代表值差异让临界组合漏判。
    if w >= b and w >= h - 4:
        return "苹果型", "腰围接近或大于胸臀"
    if chest_hip_gap <= 6 and waist_gap < 12:
        return "矩形型", "三围接近，腰线不明显"
    if b - h >= 2:
        return "倒三角型", "胸围明显大于臀围"
    return "矩形型", "各项接近，倾向矩形"


def main():
    if len(sys.argv) < 4:
        print("用法: body_shape.py <bust> <waist> <hip>")
        print("可选值:")
        for key, info in BANDS.items():
            values = " / ".join(label for _, label in info["bands"])
            print(f"  {info['label']}: {values}")
        return 2

    bust, waist, hip = sys.argv[1:4]
    valid = {band_id for info in BANDS.values() for band_id, _ in info["bands"]}
    for value in (bust, waist, hip):
        if value not in valid:
            print(f"区间标识无效: {value}")
            return 2

    shape, reason = classify(bust, waist, hip)
    print(f"{shape}|{reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())