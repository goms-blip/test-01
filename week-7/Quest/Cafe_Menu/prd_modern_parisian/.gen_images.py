"""Generate Modern Parisian Editorial assets with gpt-image-2.
Reads OPENAI_API_KEY from env. Writes PNGs into ./images/.
Does NOT log the API key.
"""
import base64, json, os, sys, time, urllib.request

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    sys.exit("OPENAI_API_KEY missing in env")

OUT = os.path.join(os.path.dirname(__file__), "images")
os.makedirs(OUT, exist_ok=True)

PALETTE = (
    "strict 3-color palette: off-white paper #F4EFE8 background, "
    "deep midnight Parisian blue #1A2A4F as dominant shadow/contrast, "
    "muted rose gold #B68A5E as the only metallic accent. "
    "No other hues. No saturated greens, reds, or yellows."
)

STYLE = (
    "modern Parisian editorial magazine photography, soft natural window light, "
    "shallow depth of field, marble or linen surface, minimal styling, "
    "premium boutique cafe aesthetic, fine grain, slightly desaturated, "
    "Vogue Paris food editorial mood. Square 1:1 composition with generous negative space. "
    "NO text, NO letters, NO numbers, NO labels, NO logos in the image."
)

JOBS = [
    {
        "name": "signature_latte",
        "size": "1024x1024",
        "prompt": (
            "Hero overhead-angled shot of a single Crème d'amande Latte: a porcelain "
            "cup of latte with a delicate rosetta art on cream foam, three whole "
            "almonds and a tiny porcelain saucer beside it, faint dust of almond "
            "praline. A single dried almond blossom branch on the side. "
            f"{PALETTE} {STYLE}"
        ),
    },
    {
        "name": "cat_cafes",
        "size": "1024x1024",
        "prompt": (
            "Still life of an espresso cup beside antique brass coffee tools on "
            "linen. Minimal, monastic, very Parisian. "
            f"{PALETTE} {STYLE}"
        ),
    },
    {
        "name": "cat_boissons",
        "size": "1024x1024",
        "prompt": (
            "Two slim crystal glasses with iced sparkling beverages on a marble "
            "tray, a single sprig of dried lavender, deep blue shadow. "
            f"{PALETTE} {STYLE}"
        ),
    },
    {
        "name": "cat_patisseries",
        "size": "1024x1024",
        "prompt": (
            "Single canelé and a small almond financier on a tiny round porcelain "
            "plate, fine grain, soft light, French patisserie counter aesthetic. "
            f"{PALETTE} {STYLE}"
        ),
    },
]


def call_image(prompt: str, size: str) -> bytes:
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=json.dumps({
            "model": "gpt-image-2",
            "prompt": prompt,
            "size": size,
            "n": 1,
        }).encode(),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        body = json.loads(r.read())
    return base64.b64decode(body["data"][0]["b64_json"])


for job in JOBS:
    out_path = os.path.join(OUT, f"{job['name']}.png")
    if os.path.exists(out_path) and os.path.getsize(out_path) > 10_000:
        print(f"skip (exists): {job['name']}")
        continue
    t0 = time.time()
    print(f"gen: {job['name']} ({job['size']})", flush=True)
    img = call_image(job["prompt"], job["size"])
    with open(out_path, "wb") as f:
        f.write(img)
    print(f"  done {len(img)/1024:.0f} KB in {time.time()-t0:.1f}s", flush=True)

print("ALL DONE")
