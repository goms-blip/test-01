"""Stylize source.jpg into a Studio Ghibli-style anime illustration via gpt-image-2 (image edits)."""
import base64
import json
import mimetypes
import os
import secrets
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]  # repo root
ENV_FILE = ROOT / "week-7" / "Quest" / "New_Menu_Poster" / ".env"
SOURCE = HERE / "source_resized.png"
OUT_DIR = HERE / "output"
OUT_DIR.mkdir(exist_ok=True)


def load_api_key() -> str:
    if (k := os.environ.get("OPENAI_API_KEY")):
        return k
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith("OPENAI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("OPENAI_API_KEY not found")


PROMPT = (
    "A hand-painted anime illustration in the warm, peaceful style of a "
    "Studio Ghibli summer film. A friendly traveler character stands on a "
    "soft Okinawa beach in the warm afternoon light, gently smiling with "
    "his head tilted just slightly, his right hand softly resting near his "
    "cheek as if listening to the ocean. He wears a simple white crewneck "
    "cotton t-shirt and a slim black cross-body bag strap over one "
    "shoulder, with a dark sport watch on his wrist. Behind him stretches "
    "a calm turquoise sea with gentle foamy waves, a distinctive "
    "heart-shaped weathered coral rock arch sitting peacefully in the "
    "mid-distance to one side, and a wide bright sky filled with soft "
    "painterly cumulus clouds. "
    "Render in the classic Hayao Miyazaki / Ghibli hand-painted animation "
    "cel look: soft watercolor washes, visible brush texture on the clouds "
    "and sea, gentle painterly highlights, simple expressive line work, "
    "warm natural sunlight from the upper left with a soft rim light on "
    "the cheek and shoulder, vibrant yet never oversaturated colors. The "
    "mood is calm, nostalgic, quietly happy — a still frame from a "
    "peaceful Ghibli seaside scene. Clean composition with the character "
    "occupying the left two-thirds of the frame and generous sky and ocean "
    "negative space on the right. "
    "No text, no letters, no logos, no watermarks, no signatures."
)


def build_multipart(fields: dict, files: dict) -> tuple[bytes, str]:
    boundary = "----formdata-" + secrets.token_hex(16)
    sep = f"--{boundary}\r\n".encode()
    end = f"--{boundary}--\r\n".encode()
    body = bytearray()
    for k, v in fields.items():
        body += sep
        body += f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode()
        body += str(v).encode() + b"\r\n"
    for name, (filename, data, mime) in files.items():
        body += sep
        body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        body += f"Content-Type: {mime}\r\n\r\n".encode()
        body += data + b"\r\n"
    body += end
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def main():
    api_key = load_api_key()
    if not SOURCE.exists():
        sys.exit(f"missing source: {SOURCE}")

    img_bytes = SOURCE.read_bytes()
    mime = mimetypes.guess_type(SOURCE.name)[0] or "image/jpeg"

    fields = {
        "model": "gpt-image-2",
        "prompt": PROMPT,
        "size": "1536x1024",
        "n": 1,
    }
    files = {"image[]": (SOURCE.name, img_bytes, mime)}
    body, content_type = build_multipart(fields, files)

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/edits",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": content_type,
        },
        method="POST",
    )

    print(f"requesting (image size: {len(img_bytes)/1024:.0f}KB)...", flush=True)
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        sys.exit(f"HTTP {e.code}: {err_body}")

    elapsed = time.time() - t0
    if "data" not in payload or not payload["data"]:
        sys.exit(f"unexpected response: {json.dumps(payload)[:500]}")

    b64 = payload["data"][0].get("b64_json")
    if not b64:
        sys.exit(f"no b64_json in response: {json.dumps(payload)[:500]}")

    ts = time.strftime("%Y%m%d_%H%M%S")
    out = OUT_DIR / f"portrait_ghibli_{ts}.png"
    out.write_bytes(base64.b64decode(b64))
    print(f"saved {out} ({out.stat().st_size/1024:.0f}KB) in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
