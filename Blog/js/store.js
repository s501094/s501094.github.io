/*
 * ============================================================
 *  STORE.JS — The Blog's Memory
 * ============================================================
 *
 *  Think of this file as the filing cabinet for everything
 *  the blog needs to remember: your posts, categories, and
 *  personal settings (like your API key and chosen theme).
 *
 *  Instead of a traditional database (which requires a server
 *  and costs money), we use the browser's built-in "localStorage".
 *  This is a small storage area every browser provides for
 *  websites to save data directly on your device. It persists
 *  even after you close the tab or restart your computer.
 *
 *  HOW THE DATA IS ORGANISED:
 *  ┌─────────────────────────────────────────┐
 *  │  localStorage (your browser's storage)  │
 *  │  ┌─────────────┐  ┌──────────────────┐  │
 *  │  │  gdl_posts  │  │ gdl_categories   │  │
 *  │  │  (all blog  │  │ (your projects   │  │
 *  │  │   entries)  │  │  + subcategories)│  │
 *  │  └─────────────┘  └──────────────────┘  │
 *  │  ┌──────────────────────────────────┐    │
 *  │  │  gdl_settings                   │    │
 *  │  │  (API key, theme, notif time…)  │    │
 *  │  └──────────────────────────────────┘    │
 *  └─────────────────────────────────────────┘
 *
 *  SECURITY NOTE:
 *  All data is "sanitised" before saving — we strip out anything
 *  that could be used to inject harmful code (called XSS attacks).
 *  Think of it like a bouncer checking everyone at the door.
 * ============================================================
 */

'use strict'; // Tells JavaScript to be extra strict about catching mistakes

/*
 * The entire Store is wrapped in a self-calling function: (() => { ... })()
 * This pattern is called an IIFE (Immediately Invoked Function Expression).
 * It keeps all the internal helpers private — nothing outside this file
 * can accidentally change them. Only what's listed in the final
 * `return { ... }` block is visible to other files.
 */
const Store = (() => {

  /*
   * KEY NAMES
   * ---------
   * These are the labels we use when saving data to localStorage.
   * Keeping them as named constants (rather than typing the string
   * each time) prevents typos from causing mysterious "missing data" bugs.
   */
  const KEYS = {
    POSTS:      'gdl_posts',      // stores the array of all blog posts
    CATEGORIES: 'gdl_categories', // stores the array of category objects
    SETTINGS:   'gdl_settings',   // stores your preferences (theme, API key, etc.)
  };


  /* ============================================================
   *  SECURITY HELPERS — Cleaning data before it's saved
   * ============================================================
   *
   *  WHY WE NEED THESE:
   *  If someone crafts a malicious post title or content, they
   *  could try to inject HTML or JavaScript that runs in the
   *  browser. These functions neutralise that threat by converting
   *  dangerous characters into their safe, "display only" versions.
   *
   *  Example: The "<" character starts HTML tags.
   *  We convert it to "&lt;" which LOOKS like < on screen,
   *  but the browser will never treat it as real HTML code.
   */

  /*
   * sanitizeText — for short fields like titles, tags, and names.
   * Converts the 5 most dangerous HTML characters into safe versions.
   * Also enforces a 50,000-character hard maximum (roughly 10,000 words).
   */
  function sanitizeText(str) {
    if (typeof str !== 'string') return ''; // if it's not text at all, return empty
    return str
      .replace(/&/g,  '&amp;')   // & → &amp;   (must be first to avoid double-escaping)
      .replace(/</g,  '&lt;')    // < → &lt;    (prevents HTML tag injection)
      .replace(/>/g,  '&gt;')    // > → &gt;
      .replace(/"/g,  '&quot;')  // " → &quot;  (prevents breaking out of attributes)
      .replace(/'/g,  '&#x27;')  // ' → &#x27;
      .slice(0, 50000);          // hard cap at 50k characters
  }

  /*
   * sanitizeMarkdown — for post body content.
   *
   * Post bodies need to allow Markdown formatting symbols like **bold**
   * and # headings, so we can't strip ALL special characters the way
   * sanitizeText does.
   *
   * Instead, we only remove the specifically dangerous things:
   *  - <script> blocks   → these can run arbitrary JavaScript
   *  - onclick= handlers → inline JavaScript attached to HTML elements
   *  - javascript: links → links that run code instead of opening a page
   *
   * Normal Markdown characters (*, #, -, >, backticks, etc.) are untouched.
   */
  function sanitizeMarkdown(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/<script[\s\S]*?<\/script>/gi, '') // remove entire <script>…</script> blocks
      .replace(/on\w+\s*=/gi, '')                 // remove onclick=, onload=, onmouseover=, etc.
      .replace(/javascript:/gi, '')               // remove javascript: protocol from links
      .slice(0, 100000);                          // cap at 100k characters (~20,000 words)
  }


  /* ============================================================
   *  STORAGE HELPERS — Safe reading and writing to localStorage
   * ============================================================
   *
   *  localStorage can only store plain text (strings), but we need
   *  to save complex objects (arrays of posts, etc.). We solve this
   *  by converting objects to/from JSON format:
   *
   *  JavaScript object  →  JSON string  →  stored as text
   *  { title: "My Post" }  →  '{"title":"My Post"}'  →  saved
   *
   *  We wrap both operations in try/catch so if the browser's
   *  storage is full or blocked (e.g. in strict private browsing),
   *  the site won't crash — it fails gracefully.
   */

  /* safeGet — reads a value from localStorage by its key name */
  function safeGet(key) {
    try {
      const raw = localStorage.getItem(key); // retrieve the raw text string
      return raw ? JSON.parse(raw) : null;   // convert JSON text back to a JavaScript object
    } catch {
      return null; // if anything goes wrong, return null rather than crashing
    }
  }

  /* ============================================================
   *  STATIC CONTENT — posts/categories pushed to the repo as files
   * ============================================================
   *
   *  Some posts are written by committing directly to git (e.g. from
   *  Claude Code) instead of through admin.html. Those live as plain
   *  JSON in data/posts.json and data/categories.json, not localStorage,
   *  so a fresh visitor sees them immediately with no browser-specific
   *  state involved. loadStaticContent() fetches both once and caches
   *  them here; Posts.getAll()/Categories.getAll() merge them in below.
   *  Each is tagged `source: 'file'` so the admin UI knows these are
   *  read-only there — edits belong in the repo, not the editor.
   */
  let staticPosts = [];
  let staticCategories = [];

  async function loadStaticContent() {
    try {
      const [postsRes, catsRes] = await Promise.all([
        fetch('data/posts.json').catch(() => null),
        fetch('data/categories.json').catch(() => null),
      ]);
      const rawPosts = postsRes && postsRes.ok ? await postsRes.json() : [];
      const rawCats  = catsRes  && catsRes.ok  ? await catsRes.json()  : [];

      staticPosts = (Array.isArray(rawPosts) ? rawPosts : []).map(p => ({
        id:          typeof p.id === 'string' ? p.id : crypto.randomUUID(),
        title:       sanitizeText(p.title || 'Untitled Entry'),
        content:     sanitizeMarkdown(p.content || ''),
        category:    sanitizeText(p.category || ''),
        tags:        Array.isArray(p.tags) ? p.tags.map(t => sanitizeText(t)).slice(0, 10) : [],
        createdAt:   typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
        updatedAt:   typeof p.updatedAt === 'string' ? p.updatedAt : (p.createdAt || new Date().toISOString()),
        aiGenerated: Boolean(p.aiGenerated),
        attachments: [], // file-based posts carry no binary attachments
        source:      'file',
      }));

      staticCategories = (Array.isArray(rawCats) ? rawCats : []).map(c => ({
        id:       typeof c.id === 'string' ? c.id : crypto.randomUUID(),
        name:     sanitizeText(c.name || '').slice(0, 30),
        color:    /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : CATEGORY_COLORS[0],
        parentId: c.parentId || null,
        source:   'file',
      }));
    } catch (e) {
      console.error('Failed to load static content:', e); // e.g. fetch blocked on file://
    }
  }

  /* safeSet — writes a value to localStorage under a given key */
  function safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value)); // convert to JSON and save
      return true;
    } catch (e) {
      console.error('Storage write failed:', e); // log to browser console for debugging
      return false;
    }
  }


  /* ============================================================
   *  POSTS — All blog entry operations (create, read, update, delete)
   * ============================================================
   *
   *  Each post is a JavaScript object that looks like this:
   *
   *  {
   *    id:          "f3a2b1c...",       ← unique identifier, auto-generated
   *    title:       "Fixed the Login Race Condition",
   *    content:     "## What I did\n...", ← the full post body in Markdown
   *    category:    "c2",               ← ID linking to a category (a project OR a subcategory)
   *    tags:        ["bugfix", "backend"],
   *    createdAt:   "2026-06-19T20:00:00Z", ← ISO date/time string
   *    updatedAt:   "2026-06-19T20:00:00Z",
   *    aiGenerated: false,              ← was this written by Claude AI?
   *    attachments: []                  ← array of attached files (base64 encoded)
   *  }
   *
   *  This pattern of four operations — Create, Read, Update, Delete —
   *  is so common in programming it has an acronym: CRUD.
   */
  const Posts = {

    /*
     * getAll — returns every post as an array (newest first).
     * If nothing has been saved yet, returns an empty array so
     * other code doesn't have to check for null.
     */
    getAll() {
      const local = safeGet(KEYS.POSTS) || [];
      // Merge in file-based posts and sort the combined list newest-first,
      // since the two sources can no longer be ordered by insertion alone.
      return [...staticPosts, ...local].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    /*
     * getById — finds and returns a single post by its unique ID.
     * Returns null if no post with that ID exists.
     */
    getById(id) {
      return this.getAll().find(p => p.id === id) || null;
      // .find() loops through the array and returns the FIRST item where the condition is true
    },

    /*
     * create — saves a brand new blog post.
     *
     * Takes a `data` object containing the post's content,
     * adds a unique ID and timestamps, sanitizes everything,
     * then adds it to the list and saves. New posts go at the
     * TOP (unshift) so the most recent always appears first.
     */
    create(data) {
      // NOTE: reads/writes the LOCAL list only (not the static+local merge from
      // getAll()) — otherwise saving would duplicate file-based posts into
      // localStorage on every write.
      const posts = safeGet(KEYS.POSTS) || []; // load existing posts so we can add to them

      const post = {
        id:          crypto.randomUUID(), // built-in browser function: generates a unique ID like "f3a2b1c4-..."
        title:       sanitizeText(data.title || 'Untitled Entry'),
        content:     sanitizeMarkdown(data.content || ''),
        category:    sanitizeText(data.category || ''),
        tags:        (data.tags || [])
                       .map(t => sanitizeText(t))  // sanitize every individual tag
                       .filter(Boolean)             // remove any that ended up as empty strings
                       .slice(0, 10),              // maximum 10 tags per post
        createdAt:   new Date().toISOString(),      // current moment in standard format
        updatedAt:   new Date().toISOString(),
        aiGenerated: Boolean(data.aiGenerated),     // ensure it's always true or false, never undefined
        attachments: data.attachments || [],        // attached files (images, PDFs, etc.)
      };

      posts.unshift(post);        // add to the FRONT of the array (newest first)
      safeSet(KEYS.POSTS, posts); // persist the updated array to localStorage
      return post;                // return the new post so the caller can use it (e.g. to open it)
    },

    /*
     * update — edits an existing post.
     *
     * Finds the post by ID, then merges the new data with the
     * existing data using the spread operator (...). Only fields
     * that are actually provided in `data` get replaced — everything
     * else stays the same. The "updatedAt" timestamp is always refreshed.
     */
    update(id, data) {
      const posts = safeGet(KEYS.POSTS) || []; // LOCAL list only — see note in create()
      const idx = posts.findIndex(p => p.id === id); // find the index (position) of this post
      if (idx === -1) return null; // not found — do nothing (also true for file-based post IDs)

      posts[idx] = {
        ...posts[idx], // ← spread: start with all the EXISTING post data
        // Then override only the fields that were passed in:
        title:       data.title       !== undefined ? sanitizeText(data.title)       : posts[idx].title,
        content:     data.content     !== undefined ? sanitizeMarkdown(data.content) : posts[idx].content,
        category:    data.category    !== undefined ? sanitizeText(data.category)    : posts[idx].category,
        tags:        data.tags        !== undefined
                       ? data.tags.map(t => sanitizeText(t)).filter(Boolean).slice(0, 10)
                       : posts[idx].tags,
        attachments: data.attachments !== undefined ? data.attachments               : posts[idx].attachments,
        updatedAt:   new Date().toISOString(), // always update the "last edited" time
      };

      safeSet(KEYS.POSTS, posts);
      return posts[idx]; // return the updated post
    },

    /*
     * delete — permanently removes a post.
     *
     * Uses .filter() to build a NEW array that contains every post
     * EXCEPT the one we want to remove. The original array is discarded.
     * This is irreversible — there's no recycle bin!
     */
    delete(id) {
      // LOCAL list only — see note in create(). Filtering a static post's id
      // out of this list is a harmless no-op; it simply isn't in it.
      const posts = (safeGet(KEYS.POSTS) || []).filter(p => p.id !== id); // keep everything that doesn't match
      safeSet(KEYS.POSTS, posts);
    },

    /*
     * search — filters posts by a text query and/or a category.
     *
     * Used by the search bar and category dropdown on the public feed.
     * A post must match BOTH the text query AND the category (if set).
     * Matching is case-insensitive so "Unity" finds "unity".
     *
     * PROJECT + SUBCATEGORY FILTERING:
     * Categories can now be a project OR a subcategory nested under one.
     * If the category you're filtering by is a PROJECT (top-level),
     * we also want to match every post filed under any of its
     * subcategories — selecting "Sanctuary of Spirits" should show
     * posts from "Sanctuary of Spirits > Bugs & Fixes" too, not just
     * posts filed directly under the project with no subcategory.
     * If the category is a subcategory itself, we match ONLY that
     * exact subcategory (no further nesting exists to expand into).
     */
    search(query, category) {
      const q = (query || '').toLowerCase().trim(); // normalise to lowercase for comparison

      // Build the full set of category IDs this filter should match.
      // Note: Categories is defined further down in this same file, but
      // since this function only RUNS when called (not right now), by
      // the time it executes, Categories will already exist — closures
      // resolve variable references at call-time, not at definition-time.
      let categoryIds = null;
      if (category) {
        const children = Categories.getChildren(category).map(c => c.id);
        categoryIds = new Set([category, ...children]); // the category itself, plus any subcategories
      }

      return this.getAll().filter(p => {
        // Category match: pass if no filter is set, OR if the post's category is in our matching set
        const matchCat = !categoryIds || categoryIds.has(p.category);

        // Text match: pass if no query, OR if the query appears anywhere in title, content, or tags
        const matchText = !q ||
          p.title.toLowerCase().includes(q)   ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some(t => t.includes(q));     // .some() = "at least one tag matches"

        return matchCat && matchText; // BOTH conditions must be true
      });
    },
  };


  /* ============================================================
   *  CATEGORIES — Projects and their subcategories
   * ============================================================
   *
   *  Categories now support TWO LEVELS, so you can track multiple
   *  projects at once and break each one down further:
   *
   *  LEVEL 1 — PROJECTS (top-level, parentId is null)
   *    e.g. "Sanctuary of Spirits", "CS Academy", "Password Manager"
   *    Each project you work on gets its own top-level category.
   *
   *  LEVEL 2 — SUBCATEGORIES (parentId points to a project's id)
   *    e.g. "Bugs & Fixes", "Art & Assets" — nested under a project
   *
   *  A category object looks like this:
   *  { id: "c1", name: "Sanctuary of Spirits", color: "#7aa2f7", parentId: null }
   *  { id: "c2", name: "Bugs & Fixes",         color: "#7aa2f7", parentId: "c1" }
   *
   *  Only TWO LEVELS are allowed — a subcategory can never have its
   *  own subcategories. This keeps the sidebar and dropdowns simple
   *  to scan at a glance instead of turning into a deep folder tree.
   *
   *  The colour is stored as a "hex code" — the # followed by
   *  6 characters that represent a colour (used in web design).
   *  You can create up to 40 categories total (projects + subcategories
   *  combined) — plenty of room for several projects, each broken
   *  down into a handful of subcategories.
   */

  /*
   * The colour palette available when creating a new category.
   * All colours are from popular dark-mode themes (Tokyo Night,
   * Catppuccin) so they look good against the dark background.
   */
  const CATEGORY_COLORS = [
    '#7aa2f7', // soft blue
    '#bb9af7', // purple
    '#9ece6a', // green
    '#e0af68', // amber/orange
    '#f7768e', // red/pink
    '#2ac3de', // cyan
    '#ff9e64', // orange
    '#73daca', // teal
    '#b4f9f8', // light cyan
    '#c0caf5', // lavender
  ];

  /*
   * No built-in starter categories. This is a personal, multi-project
   * blog — you create your own projects (and subcategories under them)
   * as you go, rather than starting from a fixed game-dev template.
   */
  const DEFAULT_CATEGORIES = [];

  const Categories = {

    /* getAll — returns every category (projects AND subcategories) as one flat list */
    getAll() {
      const local = safeGet(KEYS.CATEGORIES) || DEFAULT_CATEGORIES;
      return [...staticCategories, ...local];
    },

    /*
     * getTopLevel — returns only the "project" categories.
     * A category is top-level when it has no parentId (null/undefined).
     * Used anywhere we need to list your projects — the sidebar,
     * the "which project is this subcategory under?" picker, etc.
     */
    getTopLevel() {
      return this.getAll().filter(c => !c.parentId);
    },

    /*
     * getChildren — returns every subcategory that belongs to a given project.
     * PARAMETER: parentId — the ID of the parent project category
     */
    getChildren(parentId) {
      return this.getAll().filter(c => c.parentId === parentId);
    },

    /*
     * create — adds a new project or subcategory.
     *
     * PARAMETERS:
     * name     — the category name (e.g. "Sanctuary of Spirits" or "Bugs & Fixes")
     * color    — a hex colour code
     * parentId — null to create a top-level PROJECT, or the ID of an
     *            existing project to create a SUBCATEGORY under it
     *
     * Validates:
     *  - You haven't hit the 40-category limit
     *  - The colour is a valid 6-digit hex code (#rrggbb format)
     *  - If parentId is given, it must point to an EXISTING top-level
     *    category — you can't nest a subcategory under another
     *    subcategory (that would make three levels, which we don't allow)
     */
    create(name, color, parentId = null) {
      // Validate against the merged (static + local) list — a subcategory
      // should be creatable under a project that was pushed as a file too —
      // but only ever WRITE the local list back to storage (see create() in Posts).
      const allCats = this.getAll();
      if (allCats.length >= 40) throw new Error('Max 40 categories'); // enforced limit

      // Validate the parent, if one was specified
      let validatedParent = null;
      if (parentId) {
        const parent = allCats.find(c => c.id === parentId);
        if (!parent) throw new Error('Selected parent project not found.');
        if (parent.parentId) throw new Error('Subcategories can only be nested one level deep.');
        validatedParent = parent.id;
      }

      const cat = {
        id:       crypto.randomUUID(),
        name:     sanitizeText(name).slice(0, 30),       // max 30-character category names
        color:    /^#[0-9a-f]{6}$/i.test(color)          // regex check: must be #rrggbb
                    ? color
                    : CATEGORY_COLORS[0],                // fall back to blue if colour is invalid
        parentId: validatedParent,                       // null = top-level project
      };

      const localCats = safeGet(KEYS.CATEGORIES) || DEFAULT_CATEGORIES;
      safeSet(KEYS.CATEGORIES, [...localCats, cat]);
      return cat;
    },

    /*
     * delete — removes a category by ID.
     *
     * If you delete a PROJECT (a top-level category), every
     * subcategory nested underneath it is deleted too — this is
     * called a "cascade delete". It prevents subcategories from
     * being left behind with no parent project to belong to.
     *
     * Posts that referenced the deleted category simply lose their
     * category label (their stored category ID no longer matches
     * anything) — the rest of the app already handles that gracefully,
     * showing them as uncategorized rather than crashing.
     */
    delete(id) {
      // Scan the merged list for children (a locally-created subcategory might
      // sit under a project that was pushed as a file) but only ever WRITE the
      // local list back — deleting a file-based category itself belongs in
      // data/categories.json, not here.
      const idsToDelete = new Set([id]);
      this.getAll().forEach(c => {
        if (c.parentId === id) idsToDelete.add(c.id);
      });

      const localCats = safeGet(KEYS.CATEGORIES) || DEFAULT_CATEGORIES;
      const remaining = localCats.filter(c => !idsToDelete.has(c.id));
      safeSet(KEYS.CATEGORIES, remaining);
    },

    /* getColors — exposes the colour palette to other files (used in the category creation modal) */
    getColors: () => CATEGORY_COLORS,
  };


  /* ============================================================
   *  SETTINGS — Your personal admin preferences
   * ============================================================
   *
   *  These settings are saved between sessions so you don't
   *  have to re-enter them every time you open the admin panel.
   *
   *  FIELDS:
   *  - apiKey:     your Anthropic API key (starts with "sk-ant-")
   *                → used to call Claude AI for the AI Assist feature
   *                → stored only in YOUR browser, never sent elsewhere
   *  - author:     your display name (e.g. "@ty")
   *  - promptTime: what time to send the daily reminder notification
   *                (default: 20:00 = 8pm)
   *  - theme:      which colour scheme the admin panel uses
   */
  const DEFAULT_SETTINGS = {
    apiKey:     '',            // empty until you add it in Settings
    author:     '',            // empty until you fill it in
    promptTime: '20:00',       // 8pm daily reminder
    theme:      'tokyo-night', // the default colour scheme
  };

  const Settings = {

    /*
     * get — returns current settings merged with the defaults.
     *
     * The "spread" trick (...) means: start with DEFAULT_SETTINGS,
     * then overwrite any values that exist in storage. This way:
     * - New settings added in future updates always have a default
     * - Missing keys never cause "undefined" errors
     */
    get() {
      return { ...DEFAULT_SETTINGS, ...(safeGet(KEYS.SETTINGS) || {}) };
    },

    /*
     * save — writes new settings after validating each field.
     *
     * Validation examples:
     * - promptTime must match "HH:MM" format (e.g. "20:00", not "8pm")
     * - theme must be one of the five known theme names
     * - author is sanitized (max 40 chars)
     */
    save(data) {
      const current = this.get(); // load what's already saved
      const updated = {
        ...current, // keep existing values as the base

        // API key: trim whitespace, but don't sanitize (keys can contain special chars)
        apiKey: typeof data.apiKey === 'string'
          ? data.apiKey.trim()
          : current.apiKey,

        // Author: sanitize for safety, limit to 40 characters
        author: typeof data.author === 'string'
          ? sanitizeText(data.author).slice(0, 40)
          : current.author,

        // Prompt time: the regex \d{2}:\d{2} means "2 digits, colon, 2 digits"
        promptTime: /^\d{2}:\d{2}$/.test(data.promptTime || '')
          ? data.promptTime
          : current.promptTime,

        // Theme: only accept known valid names — anything else is ignored
        theme: ['tokyo-night', 'catppuccin', 'nord', 'dracula', 'gruvbox'].includes(data.theme)
          ? data.theme
          : current.theme,
      };

      safeSet(KEYS.SETTINGS, updated);
      return updated;
    },
  };


  /* ============================================================
   *  IMPORT / EXPORT — Backup and restore your blog data
   * ============================================================
   *
   *  These functions let you:
   *  EXPORT: download all posts + categories as a .json file
   *  IMPORT: restore from a previously exported .json file
   *
   *  Use cases: backups, moving to a new device, recovering from
   *  accidental data loss (e.g. clearing browser storage).
   *
   *  The file includes a version number so future versions of
   *  the blog can still read older backup files correctly.
   */

  /*
   * exportData — packages everything into a formatted JSON string.
   * The admin.js file triggers a file download when this is called.
   */
  function exportData() {
    return JSON.stringify({
      version:    1,                        // format version — helps with future compatibility
      exportedAt: new Date().toISOString(), // timestamp so you know when the backup was made
      posts:      Posts.getAll(),
      categories: Categories.getAll(),
      // Note: Settings are NOT exported (they contain your API key)
    }, null, 2); // the "2" adds indentation, making the JSON file human-readable
  }

  /*
   * importData — reads and restores data from an exported JSON file.
   *
   * Important safety steps:
   * 1. Parse the JSON (convert the text file back to a JavaScript object)
   * 2. Validate the format before touching any existing data
   * 3. Re-sanitize ALL content on the way in — even your own backup
   *    could theoretically be tampered with, so we never trust it blindly
   */
  function importData(jsonString) {
    const data = JSON.parse(jsonString); // convert the text file back to a JS object

    // Bail out early with a clear error if the file doesn't look right
    if (!data || data.version !== 1)  throw new Error('Invalid format — not a Dev Blog backup');
    if (!Array.isArray(data.posts))   throw new Error('No posts array found in this file');

    // Re-sanitize every post on the way in
    const posts = data.posts.map(p => ({
      id:          typeof p.id === 'string' ? p.id : crypto.randomUUID(), // keep original ID or generate new
      title:       sanitizeText(p.title || ''),
      content:     sanitizeMarkdown(p.content || ''),
      category:    sanitizeText(p.category || ''),
      tags:        Array.isArray(p.tags) ? p.tags.map(t => sanitizeText(t)).slice(0, 10) : [],
      createdAt:   typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
      updatedAt:   new Date().toISOString(), // mark import time as "last updated"
      aiGenerated: Boolean(p.aiGenerated),
      attachments: Array.isArray(p.attachments) ? p.attachments : [],
    }));

    safeSet(KEYS.POSTS, posts); // overwrite existing posts with the imported ones

    // Import categories too, if they're present in the backup
    if (Array.isArray(data.categories)) {
      safeSet(KEYS.CATEGORIES, data.categories);
    }
  }


  /*
   * ============================================================
   *  WHAT THIS FILE EXPORTS
   * ============================================================
   *
   *  Only these four things are accessible from other files.
   *  Everything else (sanitizeText, safeGet, etc.) is private.
   *
   *  Usage from other files:
   *    Store.Posts.getAll()
   *    Store.Categories.create("Audio", "#73daca")
   *    Store.Settings.save({ theme: "dracula" })
   *    Store.exportData()
   */
  return { Posts, Categories, Settings, exportData, importData, loadStaticContent };

})(); // ← the () here immediately runs the function that wraps everything above
