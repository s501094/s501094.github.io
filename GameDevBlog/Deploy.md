# Game Dev Log — Full Deployment Guide

This guide walks you through every single step to get your blog live on GitHub Pages. No experience needed — every action is described in plain language with screenshots described at each stage so you know what you're looking for.

**Total time:** About 20–30 minutes.
**Total cost:** $0. Everything used here has a free tier that never expires.

---

## What You're Setting Up

Before diving in, here's a plain-English picture of what the finished system looks like:

```
Visitors open your site
        │
        ▼
GitHub Pages serves your blog files
(index.html, css, js — all the code you have)
        │
        ├─── Visitors browse posts (no login needed)
        │
        └─── You click "Owner Login"
                    │
                    ▼
             GitHub asks "is this really you?"
                    │
                    ▼
             Cloudflare Worker secretly handles
             the identity verification
                    │
                    ▼
             You land on admin.html
             (create, edit, delete posts + AI Assist)
```

The three services you'll use:
| Service | What it does | Cost |
|---|---|---|
| **GitHub** | Stores your code AND hosts the website | Free forever |
| **Cloudflare Workers** | A tiny server that handles login securely | Free (100k logins/day) |
| **Anthropic** | Powers the AI Assist feature | Pay-per-use (very cheap) |

---

## Before You Start — Things You'll Need

- A **GitHub account** (free at github.com — you probably already have one)
- A **Cloudflare account** (free at cloudflare.com — takes 2 minutes to create)
- The **blog files** from this project (all the HTML, CSS, JS files)
- **Git installed** on your computer (check by opening Terminal and typing `git --version`)
  - If you don't have Git: download it at https://git-scm.com/downloads
- A **code editor** to edit one file (VS Code is free at code.visualstudio.com)

---

## PART 1 — Create Your GitHub Repository

A "repository" (or "repo") is just a folder on GitHub that stores your code and tracks its history.

### Step 1.1 — Create a new repository on GitHub

1. Go to **https://github.com** and sign in
2. Click the **green "New"** button on the left sidebar (or go to github.com/new)
3. Fill in the form:
   - **Repository name:** Type something like `gamedev-blog` or `devlog`
     - This becomes part of your URL: `https://yourname.github.io/gamedev-blog`
     - Use lowercase letters and hyphens only (no spaces)
   - **Description:** Optional — something like "My indie game dev blog"
   - **Public or Private:** Choose either — GitHub Pages works on both
   - **Do NOT check** "Add a README file" or any other checkboxes
4. Click **"Create repository"**

You'll land on an empty repo page. Leave this tab open — you'll come back to it.

### Step 1.2 — Set up the files on your computer

Open **Terminal** (Mac/Linux) or **Command Prompt / PowerShell** (Windows).

Navigate to wherever you want to keep the project:
```bash
cd Desktop
# or wherever you prefer, e.g. cd Documents/projects
```

Create a new folder and move your blog files into it:
```bash
mkdir gamedev-blog
cd gamedev-blog
```

Now copy all your blog files into this folder. Your folder structure should look like this before continuing:
```
gamedev-blog/
├── index.html
├── admin.html
├── SETUP.md
├── css/
│   ├── themes.css
│   ├── style.css
│   └── admin.css
├── js/
│   ├── store.js
│   ├── auth.js
│   ├── themes.js
│   ├── markdown.js
│   ├── ai.js
│   ├── public.js
│   ├── admin.js
│   └── app.js
└── cloudflare-worker/
    ├── worker.js
    └── wrangler.toml
```

---

## PART 2 — Create Your GitHub OAuth App

This is what lets GitHub verify your identity when you log in. Think of it as registering your blog with GitHub so GitHub knows it's allowed to ask "is this person really who they say they are?"

### Step 2.1 — Open the OAuth Apps settings

1. On GitHub, click your **profile picture** in the top-right corner
2. Click **"Settings"** in the dropdown
3. Scroll down the left sidebar and click **"Developer settings"** (it's near the bottom)
4. Click **"OAuth Apps"** in the left sidebar
5. Click the **"New OAuth App"** button

### Step 2.2 — Fill in the OAuth App form

You'll see a form with four fields. Fill them in exactly like this:

- **Application name:**
  ```
  Game Dev Log
  ```
  (This is just a label — you'll see it when GitHub asks you to approve the login)

- **Homepage URL:**
  ```
  https://YOURNAME.github.io/YOURREPO
  ```
  Replace `YOURNAME` with your actual GitHub username and `YOURREPO` with the repository name you chose in Step 1.1.

  Example: If your username is `ty` and your repo is `gamedev-blog`:
  ```
  https://ty.github.io/gamedev-blog
  ```

- **Application description:** Leave this blank (optional)

- **Authorization callback URL:**
  ```
  https://YOURNAME.github.io/YOURREPO/
  ```
  This is the SAME as the homepage URL above — just make sure it has a trailing slash `/` at the end.

  Example:
  ```
  https://ty.github.io/gamedev-blog/
  ```

Click **"Register application"**.

### Step 2.3 — Save your Client ID and generate a Client Secret

After registering, you'll land on your OAuth App's settings page.

1. **Copy your Client ID** — it looks like `Ov23liABCDEF123456`
   - Save it somewhere safe (a notes app, text file, etc.)
   - This is NOT a secret — it's safe to put in your code

2. Click **"Generate a new client secret"**
   - GitHub may ask for your password — enter it
   - A long string appears. **Copy it immediately** — GitHub will never show it again
   - It looks like: `abc123def456ghi789jkl012mno345pqr678stu901`
   - Keep this VERY safe — anyone with this can impersonate your app

> ⚠️ **Important:** If you lose the client secret, you'll need to generate a new one. The old one stops working. That's fine, just inconvenient.

---

## PART 3 — Deploy the Cloudflare Worker

This is the tiny server that handles the secure part of the login. It takes about 5 minutes to set up and runs 100,000 times per day for free — more than enough for a personal blog.

### Step 3.1 — Create a Cloudflare account (if you don't have one)

1. Go to **https://workers.cloudflare.com**
2. Click **"Sign up"**
3. Enter your email and a password
4. Verify your email when they send you a confirmation link
5. You do NOT need to add a domain or credit card

### Step 3.2 — Create your Worker

1. Once logged in, you'll see the Cloudflare dashboard
2. In the left sidebar, click **"Workers & Pages"**
3. Click the **"Create"** button
4. Click **"Create Worker"**
5. Cloudflare gives your Worker a random name like `dry-lake-a1b2` — you can change this if you want (click on the name field)
   - Try something like `gamedev-blog-auth`
6. You'll see a code editor with some default "Hello World" code

### Step 3.3 — Paste in your Worker code

1. Select ALL the code in the editor (Ctrl+A on Windows, Cmd+A on Mac)
2. Delete it
3. Open the file `cloudflare-worker/worker.js` from your project in your code editor
4. Select all of it and copy it
5. Paste it into the Cloudflare code editor
6. Click **"Deploy"** (blue button, top right)

You'll see a success message and a URL for your Worker. It looks like:
```
https://gamedev-blog-auth.YOURNAME.workers.dev
```
**Copy this URL** — you'll need it in Part 4.

### Step 3.4 — Add your secret environment variables

This is where you securely give the Worker your Client Secret without it ever appearing in public code.

1. After deploying, click on your Worker's name to go to its settings
2. Click the **"Settings"** tab
3. Scroll down to find **"Variables and Secrets"** (or just "Variables")
4. You need to add three variables. For each one, click **"Add variable"** (or "Add secret"):

   **Variable 1:**
   - Name: `GITHUB_CLIENT_ID`
   - Value: your Client ID from Step 2.3 (the `Ov23li...` string)
   - Type: **Secret** (click "Encrypt" if there's that option)

   **Variable 2:**
   - Name: `GITHUB_CLIENT_SECRET`
   - Value: your Client Secret from Step 2.3 (the long string)
   - Type: **Secret** (definitely encrypt this one)

   **Variable 3:**
   - Name: `ALLOWED_ORIGIN`
   - Value: your GitHub Pages URL (e.g. `https://ty.github.io`)
     - Just your username's root — no repo name, no trailing slash
   - Type: **Text** (this one isn't a secret)

5. Click **"Save and deploy"** after adding all three

---

## PART 4 — Configure Your Blog Files

Now you tell your blog where to find the Cloudflare Worker and which GitHub account is allowed to log in.

### Step 4.1 — Open auth.js in your code editor

Open VS Code (or any text editor) and open the file:
```
js/auth.js
```

Near the very top of the file, you'll see a section that says:
```javascript
// ▼▼▼  FILL THESE IN  ▼▼▼
const GITHUB_CLIENT_ID    = 'YOUR_GITHUB_CLIENT_ID';
const ALLOWED_GITHUB_USER = 'YOUR_GITHUB_USERNAME';
const TOKEN_EXCHANGE_URL  = 'https://YOUR_WORKER.YOUR_SUBDOMAIN.workers.dev';
// ▲▲▲  FILL THESE IN  ▲▲▲
```

### Step 4.2 — Fill in your three values

Replace each placeholder with your real values:

**Line 1 — GITHUB_CLIENT_ID:**
Replace `'YOUR_GITHUB_CLIENT_ID'` with your actual Client ID from Step 2.3.
```javascript
const GITHUB_CLIENT_ID    = 'Ov23liABCDEF123456';
```

**Line 2 — ALLOWED_GITHUB_USER:**
Replace `'YOUR_GITHUB_USERNAME'` with your exact GitHub username (case doesn't matter, but match it exactly).
```javascript
const ALLOWED_GITHUB_USER = 'ty';
```

**Line 3 — TOKEN_EXCHANGE_URL:**
Replace the placeholder with your Cloudflare Worker URL from Step 3.3.
```javascript
const TOKEN_EXCHANGE_URL  = 'https://gamedev-blog-auth.ty.workers.dev';
```

Save the file (Ctrl+S / Cmd+S).

---

## PART 5 — Push Your Files to GitHub

Now you upload all your files to the GitHub repository you created in Part 1.

### Step 5.1 — Initialize Git in your project folder

In your Terminal, make sure you're in your project folder:
```bash
cd gamedev-blog
# (or wherever your files are)
```

Initialize Git (tells Git to start tracking this folder):
```bash
git init
```

You should see: `Initialized empty Git repository in .../gamedev-blog/.git/`

### Step 5.2 — Connect your folder to your GitHub repository

Back on GitHub, look at the empty repo page you left open from Part 1. You'll see a section that says "…or push an existing repository from the command line". There's a URL in there — copy it.

It looks like:
```
https://github.com/YOURNAME/gamedev-blog.git
```

In Terminal, paste it into this command:
```bash
git remote add origin https://github.com/YOURNAME/gamedev-blog.git
```

This tells Git "when I push files, send them to this GitHub repository".

### Step 5.3 — Stage, commit, and push your files

**Stage all files** (tell Git which files to include in the upload):
```bash
git add .
```
The `.` means "everything in this folder".

**Commit** (save a snapshot with a message describing what it is):
```bash
git commit -m "Initial blog setup"
```

**Push** (upload to GitHub):
```bash
git push -u origin main
```

If it asks for your GitHub username and password:
- Username: your GitHub username
- Password: **NOT your GitHub password** — you need a Personal Access Token
  - Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic) → Generate new token
  - Give it a name, set expiry, check the `repo` scope, click Generate
  - Copy the token and use it as your password

After pushing, refresh your GitHub repo page — you should see all your files there.

### Step 5.4 — Enable GitHub Pages

1. On your GitHub repo page, click the **"Settings"** tab (top of the page)
2. In the left sidebar, click **"Pages"**
3. Under **"Source"**, click the dropdown that says "None" and select **"Deploy from a branch"**
4. Under **"Branch"**, select **"main"** from the first dropdown and **"/ (root)"** from the second
5. Click **"Save"**

GitHub will show a message like "Your site is being built". This takes 1–3 minutes.

After a minute, refresh the page. You'll see a green box with your live URL:
```
Your site is live at https://YOURNAME.github.io/YOURREPO/
```

**Open that URL in your browser.** Your blog is live! 🎉

---

## PART 6 — Test That Everything Works

Before celebrating, let's make sure login actually works.

### Step 6.1 — Test the public site

Open your blog URL. You should see:
- ✅ The sidebar with "DEV_LOG" title and the blinking cursor
- ✅ "Dev Journal" heading with "0 entries"
- ✅ Category list in the sidebar
- ✅ A subtle "Owner Login" button at the very bottom of the sidebar
- ✅ No write/edit/AI/theme buttons anywhere (good — visitors shouldn't see those)

### Step 6.2 — Test the login

1. Click **"Owner Login"** at the bottom of the sidebar
2. A small popup appears with "Continue with GitHub"
3. Click **"Continue with GitHub"**
4. GitHub redirects you to an authorisation page asking if you want to give "Game Dev Log" access to your account
5. Click **"Authorize Game Dev Log"** (the green button)
6. You should be redirected back to your blog and then automatically taken to `admin.html`

**If login worked:** You'll see your GitHub profile picture and username in the sidebar, and you have access to All Posts, New Entry, AI Assist, and Settings.

**If login didn't work:** See the Troubleshooting section below.

### Step 6.3 — Create your first post

1. Click **"New Entry"** in the sidebar
2. Type a title like "Day 1 — Starting My Game Dev Journey"
3. Write something in the content area (Markdown works!)
4. Click **"✦ Publish Entry"**
5. Open a new incognito/private window and visit your blog URL
6. You should see the post in the feed — without any admin controls

---

## PART 7 — Set Up AI Assist (Optional)

The AI features cost a small amount per use (a full blog post is usually less than $0.01) but require an Anthropic API key.

### Step 7.1 — Get an Anthropic API key

1. Go to **https://console.anthropic.com**
2. Create an account (free to sign up)
3. Go to **"API Keys"** in the left sidebar
4. Click **"Create Key"**
5. Give it a name like "Game Dev Blog"
6. Copy the key — it starts with `sk-ant-`

### Step 7.2 — Add the key to your blog

1. Log in to your admin panel
2. Click **"Settings"** in the sidebar
3. Paste your API key into the **"Anthropic API Key"** field
4. Click **"Save Settings"**

The key is stored only in your browser's localStorage — it never touches any server except Anthropic's own API.

### Step 7.3 — Test AI Assist

1. Click **"AI Assist"** in the sidebar
2. Read the daily prompt question at the top
3. In the text area, brain-dump what you worked on today — as messy as you like
4. Pick a category and enter your project name
5. Click **"◉ Generate Post"**
6. Wait about 10–15 seconds — Claude will write a full formatted blog post from your notes
7. Click **"✦ Publish"** to post it, or **"Edit before publishing"** to tweak it first

---

## Updating Your Blog In The Future

Every time you want to make changes to the site itself (not posts — those are saved in your browser), you edit your files and push them again:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

GitHub Pages automatically rebuilds your site within a minute or two of each push.

---

## Troubleshooting

### "My site shows a 404 error"
- Wait 3–5 minutes — GitHub Pages can be slow to build for the first time
- Go to your repo → Settings → Pages and confirm it shows your URL
- Make sure `index.html` is in the root of the repo (not inside a subfolder)

### "Login redirects me back but nothing happens / I see an error"
- Double-check the Callback URL in your GitHub OAuth App settings (Step 2.2)
  - It must exactly match your GitHub Pages URL including the trailing `/`
- Double-check the three values in `js/auth.js` (Step 4.2) — no typos
- Open your browser's DevTools (F12) → Console tab — look for red error messages

### "Login says 'Access denied'"
- Check that `ALLOWED_GITHUB_USER` in `auth.js` exactly matches your GitHub username
- GitHub usernames are case-insensitive but double-check anyway

### "Login says 'Token exchange failed'"
- Your Cloudflare Worker isn't reachable or isn't configured correctly
- Go to your Cloudflare dashboard → Workers → your worker → test it
- Check that all three environment variables are saved in the Worker settings (Step 3.4)
- Make sure the `TOKEN_EXCHANGE_URL` in `auth.js` exactly matches your Worker's URL

### "I pushed changes but the site didn't update"
- Go to your repo → Actions tab → you'll see a workflow running
- If it's red/failed, click on it to see the error
- If there's no Actions tab: go to Settings → Pages and confirm the source is set correctly

### "My posts disappeared"
- Posts are stored in your browser's localStorage — they're tied to your specific browser
- If you cleared browser data, opened an incognito window, or switched computers, they won't be there
- **Always export your posts regularly** via Settings → Export JSON in the admin panel
- Import them back via Settings → Import JSON

### "I want to use this on multiple devices"
- Currently posts live in localStorage (browser storage on one device)
- To use from multiple devices, export from one and import on another
- A future upgrade would store posts in a GitHub Gist or similar — let me know if you want that

---

## Quick Reference — Commands You'll Use

```bash
# First time pushing your blog to GitHub
git init
git remote add origin https://github.com/YOURNAME/YOURREPO.git
git add .
git commit -m "Initial setup"
git push -u origin main

# Every time you update the blog code
git add .
git commit -m "What you changed"
git push
```

---

## Your Three Important URLs

Write these down once everything is set up:

| What | URL |
|---|---|
| Public blog (what visitors see) | `https://YOURNAME.github.io/YOURREPO/` |
| Admin panel (your login) | `https://YOURNAME.github.io/YOURREPO/admin.html` |
| Cloudflare Worker | `https://YOURWORKERNAME.YOURNAME.workers.dev` |
