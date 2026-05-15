"""Generate hero image for Café Frappé Amande summer poster."""
import base64, json, os, sys, time, urllib.request

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    sys.exit("OPENAI_API_KEY missing")

OUT_DIR = os.path.join(os.path.dirname(__file__), "images")
os.makedirs(OUT_DIR, exist_ok=True)

PALETTE = (
    "color palette: warm off-white #F4EFE8 background tones, deep midnight "
    "Parisian blue #1A2A4F shadows and cloth, a single warm coral / "
    "tangerine #E26B4A as the ONLY saturated accent (a small ripe peach "
    "half, a thin coral linen ribbon, or a coral straw). No other "
    "saturated colors — no green leaves, no pink, no purple."
)

STYLE = (
    "modern Parisian editorial summer photography, soft natural seaside "
    "morning window light, gentle shadow falling left-to-right, shallow "
    "depth of field, marble cafe counter, fine grain, slightly desaturated "
    "except the coral accent. Vogue Paris food editorial mood. Composition "
    "should leave clean negative space on the top quarter and bottom quarter "
    "for poster typography overlay. NO text, NO letters, NO numbers, NO "
    "labels, NO logos. NO watermarks."
)

PROMPT = (
    "Hero shot of a tall slim French highball glass filled with a Café "
    "Frappé Amande: layered iced coffee with caramel-amber base, large "
    "crystal-clear ice cubes visible through the glass, a thick cap of "
    "softly whipped almond cream on top, three sliced toasted almonds "
    "garnishing the cream, fine dust of almond praline. Cold condensation "
    "drops beading on the glass surface. A single coral linen napkin "
    "casually placed under the glass on a pale marble surface. Two whole "
    "almonds and a tiny dried almond branch resting beside. Deep blue "
    "linen drape softly out of focus in the background, hint of bright "
    "Mediterranean horizon light. Eye-level slight tilt-down angle, "
    "portrait 2:3 framing with the drink centered and occupying about 60% "
    "of the frame height. "
    + PALETTE + " " + STYLE
)

req = urllib.request.Request(
    "https://api.openai.com/v1/images/generations",
    data=json.dumps({
        "model": "gpt-image-2",
        "prompt": PROMPT,
        "size": "1024x1536",
        "n": 1,
    }).encode(),
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    method="POST",
)
out_path = os.path.join(OUT_DIR, "hero_frappe_amande.png")
t0 = time.time()
print(f"gen: hero_frappe_amande (1024x1536)", flush=True)
with urllib.request.urlopen(req, timeout=300) as r:
    body = json.loads(r.read())
img = base64.b64decode(body["data"][0]["b64_json"])
with open(out_path, "wb") as f:
    f.write(img)
print(f"  done {len(img)/1024:.0f} KB in {time.time()-t0:.1f}s", flush=True)
