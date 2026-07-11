/**
 * ============================================================
 *  CLOUDFLARE WORKER — GitHub OAuth Token Exchange
 * ============================================================
 *
 *  WHAT IS THIS FILE?
 *  This is a tiny server-side script that runs on Cloudflare's
 *  infrastructure (their "edge network" — computers spread
 *  around the world for fast response times).
 *
 *  WHY DO WE NEED IT?
 *  When you log in with GitHub, the process works in two steps:
 *
 *  Step 1: GitHub gives your BROWSER a temporary "code"
 *  Step 2: Someone needs to swap that code for a real "token"
 *
 *  The problem: Step 2 requires a "Client Secret" — a password
 *  that proves YOUR blog is the real one making the request.
 *  We CANNOT put that secret in the JavaScript files the browser
 *  downloads (anyone could open browser DevTools and read it).
 *
 *  The solution: This Worker runs in a secure environment where
 *  we CAN safely store the secret. Your blog sends the code here,
 *  this Worker combines it with the secret, asks GitHub for the
 *  real token, and sends the token back to your blog.
 *
 *  Think of it like a middleman courier:
 *  You (browser) → give package (code) to courier (Worker)
 *  Courier shows its ID badge (secret) to the post office (GitHub)
 *  Post office gives courier the real item (token)
 *  Courier delivers token back to you
 *
 *  DEPLOYMENT (takes ~5 minutes):
 *  1. Sign up free at https://workers.cloudflare.com
 *  2. Create a new Worker, paste this entire file
 *  3. In Worker Settings → Variables, add these as SECRETS:
 *     GITHUB_CLIENT_ID     = (from your GitHub OAuth App)
 *     GITHUB_CLIENT_SECRET = (from your GitHub OAuth App)
 *     ALLOWED_ORIGIN       = https://yourname.github.io
 *  4. Deploy — you get a URL like:
 *     https://gamedev-auth.yourname.workers.dev
 *  5. Paste that URL into auth.js as TOKEN_EXCHANGE_URL
 *
 *  COST: Free forever. 100,000 requests per day included.
 *  You'd need to log in thousands of times per day to exceed that.
 * ============================================================
 */

export default {

  /**
   * fetch — The main handler function.
   *
   * Cloudflare calls this function automatically for every
   * HTTP request that hits this Worker's URL.
   *
   * PARAMETERS:
   * request — the incoming HTTP request object
   *           (contains the method, headers, URL, and body)
   * env     — the environment variables we set in the dashboard
   *           (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ALLOWED_ORIGIN)
   */
  async fetch(request, env) {

    /*
     * CORS HEADERS — Cross-Origin Resource Sharing
     * ─────────────────────────────────────────────
     * "Origin" = which website is making the request.
     * By default, browsers block JavaScript from one website
     * (your blog) making requests to a completely different
     * server (this Worker). This is the "Same-Origin Policy" —
     * a security feature to prevent malicious websites from
     * stealing your data.
     *
     * CORS headers are how a server says "it's OK, I trust this
     * specific website to make requests to me".
     *
     * We set ALLOWED_ORIGIN to your blog's exact URL
     * (e.g. "https://yourname.github.io") so ONLY your blog
     * can use this Worker. Any other website trying to use it
     * gets blocked by the browser.
     *
     * The 'origin' variable reads what site made the request —
     * we use it for logging/security checks if needed.
     */
    const origin        = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    // '*' means "any origin" — only use this during initial testing,
    // never in production (anyone could use your Worker)

    // These headers must be included in EVERY response
    const corsHeaders = {
      'Access-Control-Allow-Origin':  allowedOrigin,  // which sites are allowed
      'Access-Control-Allow-Methods': 'POST, OPTIONS', // which HTTP methods are allowed
      'Access-Control-Allow-Headers': 'Content-Type',  // which request headers are allowed
      'Content-Type': 'application/json',              // our responses are always JSON
    };

    /*
     * Handle "preflight" requests (OPTIONS method).
     *
     * Before making a cross-origin POST request, browsers
     * automatically send a quick OPTIONS request first to
     * ask "are you willing to accept a POST from my origin?".
     * This is called a "preflight check".
     *
     * We respond with 204 (No Content) and our CORS headers
     * to tell the browser "yes, proceed with your POST".
     */
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    /*
     * Only accept POST requests.
     * If someone tries to visit this URL in their browser (GET request),
     * or sends any other method, reject it with 405 Method Not Allowed.
     */
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    /*
     * Origin validation (extra security layer).
     *
     * Even though CORS headers should prevent unauthorised origins,
     * we add a server-side check too. If the request comes from
     * somewhere other than your blog's URL, reject it.
     *
     * We skip this if ALLOWED_ORIGIN is '*' (wildcard) —
     * that mode allows any origin, used during testing only.
     */
    if (allowedOrigin !== '*' && origin !== allowedOrigin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden origin' }),
        { status: 403, headers: corsHeaders }
      );
    }

    /*
     * Parse the request body.
     *
     * The blog sends us a JSON object like: { "code": "abc123..." }
     * We need to extract the "code" value from it.
     *
     * We use try/catch because JSON.parse will throw an error
     * if the body isn't valid JSON, and we want to handle that
     * gracefully rather than crashing.
     */
    let code;
    try {
      const body = await request.json(); // parse the JSON body
      code = body?.code;                 // extract the code field
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: corsHeaders }
      );
    }

    /*
     * Validate the code.
     * It must exist, be a string, and be a reasonable length.
     * GitHub codes are typically 20 characters — we're generous
     * with 200 to future-proof, but reject anything absurdly long
     * (a potential attack attempt).
     */
    if (!code || typeof code !== 'string' || code.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid code' }),
        { status: 400, headers: corsHeaders }
      );
    }

    /*
     * Exchange the code for a token with GitHub.
     *
     * We POST to GitHub's token endpoint with:
     * - client_id:     our OAuth App's public ID
     * - client_secret: our OAuth App's private secret (secure here in Workers)
     * - code:          the temporary code from the browser
     *
     * GitHub responds with either:
     * - { access_token: "gho_..." } on success
     * - { error: "...", error_description: "..." } on failure
     *
     * The "Accept: application/json" header tells GitHub to
     * respond with JSON instead of its default URL-encoded format.
     */
    try {
      const ghRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        body: JSON.stringify({
          client_id:     env.GITHUB_CLIENT_ID,     // from Cloudflare environment variables
          client_secret: env.GITHUB_CLIENT_SECRET, // the secret — NEVER in public code
          code,                                    // the temporary code from your browser
        }),
      });

      const data = await ghRes.json();

      // If GitHub returned an error, pass it through to the browser with a 400 status
      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error_description || data.error }),
          { status: 400, headers: corsHeaders }
        );
      }

      /*
       * SUCCESS! Send the access token back to the browser.
       *
       * From here, the browser (auth.js) will use this token to:
       * 1. Ask GitHub "who owns this token?"
       * 2. Verify the answer is the allowed GitHub username
       * 3. Store the token in sessionStorage for the duration of the tab session
       */
      return new Response(
        JSON.stringify({ access_token: data.access_token }),
        { status: 200, headers: corsHeaders }
      );

    } catch (err) {
      /*
       * If the fetch to GitHub itself failed (network error, GitHub is down, etc.)
       * return a generic 500 Internal Server Error.
       * We don't expose the raw error message to avoid leaking internal details.
       */
      return new Response(
        JSON.stringify({ error: 'Token exchange failed' }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
