"""Generate signature_latte_v2.png — different angle/composition."""
import base64, json, os, sys, time, urllib.request

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    sys.exit("OPENAI_API_KEY missing")

OUT = os.path.join(os.path.dirname(__file__), "images", "signature_latte_v2.png")

PALETTE = (
    "strict 3-color palette: off-white paper #F4EFE8 background tones, "
    "deep midnight Parisian blue #1A2A4F as dominant shadow/dark cloth, "
    "muted rose gold #B68A5E as the only metallic accent. "
    "No other hues. No saturated greens, reds, or yellows."
)

PROMPT = (
    "Eye-level side angle close-up of a single Crème d'amande Latte in a "
    "classic French porcelain cup. The latte art rosetta visible from the rim "
    "angle, soft steam wisp rising, a tiny porcelain pitcher of cream half "
    "out of focus behind it, a small porcelain spoon resting on the saucer. "
    "Three whole almonds on a small linen napkin in foreground. Marble cafe "
    "counter, deep blue linen drape softly out of focus in the background. "
    "Premium Parisian boutique cafe aesthetic. "
    + PALETTE +
    " Modern Parisian editorial photography, soft window light, shallow depth "
    "of field, fine grain, slightly desaturated, Vogue Paris food editorial "
    "mood. Square 1:1 composition with generous negative space. "
    "NO text, NO letters, NO numbers, NO labels, NO logos."
)


req = urllib.request.Request(
    "https://api.openai.com/v1/images/generations",
    data=json.dumps({
        "model": "gpt-image-2",
        "prompt": PROMPT,
        "size": "1024x1024",
        "n": 1,
    }).encode(),
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    method="POST",
)
t0 = time.time()
print("gen: signature_latte_v2 (1024x1024)", flush=True)
with urllib.request.urlopen(req, timeout=300) as r:
    body = json.loads(r.read())
img = base64.b64decode(body["data"][0]["b64_json"])
with open(OUT, "wb") as f:
    f.write(img)
print(f"  done {len(img)/1024:.0f} KB in {time.time()-t0:.1f}s", flush=True)
