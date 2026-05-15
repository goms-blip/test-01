"""Generate hero_frappe_amande_v2.png — different angle/composition."""
import base64, json, os, sys, time, urllib.request

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    sys.exit("OPENAI_API_KEY missing")

OUT = os.path.join(os.path.dirname(__file__), "images", "hero_frappe_amande_v2.png")

PALETTE = (
    "color palette: warm off-white #F4EFE8 surfaces and background tones, "
    "deep midnight Parisian blue #1A2A4F shadows and cloth, a single warm "
    "coral / tangerine #E26B4A as the ONLY saturated accent (a coral "
    "linen napkin and/or coral paper straw). No other saturated colors — "
    "no greens, pinks, purples."
)

STYLE = (
    "modern Parisian editorial summer photography, soft natural seaside "
    "afternoon light from upper-right, long soft shadows, shallow depth of "
    "field, fine grain, slightly desaturated except the coral accent. "
    "Vogue Paris food editorial mood. Drink centered vertically with "
    "generous negative space top and bottom for poster typography overlay. "
    "NO text, NO letters, NO numbers, NO labels, NO logos, NO watermarks."
)

PROMPT = (
    "Dramatic low-angle three-quarter hero shot of a tall slim French "
    "highball glass filled with a Café Frappé Amande: layered iced coffee "
    "with caramel-amber base, large crystal ice cubes clearly visible "
    "through the glass, a generous thick cap of softly whipped almond cream "
    "on top with three sliced toasted almonds and a fine dust of almond "
    "praline. Heavy cold condensation beading down the glass. A long coral "
    "paper striped drinking straw rises out of the glass at a slight angle. "
    "The glass sits at the right side of the frame on a sun-warmed pale "
    "marble cafe terrace; a coral linen napkin loosely folded under the "
    "base. A small porcelain plate with three whole almonds and a tiny "
    "dried almond branch placed at the lower-left foreground, slightly out "
    "of focus. In the background, a soft deep navy blue cloth drape and "
    "blurred bright Mediterranean afternoon sky / horizon line. Portrait "
    "2:3 framing, eye level slightly below the cream cap so the drink "
    "feels tall and inviting. "
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
t0 = time.time()
print("gen: hero_frappe_amande_v2 (1024x1536)", flush=True)
with urllib.request.urlopen(req, timeout=300) as r:
    body = json.loads(r.read())
img = base64.b64decode(body["data"][0]["b64_json"])
with open(OUT, "wb") as f:
    f.write(img)
print(f"  done {len(img)/1024:.0f} KB in {time.time()-t0:.1f}s", flush=True)
