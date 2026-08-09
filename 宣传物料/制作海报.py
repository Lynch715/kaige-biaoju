from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
background = Image.open(ROOT / "开个镖局-像素海报底图.png").convert("RGB")
qr = Image.open(ROOT / "开个镖局-Pages二维码.png").convert("RGB")
font_path = "/System/Library/Fonts/STHeiti Medium.ttc"

draw = ImageDraw.Draw(background)
title_font = ImageFont.truetype(font_path, 92)
sub_font = ImageFont.truetype(font_path, 28)
feature_font = ImageFont.truetype(font_path, 25)
qr_font = ImageFont.truetype(font_path, 25)

def centered(text, y, font, fill, stroke=0, stroke_fill="#1b110b"):
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    x = (background.width - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)

centered("开个镖局", 55, title_font, "#f2cf78", 4)
centered("一面镖旗 · 四匹快马 · 半座江湖", 170, sub_font, "#f4ead0", 2)

# Left-bottom feature copy sits on a translucent ink panel.
draw.rounded_rectangle((44, 1170, 524, 1480), radius=12, fill=(12, 12, 13, 225), outline="#aa793e", width=3)
features = ["接镖定路 · 权衡货值与风险", "培养镖师 · 闯过山匪与官卡", "开设分号 · 威震十三省"]
for i, line in enumerate(features):
    draw.text((76, 1215 + i * 70), "◆ " + line, font=feature_font, fill="#f5dfad", stroke_width=1, stroke_fill="#111111")

# Place a pristine QR with a generous white quiet zone.
qr = qr.resize((272, 272), Image.Resampling.NEAREST)
panel = (674, 1137, 978, 1494)
draw.rounded_rectangle(panel, radius=10, fill="#fdfbf5", outline="#d0a252", width=5)
background.paste(qr, (690, 1153))
label = "扫码即玩 · 无需安装"
label_box = draw.textbbox((0, 0), label, font=qr_font)
label_x = 826 - (label_box[2] - label_box[0]) // 2
draw.text((label_x, 1441), label, font=qr_font, fill="#241812")

background.save(ROOT / "开个镖局-像素宣传海报.png", quality=95)

