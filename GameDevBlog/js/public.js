/*
 * ============================================================
 *  PUBLIC.JS — The Visitor-Facing Blog (index.html)
 * ============================================================
 *
 *  This file controls everything visitors see when they come
 *  to your blog. It is intentionally minimal and read-only —
 *  there are no create, edit, or delete buttons here.
 *
 *  WHAT VISITORS CAN DO:
 *  ✓ Browse the post feed
 *  ✓ Click a post to read the full thing
 *  ✓ Search posts by keyword
 *  ✓ Filter posts by category
 *  ✓ Click category labels in the sidebar
 *  ✓ Download attached files
 *  ✓ Watch embedded YouTube/Vimeo videos
 *  ✓ Click "Owner Login" to open the login popup (bottom of sidebar)
 *
 *  WHAT VISITORS CANNOT DO:
 *  ✗ See the editor, AI Assist, or Settings
 *  ✗ See any write/edit/delete controls
 *  ✗ Change the site theme
 *  ✗ Access the admin panel (without being the verified GitHub owner)
 *
 *  HOW THE PAGE WORKS:
 *  The blog has two "views" — the feed and a single post.
 *  Only one is visible at a time. Clicking a post card switches
 *  to the detail view. Clicking "← back" switches back to the feed.
 *  The actual URL doesn't change — the switching is done in JavaScript
 *  by showing/hiding HTML elements. This is called a Single Page App (SPA).
 * ============================================================
 */

'use strict';

const Public = (() => {

  /*
   * $ — A shortcut function for finding elements on the page.
   * document.getElementById("searchInput") is long to type repeatedly,
   * so we alias it as $("searchInput"). This is a very common pattern.
   */
  const $ = id => document.getElementById(id);


  /* ============================================================
   *  HELPER FUNCTIONS — Small utilities used throughout the file
   * ============================================================ */

  /*
   * formatDate — Converts a computer date string into a human-readable one.
   *
   * Posts are stored with dates like "2026-06-19T20:00:00.000Z"
   * (ISO 8601 format — a universal standard for dates).
   * We convert that to something friendlier like "Jun 19, 2026".
   *
   * The try/catch prevents a crash if a post somehow has a bad date.
   */
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch {
      return ''; // return empty string rather than crashing
    }
  }

  /*
   * toast — Shows a temporary notification message at the bottom-right.
   *
   * Used to give feedback like "Error: Access denied."
   * Each message disappears automatically after 3.8 seconds.
   *
   * PARAMETERS:
   * msg  — the text to display
   * type — 'info', 'success', or 'error' (affects the colour)
   */
  function toast(msg, type = 'info') {
    const icons = { success: '✓', error: '✕', info: '◈' };
    const t = document.createElement('div'); // create a new <div> element
    t.className = `toast ${type}`;           // apply CSS classes for styling
    t.innerHTML = `<span class="toast-icon">${icons[type] || '◈'}</span><span>${msg}</span>`;
    $('toastContainer').appendChild(t);      // add it to the page
    setTimeout(() => t.remove(), 3800);      // remove it after 3.8 seconds
  }

  /*
   * getCategoryById — Looks up a category object by its ID.
   *
   * Posts store a category ID (like "c2"), not the full name.
   * This function fetches the full category object so we can
   * display the name and colour.
   * Returns null if no matching category is found.
   */
  function getCategoryById(id) {
    return Store.Categories.getAll().find(c => c.id === id) || null;
  }

  /*
   * getFileIcon — Returns an emoji icon for a file based on its type.
   *
   * File types are identified by their "MIME type" — a standardised
   * string like "image/png" or "application/pdf" that describes
   * what kind of data the file contains.
   *
   * PARAMETER:
   * mime — the MIME type string (e.g. "image/jpeg", "application/pdf")
   */
  function getFileIcon(mime = '') {
    if (mime.startsWith('image/'))                    return '🖼️';
    if (mime.startsWith('video/'))                    return '🎬';
    if (mime.startsWith('audio/'))                    return '🎵';
    if (mime.includes('pdf'))                         return '📄';
    if (mime.includes('zip') || mime.includes('tar')) return '📦';
    return '📎'; // default for unknown file types
  }

  /*
   * formatBytes — Converts a raw file size (in bytes) to a readable string.
   *
   * 1,024 bytes = 1 KB, 1,048,576 bytes = 1 MB.
   * We use these conversions to show "2.4 KB" or "1.1 MB" instead of
   * an incomprehensibly large number like "2,457 bytes".
   *
   * PARAMETER:
   * bytes — the file size as a raw number
   */
  function formatBytes(bytes) {
    if (!bytes)               return '';
    if (bytes < 1024)         return bytes + 'B';
    if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }


  /* ============================================================
   *  showView — Switches between the feed and post detail views
   * ============================================================
   *
   *  The page has two "views" — named sections that can be
   *  shown or hidden. Only one is ever visible at a time.
   *
   *  We switch views by:
   *  1. Removing the 'active' class from ALL views (hides them all)
   *  2. Adding 'active' back to just the one we want (makes it visible)
   *
   *  The CSS in style.css says: .view { display: none } and
   *  .view.active { display: block }
   *
   *  PARAMETER:
   *  name — 'home' (the feed) or 'post' (a single post)
   */
  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${name}`);
    if (target) target.classList.add('active');
  }


  /* ============================================================
   *  renderSidebarCategories — Populates the category list in the sidebar
   * ============================================================
   *
   *  The sidebar shows each category with a coloured dot and
   *  a count of how many posts belong to it. Clicking a category
   *  filters the feed to show only posts in that category.
   *
   *  This function rebuilds the entire list from scratch each time
   *  it's called, ensuring the counts are always accurate.
   */
  function renderSidebarCategories() {
    const list  = $('categoryList');
    if (!list) return; // safety check — exit if the element doesn't exist on the page

    const cats  = Store.Categories.getAll();
    const posts = Store.Posts.getAll();

    list.innerHTML = ''; // clear any previously rendered items

    cats.forEach(cat => {
      // Count how many posts belong to this category
      const count = posts.filter(p => p.category === cat.id).length;

      const li = document.createElement('li');
      li.className = 'category-item';

      // Accessibility: make it keyboard-navigable and announce correctly to screen readers
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0'); // 0 = included in normal tab order
      li.setAttribute('aria-label', `${cat.name}, ${count} posts`);

      // The coloured dot uses the category's hex colour as an inline style
      li.innerHTML = `
        <span class="category-name">
          <span class="category-dot" style="background:${cat.color}"></span>${cat.name}
        </span>
        <span class="category-count">${count}</span>`;

      // Clicking a category sets the filter dropdown and refreshes the post feed
      li.addEventListener('click', () => {
        $('categoryFilter').value = cat.id; // set the dropdown value
        showView('home');                   // switch to the feed view if we're on a post
        renderPosts();                      // re-render the filtered list
      });

      // Also handle keyboard activation (Enter or Space bar = same as a click)
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') li.click();
      });

      list.appendChild(li); // add this category item to the sidebar list
    });
  }

  /*
   * populateCategorySelect — Fills the category filter dropdown above the post grid.
   *
   * The dropdown starts with "all categories" and then lists each category.
   * We preserve the currently selected value so it doesn't reset when
   * the list refreshes.
   */
  function populateCategorySelect() {
    const sel = $('categoryFilter');
    if (!sel) return;

    const cats = Store.Categories.getAll();
    const curr = sel.value; // remember the current selection before we clear it

    sel.innerHTML =
      '<option value="">all categories</option>' +
      cats.map(c => `<option value="${c.id}"${c.id === curr ? ' selected' : ''}>${c.name}</option>`).join('');
    // The ternary `c.id === curr ? ' selected' : ''` re-selects the same option after refresh
  }


  /* ============================================================
   *  renderPosts — Builds the post card grid on the home feed
   * ============================================================
   *
   *  This is the main function that draws the post cards you see
   *  on the homepage. It's called:
   *  - When the page first loads
   *  - When the search query changes
   *  - When the category filter changes
   *  - After navigating back from a post detail
   *
   *  HOW IT WORKS:
   *  1. Reads the current search text and selected category
   *  2. Asks Store.Posts.search() to filter the posts
   *  3. If no posts match, shows the empty state message
   *  4. Otherwise, builds an HTML card for each post and
   *     adds it to the grid container
   *  5. Attaches click handlers so clicking a card opens the post
   */
  function renderPosts() {
    const query    = $('searchInput')?.value || '';
    const category = $('categoryFilter')?.value || '';
    const posts    = Store.Posts.search(query, category); // filtered list from the store

    const grid    = $('postsGrid');
    const empty   = $('emptyState');
    const countEl = $('postCount');

    // Update the post count label at the top (e.g. "12 entries")
    if (countEl) countEl.textContent = `${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}`;

    // Refresh the sidebar categories and dropdown (counts may have changed)
    renderSidebarCategories();
    populateCategorySelect();

    // If there are no results, show the "no entries yet" empty state
    if (!posts.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden'); // show the empty state message
      return;
    }

    empty.classList.add('hidden'); // hide the empty state if we have results

    /*
     * Build the HTML for each post card.
     *
     * .map() loops over every post and returns an HTML string for it.
     * .join('') combines all the strings into one long HTML block.
     * We then set that as the grid's content all at once (one DOM update = faster).
     *
     * TEMPLATE LITERALS:
     * The `backtick` strings with ${...} are template literals — they let
     * us embed JavaScript expressions directly inside HTML strings.
     */
    grid.innerHTML = posts.map(post => {

      // Build the coloured category badge (or empty string if no category)
      const cat = getCategoryById(post.category);
      const badgeHtml = cat
        ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`
        // The "22" and "44" appended to the hex colour create semi-transparent versions (in hex, 22 ≈ 13% opacity)
        : '';

      // Build the tags row (or empty string if no tags)
      const tagsHtml = post.tags?.length
        ? `<div class="post-card-tags">${post.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
        : '';

      // Show a 📎 indicator if the post has attached files or embedded videos
      const hasMedia = post.attachments?.length ||
                       post.content?.includes('youtube.com') ||
                       post.content?.includes('vimeo.com');
      const mediaIndicator = hasMedia
        ? `<span class="media-indicator" title="Contains media" aria-label="Contains media">📎</span>`
        : '';

      // Return the complete card HTML
      return `
        <article class="post-card" role="article" tabindex="0" data-id="${post.id}" aria-label="${post.title}">
          <div class="post-card-meta">
            <time class="post-date" datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
            <div style="display:flex;gap:6px;align-items:center">${badgeHtml}${mediaIndicator}</div>
          </div>
          <h3 class="post-card-title">${post.title}</h3>
          <p class="post-card-excerpt">${Markdown.excerpt(post.content)}</p>
          ${tagsHtml}
        </article>`;

    }).join(''); // join all card HTML strings into one big block

    // Attach click and keyboard handlers to each card after the HTML is rendered
    grid.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click',   () => openPost(card.dataset.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openPost(card.dataset.id); });
      // card.dataset.id reads the data-id="..." attribute we put on each <article>
    });
  }


  /* ============================================================
   *  openPost — Shows the full content of a single post
   * ============================================================
   *
   *  Called when a visitor clicks a post card.
   *
   *  WHAT IT RENDERS:
   *  - Post title (displayed using the pixel font)
   *  - Date, category badge, and "✦ ai" label if AI-generated
   *  - Tags row
   *  - Full post body, rendered from Markdown to HTML
   *  - Attached files section (if any) with download links
   *
   *  SECURITY:
   *  All external links (any href starting with "http")
   *  get target="_blank" and rel="noopener noreferrer" added.
   *  - target="_blank" opens the link in a new tab
   *  - rel="noopener noreferrer" prevents the new tab from
   *    being able to control or read data from your blog tab
   *    (a security vulnerability called "reverse tabnapping")
   *
   *  PARAMETER:
   *  id — the unique ID of the post to open
   */
  function openPost(id) {
    const post = Store.Posts.getById(id);
    if (!post) return; // safety check — do nothing if post not found

    // Build the category badge
    const cat = getCategoryById(post.category);
    const badgeHtml = cat
      ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`
      : '';

    // Build the tags row
    const tagsHtml = post.tags?.length
      ? `<div class="post-detail-tags">${post.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
      : '';

    // Build the attachments section
    // Each attachment is stored as a base64 data URL so it can be downloaded
    // directly from the browser without needing a server
    let attachHtml = '';
    if (post.attachments?.length) {
      attachHtml = `
        <div class="public-attachments">
          <h3 class="attachments-heading">📎 Attached Files</h3>
          <div class="attachments-list">
            ${post.attachments.map(a => `
              <a class="attachment-item"
                 href="${a.dataUrl}"
                 download="${a.name}"
                 aria-label="Download ${a.name}">
                <span class="attach-icon">${getFileIcon(a.type)}</span>
                <span class="attach-name">${a.name}</span>
                <span class="attach-size">${formatBytes(a.size)}</span>
              </a>`).join('')}
          </div>
        </div>`;
    }

    // Build the full post detail HTML and inject it into the page
    $('postDetail').innerHTML = `
      <header class="post-detail-header">
        <h2 class="post-detail-title">${post.title}</h2>
        <div class="post-detail-meta">
          <time class="post-date" datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
          ${badgeHtml}
          ${post.aiGenerated ? '<span class="tag" style="color:var(--accent-2)">✦ ai</span>' : ''}
        </div>
        ${tagsHtml}
      </header>
      <div class="post-detail-body">${Markdown.render(post.content)}</div>
      ${attachHtml}`;

    // Make all external links open in a new tab safely
    $('postDetail').querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('http')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });

    showView('post'); // switch from the feed to the detail view
  }


  /* ============================================================
   *  initLoginPopup — Sets up the Owner Login popup behaviour
   * ============================================================
   *
   *  The login popup is a small modal (an overlay window) that
   *  appears when you click the "Owner Login" button in the sidebar.
   *  It contains a single button: "Continue with GitHub".
   *
   *  OPEN/CLOSE BEHAVIOUR:
   *  - Login button → opens the popup (removes 'hidden' class)
   *  - ✕ button in the corner → closes it
   *  - Clicking the dark background behind it → closes it
   *  - Pressing Escape key → closes it
   *
   *  These multiple ways to close follow standard UX conventions
   *  for modal dialogs.
   */
  function initLoginPopup() {
    const overlay  = $('loginOverlay');   // the dark semi-transparent background
    const loginBtn = $('loginBtn');       // the "Owner Login" button in the sidebar
    const closeBtn = $('loginClose');     // the ✕ button inside the popup
    const ghBtn    = $('githubLoginBtn'); // the "Continue with GitHub" button

    // Open the popup
    loginBtn?.addEventListener('click', () => overlay?.classList.remove('hidden'));

    // Close by clicking ✕
    closeBtn?.addEventListener('click', () => overlay?.classList.add('hidden'));

    // Close by clicking the dark overlay background (but NOT the popup itself)
    overlay?.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
      // e.target is the element that was actually clicked
      // If it's the overlay (not a child inside the popup), close it
    });

    // Close by pressing Escape anywhere on the page
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') overlay?.classList.add('hidden');
    });

    // "Continue with GitHub" → start the OAuth login flow
    ghBtn?.addEventListener('click', () => {
      Auth.login(); // redirects the browser to GitHub's login page
    });
  }


  /* ============================================================
   *  init — The startup function, runs when the page loads
   * ============================================================
   *
   *  This is called at the bottom of the file via:
   *  document.addEventListener('DOMContentLoaded', Public.init)
   *
   *  "DOMContentLoaded" fires when the browser has finished
   *  reading and building the HTML structure but before images
   *  have loaded. It's the right moment to start adding
   *  JavaScript behaviour to page elements.
   *
   *  WHAT INIT DOES:
   *  1. Checks if we're returning from GitHub OAuth (login callback)
   *     → If logged in as the owner, redirect to admin panel
   *  2. Sets up the colour theme
   *  3. Attaches all the event listeners (search, filter, back button, etc.)
   *  4. Renders the initial post feed
   */
  async function init() {

    /*
     * Step 1: Handle OAuth callback
     *
     * If you just approved the login on GitHub, the URL will
     * contain "?code=...&state=...". Auth.handlePageLoad() detects
     * this and completes the login process.
     *
     * If the login is successful, we redirect to admin.html.
     * If it fails, we show an error toast and stay on the public page.
     *
     * Note the "async" keyword on init and "await" here —
     * this tells JavaScript to WAIT for handlePageLoad to finish
     * before doing anything else. Without this, the redirect
     * might not happen before the rest of init runs.
     */
    try {
      const result = await Auth.handlePageLoad();
      if (result.status === 'callback' || result.status === 'authenticated') {
        // Successfully verified as the owner — go to the admin panel
        window.location.href = 'admin.html';
        return; // stop here, don't run the rest of init
      }
    } catch (e) {
      toast(e.message, 'error'); // show the error (e.g. "Access denied")
    }

    // Step 2: Load the saved colour theme (visitors can't change it, but it initialises to default)
    Themes.init();

    // Step 3: Wire up the "All Posts" nav link in the sidebar
    document.querySelectorAll('[data-filter]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault(); // stop the link from navigating to "#"
        $('categoryFilter').value = el.dataset.filter; // set the filter (empty string = all)
        showView('home');
        renderPosts();
      });
    });

    // Step 4: Search bar — re-renders posts as you type, with a small delay
    let searchTimer; // used to debounce (avoid running on every single keystroke)
    $('searchInput')?.addEventListener('input', () => {
      clearTimeout(searchTimer); // cancel any pending render
      searchTimer = setTimeout(renderPosts, 220); // wait 220ms after last keystroke before rendering
      // This "debounce" prevents the page from re-rendering dozens of times while you type
    });

    // Step 5: Category dropdown — re-render immediately when selection changes
    $('categoryFilter')?.addEventListener('change', renderPosts);

    // Step 6: "← back" button — return to the feed from a post detail view
    $('backBtn')?.addEventListener('click', () => {
      showView('home');
      renderPosts(); // refresh in case anything changed while viewing the post
    });

    // Step 7: Set up the login popup behaviour
    initLoginPopup();

    // Step 8: Mobile hamburger menu (the ☰ button that shows/hides the sidebar on small screens)
    $('hamburger')?.addEventListener('click', () => {
      const open = $('sidebar').classList.toggle('open'); // toggle returns the new state
      $('hamburger').classList.toggle('open', open);
      $('hamburger').setAttribute('aria-expanded', String(open)); // accessibility: announce state
    });

    // Close the sidebar if you click anywhere outside of it on mobile
    document.addEventListener('click', e => {
      if (window.innerWidth <= 768 &&                     // only on small screens
          !$('sidebar').contains(e.target) &&             // click was NOT inside the sidebar
          !$('hamburger').contains(e.target)) {           // click was NOT the hamburger button
        $('sidebar').classList.remove('open');
        $('hamburger').classList.remove('open');
        $('hamburger').setAttribute('aria-expanded', 'false');
      }
    });

    // Step 9: Render the initial post feed
    renderPosts();
    renderSidebarCategories();
  }

  /*
   * WHAT THIS FILE EXPORTS
   * Only init() needs to be accessible from outside this module.
   * Everything else is internal.
   */
  return { init };

})();

/*
 * START THE APP
 * When the browser finishes loading the HTML, run Public.init().
 * This is the entry point — the very first thing that runs
 * when a visitor opens the page.
 */
document.addEventListener('DOMContentLoaded', Public.init);
