# Deploy guide — getting `/api/generate` live on Vercel

You only need to do this once. After it's live, the front-end (`index.html`) will be able to call your real OpenAI generator.

There are two paths. **Pick the one that matches your setup.**

---

## Path A — All in your browser (no terminal, no installs)

Best if you've never used a code terminal before. ~10 minutes.

### 1. Make a GitHub account (if you don't have one)

Go to **https://github.com/signup** and create a free account. GitHub is just where the code will live so Vercel can read it.

### 2. Create a new empty repository

- Sign in to GitHub
- Click the **+** in the top-right → *New repository*
- Repository name: `pacifik-design-builder`
- Visibility: **Private** *(important — your `vercel.json` and project structure shouldn't be public)*
- Don't add README/license (we already have files)
- Click *Create repository*

### 3. Upload the project files

On the new empty repo page, click **"uploading an existing file"** (the link inside the gray box).

- Open the `pacifik-design-builder` folder on your computer
- Drag **all of these** onto the GitHub upload area:
  - `index.html`
  - `package.json`
  - `vercel.json`
  - `README.md`
  - `DEPLOY.md`
  - the entire `api/` folder (it contains `generate.js`)
  - the `assets/` folder
- Scroll down → *Commit changes*

### 4. Sign up for Vercel

- Go to **https://vercel.com/signup**
- Click **"Continue with GitHub"** (this connects the two accounts)
- Authorize Vercel to read your repos
- Skip team upgrade → use the free Hobby plan

### 5. Import the project

- On the Vercel dashboard, click **"Add New… → Project"**
- You'll see your `pacifik-design-builder` repo → click *Import*
- Framework preset: **Other** (Vercel will auto-detect "no framework")
- Don't change build/output settings — leave defaults
- Click **Environment Variables** to expand it
- Add these one at a time:

| Name                    | Value                                        |
| ----------------------- | -------------------------------------------- |
| `OPENAI_API_KEY`        | *(paste the key you created)*                |
| `SHOPIFY_STORE_DOMAIN`  | `pacifikelements.myshopify.com` *(or your `.myshopify.com` URL)* |
| `SHOPIFY_ADMIN_TOKEN`   | *(leave blank for now — we'll add it when wiring Shopify)* |

- Click *Deploy*

In ~30 seconds you'll get a URL like `https://pacifik-design-builder-abc123.vercel.app`.

### 6. Test the endpoint

Visit `https://YOUR-VERCEL-URL.vercel.app` in your browser — you should see the design builder.

To test the AI flow end-to-end *without* Shopify yet, temporarily edit `api/generate.js` (in GitHub's web editor) and comment out the entitlement check — just for now, so we can confirm OpenAI is reachable. Send me the Vercel URL when you have it and I'll show you the exact line.

---

## Path B — Terminal (Vercel CLI)

Faster if you already have Node.js and are comfortable with a terminal. ~3 minutes.

```bash
cd pacifik-design-builder
npx vercel@latest          # follow prompts: link to your account, accept defaults
npx vercel env add OPENAI_API_KEY production    # paste key when prompted
npx vercel env add SHOPIFY_STORE_DOMAIN production    # type pacifikelements.myshopify.com
npx vercel deploy --prod
```

---

## After deploy — final wire-up

Once Vercel gives you a URL, edit one line in `index.html`:

```js
const API_BASE = 'https://YOUR-VERCEL-URL.vercel.app';
```

Replace `''` with your Vercel URL. (If you're hosting `index.html` *on* the same Vercel project, you can leave it empty — same-origin works.)

Push that one-line change back to GitHub and Vercel auto-redeploys.

---

## Troubleshooting

- **Build fails on Vercel:** Most likely missing `package.json`. Make sure all four root files (`index.html`, `package.json`, `vercel.json`, `README.md`) are at the *top level* of the repo, not inside a subfolder.
- **`/api/generate` returns 402:** That's the entitlement check working — it's saying "no Design Pass." Expected until we wire Shopify.
- **`/api/generate` returns 500:** Check Vercel → your project → Logs. Most common: typo'd or expired `OPENAI_API_KEY`.
- **CORS error in browser console:** Update `vercel.json`'s `Access-Control-Allow-Origin` to match the exact domain serving `index.html` (currently set to `https://www.pacifikelements.com`).
