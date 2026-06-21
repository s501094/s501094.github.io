/*
 * ============================================================
 *  THEMES.JS — Colour Scheme Switcher
 * ============================================================
 *
 *  This file controls the visual colour theme of the admin panel.
 *  Five themes are available, all inspired by popular dark-mode
 *  colour schemes used by developers:
 *
 *  ┌──────────────┬────────────────────────────────────────┐
 *  │ tokyo-night  │ Deep navy blues + soft purples         │
 *  │ catppuccin   │ Warm pastels on dark chocolate         │
 *  │ nord         │ Cool arctic blues and greens           │
 *  │ dracula      │ Vivid purples and pinks on dark grey   │
 *  │ gruvbox      │ Earthy yellows and greens on brown     │
 *  └──────────────┴────────────────────────────────────────┘
 *
 *  HOW THEMES WORK:
 *  Each theme is defined in css/themes.css as a set of
 *  "CSS custom properties" (also called CSS variables).
 *  These are like named colour slots:
 *
 *    [data-theme="tokyo-night"] {
 *      --bg:     #0d1117;   ← background colour
 *      --accent: #7aa2f7;   ← highlight colour (blue)
 *      --text:   #c0caf5;   ← body text colour
 *      ... etc
 *    }
 *
 *  Switching themes is as simple as changing the "data-theme"
 *  attribute on the <html> element. The browser automatically
 *  updates all colours everywhere on the page instantly.
 *
 *  BONUS FEATURE — AI Theme Switching:
 *  If you mention a theme name in your AI Assist notes
 *  (e.g. "switch to dracula" or "use nord today"),
 *  the theme changes automatically when the AI generates your post.
 * ============================================================
 */

'use strict';

const Themes = (() => {

  /*
   * VALID — The complete list of allowed theme names.
   * We check against this list before applying anything,
   * so a typo or injected value can't set an invalid theme.
   */
  const VALID = ['tokyo-night', 'catppuccin', 'nord', 'dracula', 'gruvbox'];


  /* ============================================================
   *  apply — Switches the active theme
   * ============================================================
   *
   *  This is the main function that actually changes the look.
   *
   *  It does three things:
   *  1. Sets data-theme="..." on the <html> element
   *     → The CSS in themes.css uses this to switch colour sets
   *  2. Updates the theme buttons so the active one looks selected
   *  3. Saves the choice to Settings so it persists next visit
   *
   *  PARAMETER:
   *  theme — one of the five valid theme name strings (e.g. "dracula")
   */
  function apply(theme) {
    // Don't apply unknown themes — silently reject invalid values
    if (!VALID.includes(theme)) return;

    // 1. Set the data-theme attribute on the root <html> element.
    //    All CSS rules in themes.css are scoped to this attribute,
    //    so changing it instantly recolours the entire page.
    document.documentElement.setAttribute('data-theme', theme);

    // 2a. Update the small "TN / CP / ND / DR / GB" buttons in the sidebar.
    //     The active one gets highlighted, all others go back to default.
    document.querySelectorAll('.theme-btn').forEach(btn => {
      const isActive = btn.dataset.theme === theme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive)); // accessibility: tells screen readers which is selected
    });

    // 2b. Update the larger theme card buttons in the Settings page
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.theme === theme);
    });

    // 3. Save the choice so it's remembered next time you open the admin panel
    const settings = Store.Settings.get();
    Store.Settings.save({ ...settings, theme }); // spread keeps all other settings unchanged
  }


  /* ============================================================
   *  getCurrent — Returns the currently active theme name
   * ============================================================
   *
   *  Reads the data-theme attribute directly from the <html> element.
   *  Falls back to 'tokyo-night' if for some reason it's not set.
   */
  function getCurrent() {
    return document.documentElement.getAttribute('data-theme') || 'tokyo-night';
  }


  /* ============================================================
   *  detectThemeInText — Finds theme commands in written text
   * ============================================================
   *
   *  This enables the "AI theme switching" feature.
   *  When you write your dev notes in AI Assist, you can casually
   *  mention a theme and the site switches automatically.
   *
   *  Examples that would trigger a switch:
   *  - "switch to dracula"
   *  - "I want to try nord today"
   *  - "use catppuccin" or "use cat" or "use mocha"
   *  - "tokyo night vibes"
   *
   *  HOW IT WORKS:
   *  It converts the text to lowercase, then checks whether any of
   *  the theme names (or their known nicknames) appear anywhere in it.
   *  Returns the theme name if found, or null if no match.
   *
   *  PARAMETER:
   *  text — any string (your raw dev notes)
   */
  function detectThemeInText(text) {
    const lower = text.toLowerCase(); // normalise so matching is case-insensitive

    for (const t of VALID) {
      // Each theme has a list of words/phrases that count as a match
      const aliases = {
        'tokyo-night': ['tokyo night', 'tokyo-night', 'tokyo'],
        'catppuccin':  ['catppuccin', 'cat', 'mocha'],  // "mocha" is the dark variant's name
        'nord':        ['nord'],
        'dracula':     ['dracula'],
        'gruvbox':     ['gruvbox'],
      };

      // .some() returns true if at least one alias is found in the text
      if ((aliases[t] || [t]).some(alias => lower.includes(alias))) {
        return t; // found a match — return the theme name
      }
    }

    return null; // no theme mentioned
  }


  /* ============================================================
   *  init — Sets up themes when the page first loads
   * ============================================================
   *
   *  Called once at startup (from admin.js or public.js).
   *  Does two things:
   *  1. Loads and applies your previously saved theme preference
   *  2. Attaches click handlers to all theme buttons so they work
   */
  function init() {
    // 1. Load saved theme (from Settings) and apply it immediately
    const saved = Store.Settings.get().theme || 'tokyo-night';
    apply(saved); // this updates the HTML attribute AND highlights the right button

    // 2. Attach click handlers to the small sidebar theme buttons (TN / CP / etc.)
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => apply(btn.dataset.theme));
      // btn.dataset.theme reads the data-theme="tokyo-night" attribute from the HTML
    });

    // 3. Attach click handlers to the larger theme cards in Settings
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => apply(card.dataset.theme));
    });
  }


  /*
   * WHAT THIS FILE EXPORTS
   * These are the only functions other files can call.
   */
  return { init, apply, getCurrent, detectThemeInText, VALID };

})();
