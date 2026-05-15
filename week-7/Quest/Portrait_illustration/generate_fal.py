"""Stylize source_resized.png into a Ghibli-style illustration via fal.ai Flux image-to-image.
Fallback path because OpenAI gpt-image-2 safety blocks real-person → anime style transfer.
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


PROMPT = (
    "Painterly oil-on-canvas seaside portrait. Visible thick oil brush "
    "strokes everywhere, impasto texture on the skin and clothing, palette "
    "knife marks on the sea and clouds, woven linen canvas grain visible "
    "through the paint. Loose painterly handling — NOT photorealistic, NOT "
    "a photograph, NOT a photo filter. Skin tones built from layered warm "
    "and cool brush strokes, the cheek catches a buttery highlight, the "
    "shadow side reads as cool violet-grey paint. Hair is suggested with "
    "confident dark brushstrokes rather than individual strands. The white "
    "t-shirt is painted with bold visible strokes of warm and cool whites, "
    "the black bag strap and wristwatch as decisive dark accents. Behind "
    "him the turquoise ocean is rendered in choppy horizontal palette-knife "
    "strokes; the distinctive heart-shaped weathered coral rock arch sits "
    "in the mid-distance painted with confident chunky brushwork; the wide "
    "sky is loose impressionist cumulus clouds with visible brush texture. "
    "Faithfully preserve the real facial features, age, expression, "
    "hairstyle, body proportions, pose and clothing of the reference person "
    "— only the medium transforms from photograph to oil painting. Warm "
    "late-afternoon sunlight from the upper-left, gentle rim light on the "
    "cheek and shoulder. Modern fine-art editorial portrait in the spirit "
    "of John Singer Sargent's plein-air looseness combined with "
    "contemporary Korean oil painters. Restrained palette, dignified mood. "
    "No text, no letters, no logos, no watermarks, no signatures, no "
    "painted frame."
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
        sys.exit(f"HTTP {e.code} on {method} {url}: {e.read().decode('utf-8', 'replace')[:600]}")


def run_one(key: str, data_uri: str, strength: float, n: int = 2):
    payload = {
        "image_url": data_uri,
        "prompt": PROMPT,
        "strength": strength,
        "num_inference_steps": 50,
        "guidance_scale": 4.2,
        "image_size": "landscape_4_3",
        "num_images": n,
        "enable_safety_checker": True,
    }
    print(f"submit strength={strength} n={n} ...", flush=True)
    submit = http(
        "POST",
        "https://queue.fal.run/fal-ai/flux/dev/image-to-image",
        key=key,
        json_body=payload,
    )
    request_id = submit.get("request_id")
    status_url = submit.get("status_url") or f"https://queue.fal.run/fal-ai/flux/requests/{request_id}/status"
    result_url = submit.get("response_url") or f"https://queue.fal.run/fal-ai/flux/requests/{request_id}"
    t0 = time.time()
    for _ in range(120):
        time.sleep(2.5)
        st = http("GET", status_url, key=key)
        status = st.get("status")
        if status == "COMPLETED":
            break
        if status in ("FAILED", "ERROR"):
            sys.exit(f"job failed: {json.dumps(st)[:600]}")
    else:
        sys.exit("timeout waiting for job")
    print(f"  done in {time.time()-t0:.0f}s", flush=True)

    result = http("GET", result_url, key=key)
    images = result.get("images") or []
    ts = time.strftime("%Y%m%d_%H%M%S")
    saved = []
    for i, img in enumerate(images, 1):
        url = img.get("url")
        if not url:
            continue
        png = http("GET", url, key=key, raw=True)
        out = OUT_DIR / f"portrait_painting_s{int(strength*100)}_{ts}_{i}.png"
        out.write_bytes(png)
        print(f"  saved {out.name} ({out.stat().st_size/1024:.0f}KB)")
        saved.append(out)
    return saved


def main():
    key = load_key("FAL_KEY")
    if not SOURCE.exists():
        sys.exit(f"missing source: {SOURCE}")

    mime = mimetypes.guess_type(SOURCE.name)[0] or "image/png"
    b64 = base64.b64encode(SOURCE.read_bytes()).decode()
    data_uri = f"data:{mime};base64,{b64}"

    # Two passes for comparison: 0.65 = strong face preservation + visible painterly,
    # 0.75 = more pronounced brushwork at slight cost of likeness.
    run_one(key, data_uri, 0.65, n=2)
    run_one(key, data_uri, 0.75, n=2)


if __name__ == "__main__":
    main()
