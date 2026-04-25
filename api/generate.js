// Serverless endpoint — deploy to Vercel as /api/generate
//
// Two responsibilities:
//   1. Verify the customer holds an active AI Design Pass via Shopify customer
//      metafield, OR accept an explicit demo flow when Shopify isn't wired up.
//   2. Call OpenAI Images (gpt-image-1) to generate a Polynesian-style tattoo
//      design with a transparent background, and return it to the browser.
//
// Env vars at deploy time:
//   OPENAI_API_KEY         — required, from https://platform.openai.com/api-keys
//   SHOPIFY_STORE_DOMAIN   — optional. If set, real customer entitlement is checked.
//   SHOPIFY_ADMIN_TOKEN    — optional. Required when SHOPIFY_STORE_DOMAIN is set.
//   ALLOW_DEMO             — optional. Defaults to "1". Set to "0" once Shopify is
//                            live to disable the demo bypass entirely.
//
// Why gpt-image-1: it natively returns transparent PNGs, exactly what we need
// for wrapping a tattoo onto the 3D mannequin without a white background box.

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const ALLOW_DEMO     = (process.env.ALLOW_DEMO ?? '1') === '1';
const SHOPIFY_LIVE   = Boolean(SHOPIFY_DOMAIN && SHOPIFY_TOKEN);

export default async function handler(req, res) {
  // CORS — allow the live shop front-end and any vercel.app preview.
  const origin = req.headers.origin || '';
  if (
    origin === 'https://www.pacifikelements.com' ||
    origin === 'https://pacifikelements.com'      ||
    origin.endsWith('.vercel.app')
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-demo-pass');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, bodyPart, customerId } = req.body || {};
  if (!prompt || !bodyPart) {
    return res.status(400).json({ error: 'prompt and bodyPart are required' });
  }

  // ---- 1. Entitlement -------------------------------------------------
  //
  // Three accept paths:
  //   a) Shopify is wired up AND the customer's ai_pass.expires_at is in the future.
  //   b) Shopify isn't wired up yet AND ALLOW_DEMO=1 — accept everything (testing mode).
  //   c) Client sent the demo header AND ALLOW_DEMO=1 — accept (the unlock-button flow).
  const demoHeader = (req.headers['x-demo-pass'] || '').toString().trim() === '1';
  const entitled =
    (SHOPIFY_LIVE && await hasActivePass(customerId)) ||
    (ALLOW_DEMO && (!SHOPIFY_LIVE || demoHeader));

  if (!entitled) {
    return res.status(402).json({ error: 'No active AI Design Pass' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing OPENAI_API_KEY' });
  }

  // ---- 2. Build the Polynesian-style prompt ---------------------------
  const fullPrompt = [
    'A traditional Polynesian / Marquesan tattoo design.',
    'Solid black ink only. No color. No shading. No gradients. No photorealism.',
    `Bold geometric tribal motifs depicting: ${prompt}.`,
    `Composition designed to fit a ${bodyPartToCopy(bodyPart)} placement.`,
    'Flat 2D vector aesthetic, crisp lines, symmetrical, centered.',
    'Use authentic Polynesian elements where appropriate: shark teeth (niho mano),',
    'ocean waves, spearheads, enata figures, tiki faces, sun bursts, turtle shells,',
    'koru spirals, manaia guardians, frigate birds.',
    'No human, no skin, no body parts shown — just the tattoo design itself.',
  ].join(' ');

  // ---- 3. Call OpenAI Images ------------------------------------------
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      'gpt-image-1',
        prompt:     fullPrompt,
        size:       sizeFor(bodyPart),
        background: 'transparent',
        quality:    'high',
        n:          1,
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'OpenAI error', detail: text });
    }

    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: 'No image returned' });

    return res.status(200).json({ url: `data:image/png;base64,${b64}` });
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

function sizeFor(p) {
  // gpt-image-1 supports 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape).
  // Tattoos read best as portrait strips for arms/legs and torso panels.
  return '1024x1536';
}

// ---- Shopify entitlement check (only used when fully wired up) -------
async function hasActivePass(customerId) {
  if (!SHOPIFY_LIVE || !customerId) return false;
  try {
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/2024-10/customers/${customerId}/metafields.json?namespace=ai_pass`;
    const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
    if (!r.ok) return false;
    const { metafields = [] } = await r.json();
    const expiresAt = metafields.find(m => m.key === 'expires_at')?.value;
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now();
  } catch {
    return false;
  }
}

export const config = { maxDuration: 60 };
