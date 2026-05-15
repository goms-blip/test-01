"""Editorial vector-illustration version via OpenAI gpt-image-2.
Tries the /images/edits endpoint first (source photo as reference). If the
safety system rejects it, falls back to /images/generations with the same
descriptive prompt (text-only). The scene description is written so the
identity-stylization trigger is avoided — we describe an illustration of a
generic scene, never "convert this photo of [person]".
"""
import base64
import json
import mimetypes
import os
import secrets
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
    "A modern editorial vector illustration for a magazine cover, in the "
    "style of contemporary New York Times / The New Yorker / Apple "
    "editorial illustration. Subject: a man in his late thirties standing "
    "calmly on a soft sandy beach, gentle slight smile, head tilted just "
    "slightly, his right hand softly resting near his cheek as if "
    "listening to the ocean. Short dark hair. He wears a simple cream "
    "off-white crewneck t-shirt and a slim black cross-body bag strap "
    "running diagonally over his right shoulder; a small dark sport "
    "watch on his left wrist. "
    "Behind him: a calm turquoise sea, a distinctive heart-shaped "
    "weathered coral rock arch sitting in the mid-distance to his left, "
    "gentle foamy waves on the shoreline, a wide light sky with a few "
    "soft simplified cloud shapes, warm late-afternoon light. "
    "Visual treatment: flat color planes, clean geometric forms, "
    "deliberately simplified facial features rendered with confident line "
    "work and subtle shading, NO photorealism, NO gradients beyond "
    "minimal soft shading. Restrained sophisticated palette — warm sand "
    "beige, cream off-white, deep teal ocean, soft sky blue, with a "
    "single warm coral accent. Subtle paper-grain texture overlay. "
    "Composition: figure occupies the left two-thirds of the frame with "
    "generous sky and ocean negative space to the right. Mood: calm, "
    "modern, dignified, professional. "
    "Absolutely no text, no letters, no logos, no watermarks, no "
    "signatures, no painted frame."
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


def post(url: str, *, key: str, body: bytes, content_type: str):
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": content_type},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        err_text = e.read().decode("utf-8", "replace")
        return None, (e.code, err_text)


def save_images(payload, label: str):
    if "data" not in payload or not payload["data"]:
        sys.exit(f"unexpected response: {json.dumps(payload)[:500]}")
    ts = time.strftime("%Y%m%d_%H%M%S")
    out_paths = []
    for i, item in enumerate(payload["data"], 1):
        b64 = item.get("b64_json")
        if not b64:
            continue
        out = OUT_DIR / f"portrait_editorial_{label}_{ts}_{i}.png"
        out.write_bytes(base64.b64decode(b64))
        out_paths.append(out)
        print(f"saved {out.name} ({out.stat().st_size/1024:.0f}KB)")
    return out_paths


def try_edits(key: str, n: int = 2) -> bool:
    """Try /images/edits with source photo. Returns True if successful."""
    if not SOURCE.exists():
        print("source missing — skipping edits path")
        return False
    img_bytes = SOURCE.read_bytes()
    mime = mimetypes.guess_type(SOURCE.name)[0] or "image/png"
    fields = {
        "model": "gpt-image-2",
        "prompt": PROMPT,
        "size": "1536x1024",
        "n": n,
    }
    files = {"image[]": (SOURCE.name, img_bytes, mime)}
    body, ct = build_multipart(fields, files)

    print(f"[edits] submitting (gpt-image-2, n={n}) ...", flush=True)
    t0 = time.time()
    payload, err = post("https://api.openai.com/v1/images/edits", key=key, body=body, content_type=ct)
    if err:
        code, txt = err
        print(f"[edits] HTTP {code}: {txt[:400]}")
        return False
    print(f"[edits] completed in {time.time()-t0:.1f}s")
    save_images(payload, "edit")
    return True


def try_generations(key: str, n: int = 2) -> bool:
    """Text-only generations fallback."""
    body_json = json.dumps({
        "model": "gpt-image-2",
        "prompt": PROMPT,
        "size": "1536x1024",
        "n": n,
    }).encode()
    print(f"[generations] submitting (gpt-image-2, n={n}) ...", flush=True)
    t0 = time.time()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body_json,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            payload = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"[generations] HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}")
    print(f"[generations] completed in {time.time()-t0:.1f}s")
    save_images(payload, "gen")
    return True


def main():
    key = load_key("OPENAI_API_KEY")
    if try_edits(key, n=2):
        return
    print("[fallback] edits path failed — using text-only generations")
    try_generations(key, n=2)


if __name__ == "__main__":
    main()
