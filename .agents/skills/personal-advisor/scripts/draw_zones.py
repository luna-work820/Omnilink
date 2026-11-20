"""按判读结果绘制分区示意图。

用途：第二步确认与第三步档案输出时，为用户生成专属的分区图，替代纯文字描述。

用法：
    python3 draw_zones.py --preset oil_tzone
    python3 draw_zones.py --preset seasonal_summer_dry
    python3 draw_zones.py --preset combo_tzone
    python3 draw_zones.py --list

输出：PNG 写入当前工作目录下 skins_<preset>.png，同时打印绝对路径。
仅使用 Pillow，不联网，不读取用户照片。

坐标体系：输出坐标经 SCALE 超采样后再绘制，最后 LANCZOS 缩回目标尺寸，
保证放大查看时边缘平滑无锯齿。
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCALE = 6
OUT_W, OUT_H = 340, 420
FACE_BOX = (96, 140, 244, 392)

OIL = (224, 112, 80)
DRY = (150, 182, 216)
NEUTRAL = (226, 232, 230)
SENSITIVE = (214, 160, 190)
SKIN = (250, 244, 240)
EDGE = (88, 84, 82)
TEXT = (60, 58, 56)

FONT_CANDIDATES = (
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/System/Library/Fonts/PingFang.ttc",
)


def scale(value):
    return int(value * SCALE)


def load_font(size=24):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size * SCALE)
    return ImageFont.load_default()


def face_geometry():
    left, top, right, bottom = [scale(v) for v in FACE_BOX]
    return (
        (left + right) // 2,
        (top + bottom) // 2,
        (right - left) // 2,
        (bottom - top) // 2,
    )


def new_canvas():
    image = Image.new("RGB", (OUT_W * SCALE, OUT_H * SCALE), (255, 255, 255))
    return image, ImageDraw.Draw(image)


def draw_face(draw):
    draw.ellipse(
        [scale(v) for v in FACE_BOX],
        fill=SKIN,
        outline=EDGE,
        width=2 * SCALE,
    )
    return face_geometry()


def blob(draw, x, y, rx, ry, color):
    draw.ellipse(
        [x - rx, y - ry, x + rx, y + ry],
        fill=color,
        outline=(255, 255, 255),
        width=SCALE,
    )


def draw_tzone(draw, cx, cy, rx, ry, color):
    blob(draw, cx, cy - ry * 0.58, rx * 0.46, ry * 0.14, color)
    draw.rectangle(
        [cx - rx * 0.12, cy - ry * 0.46, cx + rx * 0.12, cy + ry * 0.14],
        fill=color,
    )
    blob(draw, cx, cy + ry * 0.62, rx * 0.34, ry * 0.16, color)


def draw_cheeks(draw, cx, cy, rx, ry, color):
    blob(draw, cx - rx * 0.55, cy - ry * 0.02, rx * 0.32, ry * 0.33, color)
    blob(draw, cx + rx * 0.55, cy - ry * 0.02, rx * 0.32, ry * 0.33, color)


def add_label(image, title, subtitle):
    draw = ImageDraw.Draw(image)
    title_font = load_font(24)
    sub_font = load_font(17)
    box = draw.textbbox((0, 0), title, font=title_font)
    title_w = box[2] - box[0]
    title_h = box[3] - box[1]
    sub_box = draw.textbbox((0, 0), subtitle, font=sub_font)
    sub_w = sub_box[2] - sub_box[0]
    sub_h = sub_box[3] - sub_box[1]
    band = title_h + sub_h + 26 * SCALE
    draw.rectangle([0, 0, OUT_W * SCALE, band], fill=(255, 255, 255))
    draw.text(
        ((OUT_W * SCALE - title_w) // 2, 8 * SCALE - box[1]),
        title,
        fill=TEXT,
        font=title_font,
    )
    draw.text(
        ((OUT_W * SCALE - sub_w) // 2, title_h + 20 * SCALE - sub_box[1]),
        subtitle,
        fill=(120, 116, 112),
        font=sub_font,
    )
    return image


def finish(image, preset, title, subtitle):
    add_label(image, title, subtitle)
    out = Path.cwd() / f"skins_{preset}.png"
    image.resize((OUT_W, OUT_H), Image.LANCZOS).save(out)
    return out


def build_oil_all(draw, cx, cy, rx, ry, color, preset, title, sub):
    draw.ellipse(
        [scale(v) for v in FACE_BOX], fill=color, outline=EDGE, width=2 * SCALE
    )
    return preset, title, sub


PRESETS = {}


def register(name, title, subtitle):
    def wrap(func):
        PRESETS[name] = (func, title, subtitle)
        return func

    return wrap


@register("oil_tzone", "仅 T 区出油", "T 区油 ·两颊干")
def _oil_tzone(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, DRY)
    draw_tzone(draw, cx, cy, rx, ry, OIL)


@register("oil_cheek", "两颊出油", "两颊油 · 其余干")
def _oil_cheek(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, OIL)
    draw_tzone(draw, cx, cy, rx, ry, DRY)


@register("oil_nose", "鼻翼为主", "鼻翼油 · 其余中性")
def _oil_nose(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, NEUTRAL)
    draw_tzone(draw, cx, cy, rx, ry, NEUTRAL)
    blob(draw, cx - rx * 0.26, cy + ry * 0.06, rx * 0.20, ry * 0.16, OIL)
    blob(draw, cx + rx * 0.26, cy + ry * 0.06, rx * 0.20, ry * 0.16, OIL)


@register("oil_chin", "下巴为主", "下巴油 · 其余中性")
def _oil_chin(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, NEUTRAL)
    draw_tzone(draw, cx, cy, rx, ry, NEUTRAL)
    blob(draw, cx, cy + ry * 0.62, rx * 0.34, ry * 0.16, OIL)


@register("oil_all", "全脸均匀出油", "整脸油 · 无明显分区")
def _oil_all(image, draw):
    draw.ellipse(
        [scale(v) for v in FACE_BOX], fill=OIL, outline=EDGE, width=2 * SCALE
    )


@register("dry_all", "全脸均匀干燥", "整脸干 · 无明显分区")
def _dry_all(image, draw):
    draw.ellipse(
        [scale(v) for v in FACE_BOX], fill=DRY, outline=EDGE, width=2 * SCALE
    )


@register("combo_tzone", "混合性 · T 区型", "全年固定分区 · 分区护理")
def _combo_tzone(image, draw):
    """强调固定的分区结构：画出 T 区与 U 区的分界线，与出油范围图区分开。"""
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, DRY)
    draw_tzone(draw, cx, cy, rx, ry, OIL)
    line_x = cx + rx * 0.34
    draw.line(
        [
            line_x,
            cy - ry * 0.66,
            line_x,
            cy - ry * 0.36,
        ],
        fill=(255, 255, 255),
        width=3 * SCALE,
    )
    draw.line(
        [
            cx - rx * 0.34,
            cy + ry * 0.30,
            cx + rx * 0.34,
            cy + ry * 0.30,
        ],
        fill=(255, 255, 255),
        width=3 * SCALE,
    )


@register("seasonal_summer_oily", "季节型 · 夏油冬干", "当前为夏季 · T 区型不可套用")
def _seasonal_summer(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, DRY)
    draw_tzone(draw, cx, cy, rx, ry, OIL)


@register("seasonal_winter_dry", "季节型 · 当前冬季", "当前为冬季 · 屏障修护为主")
def _seasonal_winter(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, DRY)
    draw_tzone(draw, cx, cy, rx, ry, NEUTRAL)


@register("outer_oily_inner_dry", "外油内干", "T 区油光 · 角质层实际缺水")
def _outer_dry(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, DRY)
    draw_tzone(draw, cx, cy, rx, ry, (OIL[0], OIL[1], 150))


@register("sensitive_mild", "偶尔泛红刺痛", "功效成分从最低浓度开始")
def _sensitive_mild(image, draw):
    cx, cy, rx, ry = draw_face(draw)
    draw.ellipse(
        [scale(v) for v in FACE_BOX], fill=SENSITIVE, outline=EDGE, width=2 * SCALE
    )


def main():
    parser = argparse.ArgumentParser(description="绘制肤质分区示意图")
    parser.add_argument("--preset", help="预设名称")
    parser.add_argument("--list", action="store_true", help="列出全部预设")
    args = parser.parse_args()

    if args.list or not args.preset:
        print("可用预设：")
        for name, (_, title, sub) in PRESETS.items():
            print(f"  {name:26s} {title}｜{sub}")
        return 0 if args.list else 2

    if args.preset not in PRESETS:
        print(f"未知预设：{args.preset}，用 --list 查看全部")
        return 2

    func, title, subtitle = PRESETS[args.preset]
    image, draw = new_canvas()
    func(image, draw)
    out = finish(image, args.preset, title, subtitle)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())