/*
 * ============================================================
 *  AUTH.JS — Login & Identity Verification
 * ============================================================
 *
 *  This file handles the entire login process. It makes sure
 *  ONLY YOU (the blog owner) can access the admin panel.
 *  Everyone else sees the public read-only blog.
 *
 *  THE PROBLEM THIS SOLVES:
 *  The site is hosted on GitHub Pages — a completely free,
 *  "static" host. That means there's no traditional server
 *  running code, so we can't do login the usual way
 *  (username + password checked on a server).
 *
 *  THE SOLUTION — GitHub OAuth:
 *  Instead of a password, we use your GitHub account as proof
 *  of identity. The flow works like this:
 *
 *  1. You click "Owner Login"
 *  2. You're sent to GitHub's website to approve access
 *  3. GitHub sends a temporary "code" back to your site
 *  4. A Cloudflare Worker (tiny free server) swaps the code
 *     for a real "token" (GitHub requires a server secret for this step)
 *  5. We ask GitHub "who owns this token?"
 *  6. If the answer matches YOUR username, you're in — admin panel opens
 *  7. If it's anyone else, access is denied
 *
 *  VISUAL FLOW:
 *
 *  [You]──click──▶[Login popup]──click──▶[GitHub.com login page]
 *                                                  │
 *                                    GitHub sends code back
 *                                                  │
 *  [Your site]◀────────────────────────────────────┘
 *       │
 *       └──▶[Cloudflare Worker]──▶[GitHub API: swap code for token]
 *                   │
 *                   └──▶[GitHub API: "who is this token?"]
 *                               │
 *                  ┌────────────┴───────────┐
 *              It's you ✓               Not you ✗
 *                  │                        │
 *           [Admin panel]           [Access denied]
 *
 *  WHAT IS "OAUTH"?
 *  OAuth is an open standard for letting one website (your blog)
 *  verify your identity through another website (GitHub) without
 *  ever seeing your GitHub password. It's the same technology
 *  behind "Sign in with Google" or "Sign in with Apple" buttons.
 *
 *  100% FREE STACK:
 *  • GitHub Pages         → hosts the site (free forever)
 *  • GitHub OAuth App     → handles authentication (free forever)
 *  • Cloudflare Workers   → handles the code/token swap (free, 100k req/day)
 *
 *  ── SETUP ──
 *  Fill in the three constants in the CONFIG section below.
 *  See SETUP.md for step-by-step instructions.
 * ============================================================
 */

'use strict';

const Auth = (() => {

  /* ============================================================
   *  CONFIG — Fill these in before deploying
   * ============================================================
   *
   *  These three values connect this file to your specific
   *  GitHub account and Cloudflare Worker. Without them,
   *  login won't work.
   *
   *  GITHUB_CLIENT_ID:
   *    The public identifier for your GitHub OAuth App.
   *    Found at: github.com/settings/developers → your app → "Client ID"
   *    Safe to include in public code — it's not a secret.
   *    Example: "Ov23liABCDEF123456"
   *
   *  ALLOWED_GITHUB_USER:
   *    Your exact GitHub username (case-insensitive).
   *    This is the ONLY account that will be allowed in.
   *    Example: "ty"
   *
   *  TOKEN_EXCHANGE_URL:
   *    The URL of your Cloudflare Worker.
   *    This is the tiny free server that swaps the temporary
   *    code for a real access token. Your Client Secret lives
   *    here (in Cloudflare's environment variables), never in
   *    this file.
   *    Example: "https://gamedev-auth.yourname.workers.dev"
   */
  const GITHUB_CLIENT_ID    = 'Ov23lirNCzw7GmLvM5CW';
  const ALLOWED_GITHUB_USER = 's501094';
  const TOKEN_EXCHANGE_URL  = 'https://game-dev-blog-auth.tyellis1111245.workers.dev';


  /* ============================================================
   *  SESSION STORAGE KEY NAMES
   * ============================================================
   *
   *  After login, we need to remember that you're logged in
   *  while you navigate around the admin panel.
   *
   *  We use "sessionStorage" (not localStorage) for this.
   *  The key difference:
   *  - localStorage persists even after you close the browser
   *  - sessionStorage is automatically wiped when the TAB closes
   *
   *  Using sessionStorage for login tokens is safer — if you
   *  walk away from your computer and someone opens a new tab,
   *  they won't be automatically logged in as you.
   */
  const SESSION_KEY = 'gdl_gh_token'; // stores the GitHub access token
  const USER_KEY    = 'gdl_gh_user';  // stores your GitHub profile info (name, avatar)
  const STATE_KEY   = 'gdl_oauth_state'; // stores the anti-CSRF random string (see below)


  /* ============================================================
   *  generateState — Creates a random security token
   * ============================================================
   *
   *  This is protection against "CSRF" (Cross-Site Request Forgery)
   *  — a type of attack where a malicious website tricks your
   *  browser into making requests to another site on your behalf.
   *
   *  HOW IT WORKS:
   *  1. Before redirecting to GitHub, we generate a random string
   *     and save it in sessionStorage
   *  2. We include that string in the URL we send to GitHub
   *  3. GitHub includes it in the URL when redirecting back to us
   *  4. We compare the two: if they match, the redirect is genuine
   *     If they don't match, someone may be trying to hijack the login
   *
   *  The random string is generated using crypto.getRandomValues() —
   *  a cryptographically secure random number generator built into
   *  all modern browsers. This is much harder to predict than
   *  Math.random(), which isn't truly random.
   */
  function generateState() {
    const arr = new Uint8Array(16);    // create an array of 16 empty bytes
    crypto.getRandomValues(arr);       // fill it with cryptographically random values
    // Convert each byte to a 2-character hex string, then join them all
    // Result looks like: "a3f92c1b8e4d7a05f6c2b9e1d4a8f307"
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }


  /* ============================================================
   *  login — Starts the GitHub OAuth process
   * ============================================================
   *
   *  Called when you click "Continue with GitHub" in the login popup.
   *
   *  What it does:
   *  1. Generates a random state string and saves it
   *  2. Builds a URL pointing to GitHub's authorisation page
   *  3. Redirects you there (the whole page navigates to GitHub)
   *
   *  The "scope: 'read:user'" parameter tells GitHub we only
   *  need to read your basic profile — we're not asking for
   *  access to your repos, emails, or anything else.
   */
  function login() {
    const state = generateState();
    sessionStorage.setItem(STATE_KEY, state); // save state to verify when GitHub redirects back

    // Build the GitHub authorisation URL with the required parameters
    const params = new URLSearchParams({
      client_id:    GITHUB_CLIENT_ID,
      scope:        'read:user',               // only request minimal permissions
      state,                                   // the anti-CSRF token
      redirect_uri: window.location.href.split('?')[0], // come back to the current page (strip any existing query params)
    });

    // Navigate the browser to GitHub's login page
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  }


  /* ============================================================
   *  exchangeCode — Swaps a temporary code for a real token
   * ============================================================
   *
   *  After you approve access on GitHub, GitHub redirects you
   *  back to your site with a short-lived "code" in the URL:
   *  https://yoursite.github.io/?code=abc123&state=xyz789
   *
   *  This code is like a one-time-use ticket. We need to swap
   *  it for a real access token. But to do that, we need the
   *  "client secret" — which MUST stay hidden. We can't put it
   *  in this JavaScript file (anyone could read it).
   *
   *  So we send the code to our Cloudflare Worker instead.
   *  The Worker has the client secret stored securely in its
   *  environment variables (not in any public file).
   *
   *  PARAMETERS:
   *  - code:  the temporary code GitHub put in the URL
   *  - state: the state value GitHub put in the URL (we verify it matches)
   */
  async function exchangeCode(code, state) {
    // ── CSRF Check ──
    // Retrieve the state we saved before redirecting to GitHub
    const saved = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY); // delete it — it's single-use

    // If the state doesn't match, something is wrong — abort
    if (!saved || state !== saved) {
      throw new Error('OAuth state mismatch — please try logging in again.');
    }

    // ── Send the code to Cloudflare Worker ──
    // The Worker lives at TOKEN_EXCHANGE_URL. It receives the code,
    // combines it with the client secret (which only IT knows),
    // and asks GitHub for the real access token. It then sends
    // that token back to us.
    const res = await fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }), // send the code as JSON
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Token exchange failed (${res.status})`);
    }

    const data = await res.json();
    if (!data.access_token) throw new Error('No access token returned.');
    return data.access_token; // this is the real GitHub access token
  }


  /* ============================================================
   *  verifyUser — Checks if the token belongs to YOU
   * ============================================================
   *
   *  Now that we have a real access token, we ask GitHub's API:
   *  "Who does this token belong to?"
   *
   *  GitHub responds with a user profile object including their
   *  username (called "login" in GitHub's API).
   *
   *  We compare that username to ALLOWED_GITHUB_USER.
   *  - Match → welcome, you're in
   *  - No match → access denied, even if they successfully logged
   *               into their own GitHub account
   *
   *  This is the core security gate of the entire auth system.
   */
  async function verifyUser(token) {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`, // prove ownership of the token
        'Accept': 'application/vnd.github+json',
      },
    });

    if (!res.ok) throw new Error('Failed to fetch GitHub profile.');

    const user = await res.json();

    // Case-insensitive comparison (GitHub usernames are case-insensitive)
    if (user.login.toLowerCase() !== ALLOWED_GITHUB_USER.toLowerCase()) {
      throw new Error(`Access denied. Only @${ALLOWED_GITHUB_USER} can log in here.`);
    }

    return user; // return the full profile object (name, avatar URL, etc.)
  }


  /* ============================================================
   *  storeSession — Saves login info for the current tab session
   * ============================================================
   *
   *  After successfully verifying identity, we save two things
   *  to sessionStorage so you stay logged in while navigating:
   *
   *  1. The access token → needed to make authenticated GitHub API calls
   *  2. Basic profile info → used to show your name and avatar in the sidebar
   *
   *  We deliberately don't store unnecessary data (emails, etc.)
   *  — only what the UI actually needs.
   */
  function storeSession(token, user) {
    sessionStorage.setItem(SESSION_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify({
      login:      user.login,             // GitHub username (e.g. "ty")
      name:       user.name || user.login, // display name (falls back to username if not set)
      avatar_url: user.avatar_url,         // URL of your GitHub profile picture
    }));
  }


  /* ============================================================
   *  getSession — Retrieves the current login session
   * ============================================================
   *
   *  Returns the stored token and user profile, or null if
   *  nobody is logged in (or the session expired by tab close).
   */
  function getSession() {
    const token   = sessionStorage.getItem(SESSION_KEY);
    const userRaw = sessionStorage.getItem(USER_KEY);
    if (!token || !userRaw) return null; // not logged in

    try {
      return { token, user: JSON.parse(userRaw) }; // parse the user JSON back to an object
    } catch {
      return null; // if the stored JSON is corrupt for any reason, treat as logged out
    }
  }


  /* ============================================================
   *  logout — Clears the session and returns to the public site
   * ============================================================
   *
   *  Simply deletes the session data from sessionStorage and
   *  navigates back to the public homepage.
   *
   *  Note: This doesn't revoke the GitHub token (that would
   *  require another server call). But since the token is gone
   *  from storage, the admin panel will treat you as logged out.
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(USER_KEY);
    window.location.href = 'index.html'; // go to the public homepage
  }


  /* isLoggedIn — Quick check: is there an active session? */
  function isLoggedIn() {
    return !!getSession(); // !! converts null to false, and an object to true
  }


  /* ============================================================
   *  handlePageLoad — Runs every time a page loads
   * ============================================================
   *
   *  This is the main entry point for the auth system.
   *  It handles two scenarios:
   *
   *  SCENARIO 1 — Returning from GitHub (OAuth callback):
   *  The URL contains ?code=...&state=...
   *  → Exchange the code, verify the user, store the session
   *  → Return status: 'callback'
   *
   *  SCENARIO 2 — Normal page load:
   *  Check if there's already an active session in sessionStorage
   *  → If yes, return status: 'authenticated'
   *  → If no, return status: 'unauthenticated'
   *
   *  The calling code (public.js or admin.js) then decides
   *  what to do based on the status.
   */
  async function handlePageLoad() {
    // Check if GitHub put a code and state in the URL
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');

    if (code && state) {
      // We're in the OAuth callback — clean the URL immediately so
      // the code doesn't stay visible in the address bar or browser history
      window.history.replaceState({}, document.title, window.location.pathname);

      // Complete the login flow
      const token = await exchangeCode(code, state); // swap code for token (via Cloudflare Worker)
      const user  = await verifyUser(token);          // verify it's you (via GitHub API)
      storeSession(token, user);                      // remember the session
      return { status: 'callback', user };
    }

    // No code in URL — check for an existing session
    const session = getSession();
    if (session) return { status: 'authenticated', user: session.user };

    // No session found — user is not logged in
    return { status: 'unauthenticated', user: null };
  }


  /*
   * WHAT THIS FILE EXPORTS
   * Only these functions are accessible from other files.
   * The internal helpers (generateState, exchangeCode, verifyUser,
   * storeSession) are private — other files can't call them directly.
   */
  return { login, logout, isLoggedIn, getSession, handlePageLoad };

})();
