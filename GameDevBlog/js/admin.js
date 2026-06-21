/*
 * ============================================================
 *  ADMIN.JS — The Owner's Control Panel (admin.html)
 * ============================================================
 *
 *  This file only runs when YOU are logged in as the verified
 *  GitHub owner. If someone who isn't you tries to visit
 *  admin.html directly, Auth.handlePageLoad() will fail the
 *  identity check and redirect them back to index.html.
 *
 *  WHAT THIS FILE CONTROLS:
 *  ┌────────────────────────────────────────────────────────┐
 *  │  POSTS VIEW    │ Browse all posts with edit/delete     │
 *  │  WRITE VIEW    │ Rich Markdown editor with media tools │
 *  │  AI ASSIST     │ Brain-dump → full blog post via Claude│
 *  │  SETTINGS      │ API key, theme, notifications         │
 *  └────────────────────────────────────────────────────────┘
 *
 *  HOW THE VIEWS WORK:
 *  The admin panel is a "single page app" — the URL never changes
 *  but different sections (views) are shown or hidden depending
 *  on which nav item you click. Only one view is visible at once.
 *
 *  FILE ATTACHMENTS:
 *  Files are stored as "base64 data URLs" — a way of encoding
 *  any binary file (image, PDF, ZIP, etc.) as a plain text string.
 *  This lets us store files directly in localStorage without
 *  needing a file server. The trade-off is storage size:
 *  localStorage has a ~5MB limit per domain, so large attachments
 *  should be hosted externally (e.g. GitHub, Imgur) and linked.
 * ============================================================
 */

'use strict';

const Admin = (() => {

  /*
   * $ — Shortcut for document.getElementById().
   * Saves typing the full method name dozens of times.
   */
  const $ = id => document.getElementById(id);

  /*
   * STATE VARIABLES
   * ───────────────
   * These variables track "what's currently happening" in the UI.
   * They're defined here (outside any function) so all functions
   * in this module can read and update them.
   *
   * currentEditId:      null if writing a NEW post; a post ID if editing an existing one
   * pendingAttachments: files staged for the current post but not yet saved
   * generatedPost:      holds AI-generated content before the user decides to publish/edit it
   */
  let currentEditId       = null;
  let pendingAttachments  = [];
  let generatedPost       = null;


  /* ============================================================
   *  HELPER FUNCTIONS
   * ============================================================ */

  /* formatDate — converts "2026-06-19T20:00:00Z" → "Jun 19, 2026" */
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
    } catch { return ''; }
  }

  /*
   * formatBytes — converts raw byte count to readable file size.
   * 1024 bytes = 1 KB, 1048576 bytes = 1 MB.
   */
  function formatBytes(b) {
    if (!b)           return '';
    if (b < 1024)     return b + 'B';
    if (b < 1048576)  return (b / 1024).toFixed(1) + 'KB';
    return (b / 1048576).toFixed(1) + 'MB';
  }

  /*
   * getFileIcon — picks an emoji icon based on the file's MIME type.
   * MIME type is a standard string that identifies file kinds
   * (e.g. "image/png", "application/pdf", "video/mp4").
   */
  function getFileIcon(mime = '') {
    if (mime.startsWith('image/'))                      return '🖼️';
    if (mime.startsWith('video/'))                      return '🎬';
    if (mime.startsWith('audio/'))                      return '🎵';
    if (mime.includes('pdf'))                           return '📄';
    if (mime.includes('zip') || mime.includes('tar'))   return '📦';
    return '📎';
  }

  /*
   * toast — shows a temporary pop-up notification at the bottom-right.
   * Automatically disappears after 3.8 seconds.
   * type: 'info' (blue ◈), 'success' (green ✓), or 'error' (red ✕)
   */
  function toast(msg, type = 'info') {
    const icons = { success: '✓', error: '✕', info: '◈' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || '◈'}</span><span>${msg}</span>`;
    $('toastContainer').appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }

  /* getCategoryById — looks up a category object by its ID string */
  function getCategoryById(id) {
    return Store.Categories.getAll().find(c => c.id === id) || null;
  }


  /* ============================================================
   *  VIEW ROUTER — Switches between the four admin panel sections
   * ============================================================
   *
   *  Works by:
   *  1. Removing 'active' from all views (hiding them all)
   *  2. Adding 'active' to only the requested view
   *  3. Highlighting the matching nav link in the sidebar
   *  4. Running any initialisation needed for that view
   *
   *  PARAMETER:
   *  name — 'posts', 'write', 'ai-assist', 'settings', or 'post'
   */
  function showView(name) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Show the requested view (its ID is "view-{name}" in the HTML)
    const target = $(`view-${name}`);
    if (target) target.classList.add('active');

    // Update the sidebar nav links: highlight the active one, clear the others
    document.querySelectorAll('.nav-link[data-view]').forEach(l => {
      const active = l.dataset.view === name;
      l.classList.toggle('active', active);
      active ? l.setAttribute('aria-current', 'page') : l.removeAttribute('aria-current');
    });

    // Run initialisation for views that need it
    if (name === 'posts')     renderPosts();
    if (name === 'write')     initWriteView();
    if (name === 'ai-assist') initAIView();
    if (name === 'settings')  initSettingsView();

    // On mobile: close the sidebar when you navigate (it overlaps the content)
    if (window.innerWidth <= 768) {
      $('sidebar').classList.remove('open');
      $('hamburger').classList.remove('open');
      $('hamburger').setAttribute('aria-expanded', 'false');
    }
  }


  /* ============================================================
   *  SIDEBAR — Categories list and dropdowns
   * ============================================================ */

  /*
   * renderSidebarCategories — rebuilds the category list in the sidebar.
   *
   * Shows each category with a coloured dot and a post count.
   * Clicking a category sets the filter dropdown and refreshes the post grid.
   */
  function renderSidebarCategories() {
    const list  = $('categoryList');
    const cats  = Store.Categories.getAll();
    const posts = Store.Posts.getAll();
    list.innerHTML = ''; // clear and rebuild from scratch

    cats.forEach(cat => {
      const count = posts.filter(p => p.category === cat.id).length; // how many posts in this category

      const li = document.createElement('li');
      li.className = 'category-item';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.innerHTML = `
        <span class="category-name">
          <span class="category-dot" style="background:${cat.color}"></span>${cat.name}
        </span>
        <span class="category-count">${count}</span>`;

      li.addEventListener('click', () => {
        $('categoryFilter').value = cat.id;
        showView('posts'); // navigate to the posts list
      });
      li.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') li.click();
      });
      list.appendChild(li);
    });
  }

  /*
   * populateCategorySelects — fills all category dropdown menus.
   *
   * There are three dropdowns that need category lists:
   * - postCategory: in the write/edit form
   * - aiCategory:   in the AI Assist form
   * - categoryFilter: the filter above the post grid
   */
  function populateCategorySelects() {
    const cats = Store.Categories.getAll();
    const opts = '<option value="">Uncategorized</option>' +
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Populate the write form and AI form category selects
    ['postCategory', 'aiCategory'].forEach(id => {
      const s = $(id);
      if (s) s.innerHTML = opts;
    });

    // Populate the filter dropdown (includes "all categories" as first option)
    const f = $('categoryFilter');
    if (f) f.innerHTML = '<option value="">all categories</option>' +
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }


  /* ============================================================
   *  POSTS MANAGEMENT VIEW — The main list of all blog posts
   * ============================================================
   *
   *  Renders post cards with Edit and Delete buttons visible
   *  on hover. This is the admin version of the post grid —
   *  it includes the management controls visitors don't see.
   */
  function renderPosts() {
    const query    = $('searchInput')?.value || '';
    const category = $('categoryFilter')?.value || '';
    const posts    = Store.Posts.search(query, category);
    const grid     = $('postsGrid');
    const empty    = $('emptyState');

    // Update the post count label (e.g. "8 entries")
    $('postCount').textContent = `${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}`;

    renderSidebarCategories();
    populateCategorySelects();

    if (!posts.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Build HTML for each post card
    grid.innerHTML = posts.map(post => {
      const cat = getCategoryById(post.category);

      // Category badge (coloured pill label)
      const badge = cat
        ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`
        : '';

      // Tags row
      const tags = post.tags?.length
        ? `<div class="post-card-tags">${post.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
        : '';

      // Attachment count indicator (shows number of attached files)
      const media = post.attachments?.length
        ? `<span class="media-indicator">📎 ${post.attachments.length}</span>`
        : '';

      return `
        <article class="post-card admin-card" role="article" tabindex="0" data-id="${post.id}">
          <div class="post-card-meta">
            <time class="post-date" datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
            <div style="display:flex;gap:6px;align-items:center">${badge}${media}</div>
          </div>
          <h3 class="post-card-title">${post.title}</h3>
          <p class="post-card-excerpt">${Markdown.excerpt(post.content)}</p>
          ${tags}
          <!-- Admin controls: Edit and Delete buttons appear on hover -->
          <div class="admin-card-actions">
            <button class="btn-ghost btn-sm edit-btn" data-id="${post.id}" aria-label="Edit post">Edit</button>
            <button class="btn-danger btn-sm delete-btn" data-id="${post.id}" aria-label="Delete post">Delete</button>
          </div>
        </article>`;
    }).join('');

    // Attach click handlers to cards: clicking the card body opens the post detail,
    // but clicking Edit or Delete does something different (handled below)
    grid.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click', e => {
        // Only open the post if the click wasn't on a button
        if (!e.target.closest('.admin-card-actions')) openPost(card.dataset.id);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.target.closest('button')) openPost(card.dataset.id);
      });
    });

    // Wire up the Edit buttons
    grid.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => editPost(b.dataset.id)));

    // Wire up the Delete buttons
    grid.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.id)));
  }


  /* ============================================================
   *  POST DETAIL VIEW — Full rendered post (admin version)
   * ============================================================
   *
   *  Similar to the public post view, but with Edit and Delete
   *  buttons in a toolbar above the post content.
   */
  function openPost(id) {
    const post = Store.Posts.getById(id);
    if (!post) return;

    const cat = getCategoryById(post.category);
    const badge = cat
      ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`
      : '';
    const tags = post.tags?.length
      ? `<div class="post-detail-tags">${post.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
      : '';

    // Build the file attachments section
    let attachHtml = '';
    if (post.attachments?.length) {
      attachHtml = `
        <div class="public-attachments">
          <h3 class="attachments-heading">📎 Attached Files</h3>
          <div class="attachments-list">
            ${post.attachments.map(a => `
              <a class="attachment-item" href="${a.dataUrl}" download="${a.name}">
                <span class="attach-icon">${getFileIcon(a.type)}</span>
                <span class="attach-name">${a.name}</span>
                <span class="attach-size">${formatBytes(a.size)}</span>
              </a>`).join('')}
          </div>
        </div>`;
    }

    // Inject the full post HTML into the detail container
    $('postDetail').innerHTML = `
      <header class="post-detail-header">
        <h2 class="post-detail-title">${post.title}</h2>
        <div class="post-detail-meta">
          <time class="post-date" datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
          ${badge}
          ${post.aiGenerated ? '<span class="tag" style="color:var(--accent-2)">✦ ai</span>' : ''}
        </div>
        ${tags}
      </header>
      <div class="post-detail-body">${Markdown.render(post.content)}</div>
      ${attachHtml}`;

    // Make external links open safely in new tabs
    $('postDetail').querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (h.startsWith('http')) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });

    // Wire up the toolbar Edit and Delete buttons to this specific post
    $('editPostBtn').onclick   = () => editPost(post.id);
    $('deletePostBtn').onclick = () => confirmDelete(post.id);

    showView('post');
  }


  /* ============================================================
   *  WRITE VIEW — The Markdown editor
   * ============================================================
   *
   *  Used for both CREATING new posts and EDITING existing ones.
   *  The state variable `currentEditId` tells us which mode we're in:
   *  - null         → creating a new post
   *  - a post ID    → editing an existing post
   *
   *  FEATURES:
   *  - Markdown textarea with write/preview tabs
   *  - Media toolbar for inserting images, videos, and links
   *  - File attachment panel
   *  - "AI Beautify" button to polish the draft via Claude
   */

  /*
   * initWriteView — resets the editor to a clean state for a new post.
   *
   * PARAMETER:
   * postId — null for new post, or an ID string when editing
   */
  function initWriteView(postId = null) {
    currentEditId = postId; // remember whether we're editing or creating

    // Update the heading and button label to match the mode
    $('writeViewTitle').textContent = postId ? 'Edit Entry'     : 'New Entry';
    $('savePostBtn').textContent    = postId ? '✦ Update Entry' : '✦ Publish Entry';

    // If creating a new post, clear all form fields
    if (!postId) {
      $('postTitle').value = $('postContent').value = $('postTags').value = '';
      $('postCategory').value = '';
    }

    // Reset attachments to empty (editPost() will re-populate them for existing posts)
    pendingAttachments = [];
    renderAttachments();
    populateCategorySelects();

    // Make sure we start on the "Write" tab (not "Preview")
    $('panel-write').classList.remove('hidden');
    $('panel-preview').classList.add('hidden');
    $('tab-write').classList.add('active');
    $('tab-write').setAttribute('aria-selected', 'true');
    $('tab-preview').classList.remove('active');
    $('tab-preview').setAttribute('aria-selected', 'false');
  }

  /*
   * editPost — loads an existing post into the editor for changes.
   *
   * Calls showView('write') to navigate to the editor, then
   * populates every form field with the post's existing data.
   * We use setTimeout to ensure the view has rendered before
   * we try to fill in the fields.
   */
  function editPost(id) {
    const post = Store.Posts.getById(id);
    if (!post) return;

    showView('write'); // navigate to the editor view

    // Small delay (50ms) to let the DOM update before populating fields
    setTimeout(() => {
      initWriteView(id); // set the mode to "editing this post ID"
      $('postTitle').value   = post.title;
      $('postContent').value = post.content;
      $('postTags').value    = (post.tags || []).join(', ');

      populateCategorySelects(); // rebuild the dropdown so we can select the right category
      // Another small delay for the dropdown to finish rendering
      setTimeout(() => {
        $('postCategory').value = post.category || '';
      }, 50);

      // Load the post's existing attachments into pendingAttachments
      pendingAttachments = post.attachments ? [...post.attachments] : [];
      // [...array] creates a copy — we don't want to mutate the original store data
      renderAttachments();
    }, 50);
  }

  /*
   * savePost — saves the current editor content as a new or updated post.
   *
   * Validates that title and content aren't empty, then calls either
   * Store.Posts.create() or Store.Posts.update() depending on the mode.
   */
  function savePost() {
    const title    = $('postTitle').value.trim();
    const content  = $('postContent').value.trim();
    const category = $('postCategory').value;
    const tags     = $('postTags').value.split(',')   // split "unity, navmesh, ai" by commas
                       .map(t => t.trim())             // trim whitespace from each tag
                       .filter(Boolean);               // remove empty strings

    // Basic validation — don't allow empty posts
    if (!title)   { toast('Please add a title.', 'error');          return; }
    if (!content) { toast('Content cannot be empty.', 'error');     return; }

    const data = { title, content, category, tags, attachments: pendingAttachments };

    if (currentEditId) {
      // Editing mode — update the existing post
      Store.Posts.update(currentEditId, data);
      toast('Entry updated!', 'success');
      openPost(currentEditId); // navigate to the updated post's detail view
    } else {
      // New post mode — create and navigate to it
      const post = Store.Posts.create(data);
      toast('Entry published!', 'success');
      pendingAttachments = []; // clear staged attachments after save
      openPost(post.id);
    }

    renderSidebarCategories(); // update counts in the sidebar
  }

  /*
   * confirmDelete — shows a confirmation modal before deleting a post.
   *
   * We always confirm destructive actions to prevent accidental deletion.
   * The modal has two buttons: Cancel (does nothing) and Delete (permanent).
   */
  function confirmDelete(id) {
    showModal('Delete Entry', 'Are you sure? This cannot be undone.', [
      { label: 'Cancel', cls: 'btn-ghost', action: closeModal },
      { label: 'Delete', cls: 'btn-danger', action: () => {
        Store.Posts.delete(id);
        closeModal();
        showView('posts'); // go back to the post list
        toast('Entry deleted.', 'info');
      }},
    ]);
  }


  /* ============================================================
   *  FILE ATTACHMENTS — Handling files in the editor
   * ============================================================
   *
   *  Files are stored as "base64 data URLs". Here's what that means:
   *
   *  Any file (image, PDF, etc.) is just binary data — a sequence of 0s and 1s.
   *  Base64 is a way to represent that binary data using only text characters
   *  (A-Z, a-z, 0-9, +, /). This means we can store the entire file
   *  as a string in localStorage.
   *
   *  A data URL looks like:
   *  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
   *   ─────────────────────  ──────────────────────────
   *   tells browser the type    the actual file as base64 text
   *
   *  When used as an <img src="..."> or <a href="..." download>,
   *  the browser knows how to decode and display/download the file.
   *
   *  LIMITATIONS:
   *  - localStorage has a ~5MB total limit per domain
   *  - Base64 encoding adds ~33% overhead (a 1MB file becomes ~1.33MB)
   *  - For large files, link to an external host (GitHub, Imgur, etc.)
   */

  /*
   * handleFileAttach — processes one or more dropped or selected files.
   *
   * For each file:
   * - Checks it's under 5MB
   * - Reads it as a base64 data URL using FileReader
   * - Adds it to pendingAttachments
   * - If it's an image, automatically inserts an ![img](data:...) tag
   *   into the Markdown editor so it's embedded in the post body too
   *
   * PARAMETER:
   * files — a FileList object from an <input type="file"> or drag-and-drop
   */
  function handleFileAttach(files) {
    const MAX_FILE_MB = 5;
    const MAX_FILES   = 10;

    if (pendingAttachments.length + files.length > MAX_FILES) {
      toast(`Max ${MAX_FILES} files per post.`, 'error');
      return;
    }

    Array.from(files).forEach(file => {
      // Check file size (file.size is in bytes; convert MB to bytes for comparison)
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast(`"${file.name}" exceeds ${MAX_FILE_MB}MB limit.`, 'error');
        return; // skip this file, continue with others
      }

      // FileReader is a browser API for reading file contents
      const reader = new FileReader();

      // This callback fires when the file has finished loading
      reader.onload = e => {
        pendingAttachments.push({
          name:    file.name,              // original filename (e.g. "screenshot.png")
          type:    file.type,              // MIME type (e.g. "image/png")
          size:    file.size,              // file size in bytes
          dataUrl: e.target.result,        // the base64 data URL (the actual file content as text)
        });

        renderAttachments(); // refresh the attachments panel UI

        // For images: also insert an inline image tag into the post body
        if (file.type.startsWith('image/')) {
          insertAtCursor($('postContent'), `\n![${file.name}](${e.target.result})\n`);
          toast(`Image "${file.name}" inserted into post.`, 'success');
        } else {
          toast(`File "${file.name}" attached.`, 'success');
        }
      };

      reader.readAsDataURL(file); // start reading the file (triggers onload when done)
    });
  }

  /*
   * renderAttachments — rebuilds the attachments panel UI.
   *
   * Shows a list of all staged files with their icon, name, size,
   * and a ✕ button to remove each one before saving.
   */
  function renderAttachments() {
    const list  = $('attachmentsList');
    const count = $('attachCount');

    count.textContent = `${pendingAttachments.length} file${pendingAttachments.length !== 1 ? 's' : ''}`;

    if (!pendingAttachments.length) {
      list.innerHTML = '<p class="attach-empty">No files attached.</p>';
      return;
    }

    // Build the list of file items
    list.innerHTML = pendingAttachments.map((a, i) => `
      <div class="attachment-item editable">
        <span class="attach-icon">${getFileIcon(a.type)}</span>
        <span class="attach-name">${a.name}</span>
        <span class="attach-size">${formatBytes(a.size)}</span>
        <button class="btn-ghost btn-sm remove-attach" data-idx="${i}" aria-label="Remove ${a.name}">✕</button>
      </div>`).join('');

    // Wire up the ✕ remove buttons
    list.querySelectorAll('.remove-attach').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingAttachments.splice(+btn.dataset.idx, 1); // remove the item at this index
        // +btn.dataset.idx converts the string "2" to the number 2
        renderAttachments(); // re-render the updated list
      });
    });
  }


  /* ============================================================
   *  TOOLBAR — Markdown formatting helpers
   * ============================================================
   *
   *  The toolbar above the editor provides buttons that insert
   *  Markdown snippets at the cursor position in the textarea.
   *
   *  These two helper functions do the actual text manipulation.
   */

  /*
   * insertAtCursor — inserts text at the cursor's current position in a textarea.
   *
   * selectionStart and selectionEnd give us where the cursor/selection is.
   * We split the textarea's value at those points and insert our text in the middle.
   * Then we move the cursor to just after the inserted text.
   *
   * PARAMETERS:
   * textarea — the <textarea> DOM element to insert into
   * text     — the string to insert
   */
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart; // cursor position (start of selection)
    const end   = textarea.selectionEnd;   // cursor position (end of selection)
    const val   = textarea.value;

    // Build the new value: text before cursor + inserted text + text after cursor
    textarea.value = val.slice(0, start) + text + val.slice(end);

    // Move the cursor to just after the inserted text
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus(); // return focus to the textarea
  }

  /*
   * wrapSelection — wraps the currently selected text with before/after strings.
   *
   * Example: select "hello", call wrapSelection(textarea, "**", "**")
   * Result: **hello**  (selected text becomes bold Markdown)
   *
   * If nothing is selected, wraps the placeholder word "text" instead.
   */
  function wrapSelection(textarea, before, after) {
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const sel   = textarea.value.slice(start, end) || 'text'; // use "text" if nothing selected
    insertAtCursor(textarea, before + sel + after);
  }


  /* ============================================================
   *  INSERT MODALS — Popup dialogs for inserting media
   * ============================================================
   *
   *  Each "Insert" button in the toolbar opens a modal dialog
   *  where you provide details (URL, file, etc.), then click
   *  "Insert" to add the appropriate Markdown to the editor.
   */

  /*
   * openInsertImage — opens the image insertion dialog.
   *
   * Has two tabs:
   * - "By URL": paste a URL like https://i.imgur.com/abc.png
   * - "Upload File": pick an image file from your computer
   *
   * Both options insert an ![alt text](url) Markdown tag.
   * Uploaded files become base64 data URLs.
   */
  function openInsertImage() {
    showModal('Insert Image', `
      <div class="modal-tabs">
        <button class="tab-btn active" id="imgTabUrl">By URL</button>
        <button class="tab-btn" id="imgTabUpload">Upload File</button>
      </div>
      <div id="imgPanelUrl" class="modal-form-group">
        <label class="form-label" for="imgUrl">Image URL</label>
        <input type="url" id="imgUrl" class="form-input" placeholder="https://..." />
        <label class="form-label" for="imgAlt">Alt text (description)</label>
        <input type="text" id="imgAlt" class="form-input" placeholder="What the image shows" />
      </div>
      <div id="imgPanelUpload" class="modal-form-group hidden">
        <label class="btn-secondary btn-file-label" style="display:inline-block;margin-top:8px">
          Choose Image File
          <input type="file" id="imgFileInput" accept="image/*" class="sr-only" />
        </label>
        <p class="form-hint" id="imgFileName">No file chosen</p>
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-ghost', action: closeModal },
      { label: 'Insert', cls: 'btn-primary', action: () => {
        const url = $('imgUrl')?.value.trim();
        const alt = $('imgAlt')?.value.trim() || 'image';
        if (url) {
          insertAtCursor($('postContent'), `\n![${alt}](${url})\n`);
          closeModal();
          toast('Image inserted!', 'success');
        } else {
          toast('Please enter an image URL or upload a file.', 'error');
        }
      }},
    ]);

    // Set up the tab switching within the modal (after it's been added to the DOM)
    setTimeout(() => {
      // Switch to "By URL" tab
      $('imgTabUrl')?.addEventListener('click', () => {
        $('imgTabUrl').classList.add('active');    $('imgTabUpload').classList.remove('active');
        $('imgPanelUrl').classList.remove('hidden'); $('imgPanelUpload').classList.add('hidden');
      });
      // Switch to "Upload File" tab
      $('imgTabUpload')?.addEventListener('click', () => {
        $('imgTabUpload').classList.add('active');  $('imgTabUrl').classList.remove('active');
        $('imgPanelUpload').classList.remove('hidden'); $('imgPanelUrl').classList.add('hidden');
      });
      // When a file is chosen, read it as a data URL and pre-fill the URL field
      $('imgFileInput')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return; }
        $('imgFileName').textContent = file.name;
        const reader = new FileReader();
        reader.onload = ev => {
          $('imgUrl').value = ev.target.result; // pre-fill the URL with the data URL
          $('imgAlt').value = file.name;
        };
        reader.readAsDataURL(file);
      });
      $('imgUrl')?.focus();
    }, 50);
  }

  /*
   * openInsertVideo — opens the video embedding dialog.
   *
   * Accepts YouTube or Vimeo URLs and converts them to embed URLs.
   * The embed is inserted as an <iframe> tag directly in the Markdown.
   * Our sanitizer (in the HTML files) allows iframes only from these
   * trusted video hosts — all others are stripped for security.
   *
   * YouTube regular URL:  https://youtube.com/watch?v=VIDEO_ID
   * YouTube embed URL:    https://youtube-nocookie.com/embed/VIDEO_ID
   *                                           ↑ "nocookie" version doesn't track visitors
   * Vimeo regular URL:    https://vimeo.com/VIDEO_ID
   * Vimeo embed URL:      https://player.vimeo.com/video/VIDEO_ID
   */
  function openInsertVideo() {
    showModal('Embed Video', `
      <div class="modal-form-group">
        <label class="form-label" for="videoUrl">YouTube or Vimeo URL</label>
        <input type="url" id="videoUrl" class="form-input" placeholder="https://www.youtube.com/watch?v=..." />
        <p class="form-hint">Paste a YouTube or Vimeo link — it embeds as a video player in the post.</p>
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-ghost', action: closeModal },
      { label: 'Embed',  cls: 'btn-primary', action: () => {
        const url      = $('videoUrl')?.value.trim();
        const embedSrc = parseVideoUrl(url); // convert regular URL to embed URL
        if (!embedSrc) { toast('Invalid YouTube or Vimeo URL.', 'error'); return; }
        // Insert an iframe tag — the browser renders this as an embedded video player
        insertAtCursor($('postContent'),
          `\n<iframe width="100%" height="400" src="${embedSrc}" frameborder="0" allowfullscreen loading="lazy" title="Embedded video"></iframe>\n`
        );
        closeModal();
        toast('Video embedded!', 'success');
      }},
    ]);
    setTimeout(() => $('videoUrl')?.focus(), 50);
  }

  /*
   * parseVideoUrl — converts a regular YouTube/Vimeo URL to an embed URL.
   *
   * Uses the browser's built-in URL constructor to safely parse URLs.
   * Returns null if the URL isn't a recognised video URL.
   *
   * EXAMPLES:
   * youtube.com/watch?v=dQw4w9WgXcQ  →  youtube-nocookie.com/embed/dQw4w9WgXcQ
   * youtu.be/dQw4w9WgXcQ             →  youtube-nocookie.com/embed/dQw4w9WgXcQ
   * vimeo.com/123456789              →  player.vimeo.com/video/123456789
   */
  function parseVideoUrl(url) {
    if (!url) return null;
    try {
      const u = new URL(url); // safely parse the URL (throws if malformed)

      // YouTube: the video ID is in the "v" query parameter
      if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
        return `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v')}`;
      }

      // YouTube short links: the video ID is the path (e.g. /dQw4w9WgXcQ)
      if (u.hostname.includes('youtu.be')) {
        return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
        // .slice(1) removes the leading "/" from the path
      }

      // Vimeo: the video ID is the last part of the path
      if (u.hostname.includes('vimeo.com')) {
        const id = u.pathname.split('/').filter(Boolean).pop();
        // .split('/') breaks "/123456789" into ["", "123456789"]
        // .filter(Boolean) removes empty strings
        // .pop() takes the last element ("123456789")
        return `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      // URL constructor throws if the string isn't a valid URL — we just return null
    }
    return null;
  }

  /*
   * openInsertLink — opens the hyperlink insertion dialog.
   * Inserts [link text](url) Markdown syntax into the editor.
   */
  function openInsertLink() {
    showModal('Insert Link', `
      <div class="modal-form-group">
        <label class="form-label" for="linkUrl">URL</label>
        <input type="url" id="linkUrl" class="form-input" placeholder="https://..." />
        <label class="form-label" for="linkText">Link text</label>
        <input type="text" id="linkText" class="form-input" placeholder="Click here" />
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-ghost', action: closeModal },
      { label: 'Insert', cls: 'btn-primary', action: () => {
        const url  = $('linkUrl')?.value.trim();
        const text = $('linkText')?.value.trim() || url;
        if (!url) { toast('Please enter a URL.', 'error'); return; }
        insertAtCursor($('postContent'), `[${text}](${url})`);
        closeModal();
        toast('Link inserted!', 'success');
      }},
    ]);
    setTimeout(() => $('linkUrl')?.focus(), 50);
  }


  /* ============================================================
   *  WRITE/PREVIEW TABS — Switch between editing and previewing
   * ============================================================
   *
   *  The editor has two tabs above the textarea:
   *  - "Write": the raw Markdown textarea (for typing)
   *  - "Preview": a rendered view of how the post will look
   *
   *  This function sets up those tab buttons. Clicking "Preview"
   *  runs Markdown.render() on the current content and shows
   *  the result. Clicking "Write" shows the textarea again.
   */
  function initMarkdownTabs() {
    $('tab-write')?.addEventListener('click', () => {
      $('panel-write').classList.remove('hidden');
      $('panel-preview').classList.add('hidden');
      $('tab-write').classList.add('active');    $('tab-write').setAttribute('aria-selected', 'true');
      $('tab-preview').classList.remove('active'); $('tab-preview').setAttribute('aria-selected', 'false');
    });

    $('tab-preview')?.addEventListener('click', () => {
      // Render the current Markdown content into HTML for the preview pane
      $('markdownPreview').innerHTML = Markdown.render($('postContent').value);
      $('panel-preview').classList.remove('hidden');
      $('panel-write').classList.add('hidden');
      $('tab-preview').classList.add('active');  $('tab-preview').setAttribute('aria-selected', 'true');
      $('tab-write').classList.remove('active');   $('tab-write').setAttribute('aria-selected', 'false');
    });
  }


  /* ============================================================
   *  AI ASSIST VIEW — Brain-dump to blog post
   * ============================================================
   *
   *  This view guides you through the process of generating a
   *  full blog post from rough notes. Steps:
   *  1. Read today's daily prompt question
   *  2. Write your notes in the textarea
   *  3. Select a category and project name
   *  4. Toggle whether to include resource links and beginner tips
   *  5. Click "Generate Post" → Claude writes a full Markdown post
   *  6. Read the result, then either Publish or Edit it first
   */

  /*
   * initAIView — resets the AI Assist form to a fresh state.
   *
   * Called every time you navigate to this view to clear any
   * previous generated output and show today's prompt question.
   */
  function initAIView() {
    populateCategorySelects();
    // Show today's date in the prompt card header
    $('todayDate').textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    // Show today's rotating prompt question
    $('dailyQuestion').textContent = AI.getDailyPrompt();
    // Clear any previously generated output
    $('aiOutput').classList.add('hidden');
    $('aiLoading').classList.add('hidden');
    $('aiOutputContent').innerHTML = '';
    generatedPost = null;
    // Wire up the character counter for the notes textarea
    $('rawNotes').addEventListener('input', () => {
      $('charCount').textContent = $('rawNotes').value.length;
    });
  }

  /*
   * generatePost — sends your notes to Claude and shows the result.
   *
   * This is the main async function for the AI Assist feature.
   * "async" means it runs asynchronously — it can "await" the API
   * response without freezing the whole page.
   *
   * WHAT HAPPENS:
   * 1. Validate that there are enough notes to work with
   * 2. Check for a theme switch command in the notes
   * 3. Show a loading indicator
   * 4. Call AI.beautifyPost() which sends notes to Claude API
   * 5. Display Claude's response in the output panel
   * 6. Allow publishing or editing the result
   */
  async function generatePost() {
    const raw = $('rawNotes').value.trim();
    if (!raw || raw.length < 10) { toast('Add more notes first!', 'error'); return; }

    // If notes mention a theme (e.g. "switch to nord"), change it now
    const theme = Themes.detectThemeInText(raw);
    if (theme) { Themes.apply(theme); toast(`Theme → ${theme}!`, 'success'); }

    // Show loading state, hide previous output, disable the button
    $('aiLoading').classList.remove('hidden');
    $('aiOutput').classList.add('hidden');
    $('generatePostBtn').disabled = true;

    try {
      // This line actually calls the Claude API — it may take 5-15 seconds
      const content = await AI.beautifyPost(raw, {
        category:     getCategoryById($('aiCategory').value)?.name || '',
        gameName:     $('aiGame').value.trim(),
        includeLinks: $('includeLinks').checked,  // checkbox: add resource links?
        includeTips:  $('includeTips').checked,   // checkbox: add beginner tips?
      });

      // Store the generated content so we can publish or send to editor
      generatedPost = {
        content,
        category:    $('aiCategory').value,
        tags:        [],
        aiGenerated: true,
      };

      // Render the Markdown output in the preview panel
      $('aiOutputContent').innerHTML = Markdown.render(content);

      // Make generated links open safely in new tabs
      $('aiOutputContent').querySelectorAll('a[href]').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });

      $('aiOutput').classList.remove('hidden'); // show the output panel
      toast('Post generated!', 'success');

    } catch (e) {
      toast(e.message, 'error'); // show the error (e.g. "No API key set")
    } finally {
      // Always hide loading and re-enable the button, whether success or failure
      $('aiLoading').classList.add('hidden');
      $('generatePostBtn').disabled = false;
    }
  }

  /*
   * publishGenerated — immediately publishes the AI-generated post.
   *
   * Extracts the title from the first # heading in the generated Markdown,
   * creates the post in the store, and opens it.
   */
  function publishGenerated() {
    if (!generatedPost) return;
    // Find the first H1 heading with a regex and use it as the title
    const match = generatedPost.content.match(/^#\s+(.+)/m);
    const title = match ? match[1].trim() : 'Dev Log Entry';
    const post = Store.Posts.create({ title, ...generatedPost });
    toast('Entry published!', 'success');
    renderSidebarCategories();
    openPost(post.id);
  }

  /*
   * sendToEditor — loads the generated post into the Markdown editor
   * so you can make changes before publishing.
   */
  function sendToEditor() {
    if (!generatedPost) return;
    showView('write');
    setTimeout(() => {
      initWriteView(null); // new post mode
      const match = generatedPost.content.match(/^#\s+(.+)/m);
      $('postTitle').value   = match ? match[1].trim() : '';
      $('postContent').value = generatedPost.content;
      populateCategorySelects();
      setTimeout(() => { $('postCategory').value = generatedPost.category || ''; }, 50);
      toast('Loaded in editor. Make your changes!', 'info');
    }, 80);
  }

  /*
   * beautifyDraft — polishes the current editor content via Claude.
   *
   * Called by the "AI Beautify" button. Unlike generatePost (which writes
   * from scratch), this takes your existing draft and improves it.
   */
  async function beautifyDraft() {
    const content = $('postContent').value.trim();
    const title   = $('postTitle').value.trim();
    if (!content) { toast('Write something first!', 'error'); return; }

    $('aiStatus').classList.remove('hidden'); // show "AI is polishing…" message
    $('aiBeautifyBtn').disabled = true;

    try {
      const improved = await AI.beautifyDraft(content, title);
      $('postContent').value = improved; // replace the textarea content with the polished version
      toast('Post polished!', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      $('aiStatus').classList.add('hidden');
      $('aiBeautifyBtn').disabled = false;
    }
  }


  /* ============================================================
   *  SETTINGS VIEW
   * ============================================================
   *
   *  Loads saved settings into the form fields when you navigate
   *  to the Settings view. Changes are only applied when you
   *  click "Save Settings".
   */
  function initSettingsView() {
    const s = Store.Settings.get();
    $('apiKeyInput').value = s.apiKey     || '';
    $('blogAuthor').value  = s.author     || '';
    $('promptTime').value  = s.promptTime || '20:00';
  }

  /*
   * saveSettings — validates and saves settings from the form.
   *
   * The API key check ensures you don't accidentally save a key
   * that's in the wrong format (all Anthropic keys start with "sk-ant-").
   */
  function saveSettings() {
    const key = $('apiKeyInput').value.trim();
    // Quick sanity check on the API key format
    if (key && !key.startsWith('sk-ant-')) {
      toast('API key should start with sk-ant-', 'error');
      return;
    }
    Store.Settings.save({
      apiKey:     key,
      author:     $('blogAuthor').value.trim(),
      promptTime: $('promptTime').value,
      theme:      Themes.getCurrent(), // save current theme too
    });
    // Show brief confirmation message
    $('settingsStatus').textContent = '✓ Saved.';
    $('settingsStatus').classList.remove('hidden');
    setTimeout(() => $('settingsStatus').classList.add('hidden'), 2500);
    toast('Settings saved!', 'success');
  }


  /* ============================================================
   *  CATEGORIES — Adding new categories via a modal dialog
   * ============================================================ */

  /*
   * openAddCategoryModal — shows the "New Category" dialog.
   *
   * Lets you pick a name and one of the preset colour swatches.
   * The colour is tracked by a `picked` variable that updates
   * when you click a swatch.
   */
  function openAddCategoryModal() {
    const COLORS = Store.Categories.getColors();
    let picked = COLORS[0]; // default to the first colour (blue)

    // Build the row of colour swatches (each is a small circle)
    const swatches = COLORS.map((c, i) =>
      `<span class="color-swatch ${i === 0 ? 'selected' : ''}"
             data-color="${c}"
             style="background:${c}"
             role="radio"
             tabindex="0"
             aria-checked="${i === 0}"
             aria-label="Colour ${c}"></span>`
    ).join('');

    showModal('New Category', `
      <div class="modal-form-group">
        <label class="form-label" for="newCatName">Name</label>
        <input type="text" id="newCatName" class="form-input" placeholder="e.g. Art & Assets" maxlength="30" />
      </div>
      <div class="modal-form-group">
        <label class="form-label">Colour</label>
        <div class="color-picker-row" id="colorPicker" role="radiogroup">${swatches}</div>
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-ghost',   action: closeModal },
      { label: 'Create', cls: 'btn-primary', action: () => {
        const name = document.getElementById('newCatName')?.value.trim();
        if (!name) { toast('Category name required.', 'error'); return; }
        try {
          Store.Categories.create(name, picked);
          populateCategorySelects();
          renderSidebarCategories();
          toast(`"${name}" created!`, 'success');
          closeModal();
        } catch (e) { toast(e.message, 'error'); }
      }},
    ]);

    // After the modal renders, wire up the colour swatch buttons
    setTimeout(() => {
      document.querySelectorAll('.color-swatch').forEach(s => {
        s.addEventListener('click', () => {
          // Deselect all swatches
          document.querySelectorAll('.color-swatch').forEach(x => {
            x.classList.remove('selected');
            x.setAttribute('aria-checked', 'false');
          });
          // Select this one
          s.classList.add('selected');
          s.setAttribute('aria-checked', 'true');
          picked = s.dataset.color; // update the tracked colour
        });
        s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') s.click(); });
      });
      document.getElementById('newCatName')?.focus();
    }, 50);
  }


  /* ============================================================
   *  MODAL SYSTEM — Generic reusable popup dialogs
   * ============================================================
   *
   *  showModal() creates any modal with a title, HTML body, and
   *  an array of action buttons. This is more flexible than
   *  having separate modal HTML for every dialog.
   *
   *  Usage:
   *  showModal('Confirm Delete', 'Are you sure?', [
   *    { label: 'Cancel', cls: 'btn-ghost',   action: closeModal },
   *    { label: 'Delete', cls: 'btn-danger', action: () => { ... } }
   *  ]);
   */
  function showModal(title, bodyHtml, actions) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML    = bodyHtml;
    $('modalActions').innerHTML = '';

    // Create a button for each action
    actions.forEach(({ label, cls, action }) => {
      const btn = document.createElement('button');
      btn.className   = cls;
      btn.textContent = label;
      btn.addEventListener('click', action);
      $('modalActions').appendChild(btn);
    });

    $('modalOverlay').classList.remove('hidden'); // make the modal visible
    // Auto-focus the first focusable element inside the modal for accessibility
    setTimeout(() => $('modalOverlay').querySelector('input,button')?.focus(), 50);
  }

  /* closeModal — hides the modal overlay */
  function closeModal() {
    $('modalOverlay').classList.add('hidden');
  }


  /* ============================================================
   *  DATA IMPORT / EXPORT
   * ============================================================ */

  /*
   * exportData — packages all posts and categories as a JSON file download.
   *
   * Uses the browser's built-in Blob API to create an in-memory file,
   * then triggers a download by programmatically clicking a hidden link.
   */
  function exportData() {
    const json = Store.exportData(); // get the JSON string from the store
    const blob = new Blob([json], { type: 'application/json' }); // create an in-memory file
    const url  = URL.createObjectURL(blob); // create a temporary URL pointing to that file

    const a = document.createElement('a');
    a.href     = url;
    a.download = `devlog-${new Date().toISOString().slice(0, 10)}.json`; // filename with today's date
    a.click(); // trigger the download

    URL.revokeObjectURL(url); // release the temporary URL to free memory
    toast('Exported!', 'success');
  }

  /*
   * importData — reads a JSON backup file and restores all data.
   *
   * Uses FileReader to read the selected file's contents as text,
   * then passes the text to Store.importData() for parsing and validation.
   *
   * PARAMETER:
   * file — a File object from an <input type="file"> element
   */
  function importData(file) {
    const r = new FileReader();
    r.onload = e => {
      try {
        Store.importData(e.target.result); // validate and write the imported data
        renderPosts();
        populateCategorySelects();
        renderSidebarCategories();
        toast('Imported!', 'success');
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error');
      }
    };
    r.readAsText(file); // read the file as a text string (triggers onload when done)
  }


  /* ============================================================
   *  INIT — Startup function, runs when admin.html loads
   * ============================================================
   *
   *  This is the entry point for the admin panel. It:
   *  1. Shows a loading screen while verifying your identity
   *  2. Redirects to the public site if you're not the owner
   *  3. Shows your GitHub avatar and name in the sidebar
   *  4. Wires up ALL the event listeners for every button and input
   *  5. Renders the initial post list
   */
  async function init() {

    /*
     * STEP 1: Show the auth guard (loading screen) while we verify identity.
     *
     * The auth guard is a full-page overlay that blocks the admin panel
     * until we've confirmed you're the right user. This prevents a flash
     * of admin content before the redirect happens.
     */
    $('authGuard').style.display = 'flex';

    let user = null;
    try {
      const result = await Auth.handlePageLoad();

      if (result.status === 'unauthenticated') {
        // Not logged in — quietly redirect to the public site
        window.location.href = 'index.html';
        return; // stop running
      }
      user = result.user; // logged in successfully
    } catch (e) {
      // Authentication failed (wrong user, token expired, etc.)
      alert(`Authentication failed: ${e.message}`);
      window.location.href = 'index.html';
      return;
    }

    // STEP 2: Authentication passed — hide the guard and show the admin panel
    $('authGuard').style.display = 'none';

    // Display your GitHub profile picture and username in the sidebar
    if (user) {
      $('ownerAvatar').src           = user.avatar_url || '';
      $('ownerName').textContent     = user.name || user.login;
    }

    // STEP 3: Initialise subsystems
    Themes.init();       // load saved theme
    initMarkdownTabs();  // set up write/preview tab switching

    // STEP 4: Wire up navigation
    // Every element with a data-view attribute triggers a view switch when clicked
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        showView(el.dataset.view);
      });
    });

    // Logout button: clears session and goes back to public site
    $('logoutBtn')?.addEventListener('click', () => Auth.logout());

    // Post detail back button and action buttons
    $('backBtn')?.addEventListener('click', () => showView('posts'));

    // Editor: save/cancel/AI beautify
    $('savePostBtn')?.addEventListener('click', savePost);
    $('cancelEditBtn')?.addEventListener('click', () => showView('posts'));
    $('aiBeautifyBtn')?.addEventListener('click', beautifyDraft);

    // Media toolbar buttons
    $('insertImageBtn')?.addEventListener('click', openInsertImage);
    $('insertVideoBtn')?.addEventListener('click', openInsertVideo);
    $('insertLinkBtn')?.addEventListener('click', openInsertLink);
    $('insertFileBtn')?.addEventListener('click', () => $('attachFileInput').click()); // open file picker
    // Quick markdown shortcuts
    $('insertH2Btn')?.addEventListener('click',   () => insertAtCursor($('postContent'), '\n## '));
    $('insertBoldBtn')?.addEventListener('click', () => wrapSelection($('postContent'), '**', '**'));
    $('insertCodeBtn')?.addEventListener('click', () => wrapSelection($('postContent'), '\n```\n', '\n```\n'));
    $('insertQuoteBtn')?.addEventListener('click',() => insertAtCursor($('postContent'), '\n> '));

    // File attachment input
    $('attachFileInput')?.addEventListener('change', e => {
      if (e.target.files.length) handleFileAttach(e.target.files);
    });

    // AI Assist controls
    $('generatePostBtn')?.addEventListener('click',    generatePost);
    $('publishGeneratedBtn')?.addEventListener('click', publishGenerated);
    $('regenerateBtn')?.addEventListener('click',      generatePost);
    $('editGeneratedBtn')?.addEventListener('click',   sendToEditor);

    // Settings page controls
    $('saveSettingsBtn')?.addEventListener('click', saveSettings);
    $('requestNotifBtn')?.addEventListener('click', async () => {
      try {
        await AI.requestNotifications();
        toast('Notifications enabled!', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    // Show/hide the API key (toggle between password and text input type)
    $('toggleApiKey')?.addEventListener('click', () => {
      const inp   = $('apiKeyInput');
      const show  = inp.type === 'text'; // currently visible?
      inp.type    = show ? 'password' : 'text';
      $('toggleApiKey').textContent = show ? 'show' : 'hide';
    });
    $('exportBtn')?.addEventListener('click', exportData);
    $('importInput')?.addEventListener('change', e => {
      if (e.target.files[0]) importData(e.target.files[0]);
    });
    $('clearDataBtn')?.addEventListener('click', () => {
      showModal('Clear All Data', 'Permanently delete all posts and categories? This cannot be undone.', [
        { label: 'Cancel',          cls: 'btn-ghost',  action: closeModal },
        { label: 'Clear Everything', cls: 'btn-danger', action: () => {
          localStorage.clear();
          closeModal();
          renderPosts();
          populateCategorySelects();
          renderSidebarCategories();
          toast('All data cleared.', 'info');
        }},
      ]);
    });

    // Category management
    $('addCategoryBtn')?.addEventListener('click', openAddCategoryModal);

    // Modal close: clicking the dark overlay background, or pressing Escape
    $('modalOverlay')?.addEventListener('click', e => {
      if (e.target === $('modalOverlay')) closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('modalOverlay').classList.contains('hidden')) closeModal();
    });

    // Mobile hamburger menu
    $('hamburger')?.addEventListener('click', () => {
      const open = $('sidebar').classList.toggle('open');
      $('hamburger').classList.toggle('open', open);
      $('hamburger').setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', e => {
      if (window.innerWidth <= 768 &&
          !$('sidebar').contains(e.target) &&
          !$('hamburger').contains(e.target)) {
        $('sidebar').classList.remove('open');
        $('hamburger').classList.remove('open');
        $('hamburger').setAttribute('aria-expanded', 'false');
      }
    });

    // Search and filter
    let t;
    $('searchInput')?.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(renderPosts, 220); // debounce: wait 220ms after last keystroke
    });
    $('categoryFilter')?.addEventListener('change', renderPosts);

    // STEP 5: Render the initial post list
    renderPosts();
    renderSidebarCategories();
    populateCategorySelects();
    showView('posts'); // start on the posts list view

    // If notifications are already granted (from a previous session), restart the daily timer
    if (Notification.permission === 'granted') AI.scheduleReminder();
  }

  /* WHAT THIS FILE EXPORTS — only init() needs to be called from outside */
  return { init };

})();

/*
 * START THE ADMIN PANEL
 * When the browser finishes parsing admin.html, run Admin.init().
 * This kicks off the auth check and everything else.
 */
document.addEventListener('DOMContentLoaded', Admin.init);
