/*
 * ============================================================
 *  APP.JS — Legacy All-in-One Controller (Unused in Production)
 * ============================================================
 *
 *  NOTE: This file is a leftover from an earlier version of the
 *  blog before the public/admin split was implemented.
 *
 *  In the CURRENT architecture:
 *  - index.html  uses  public.js  (visitor-facing, read-only)
 *  - admin.html  uses  admin.js   (owner-only editor)
 *
 *  This file (app.js) is NOT loaded by either page and does
 *  not run. It's kept here for reference only — it shows an
 *  earlier combined version where everything was in one file.
 *
 *  You can safely DELETE this file without affecting anything.
 *  If you're reading this to understand the codebase, skip
 *  to public.js and admin.js instead — those are the real files.
 * ============================================================
 */

'use strict';

const App = (() => {

  // ── STATE VARIABLES ──
  // These track what's currently happening in the UI
  let currentView   = 'home'; // which view is visible ('home', 'post', 'write', etc.)
  let currentPostId = null;   // ID of the currently open post (null if on the feed)
  let generatedPost = null;   // holds AI-generated content before the user publishes it

  // ── HELPERS ──
  // $ is a shortcut for document.getElementById()
  const $ = id => document.getElementById(id);

  // el() creates a new HTML element with optional class and text content
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls)             e.className   = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // formatDate converts ISO timestamps ("2026-06-19T...") to "Jun 19, 2026"
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
    } catch { return ''; }
  }

  // toast() shows a temporary notification at the bottom-right of the screen
  function toast(message, type = 'info') {
    const icons = { success: '✓', error: '✕', info: '◈' };
    const t = el('div', `toast ${type}`);
    t.innerHTML = `<span class="toast-icon">${icons[type] || '◈'}</span><span>${message}</span>`;
    $('toastContainer').appendChild(t);
    setTimeout(() => t.remove(), 3800); // auto-remove after 3.8 seconds
  }

  // ── VIEW ROUTER ──
  // showView() switches which panel is visible (only one at a time)
  function showView(name) {
    // Remove 'active' from all views (hides them all)
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = $(`view-${name}`);
    if (target) {
      target.classList.add('active'); // show only this view
      target.focus?.();               // move keyboard focus into the view (?.  = optional chaining, won't crash if focus isn't a method)
    }
    // Update sidebar nav links to highlight the active one
    document.querySelectorAll('.nav-link').forEach(l => {
      const isActive = l.dataset.view === name;
      l.classList.toggle('active', isActive);
      if (isActive) l.setAttribute('aria-current', 'page');
      else          l.removeAttribute('aria-current');
    });
    currentView = name;

    // Run any initialisation code needed for the view we just switched to
    if (name === 'home')      renderPosts();
    if (name === 'write')     initWriteView();
    if (name === 'ai-assist') initAIView();
    if (name === 'settings')  initSettingsView();

    // On mobile: close the sidebar when navigating
    if (window.innerWidth <= 768) {
      $('sidebar').classList.remove('open');
      $('hamburger').classList.remove('open');
      $('hamburger').setAttribute('aria-expanded','false');
    }
  }

  // ── CATEGORY HELPERS ──
  // Look up a full category object by its ID
  function getCategoryById(id) {
    return Store.Categories.getAll().find(c => c.id === id) || null;
  }
  // Look up a category by its display name
  function getCategoryByName(name) {
    return Store.Categories.getAll().find(c => c.name === name) || null;
  }
  // Build the HTML for a coloured category badge pill
  function renderCategoryBadge(categoryId) {
    const cat = getCategoryById(categoryId);
    if (!cat) return '';
    // The colour is used for text and border; "22"/"44" appended to the hex = semi-transparent
    return `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`;
  }

  // Rebuild the category list in the sidebar with counts
  function renderSidebarCategories() {
    const list  = $('categoryList');
    const cats  = Store.Categories.getAll();
    const posts = Store.Posts.getAll();
    list.innerHTML = '';
    cats.forEach(cat => {
      const count = posts.filter(p => p.category === cat.id).length;
      const li = el('li','category-item');
      li.dataset.id = cat.id;
      li.setAttribute('role','button');
      li.setAttribute('tabindex','0');
      li.setAttribute('aria-label',`${cat.name} category, ${count} posts`);
      li.innerHTML = `
        <span class="category-name">
          <span class="category-dot" style="background:${cat.color}"></span>
          ${cat.name}
        </span>
        <span class="category-count">${count}</span>`;
      li.addEventListener('click', () => {
        $('categoryFilter').value = cat.id;
        showView('home');
        renderPosts();
      });
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') li.click(); });
      list.appendChild(li);
    });
  }

  // Fill all category <select> dropdowns with current category options
  function populateCategorySelects() {
    const cats = Store.Categories.getAll();
    const opts = `<option value="">Uncategorized</option>` +
      cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    ['postCategory','aiCategory'].forEach(id => {
      const sel = $(id);
      if (sel) sel.innerHTML = opts;
    });
    const filter = $('categoryFilter');
    if (filter) {
      filter.innerHTML = `<option value="">all categories</option>` +
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  }

  // ── HOME / POST LIST ──
  // Renders the grid of post cards, filtered by search + category
  function renderPosts() {
    const query    = $('searchInput')?.value || '';
    const category = $('categoryFilter')?.value || '';
    const posts    = Store.Posts.search(query, category);
    const grid     = $('postsGrid');
    const empty    = $('emptyState');
    const countEl  = $('postCount');

    if (countEl) countEl.textContent = `${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}`;
    renderSidebarCategories();
    populateCategorySelects();

    if (!posts.length) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Build a card for each post and inject them all at once
    grid.innerHTML = posts.map(post => {
      const cat      = getCategoryById(post.category);
      const badgeHtml = cat
        ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`
        : '';
      const tagsHtml  = post.tags.length
        ? `<div class="post-card-tags">${post.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>`
        : '';
      const aiLabel   = post.aiGenerated
        ? '<span class="tag" style="color:var(--accent-2)">ai</span>'
        : '';
      return `
        <article class="post-card" role="article" tabindex="0" data-id="${post.id}" aria-label="${post.title}">
          <div class="post-card-meta">
            <time class="post-date" datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
            ${badgeHtml}
          </div>
          <h3 class="post-card-title">${post.title}</h3>
          <p class="post-card-excerpt">${Markdown.excerpt(post.content)}</p>
          ${tagsHtml}
          ${aiLabel ? `<div class="post-card-tags" style="margin-top:6px">${aiLabel}</div>` : ''}
        </article>`;
    }).join('');

    // Attach click/keyboard handlers to the rendered cards
    grid.querySelectorAll('.post-card').forEach(card => {
      card.addEventListener('click',   () => openPost(card.dataset.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openPost(card.dataset.id); });
    });
  }

  // ── POST DETAIL ──
  // Shows the full rendered content of a single post
  function openPost(id) {
    const post = Store.Posts.getById(id);
    if (!post) return;
    currentPostId = id;

    const cat      = getCategoryById(post.category);
    const badgeHtml = cat
      ? `<span class="category-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>`
      : '';
    const tagsHtml = post.tags.length
      ? `<div class="post-detail-tags">${post.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>`
      : '';

    $('postDetail').innerHTML = `
      <header class="post-detail-header">
        <h2 class="post-detail-title">${post.title}</h2>
        <div class="post-detail-meta">
          <time class="post-date" datetime="${post.createdAt}">${formatDate(post.createdAt)}</time>
          ${badgeHtml}
          ${post.aiGenerated ? '<span class="tag" style="color:var(--accent-2)">✦ ai generated</span>' : ''}
        </div>
        ${tagsHtml}
      </header>
      <div class="post-detail-body">${Markdown.render(post.content)}</div>
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" id="editPostBtn">Edit Post</button>
        <button class="btn-danger btn-sm" id="deletePostBtn">Delete</button>
      </div>`;

    $('editPostBtn').addEventListener('click', () => editPost(post));
    $('deletePostBtn').addEventListener('click', () => confirmDeletePost(post.id));

    // Make external links safe: open in new tab, prevent reverse tabnapping
    $('postDetail').querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (href && (href.startsWith('http') || href.startsWith('https'))) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
    showView('post');
  }

  // Load a post into the write form for editing
  function editPost(post) {
    showView('write');
    setTimeout(() => {
      $('postTitle').value            = post.title;
      $('postCategory').value         = post.category || '';
      $('postContent').value          = post.content;
      $('postTags').value             = post.tags.join(', ');
      $('savePostBtn').dataset.editId = post.id;
      $('savePostBtn').textContent    = '✦ Update Entry';
    }, 50); // small delay so the write view has rendered before we fill the fields
  }

  // Show a confirmation modal before permanently deleting a post
  function confirmDeletePost(id) {
    showModal('Delete Entry', 'Are you sure? This cannot be undone.', [
      { label: 'Cancel', cls: 'btn-ghost', action: closeModal },
      { label: 'Delete', cls: 'btn-danger', action: () => {
        Store.Posts.delete(id);
        closeModal();
        showView('home');
        toast('Entry deleted.', 'info');
      }},
    ]);
  }

  // ── WRITE VIEW ──
  // Reset the editor form for a new post
  function initWriteView() {
    populateCategorySelects();
    $('savePostBtn').dataset.editId = '';          // clear any "editing" state
    $('savePostBtn').textContent    = '✦ Publish Entry';
  }

  // Save or update a post from the editor form
  function savePost() {
    const title    = $('postTitle').value.trim();
    const content  = $('postContent').value.trim();
    const category = $('postCategory').value;
    const tags     = $('postTags').value.split(',').map(t=>t.trim()).filter(Boolean);
    const editId   = $('savePostBtn').dataset.editId; // non-empty = editing an existing post

    if (!title)   { toast('Please add a title.',        'error'); return; }
    if (!content) { toast('Content cannot be empty.',   'error'); return; }

    if (editId) {
      Store.Posts.update(editId, { title, content, category, tags });
      toast('Entry updated!', 'success');
      openPost(editId);
    } else {
      const post = Store.Posts.create({ title, content, category, tags });
      toast('Entry published!', 'success');
      $('postTitle').value = $('postContent').value = $('postTags').value = '';
      $('postCategory').value = '';
      openPost(post.id);
    }
    renderSidebarCategories();
  }

  // Send the current draft to Claude for polishing
  async function beautifyCurrentDraft() {
    const content = $('postContent').value.trim();
    const title   = $('postTitle').value.trim();
    if (!content) { toast('Write something first!', 'error'); return; }

    $('aiStatus').classList.remove('hidden');
    $('aiBeautifyBtn').disabled = true;

    try {
      const improved = await AI.beautifyDraft(content, title);
      $('postContent').value = improved;

      // Also check if the draft mentioned a theme to switch
      const theme = Themes.detectThemeInText(content);
      if (theme) { Themes.apply(theme); toast(`Theme switched to ${theme}!`, 'success'); }

      toast('Post polished!', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      $('aiStatus').classList.add('hidden');
      $('aiBeautifyBtn').disabled = false;
    }
  }

  // Set up the Write/Preview tab toggle on the editor
  function initMarkdownTabs() {
    $('tab-write').addEventListener('click', () => {
      $('panel-write').classList.remove('hidden');
      $('panel-preview').classList.add('hidden');
      $('tab-write').classList.add('active');    $('tab-write').setAttribute('aria-selected','true');
      $('tab-preview').classList.remove('active'); $('tab-preview').setAttribute('aria-selected','false');
    });
    $('tab-preview').addEventListener('click', () => {
      $('markdownPreview').innerHTML = Markdown.render($('postContent').value);
      $('panel-preview').classList.remove('hidden');
      $('panel-write').classList.add('hidden');
      $('tab-preview').classList.add('active');   $('tab-preview').setAttribute('aria-selected','true');
      $('tab-write').classList.remove('active');    $('tab-write').setAttribute('aria-selected','false');
    });
  }

  // ── AI ASSIST VIEW ──
  // Reset the AI Assist form and show today's prompt question
  function initAIView() {
    populateCategorySelects();
    $('todayDate').textContent    = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    $('dailyQuestion').textContent = AI.getDailyPrompt();
    $('aiOutput').classList.add('hidden');
    $('aiLoading').classList.add('hidden');
    $('aiOutputContent').innerHTML = '';
    generatedPost = null;

    // Live character counter for the notes textarea
    $('rawNotes').addEventListener('input', () => {
      $('charCount').textContent = $('rawNotes').value.length;
    });
  }

  // Send notes to Claude and display the generated post
  async function generatePost() {
    const raw = $('rawNotes').value.trim();
    if (!raw)         { toast('Add some notes first!',                    'error'); return; }
    if (raw.length<10){ toast('Notes are too short to generate a post.', 'error'); return; }

    // Check if the notes include a theme switch command
    const theme = Themes.detectThemeInText(raw);
    if (theme) { Themes.apply(theme); toast(`Theme switched to ${theme}!`, 'success'); }

    $('aiLoading').classList.remove('hidden');
    $('aiOutput').classList.add('hidden');
    $('generatePostBtn').disabled = true;

    try {
      const content = await AI.beautifyPost(raw, {
        category:     getCategoryById($('aiCategory').value)?.name || '',
        gameName:     $('aiGame').value.trim(),
        includeLinks: $('includeLinks').checked,
        includeTips:  $('includeTips').checked,
      });

      generatedPost = { content, category: $('aiCategory').value, tags: [], aiGenerated: true };

      $('aiOutputContent').innerHTML = Markdown.render(content);
      $('aiOutputContent').querySelectorAll('a[href]').forEach(a => {
        a.setAttribute('target','_blank');
        a.setAttribute('rel','noopener noreferrer');
      });
      $('aiOutput').classList.remove('hidden');
      toast('Post generated!', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      $('aiLoading').classList.add('hidden');
      $('generatePostBtn').disabled = false;
    }
  }

  // Immediately publish the AI-generated post
  function publishGenerated() {
    if (!generatedPost) return;
    const titleMatch = generatedPost.content.match(/^#\s+(.+)/m); // find first # heading
    const title      = titleMatch ? titleMatch[1].trim() : 'Dev Log Entry';
    const post = Store.Posts.create({
      title,
      content:  generatedPost.content,
      category: generatedPost.category,
      tags:     generatedPost.tags,
      aiGenerated: true,
    });
    toast('Entry published!', 'success');
    renderSidebarCategories();
    openPost(post.id);
  }

  // Load the generated post into the editor for manual tweaking before publishing
  function sendToEditor() {
    if (!generatedPost) return;
    showView('write');
    setTimeout(() => {
      const titleMatch = generatedPost.content.match(/^#\s+(.+)/m);
      $('postTitle').value    = titleMatch ? titleMatch[1].trim() : '';
      $('postContent').value  = generatedPost.content;
      $('postCategory').value = generatedPost.category || '';
      toast('Loaded in editor. Make your changes!', 'info');
    }, 80);
  }

  // ── SETTINGS ──
  // Load saved settings into the settings form
  function initSettingsView() {
    const s = Store.Settings.get();
    $('apiKeyInput').value = s.apiKey     || '';
    $('blogAuthor').value  = s.author     || '';
    $('promptTime').value  = s.promptTime || '20:00';
  }

  // Save the settings form values back to the store
  function saveSettings() {
    const key = $('apiKeyInput').value.trim();
    if (key && !key.startsWith('sk-ant-')) {
      toast('API key should start with sk-ant-', 'error');
      return;
    }
    Store.Settings.save({
      apiKey:     key,
      author:     $('blogAuthor').value.trim(),
      promptTime: $('promptTime').value,
      theme:      Themes.getCurrent(),
    });
    const status = $('settingsStatus');
    status.textContent = '✓ Settings saved.';
    status.className   = 'settings-status';
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2500);
    toast('Settings saved!', 'success');
  }

  // ── CATEGORIES MODAL ──
  const CAT_COLORS = Store.Categories.getColors();

  function openAddCategoryModal() {
    let pickedColor = CAT_COLORS[0]; // the currently selected colour swatch

    const colorSwatches = CAT_COLORS.map((c,i) =>
      `<span class="color-swatch ${i===0?'selected':''}" data-color="${c}" style="background:${c}"
             role="radio" tabindex="0" aria-label="Colour ${c}" aria-checked="${i===0}"></span>`
    ).join('');

    showModal('New Category', `
      <div class="modal-form-group">
        <label class="form-label" for="newCatName">Category Name</label>
        <input type="text" id="newCatName" class="form-input" placeholder="e.g. Art & Assets" maxlength="30" />
      </div>
      <div class="modal-form-group">
        <label class="form-label">Colour</label>
        <div class="color-picker-row" id="colorPicker" role="radiogroup">${colorSwatches}</div>
      </div>
    `, [
      { label: 'Cancel', cls: 'btn-ghost',   action: closeModal },
      { label: 'Create', cls: 'btn-primary', action: () => {
        const name = document.getElementById('newCatName')?.value.trim();
        if (!name) { toast('Category name required.', 'error'); return; }
        try {
          Store.Categories.create(name, pickedColor);
          populateCategorySelects();
          renderSidebarCategories();
          toast(`Category "${name}" created!`, 'success');
          closeModal();
        } catch (e) { toast(e.message, 'error'); }
      }},
    ]);

    setTimeout(() => {
      document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
          document.querySelectorAll('.color-swatch').forEach(s => {
            s.classList.remove('selected'); s.setAttribute('aria-checked','false');
          });
          swatch.classList.add('selected'); swatch.setAttribute('aria-checked','true');
          pickedColor = swatch.dataset.color;
        });
        swatch.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') swatch.click(); });
      });
      document.getElementById('newCatName')?.focus();
    }, 50);
  }

  // ── MODAL SYSTEM ──
  // Creates and shows a reusable modal dialog with any content and buttons
  function showModal(title, bodyHtml, actions) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML    = bodyHtml;
    $('modalActions').innerHTML = '';
    actions.forEach(({ label, cls, action }) => {
      const btn = el('button', `${cls}`, label);
      btn.addEventListener('click', action);
      $('modalActions').appendChild(btn);
    });
    $('modalOverlay').classList.remove('hidden');
    setTimeout(() => $('modalOverlay').querySelector('button,input')?.focus(), 50);
  }

  function closeModal() {
    $('modalOverlay').classList.add('hidden');
  }

  // ── IMPORT / EXPORT ──
  function exportData() {
    const json = Store.exportData();
    const blob = new Blob([json], { type: 'application/json' }); // in-memory file
    const url  = URL.createObjectURL(blob);                       // temporary download URL
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `devlog-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();                                                     // trigger download
    URL.revokeObjectURL(url);                                      // free memory
    toast('Export complete!', 'success');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        Store.importData(e.target.result);
        renderPosts(); populateCategorySelects(); renderSidebarCategories();
        toast('Import successful!', 'success');
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file); // triggers onload when done
  }

  // ── INIT ──
  // Sets up all event listeners and renders the initial state
  function init() {
    Themes.init();

    // Wire nav links to the view router
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); showView(el.dataset.view); });
    });

    $('backBtn').addEventListener('click', () => showView('home'));

    // Search with 220ms debounce (avoids re-rendering on every keystroke)
    let searchTimer;
    $('searchInput').addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderPosts, 220);
    });
    $('categoryFilter').addEventListener('change', renderPosts);

    $('savePostBtn').addEventListener('click', savePost);
    $('aiBeautifyBtn').addEventListener('click', beautifyCurrentDraft);
    initMarkdownTabs();

    $('generatePostBtn').addEventListener('click', generatePost);
    $('publishGeneratedBtn').addEventListener('click', publishGenerated);
    $('regenerateBtn').addEventListener('click', generatePost);
    $('editGeneratedBtn').addEventListener('click', sendToEditor);

    $('saveSettingsBtn').addEventListener('click', saveSettings);
    $('requestNotifBtn').addEventListener('click', async () => {
      try { await AI.requestNotifications(); toast("Notifications enabled! You'll be reminded daily.", 'success'); }
      catch (e) { toast(e.message, 'error'); }
    });
    $('toggleApiKey').addEventListener('click', () => {
      const input   = $('apiKeyInput');
      const showing = input.type === 'text';
      input.type    = showing ? 'password' : 'text';
      $('toggleApiKey').textContent = showing ? 'show' : 'hide';
    });
    $('exportBtn').addEventListener('click', exportData);
    $('importInput').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); });
    $('clearDataBtn').addEventListener('click', () => {
      showModal('Clear All Data', 'This will permanently delete all posts and categories. Are you sure?', [
        { label: 'Cancel',           cls: 'btn-ghost',  action: closeModal },
        { label: 'Clear Everything', cls: 'btn-danger', action: () => {
          localStorage.clear();
          closeModal();
          renderPosts(); populateCategorySelects(); renderSidebarCategories();
          toast('All data cleared.', 'info');
        }},
      ]);
    });

    $('addCategoryBtn').addEventListener('click', openAddCategoryModal);

    $('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('modalOverlay').classList.contains('hidden')) closeModal();
    });

    $('hamburger').addEventListener('click', () => {
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
        $('hamburger').setAttribute('aria-expanded','false');
      }
    });

    renderPosts();
    renderSidebarCategories();
    populateCategorySelects();
    showView('home');

    if (Notification.permission === 'granted') AI.scheduleReminder();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
