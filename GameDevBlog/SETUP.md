# Game Dev Log — Free Setup Guide

Everything here is 100% free with no credit card required.

## The Stack
| Part | Service | Cost |
|------|---------|------|
| Site hosting | GitHub Pages | Free forever |
| OAuth backend | Cloudflare Workers | Free (100k req/day) |
| Auth provider | GitHub OAuth App | Free |
| AI features | Anthropic API (your key) | Pay per use |

---

## Step 1 — Create a GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - **Application name**: `Game Dev Log`
   - **Homepage URL**: `https://YOURNAME.github.io/YOURREPO`
   - **Authorization callback URL**: `https://YOURNAME.github.io/YOURREPO/`
4. Click **Register application**
5. Copy your **Client ID** — you'll need it in Step 3
6. Click **Generate a new client secret** — copy it, you only see it once

---

## Step 2 — Deploy the Cloudflare Worker (free)

1. Sign up free at https://workers.cloudflare.com (no credit card)
2. Go to **Workers & Pages** → **Create** → **Create Worker**
3. Replace the default code with the contents of `cloudflare-worker/worker.js`
4. Click **Deploy**
5. Go to **Settings** → **Variables** and add these **secrets**:
   - `GITHUB_CLIENT_ID` = your Client ID from Step 1
   - `GITHUB_CLIENT_SECRET` = your Client Secret from Step 1
   - `ALLOWED_ORIGIN` = `https://YOURNAME.github.io`
6. Copy your Worker URL — it looks like `https://gamedev-blog-auth.YOURNAME.workers.dev`

---

## Step 3 — Configure the site

Open `js/auth.js` and fill in the three constants at the top:

```js
const GITHUB_CLIENT_ID    = 'abc123...';                          // from Step 1
const ALLOWED_GITHUB_USER = 'yourGitHubUsername';                 // your exact login
const TOKEN_EXCHANGE_URL  = 'https://gamedev-blog-auth.yourname.workers.dev'; // from Step 2
```

---

## Step 4 — Deploy to GitHub Pages

1. Create a new GitHub repo (public or private — Pages works on both)
2. Push this whole folder to the repo's `main` branch
3. Go to repo **Settings** → **Pages** → Source: `main` branch, `/ (root)`
4. Your site is live at `https://YOURNAME.github.io/YOURREPO/`

---

## Using the blog

**Public visitors** see:
- The post feed, search, category filter
- Individual post pages with embedded media and file downloads
- A small "Owner Login" button at the bottom of the sidebar (invisible until hovered)

**You (logged in)** see:
- Full admin panel at `/admin.html`
- Create / edit / delete posts
- Rich editor with image embed, YouTube/Vimeo embed, file attachments
- AI Assist (needs your Anthropic API key in Settings)
- Theme switcher

**Login flow:**
1. Click "Owner Login" in the sidebar
2. Small popup appears → click "Continue with GitHub"
3. GitHub asks to authorize → approve
4. You're redirected back and taken straight to the admin panel
5. Session lasts until you close the tab

---

## Adding your Anthropic API key

1. Log in to the admin panel
2. Go to **Settings**
3. Paste your `sk-ant-...` key — it's stored only in your browser's localStorage
4. The AI Assist tab will now work
