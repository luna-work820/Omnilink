"""生成肤质分区示意图。

用途：为第二步的出油范围选项提供可视化对照，避免用户依赖文字理解。
输出：assets/ 下六张 PNG，文件名与出油范围选项一一对应。

所有图形为示意，不模拟真实皮肤质感。色块仅表示出油倾向，不表示严重程度。
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCALE = 6
OUT_W, OUT_H = 340, 420
FACE_BOX = (96, 140, 244, 392)

OIL = (224, 112, 80)
DRY = (150, 182, 216)
NEUTRAL = (226, 232, 230)
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


def load_font():
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, 26 * SCALE)
    return ImageFont.load_default()


def new_canvas():
    image = Image.new(
        "RGB", (OUT_W * SCALE, OUT_H * SCALE), (255, 255, 255)
    )
    return image, ImageDraw.Draw(image)


def draw_face(draw):
    box = [scale(v) for v in FACE_BOX]
    draw.ellipse(box, fill=SKIN, outline=EDGE, width=2 * SCALE)
    left, top, right, bottom = box
    center_x = (left + right) // 2
    center_y = (top + bottom) // 2
    radius_x = (right - left) // 2
    radius_y = (bottom - top) // 2
    return center_x, center_y, radius_x, radius_y


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
        [
            cx - rx * 0.12,
            cy - ry * 0.46,
            cx + rx * 0.12,
            cy + ry * 0.14,
        ],
        fill=color,
    )
    blob(draw, cx, cy + ry * 0.62, rx * 0.34, ry * 0.16, color)


def draw_cheeks(draw, cx, cy, rx, ry, color):
    blob(draw, cx - rx * 0.55, cy - ry * 0.02, rx * 0.32, ry * 0.33, color)
    blob(draw, cx + rx * 0.55, cy - ry * 0.02, rx * 0.32, ry * 0.33, color)


def add_label(image, text):
    draw = ImageDraw.Draw(image)
    font = load_font()
    left, top, right, bottom = draw.textbbox(
        (0, 0), text, font=font
    )
    text_w = right - left
    text_h = bottom - top
    draw.rectangle(
        [0, 0, OUT_W * SCALE, text_h + 16 * SCALE], fill=(255, 255, 255)
    )
    draw.text(
        ((OUT_W * SCALE - text_w) // 2, 8 * SCALE - top),
        text,
        fill=TEXT,
        font=font,
    )
    return image


def save(image, out_dir, name, label):
    add_label(image, label)
    image.resize((OUT_W, OUT_H), Image.LANCZOS).save(out_dir / name)


def build(out_dir):
    """重建六张示意图。

    写入范围限定在 out_dir，即本 Skill 目录下的 assets/。
    平台仅支持两级目录，示意图不另设子目录。
    只创建该目录与其中的六个固定文件名，不读写其他路径，不联网，
    不读取用户照片，不删除任何文件。
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    image, draw = new_canvas()
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, DRY)
    draw_tzone(draw, cx, cy, rx, ry, OIL)
    save(image, out_dir, "oil_tzone.png", "仅 T 区出油")

    image, draw = new_canvas()
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, OIL)
    draw_tzone(draw, cx, cy, rx, ry, DRY)
    save(image, out_dir, "oil_cheek.png", "两颊出油")

    image, draw = new_canvas()
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, NEUTRAL)
    draw_tzone(draw, cx, cy, rx, ry, NEUTRAL)
    blob(draw, cx - rx * 0.26, cy + ry * 0.06, rx * 0.20, ry * 0.16, OIL)
    blob(draw, cx + rx * 0.26, cy + ry * 0.06, rx * 0.20, ry * 0.16, OIL)
    save(image, out_dir, "oil_nose.png", "鼻翼为主")

    image, draw = new_canvas()
    cx, cy, rx, ry = draw_face(draw)
    draw_cheeks(draw, cx, cy, rx, ry, NEUTRAL)
    draw_tzone(draw, cx, cy, rx, ry, NEUTRAL)
    blob(draw, cx, cy + ry * 0.62, rx * 0.34, ry * 0.16, OIL)
    save(image, out_dir, "oil_chin.png", "下巴为主")

    image, draw = new_canvas()
    box = [scale(v) for v in FACE_BOX]
    draw.ellipse(box, fill=OIL, outline=EDGE, width=2 * SCALE)
    save(image, out_dir, "oil_all.png", "全脸均匀出油")

    image, draw = new_canvas()
    box = [scale(v) for v in FACE_BOX]
    draw.ellipse(box, fill=DRY, outline=EDGE, width=2 * SCALE)
    save(image, out_dir, "dry_all.png", "全脸均匀干燥")


if __name__ == "__main__":
    target = Path(__file__).resolve().parent.parent / "assets"
    build(target)
    print("示意图已输出到", target)