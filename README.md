# Pacifik Elements — AI Design Builder

A 3D mannequin tattoo previewer for pacifikelements.com. Customers drag Polynesian motifs onto a live, rotating 3D figure and (after paying a small unlock fee) generate fresh designs from a text prompt.

## What's in this folder

```
pacifik-design-builder/
├── index.html          ← the working v1 demo (open in any modern browser)
├── README.md           ← this file
└── assets/
    └── motifs/         ← drop your real Polynesian design PNG/SVGs here later
```

`index.html` is fully self-contained — Three.js loads from a CDN, motifs are drawn procedurally, the AI generator is currently mocked locally. Open it in Chrome/Safari and you get the real experience.

## What works right now (no setup)

- Rotatable 3D mannequin with separate texture regions for chest, back, left/right arm, left/right leg
- Library of 8 procedural Polynesian motifs (shark teeth, waves, sun burst, tiki, spearheads, turtle shell, enata, frigate bird)
- Click a motif → applied to the currently selected body region
- Sliders to scale, rotate, and offset the design within the region
- Save Look → downloads a PNG snapshot of the mannequin
- Paywall modal demo: clicking "Unlock" enables the AI Generate panel (currently returns a procedural placeholder)

## What's still mocked (and exactly how to make it real)

### 1. Replace procedural motifs with your real designs

Drop transparent PNGs into `assets/motifs/` and edit the `motifs` array near the top of the `<script>` in `index.html`:

```js
const motifs = [
  { id: 'sharkTeeth', name: 'Shark Teeth', svg: null, src: 'assets/motifs/shark-teeth.png' },
  // ...
];
```

Then update the `<div class="motif">` render loop to use `<img src=...>` when `m.src` is provided, and update `applyToActivePart()` to load the PNG directly instead of converting an SVG string. (Five-line change — happy to do it the moment you upload reference designs.)

### 2. Wire the paywall to Shopify

The flow:

1. Create a Shopify product called **"AI Design Pass"** ($7.99, digital, no shipping).
2. When the customer clicks "Unlock for $7.99," redirect to `/cart/add?id={VARIANT_ID}&return_to=/pages/design-builder` then on to checkout.
3. After successful purchase, Shopify's order webhook fires your serverless endpoint, which writes a `customer.metafield` named `ai_pass.expires_at` = now + 24h.
4. On page load, the builder fetches `/apps/pacifik/entitlement` — if the metafield is present and unexpired, `aiUnlocked = true` from the start.

In `index.html`, the only spot that needs editing is the `payBtn` click handler (it's the line that just sets `aiUnlocked = true`).

### 3. Wire AI Generate to a real model (OpenAI)

The `mockGenerate(prompt)` function is the only part you need to replace. In production it becomes a `fetch()` to a serverless endpoint you control:

```js
async function realGenerate(prompt, bodyPart) {
  const r = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt, bodyPart })
  });
  if (!r.ok) throw new Error(await r.text());
  const { url } = await r.json();
  return url; // data:image/png;base64,... — drops straight into an <img>
}
```

The serverless endpoint (`api/generate.js`, deploys to Vercel/Cloudflare free tier) does three things:

1. Verifies the customer's `ai_pass.expires_at` Shopify metafield is in the future.
2. Builds a Polynesian-style prompt template (see the file for the full text — solid black ink, no realism, traditional motifs like niho mano / shark teeth, enata, tiki, etc.).
3. Calls **OpenAI's `gpt-image-1`** with `background: "transparent"` so the tattoo wraps cleanly onto the mannequin without a white box around it.

**Cost:** ~$0.04 per high-quality 1024×1536 image. A $7.99 unlock with even a generous 50-generation soft cap leaves $5.99 of margin per pass.

### 4. Embed in your Shopify theme

Two clean options:

**Option A — Theme app extension (recommended).** Build a tiny Shopify app whose only job is to register an embedded block. Merchants drag the "AI Design Builder" block onto any page; the block renders an `<iframe>` pointing at `https://your-domain.com/builder` (this `index.html` deployed to Vercel).

**Option B — Page embed.** Create a Shopify page called "Design Builder" and paste the `index.html` content directly into the rich text editor's HTML view. Simpler but harder to update.

## Cost estimate (all under $500 for v1)

| Item                                       | Cost          |
| ------------------------------------------ | ------------- |
| Vercel hosting (free tier)                 | $0            |
| OpenAI Images credits (starter)            | $10–25        |
| Shopify (you already pay)                  | —             |
| Domain/SSL (already covered by Shopify)    | —             |
| Optional: nicer 3D mannequin GLTF asset    | $0–60 on Sketchfab |

Total: well under your $500 cap. Per-generation cost is ~$0.003–0.04 depending on model — the $7.99 pass covers a ton of generations with margin.

## How to test the demo right now

Open `index.html` in your browser. Try:

1. Click "Chest" in the right panel, then click "Shark Teeth" in the left panel
2. Drag the mannequin to rotate it; scroll to zoom
3. Move the Scale / Rotation / Offset sliders
4. Click "Right Arm," click "Ocean Waves" — different region, different design
5. Click the orange "🔒 Unlock AI Generate" button up top → click "Unlock for $7.99" → type a prompt and hit Generate (placeholder pattern for now)
6. Click "Save Look" to download a PNG of your mannequin

## Next steps when you're ready

- [ ] Send me 5–15 of your real Polynesian designs as transparent PNGs (or even just JPGs from your existing site)
- [ ] Get an OpenAI API key (https://platform.openai.com/api-keys) and add $10–20 of prepaid credit
- [ ] Decide on the unlock price ($7.99 is a guess — could be $4.99 or $14.99)
- [ ] I'll then deploy `/api/generate.js` to Vercel, wire the entitlement check, and build a Shopify theme block to embed it

That's v1. Later we can talk about: photoreal mannequin (custom GLTF + skin shader), face/torso scanning so customers see *their own* body, AR preview on mobile via WebXR, and saving designs to a Shopify customer account for tattooist consultations.
