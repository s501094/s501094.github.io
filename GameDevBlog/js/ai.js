/*
 * ============================================================
 *  AI.JS — Claude AI Integration
 * ============================================================
 *
 *  This file connects the blog to Anthropic's Claude AI.
 *  It powers two features in the admin panel:
 *
 *  1. AI ASSIST (the main feature):
 *     You brain-dump your dev notes in plain language.
 *     Claude reads them and writes a full, formatted blog post —
 *     with headings, sections, helpful tips, and resource links.
 *
 *  2. AI BEAUTIFY (in the editor):
 *     You write a rough draft directly in the editor.
 *     Claude polishes the grammar, structure, and flow
 *     while keeping your voice and content intact.
 *
 *  HOW CLAUDE IS CALLED:
 *  We make a direct API call from the browser to Anthropic's
 *  servers. To do this, we need your Anthropic API key, which
 *  you enter in the Settings page. It's stored locally in your
 *  browser's localStorage — never sent to any third party,
 *  only ever to Anthropic's own API endpoint.
 *
 *  WHAT IS AN API KEY?
 *  Think of it like a password that identifies your account
 *  with Anthropic. It starts with "sk-ant-...". You get it from
 *  your Anthropic account dashboard at console.anthropic.com.
 *  Each AI request uses a tiny amount of credit from your account.
 *
 *  DAILY REMINDERS:
 *  This file also handles the daily notification that prompts you
 *  to log your dev session. You set what time you want it in
 *  Settings, and the browser pings you with a question like
 *  "What did you work on today?".
 * ============================================================
 */

'use strict';

const AI = (() => {

  /*
   * API CONFIGURATION
   * -----------------
   * MODEL:      which version of Claude to use.
   *             "claude-sonnet-4-6" is the current recommended model —
   *             smart enough for writing tasks, fast, and cost-efficient.
   *
   * MAX_TOKENS: the maximum length of Claude's response.
   *             1800 tokens ≈ roughly 1,350 words. Enough for a full
   *             dev log post with sections and resource links.
   *
   * API_URL:    the web address of Anthropic's messaging endpoint.
   *             This is where we send our requests.
   */
  const MODEL      = 'claude-sonnet-4-6';
  const MAX_TOKENS = 1800;
  const API_URL    = 'https://api.anthropic.com/v1/messages';


  /*
   * getKey — retrieves your Anthropic API key from Settings.
   * Called before every API request to make sure a key exists.
   */
  function getKey() {
    return Store.Settings.get().apiKey || '';
  }


  /* ============================================================
   *  callClaude — The core function that talks to the API
   * ============================================================
   *
   *  All AI features go through this single function. It handles
   *  building the request, sending it, and returning Claude's reply.
   *
   *  HOW A CLAUDE API CALL WORKS:
   *  We send a "messages" request with two parts:
   *
   *  SYSTEM PROMPT:
   *  A set of instructions that tells Claude what role to play
   *  and what rules to follow. The user never sees this.
   *  Example: "You are a game dev blog editor. Write in first person..."
   *
   *  USER MESSAGE:
   *  The actual input — your raw notes or draft post.
   *
   *  Claude reads both and returns a response as plain text.
   *
   *  PARAMETERS:
   *  systemPrompt — the hidden instructions for Claude's behaviour
   *  userMessage  — the content Claude should act on
   *  abortSignal  — optional: lets us cancel a long-running request
   */
  async function callClaude(systemPrompt, userMessage, abortSignal) {
    const key = getKey();

    // If no API key is saved, we can't make any calls — show a helpful error
    if (!key) {
      throw new Error('No API key set. Go to Settings to add your Anthropic API key.');
    }

    // Build and send the HTTP request to Anthropic's API
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     key,                       // your personal Anthropic key
        'anthropic-version': '2023-06-01',           // the API version we're using
        // This header tells Anthropic we know we're calling from a browser directly.
        // Normally API keys should be kept server-side, but since this is a personal
        // blog and only you have the key, it's acceptable here.
        'anthropic-dangerous-direct-browser-calls': 'true',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     systemPrompt, // the hidden behaviour instructions
        messages: [
          { role: 'user', content: userMessage } // your actual input
        ],
      }),
      signal: abortSignal, // allows cancelling the request if needed (not currently used in the UI)
    });

    // Handle API errors — bad key, rate limit, server issues, etc.
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `API error ${res.status}`;
      throw new Error(msg);
    }

    // Parse the response — Claude's reply is in content[0].text
    const data = await res.json();
    return data.content?.[0]?.text || ''; // the ?. is "optional chaining" — avoids crash if structure is unexpected
  }


  /* ============================================================
   *  beautifyPost — Turns your raw notes into a full blog post
   * ============================================================
   *
   *  This is the main AI Assist feature.
   *
   *  You give it your messy, stream-of-consciousness notes:
   *  "added enemy AI today, keeps getting stuck in corners,
   *   spent 2 hours on navmesh, kinda works now. also redrew
   *   the tileset in aseprite."
   *
   *  Claude returns a fully structured blog post in Markdown:
   *  - A compelling title
   *  - "What I worked on" section
   *  - "Challenges & Learnings" section
   *  - Beginner tips (with 💡 emoji) if requested
   *  - A "What's Next" section
   *  - Links to documentation or tutorials if requested
   *
   *  BONUS: If your notes mention a theme name (e.g. "try dracula
   *  today"), the site switches to that theme automatically.
   *
   *  PARAMETERS:
   *  rawContent — your raw unedited notes (the text from the textarea)
   *  options    — an object with optional settings:
   *    - category:     the post category name (to give Claude context)
   *    - gameName:     the name of your current project
   *    - includeLinks: whether to add a resources section (default: true)
   *    - includeTips:  whether to add beginner tips (default: true)
   */
  async function beautifyPost(rawContent, options = {}) {
    const { category = '', gameName = '', includeLinks = true, includeTips = true } = options;

    // Check if the notes contain a theme switch command — handle it before the API call
    const themeDetected = Themes.detectThemeInText(rawContent);
    if (themeDetected) {
      Themes.apply(themeDetected); // immediately switch the theme in the UI
    }

    /*
     * THE SYSTEM PROMPT
     * This is the set of instructions Claude receives before your notes.
     * It defines Claude's role, writing style, and what sections to include.
     * Adjusting this prompt changes the style and structure of generated posts.
     */
    const system = `You are a skilled technical writing assistant for an indie game dev blog.
Your job is to take raw developer notes and transform them into an engaging, well-structured Markdown blog post.

Rules:
- Write in first person, casual but enthusiastic tone (like a real dev diary)
- Structure with clear Markdown headings (##, ###)
- Start with a brief "What I worked on today" summary paragraph
- Break content into logical sections
- Use bullet points for lists of changes/fixes
- Include a "Challenges & Learnings" section if relevant
- End with a "What's Next" section
- ${includeLinks
    ? 'Add a "Resources" section with 3-5 REAL, helpful links (official docs, YouTube tutorials, or tools). Format each as a markdown link: [Title](url). Only include links you are confident exist.'
    : 'Do not include resource links.'}
- ${includeTips
    ? 'Add contextual tips for beginners where relevant, marked with a 💡 emoji'
    : 'Skip beginner tips.'}
- Do NOT invent game details that weren't in the raw notes
- Keep it authentic — preserve the developer's voice and struggles
- If the raw notes mention switching themes (like "use dracula theme"), respond naturally but the theme has already been handled
- Output ONLY the markdown, no preamble`;

    /*
     * THE USER MESSAGE
     * This is what Claude actually reads — your notes, plus context
     * about the game and category to help it write a better post.
     */
    const user = `Game/Project: ${gameName || 'my game'}
Category: ${category || 'General'}
Raw developer notes:

${rawContent}

Generate an appropriate title as the first H1 heading.`;

    return await callClaude(system, user); // send everything to Claude and return the response
  }


  /* ============================================================
   *  beautifyDraft — Polishes a post you've already written
   * ============================================================
   *
   *  Used by the "AI Beautify" button in the editor.
   *  Unlike beautifyPost (which writes from scratch), this takes
   *  your existing draft and improves it without changing the
   *  core content or your personal voice.
   *
   *  Think of Claude as a copy editor here — fixing grammar,
   *  improving sentence flow, and adding better structure.
   *
   *  PARAMETERS:
   *  content — your existing draft text in Markdown
   *  title   — the post title (gives Claude context)
   */
  async function beautifyDraft(content, title) {
    const system = `You are a blog editor. Polish this game dev blog post draft:
- Fix grammar and flow
- Improve structure with better Markdown headings
- Make it more engaging without changing the core content
- Preserve the developer's voice and personal style
- Do not add sections that weren't there (no "What's Next" unless it already exists)
- Output ONLY the improved markdown, no preamble or commentary`;

    return await callClaude(system, `Title: ${title}\n\n${content}`);
  }


  /* ============================================================
   *  DAILY PROMPTS — Questions to get you writing
   * ============================================================
   *
   *  These 10 questions rotate through the days of the year.
   *  Each one is designed to get you thinking about a different
   *  aspect of your dev work — bugs, art, learning, feelings, etc.
   *
   *  The rotation is based on the day of the year (1–365),
   *  so each day you get a different question automatically.
   *  After 10 days, it cycles back to the beginning.
   */
  const DAILY_PROMPTS = [
    "What feature or mechanic did you work on today? What went well, and what surprised you?",
    "Did you squash any bugs today? What caused them and how'd you fix it?",
    "What did you learn today — a new tool, technique, or concept?",
    "What are you most proud of from today's session, even if it's small?",
    "What's been the hardest part of your current project so far?",
    "Did you do any art, audio, or design work today? What tools did you use?",
    "What's one thing you'd do differently if you were starting this project over?",
    "How does today's progress compare to your original plan for the game?",
    "What inspired you to add something new today?",
    "Did you get any playtesting feedback, or test your game yourself? What'd you notice?",
  ];

  /*
   * getDailyPrompt — Returns today's prompt question.
   *
   * HOW THE ROTATION WORKS:
   * 1. Calculate which day of the year today is (1 to 365)
   * 2. Use the remainder (%) after dividing by 10 (the number of prompts)
   *    → Day 1: 1 % 10 = 1 → prompt index 1
   *    → Day 10: 10 % 10 = 0 → prompt index 0
   *    → Day 11: 11 % 10 = 1 → prompt index 1 again
   * This ensures the prompts cycle evenly throughout the year.
   */
  function getDailyPrompt() {
    // Calculate the number of days since January 1st of this year
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
      // Date.now() = current time in milliseconds
      // new Date(year, 0, 0) = Dec 31 of PREVIOUS year, also in ms
      // Difference / 86400000 (ms per day) = days elapsed
    );
    return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
  }


  /* ============================================================
   *  NOTIFICATION SCHEDULING — Daily dev log reminders
   * ============================================================
   *
   *  These functions set up browser notifications that ping you
   *  at your chosen time each day with a prompt question.
   *
   *  IMPORTANT: Browser notifications require explicit permission.
   *  The user must click "Allow" when the browser asks.
   *  If they deny it, notifications simply won't work — no error.
   *
   *  HOW IT WORKS:
   *  We calculate the number of milliseconds until the next
   *  occurrence of your chosen time, then set a timer (setTimeout).
   *  When the timer fires, it shows the notification AND sets a
   *  NEW timer for the same time tomorrow — creating a daily cycle.
   *
   *  NOTE: These timers only exist while the tab is open. If you
   *  close the browser, the reminder won't fire. This is a limitation
   *  of browser-only notifications vs. server-sent ones (like SMS).
   *  For SMS you'd need a paid service — these are free.
   */

  /*
   * requestNotifications — asks the browser for notification permission.
   * Called when you click "Enable Notifications" in Settings.
   */
  async function requestNotifications() {
    // Check if this browser even supports notifications (all modern ones do)
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported in this browser.');
    }

    // Ask the user for permission — the browser shows a popup
    const perm = await Notification.requestPermission();

    if (perm !== 'granted') {
      throw new Error('Notification permission denied.');
    }

    scheduleReminder(); // start the daily cycle
    return true;
  }

  /*
   * scheduleReminder — sets a timer for the next notification.
   *
   * Reads the prompt time from Settings (e.g. "20:00"),
   * calculates how many milliseconds until that time today
   * (or tomorrow if it's already past), and sets a timer.
   *
   * When the timer fires:
   * 1. It shows a notification with today's prompt question
   * 2. It immediately schedules ANOTHER reminder for tomorrow
   *    (this is how the "daily" part works — it's recursive)
   */
  function scheduleReminder() {
    const settings = Store.Settings.get();
    const [h, m] = (settings.promptTime || '20:00').split(':').map(Number);
    // Split "20:00" into [20, 0], convert strings to numbers

    const now = new Date();

    // Build the target time: today at h:m:00
    const target = new Date();
    target.setHours(h, m, 0, 0); // set hours, minutes, seconds, milliseconds

    // If we've already passed that time today, aim for tomorrow instead
    if (target <= now) {
      target.setDate(target.getDate() + 1); // add one day
    }

    const ms = target - now; // how many milliseconds until the reminder fires

    setTimeout(() => {
      // Only show the notification if permission is still granted
      if (Notification.permission === 'granted') {
        new Notification('🕹️ Dev Log Reminder', {
          body: getDailyPrompt(), // today's rotating question
          // A tiny inline SVG gamepad emoji as the notification icon
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🕹️</text></svg>',
          tag:  'devlog-reminder', // prevents stacking multiple identical notifications
        });
      }
      scheduleReminder(); // schedule again for the same time TOMORROW
    }, ms);
  }


  /*
   * WHAT THIS FILE EXPORTS
   * Other files (admin.js) use these functions directly.
   */
  return { beautifyPost, beautifyDraft, getDailyPrompt, requestNotifications, scheduleReminder };

})();
