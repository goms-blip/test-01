"""
compose_thumbnails.py
---------------------
frame_09.jpg(1920x1080)을 베이스로 KR/EN 두 종 유튜브 썸네일을 PIL로 직접 합성한다.

설계 원칙
- AI 이미지 사용하지 않는다. 영상 실제 프레임만 사용.
- frame_09는 마들렌 트레이 위에 그레이즈(미로와)를 브러시로 바르는 액션 컷.
- 자막바·워터마크는 흰 그라디언트 마스킹 대신 **크롭+업스케일**로 화면 밖으로 밀어낸다.
  (크롭 박스: 좌우 살짝 + 상단 살짝 + 하단 자막 영역까지 잘라 1920×1080으로 재스케일)
- 좌상단 브러시(빨강/오렌지 손잡이 + 노란 솔)는 액션감의 핵심이라 반드시 유지한다.
- 콜아웃 카피는 "그레이즈를 살짝 발라 밤이 돋보이게"라는 영상 의도에 맞춘 마일드 톤.
  KR `윤기 살짝` / EN `GENTLE GLOSS`
- 화살표·반짝임은 크롭 후 좌표계 기준으로 글레이즈 작업 부위를 가리킨다.
- 산출물: thumbnail_kr.png, thumbnail_en.png (1920x1080 PNG)
- 미리보기: thumbnail_kr_preview.png, thumbnail_en_preview.png (300x170 PNG)
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# 경로
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent
BASE_IMG = ROOT / "frame_09.jpg"
FONTS = ROOT / "fonts"

FONT_BLACK_HAN = FONTS / "BlackHanSans-Regular.ttf"
FONT_PRETENDARD = FONTS / "Pretendard-Black.otf"
FONT_ANTON = FONTS / "Anton-Regular.ttf"

OUT_KR = ROOT / "thumbnail_kr.png"
OUT_EN = ROOT / "thumbnail_en.png"
OUT_KR_PREVIEW = ROOT / "thumbnail_kr_preview.png"
OUT_EN_PREVIEW = ROOT / "thumbnail_en_preview.png"

# ---------------------------------------------------------------------------
# 디자인 토큰
# ---------------------------------------------------------------------------
BOX_GREEN_DARK = (30, 86, 49, 235)      # #1E5631 alpha 0.92
BOX_GREEN_MID = (46, 110, 60, 230)      # #2E6E3C alpha 0.90
ACCENT_LIME = (156, 200, 97, 255)       # #9CC861
WHITE = (255, 255, 255, 255)
SHADOW = (0, 0, 0, 80)

LABEL_BG = (30, 86, 49, 235)
LABEL_TEXT = (255, 255, 255, 255)

# 콜아웃(스티커) 톤
CALLOUT_YELLOW = (255, 217, 61, 255)    # #FFD93D
CALLOUT_OUTLINE = (20, 20, 20, 255)     # near-black
CALLOUT_TEXT = (30, 86, 49, 255)        # 진한 그린 (대비 최대)

# 화살표 톤
ARROW_FILL = (255, 255, 255, 255)
ARROW_OUTLINE = (15, 15, 15, 255)

# 반짝임
SPARKLE_FILL = (255, 255, 255, 255)
SPARKLE_GLOW = (255, 230, 110, 200)

# ---------------------------------------------------------------------------
# 크롭 박스 (원본 frame_09 1920×1080 좌표계)
# ---------------------------------------------------------------------------
# 결정 사양:
#  - 하단 자막바(약 y=940~1010) 완전 제거 → y_max=940
#  - 상단 0 유지 (브러시 위쪽 손잡이까지 보존)
#  - 좌우 124px씩 잘라 16:9 비율 (1672:940 = 16:9) 정확히 맞춤
#  - 좌측 124px 컷: 브러시 손잡이 일부만 잘리고 노란 솔 + 오렌지 끝 + 핵심 손잡이는 보존
#  - 우측 124px 컷: 빈 트레이 영역 일부만 잘림 (정보 손실 0)
CROP_BOX = (124, 0, 1796, 940)  # (left, top, right, bottom) — 1672×940
CROP_TARGET_SIZE = (1920, 1080)

# 크롭 후 1920×1080 좌표계 기준 — 글레이즈 작업 부위 (브러시 노란 솔 ~ 마들렌 글레이즈 표면)
# 원본 ~ (430, 460) → 크롭 (306, 460) → ×1920/1672 ≈ ×1.148 → (351, 528).
# 시각 보정: 화살표가 마들렌 표면 글레이즈에 정확히 닿도록 약간 우하향 → (380, 560).
GLAZE_TARGET = (380, 560)

# 콜아웃 위치(중심) — 우중단, 라벨박스(우상단) 아래
# 우상단 라벨이 (1920-40, 60~) 영역이라 충돌 회피하려면 y는 라벨 아래.
CALLOUT_CENTER = (1560, 600)
CALLOUT_RADIUS = 160  # 직경 320 — `윤기 살짝` 4글자 / `GENTLE GLOSS` 2단어 모두 수용

# 우상단 영상 워터마크 잔재 영역 (크롭 후 좌표).
# 원본 (1640, 55) ~ (1900, 165) → 크롭(124,0,1796,940) 후 (1516, 55)~(1672, 165) → ×1.148.
# 크롭으로 우측은 일부 잘렸지만 좌측 절반 + 도구 아이콘이 남는다 → 흰 사각형으로 덮는다.
WATERMARK_AREA = (1500, 30, 1920, 215)


# ---------------------------------------------------------------------------
# 유틸
# ---------------------------------------------------------------------------
def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    """폰트 로드. 실패 시 시스템 폰트로 폴백."""
    try:
        return ImageFont.truetype(str(path), size=size)
    except Exception:
        candidates = [
            "/System/Library/Fonts/Supplemental/AppleSDGothicNeo.ttc",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/Library/Fonts/Arial Unicode.ttf",
        ]
        for c in candidates:
            if Path(c).exists():
                try:
                    return ImageFont.truetype(c, size=size)
                except Exception:
                    continue
        return ImageFont.load_default()


def measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_rounded_box(
    canvas: Image.Image,
    xy: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    radius: int = 10,
) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(xy, radius=radius, fill=fill)
    canvas.alpha_composite(overlay)


def draw_text_with_shadow(
    canvas: Image.Image,
    pos: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int] = WHITE,
    shadow_color: tuple[int, int, int, int] = SHADOW,
    shadow_offset: tuple[int, int] = (2, 2),
) -> None:
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    sx, sy = shadow_offset
    ld.text((pos[0] + sx, pos[1] + sy), text, font=font, fill=shadow_color)
    ld.text(pos, text, font=font, fill=fill)
    canvas.alpha_composite(layer)


# ---------------------------------------------------------------------------
# 크롭 + 업스케일 (마스킹 대체)
# ---------------------------------------------------------------------------
def crop_and_upscale(base: Image.Image) -> Image.Image:
    """원본 frame_09에서 자막/좌우 일부를 잘라 1920×1080으로 재스케일.

    이전 버전(흰 그라디언트 마스킹)은 자막바 위 흰 띠가 어색했음.
    크롭+업스케일로 자막 영역 자체를 화면 밖으로 밀어낸다.
    좌상단 브러시는 보존 (액션감 핵심).
    """
    cropped = base.crop(CROP_BOX)  # 1672×940
    # 16:9 비율 검증
    cw, ch = cropped.size
    aspect = cw / ch
    target_aspect = CROP_TARGET_SIZE[0] / CROP_TARGET_SIZE[1]
    assert abs(aspect - target_aspect) < 0.01, (
        f"crop aspect {aspect:.4f} != 16:9 {target_aspect:.4f}"
    )
    return cropped.resize(CROP_TARGET_SIZE, Image.LANCZOS)


def mask_watermark(canvas: Image.Image) -> None:
    """우상단 영상 워터마크 잔재를 흰 사각형으로 덮는다.

    크롭은 자막바 처리용이고, 워터마크는 별도. 우리 라벨이 그 위에 다시 그려진다.
    """
    x1, y1, x2, y2 = WATERMARK_AREA
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((x1, y1, x2, y2), fill=(252, 252, 252, 255))
    canvas.alpha_composite(overlay)


# ---------------------------------------------------------------------------
# 우상단 라벨
# ---------------------------------------------------------------------------
def draw_top_right_label(canvas: Image.Image, text: str = "Pink Lemons Home") -> None:
    draw = ImageDraw.Draw(canvas)
    font = load_font(FONT_PRETENDARD, 32)
    tw, th = measure(draw, text, font)
    pad_x, pad_y = 18, 10
    box_w = tw + pad_x * 2
    box_h = th + pad_y * 2
    x2 = 1920 - 40
    x1 = x2 - box_w
    y1 = 60
    y2 = y1 + box_h
    draw_rounded_box(canvas, (x1, y1, x2, y2), LABEL_BG, radius=8)
    bbox = draw.textbbox((0, 0), text, font=font)
    tx = x1 + pad_x - bbox[0]
    ty = y1 + pad_y - bbox[1]
    draw_text_with_shadow(canvas, (tx, ty), text, font, fill=WHITE, shadow_offset=(1, 1))


# ---------------------------------------------------------------------------
# 메인 카피 + 서브 카피 박스
# ---------------------------------------------------------------------------
def _render_main_with_accent(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    parts: tuple[str, str, str],
    font: ImageFont.FreeTypeFont,
    *,
    box_x1: int,
    box_y1: int,
    pad_x: int,
    pad_y: int,
    bottom_extra: int,
    radius: int = 12,
) -> tuple[int, int, int, int]:
    left, accent, right = parts
    wL, hL = measure(draw, left, font)
    wX, hX = measure(draw, accent, font)
    wR, hR = measure(draw, right, font)
    main_w = wL + wX + wR
    main_h = max(hL, hX, hR)

    box_x2 = box_x1 + main_w + pad_x * 2
    box_y2 = box_y1 + main_h + pad_y * 2 + bottom_extra

    draw_rounded_box(canvas, (box_x1, box_y1, box_x2, box_y2), BOX_GREEN_DARK, radius=radius)

    bbox_left = draw.textbbox((0, 0), left, font=font)
    base_y = box_y1 + pad_y - bbox_left[1]
    cur_x = box_x1 + pad_x - bbox_left[0]

    draw_text_with_shadow(canvas, (cur_x, base_y), left, font, fill=WHITE, shadow_offset=(3, 3))
    cur_x += wL
    draw_text_with_shadow(canvas, (cur_x, base_y), accent, font, fill=ACCENT_LIME, shadow_offset=(3, 3))
    cur_x += wX
    draw_text_with_shadow(canvas, (cur_x, base_y), right, font, fill=WHITE, shadow_offset=(3, 3))

    return box_x1, box_y1, box_x2, box_y2


def _render_sub(
    canvas: Image.Image,
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    *,
    box_x1: int,
    box_y1: int,
    pad_x: int = 28,
    pad_y: int = 14,
    bottom_extra: int = 8,
    radius: int = 10,
) -> tuple[int, int, int, int]:
    tw, th = measure(draw, text, font)
    box_x2 = box_x1 + tw + pad_x * 2
    box_y2 = box_y1 + th + pad_y * 2 + bottom_extra
    draw_rounded_box(canvas, (box_x1, box_y1, box_x2, box_y2), BOX_GREEN_MID, radius=radius)
    bbox = draw.textbbox((0, 0), text, font=font)
    sx = box_x1 + pad_x - bbox[0]
    sy = box_y1 + pad_y - bbox[1]
    draw_text_with_shadow(canvas, (sx, sy), text, font, fill=WHITE, shadow_offset=(2, 2))
    return box_x1, box_y1, box_x2, box_y2


# ---------------------------------------------------------------------------
# 콜아웃 스티커
# ---------------------------------------------------------------------------
def draw_callout_sticker(
    canvas: Image.Image,
    text: str,
    *,
    center: tuple[int, int],
    radius: int = 160,
    font_path: Path = FONT_BLACK_HAN,
    font_size: int = 90,
    rotate_deg: float = -10.0,
) -> None:
    """노랑 원형 스티커 + 텍스트. 살짝 회전 + 그림자.

    구현: 원형 + 텍스트를 별도 RGBA 레이어에 그린 뒤 회전 → 합성.
    """
    cx, cy = center
    pad = 60  # 회전시 모서리 잘림 방지 여유
    layer_size = (radius * 2 + pad * 2, radius * 2 + pad * 2)
    layer = Image.new("RGBA", layer_size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)

    lx, ly = pad + radius, pad + radius  # layer 내 중심

    # 그림자(블러된 약간 큰 어두운 원)
    shadow_layer = Image.new("RGBA", layer_size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.ellipse(
        (lx - radius + 8, ly - radius + 12, lx + radius + 8, ly + radius + 12),
        fill=(0, 0, 0, 120),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=10))
    layer.alpha_composite(shadow_layer)

    # 본체 원 (외곽선 → 내부 채움)
    ld.ellipse(
        (lx - radius, ly - radius, lx + radius, ly + radius),
        fill=CALLOUT_YELLOW,
        outline=CALLOUT_OUTLINE,
        width=6,
    )

    # 텍스트 — 두 줄 처리 가능 (\n 분리 시 줄바꿈 지원)
    font = load_font(font_path, font_size)
    lines = text.split("\n")
    line_metrics = [ld.textbbox((0, 0), ln, font=font) for ln in lines]
    line_widths = [bb[2] - bb[0] for bb in line_metrics]
    line_heights = [bb[3] - bb[1] for bb in line_metrics]
    line_gap = int(font_size * 0.10)
    total_h = sum(line_heights) + line_gap * (len(lines) - 1)
    cur_y = ly - total_h // 2
    for ln, bb, lw, lh in zip(lines, line_metrics, line_widths, line_heights):
        tx = lx - lw // 2 - bb[0]
        ty = cur_y - bb[1]
        # 텍스트 외곽선(흰 외곽 → 그린 본체)
        for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
            ld.text((tx + dx, ty + dy), ln, font=font, fill=(255, 255, 255, 255))
        ld.text((tx, ty), ln, font=font, fill=CALLOUT_TEXT)
        cur_y += lh + line_gap

    # 회전
    rotated = layer.rotate(rotate_deg, resample=Image.BICUBIC, expand=False)

    # 캔버스에 합성
    paste_x = cx - rotated.size[0] // 2
    paste_y = cy - rotated.size[1] // 2
    canvas.alpha_composite(rotated, dest=(paste_x, paste_y))


# ---------------------------------------------------------------------------
# 화살표 (콜아웃 → 글레이즈 작업 부위)
# ---------------------------------------------------------------------------
def draw_curved_arrow(
    canvas: Image.Image,
    start: tuple[int, int],
    end: tuple[int, int],
    *,
    bow: float = 0.35,
    samples: int = 60,
    stroke_outline: int = 26,
    stroke_fill: int = 16,
    head_size: int = 46,
) -> None:
    """베지어 풍 곡선 화살표.

    start → end 사이를 quadratic Bezier로 잇고, 끝에 삼각형 화살촉.
    검정 외곽선 위에 흰 본체를 한 번 더 그어 "흰선+검정외곽" 효과.
    bow: 곡선 휨 정도 (0=직선, 음수=반대방향).
    """
    x1, y1 = start
    x2, y2 = end
    # 제어점: 두 점 중간에서 수직 방향으로 bow * 거리 만큼 띄움
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    dist = math.hypot(dx, dy) or 1.0
    # 수직 단위벡터
    nx, ny = -dy / dist, dx / dist
    cx = mx + nx * dist * bow
    cy = my + ny * dist * bow

    pts = []
    for i in range(samples + 1):
        t = i / samples
        bx = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2
        by = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2
        pts.append((bx, by))

    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)

    # 외곽선 (검정 굵은 선)
    ld.line(pts, fill=ARROW_OUTLINE, width=stroke_outline, joint="curve")
    # 본체 (흰 가는 선)
    ld.line(pts, fill=ARROW_FILL, width=stroke_fill, joint="curve")

    # 화살촉: 마지막 점 방향으로 삼각형
    p_last = pts[-1]
    p_prev = pts[-6] if len(pts) >= 7 else pts[0]
    ang = math.atan2(p_last[1] - p_prev[1], p_last[0] - p_prev[0])
    h = head_size
    # 삼각형 세 점
    tip = p_last
    base_l = (
        p_last[0] - h * math.cos(ang) + (h * 0.6) * math.cos(ang + math.pi / 2),
        p_last[1] - h * math.sin(ang) + (h * 0.6) * math.sin(ang + math.pi / 2),
    )
    base_r = (
        p_last[0] - h * math.cos(ang) + (h * 0.6) * math.cos(ang - math.pi / 2),
        p_last[1] - h * math.sin(ang) + (h * 0.6) * math.sin(ang - math.pi / 2),
    )
    outline_pts = [tip, base_l, base_r]
    ld.polygon(outline_pts, fill=ARROW_OUTLINE)
    # 내부: 약 70% 축소된 삼각형
    cx_t = (tip[0] + base_l[0] + base_r[0]) / 3
    cy_t = (tip[1] + base_l[1] + base_r[1]) / 3
    inner = []
    for px, py in outline_pts:
        inner.append((cx_t + (px - cx_t) * 0.72, cy_t + (py - cy_t) * 0.72))
    ld.polygon(inner, fill=ARROW_FILL)

    canvas.alpha_composite(layer)


# ---------------------------------------------------------------------------
# 반짝임 (sparkle)
# ---------------------------------------------------------------------------
def draw_sparkle(
    canvas: Image.Image,
    center: tuple[int, int],
    *,
    size: int = 70,
    rotate_deg: float = 0.0,
) -> None:
    """4-pointed star 반짝임. 흰색 + 노랑 글로우."""
    pad = size + 30
    L = pad * 2
    layer = Image.new("RGBA", (L, L), (0, 0, 0, 0))

    cx, cy = pad, pad
    s = size
    thin = max(6, int(s * 0.18))
    star_points = [
        (cx, cy - s),         # top
        (cx + thin, cy - thin),
        (cx + s, cy),         # right
        (cx + thin, cy + thin),
        (cx, cy + s),         # bottom
        (cx - thin, cy + thin),
        (cx - s, cy),         # left
        (cx - thin, cy - thin),
    ]

    glow = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    glow_scale = 1.35
    glow_pts = [
        (cx + (px - cx) * glow_scale, cy + (py - cy) * glow_scale)
        for px, py in star_points
    ]
    gd.polygon(glow_pts, fill=SPARKLE_GLOW)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
    layer.alpha_composite(glow)

    body = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    bd = ImageDraw.Draw(body)
    bd.polygon(star_points, fill=SPARKLE_FILL)
    bd.polygon(star_points, outline=(40, 40, 40, 180))
    layer.alpha_composite(body)

    if rotate_deg != 0:
        layer = layer.rotate(rotate_deg, resample=Image.BICUBIC, expand=False)

    paste_x = center[0] - L // 2
    paste_y = center[1] - L // 2
    canvas.alpha_composite(layer, dest=(paste_x, paste_y))


def draw_sparkles(canvas: Image.Image) -> None:
    """글레이즈 작업 부위 주변에 별을 흩뿌린다.

    크롭 후 좌표계 (1920×1080):
      - 글레이즈 타겟 ≈ (380, 560)
      - 브러시 노란 솔 ≈ (260, 290)
      - 마들렌 표면 좌측 ≈ (200, 700)
    이 주변에 4개 (메인 박스/콜아웃과 충돌 회피).
    """
    sparkles = [
        # (center_x, center_y, size, rotate)
        (520, 420, 60, 12),     # 글레이즈 타겟 우상단
        (200, 740, 50, -8),     # 마들렌 좌측 표면
        (640, 720, 55, 6),      # 마들렌 우측 표면
        (820, 460, 45, -18),    # 글레이즈 타겟 우측
    ]
    for x, y, sz, rot in sparkles:
        draw_sparkle(canvas, (x, y), size=sz, rotate_deg=rot)


# ---------------------------------------------------------------------------
# 합성 — KR / EN
# ---------------------------------------------------------------------------
def _compose_common(
    canvas: Image.Image,
    *,
    main_parts: tuple[str, str, str],
    main_font: ImageFont.FreeTypeFont,
    sub_text: str,
    sub_font: ImageFont.FreeTypeFont,
    callout_text: str,
    callout_font_size: int,
) -> None:
    """KR/EN 공통 합성 파이프라인 (크롭+업스케일된 캔버스 기준).

    합성 순서:
    0) 우상단 워터마크 영역 마스킹 (크롭으론 못 잡힌 잔재)
    1) 반짝임 (글레이즈 주변 — 텍스트보다 뒤)
    2) 메인/서브 박스 (좌측)
    3) 콜아웃 스티커 (우측)
    4) 화살표 (콜아웃 가장자리 → 글레이즈 타겟)
    5) 우상단 라벨 (마지막)
    """
    draw = ImageDraw.Draw(canvas)

    # 0) 워터마크 잔재 정리
    mask_watermark(canvas)

    # 1) 반짝임
    draw_sparkles(canvas)

    # 2) 메인 + 서브 (좌상~좌중단)
    bx1, by1, bx2, by2 = _render_main_with_accent(
        canvas, draw,
        parts=main_parts,
        font=main_font,
        box_x1=60,
        box_y1=70,
        pad_x=28,           # 이전 32 → 28 (크롭으로 좌측 여유 줄어듦)
        pad_y=20,           # 이전 22 → 20
        bottom_extra=12,
    )
    _render_sub(
        canvas, draw,
        text=sub_text,
        font=sub_font,
        box_x1=bx1,
        box_y1=by2 + 16,
        pad_x=24,
        pad_y=12,
        bottom_extra=6,
    )

    # 3) 콜아웃 스티커 (우중단)
    draw_callout_sticker(
        canvas,
        callout_text,
        center=CALLOUT_CENTER,
        radius=CALLOUT_RADIUS,
        font_size=callout_font_size,
        rotate_deg=-10.0,
    )

    # 4) 화살표: 콜아웃 좌측 가장자리 → 글레이즈 타겟
    arrow_start = (CALLOUT_CENTER[0] - CALLOUT_RADIUS + 22, CALLOUT_CENTER[1] - 10)
    draw_curved_arrow(
        canvas,
        start=arrow_start,
        end=GLAZE_TARGET,
        bow=-0.18,
        stroke_outline=28,
        stroke_fill=16,
        head_size=52,
    )

    # 5) 우상단 라벨
    draw_top_right_label(canvas, "Pink Lemons Home")


def compose_kr(base: Image.Image) -> Image.Image:
    canvas = crop_and_upscale(base).convert("RGBA")
    _compose_common(
        canvas,
        main_parts=("말차 ", "× ", "밤"),
        main_font=load_font(FONT_BLACK_HAN, 200),
        sub_text="밤크림 가득한 마들렌",
        sub_font=load_font(FONT_PRETENDARD, 78),
        callout_text="윤기\n살짝",  # 4글자 두 줄 — 원 안에서 균형
        callout_font_size=110,
    )
    return canvas


def compose_en(base: Image.Image) -> Image.Image:
    canvas = crop_and_upscale(base).convert("RGBA")
    _compose_common(
        canvas,
        main_parts=("MATCHA ", "× ", "MARRON"),
        main_font=load_font(FONT_ANTON, 200),
        sub_text="Chestnut Cream Madeleines",
        sub_font=load_font(FONT_PRETENDARD, 64),
        callout_text="GENTLE\nGLOSS",
        callout_font_size=80,
    )
    return canvas


# ---------------------------------------------------------------------------
# 저장 / 검증
# ---------------------------------------------------------------------------
def save_with_preview(
    canvas_rgba: Image.Image, out_full: Path, out_preview: Path
) -> tuple[tuple[int, int], tuple[int, int]]:
    final = canvas_rgba.convert("RGB")
    final.save(out_full, "PNG", optimize=True)
    re_open = Image.open(out_full)
    full_size = re_open.size

    preview = final.resize((300, 170), Image.LANCZOS)
    preview.save(out_preview, "PNG", optimize=True)
    pv_size = Image.open(out_preview).size
    return full_size, pv_size


def main() -> None:
    if not BASE_IMG.exists():
        raise SystemExit(f"frame_09.jpg not found at {BASE_IMG}")

    base = Image.open(BASE_IMG)
    print(f"[base] {BASE_IMG.name} {base.size} {base.mode}")
    print(f"[crop] box={CROP_BOX} → upscale to {CROP_TARGET_SIZE}")

    kr = compose_kr(base)
    en = compose_en(base)

    kr_size, kr_pv = save_with_preview(kr, OUT_KR, OUT_KR_PREVIEW)
    en_size, en_pv = save_with_preview(en, OUT_EN, OUT_EN_PREVIEW)

    print(f"[kr] saved {OUT_KR.name} size={kr_size} preview={kr_pv}")
    print(f"[en] saved {OUT_EN.name} size={en_size} preview={en_pv}")

    assert kr_size == (1920, 1080), f"KR size mismatch: {kr_size}"
    assert en_size == (1920, 1080), f"EN size mismatch: {en_size}"
    print("[verify] both 1920x1080 OK")


if __name__ == "__main__":
    main()
