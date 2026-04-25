// Serverless endpoint — deploy to Vercel as /api/generate
//
// Two responsibilities:
//   1. Verify the customer holds an active AI Design Pass via Shopify customer metafield.
//   2. Call OpenAI Images (gpt-image-1) to generate a Polynesian-style tattoo design
//      with a transparent background, and return the image to the browser.
//
// Env vars required at deploy time:
//   OPENAI_API_KEY        — from https://platform.openai.com/api-keys
//   SHOPIFY_STORE_DOMAIN  — e.g. pacifikelements.myshopify.com
//   SHOPIFY_ADMIN_TOKEN   — from a private app with read_customers scope
//
// Why gpt-image-1: it's the only major image model that natively returns a
// transparent PNG (background: "transparent"), which is exactly what we need
// to wrap onto the 3D mannequin's skin without a white box around the design.
//
// Cost (as of 2026-04): roughly $0.04 per high-quality 1024×1024 image.
// A $7.99 unlock with a 50-generation soft cap still leaves healthy margin.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, bodyPart, customerId } = req.body || {};
  if (!prompt || !bodyPart) {
    return res.status(400).json({ error: 'prompt and bodyPart are required' });
  }

  // ---- 1. Entitlement check ---------------------------------------------
  // In production, identify the customer via the Shopify App Proxy signed
  // request (preferred) or a customer access token. For now we accept a
  // customerId from the request body and verify their metafield.
  const entitled = await hasActivePass(customerId);
  if (!entitled) {
    return res.status(402).json({ error: 'No active AI Design Pass' });
  }

  // ---- 2. Build the Polynesian-style prompt ------------------------------
  const fullPrompt = [
    'A traditional Polynesian / Marquesan tattoo design.',
    'Solid black ink only. No color. No shading. No gradients. No realism.',
    `Bold geometric tribal motifs depicting: ${prompt}.`,
    `Composition designed to fit a ${bodyPartToCopy(bodyPart)} placement.`,
    'Flat 2D vector aesthetic, crisp lines, symmetrical, centered.',
    'Use authentic Polynesian elements where appropriate: shark teeth (niho mano),',
    'ocean waves, spearheads, enata figures, tiki faces, sun bursts, turtle shells.',
    'No human, no skin, no body parts shown — just the tattoo design itself.',
  ].join(' ');

  // ---- 3. Call OpenAI Images --------------------------------------------
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: fullPrompt,
        size: sizeFor(bodyPart),
        background: 'transparent',
        quality: 'high',
        n: 1,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'OpenAI error', detail: text });
    }

    const data = await r.json();
    // gpt-image-1 returns base64 in data[0].b64_json
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: 'No image returned' });
    }

    // Return as a data URL so the browser can drop it straight into an <img>
    const url = `data:image/png;base64,${b64}`;
    return res.status(200).json({ url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function bodyPartToCopy(p) {
  return ({
    chest:    'chest panel',
    back:     'full back panel',
    leftArm:  'half-sleeve arm',
    rightArm: 'half-sleeve arm',
    leftLeg:  'thigh band',
    rightLeg: 'thigh band',
  })[p] || 'shoulder';
}

// gpt-image-1 supported sizes: 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape)
function sizeFor(p) {
  if (p === 'chest' || p === 'back') return '1024x1536'; // tall torso panel
  return '1024x1536'; // arms / legs — tall narrow strip
}

// ---------- Shopify entitlement check ----------
async function hasActivePass(customerId) {
  if (!customerId) return false;
  const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-10/customers/${customerId}/metafields.json?namespace=ai_pass`;
  const r = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN }
  });
  if (!r.ok) return false;
  const { metafields = [] } = await r.json();
  const expiresAt = metafields.find(m => m.key === 'expires_at')?.value;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}
