"""Stylize source into oil-painted portrait via fal-ai/flux-pro/kontext.
Kontext is an instruction-based image-editing model — far better at "keep the
person and scene, only change the medium" than img2img with strength tuning.
"""
import base64
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ENV_FILE = ROOT / "week-7" / "Quest" / "New_Menu_Poster" / ".env"
SOURCE = HERE / "source_resized.png"
OUT_DIR = HERE / "output"
OUT_DIR.mkdir(exist_ok=True)


def load_key(name: str) -> str:
    if (v := os.environ.get(name)):
        return v
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{name} not found")


INSTRUCTION = (
    "Transform this photograph into a hand-painted oil-on-canvas portrait "
    "with visible thick brushstrokes, impasto paint texture, and woven "
    "canvas grain. The skin should be built from layered warm and cool "
    "brushstrokes rather than smooth photographic gradients; the hair "
    "rendered as confident loose dark strokes; the white t-shirt painted "
    "with bold visible strokes of warm and cool whites; the ocean and sky "
    "rendered with looser plein-air impressionist palette-knife marks; the "
    "clouds painted with soft chunky brushwork. Warm late-afternoon "
    "sunlight from the upper-left, gentle rim light on the cheek and "
    "shoulder. Modern fine-art editorial portrait inspired by John Singer "
    "Sargent's plein-air looseness. CRITICAL: preserve the subject's exact "
    "facial features, identity, age, expression, hairstyle, clothing "
    "(white t-shirt with black cross-body bag strap), the dark sport watch "
    "on the wrist, pose, and the seaside composition with the heart-shaped "
    "weathered coral rock formation unchanged. The transformation is only "
    "of the medium — from photograph to oil painting. No text, no letters, "
    "no signature, no painted frame."
)


def http(method: str, url: str, *, key: str, json_body=None, raw=False):
    data = json.dumps(json_body).encode() if json_body is not None else None
    headers = {"Authorization": f"Key {key}"}
    if json_body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            body = resp.read()
            return body if raw else json.loads(body)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} on {method} {url}: {e.read().decode('utf-8', 'replace')[:700]}")


def main():
    key = load_key("FAL_KEY")
    if not SOURCE.exists():
        sys.exit(f"missing source: {SOURCE}")

    mime = mimetypes.guess_type(SOURCE.name)[0] or "image/png"
    b64 = base64.b64encode(SOURCE.read_bytes()).decode()
    data_uri = f"data:{mime};base64,{b64}"

    payload = {
        "image_url": data_uri,
        "prompt": INSTRUCTION,
        "guidance_scale": 4.5,
        "num_images": 2,
        "safety_tolerance": "5",
        "output_format": "png",
        "aspect_ratio": "4:3",
    }

    endpoint = "https://queue.fal.run/fal-ai/flux-pro/kontext"
    print("submitting to flux-pro/kontext ...", flush=True)
    submit = http("POST", endpoint, key=key, json_body=payload)
    request_id = submit.get("request_id")
    status_url = submit.get("status_url") or f"{endpoint}/requests/{request_id}/status"
    result_url = submit.get("response_url") or f"{endpoint}/requests/{request_id}"
    print(f"  request_id={request_id}")

    t0 = time.time()
    for _ in range(120):
        time.sleep(2.5)
        st = http("GET", status_url, key=key)
        status = st.get("status")
        print(f"  status={status} (+{time.time()-t0:.0f}s)", flush=True)
        if status == "COMPLETED":
            break
        if status in ("FAILED", "ERROR"):
            sys.exit(f"job failed: {json.dumps(st)[:700]}")
    else:
        sys.exit("timeout waiting for job")

    result = http("GET", result_url, key=key)
    images = result.get("images") or ([result["image"]] if "image" in result else [])
    if not images:
        sys.exit(f"no images in result: {json.dumps(result)[:700]}")

    ts = time.strftime("%Y%m%d_%H%M%S")
    for i, img in enumerate(images, 1):
        url = img.get("url") if isinstance(img, dict) else img
        if not url:
            continue
        png = http("GET", url, key=key, raw=True)
        out = OUT_DIR / f"portrait_kontext_oil_{ts}_{i}.png"
        out.write_bytes(png)
        print(f"saved {out.name} ({out.stat().st_size/1024:.0f}KB)")


if __name__ == "__main__":
    main()
