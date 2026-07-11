/*
 * ============================================================
 *  MARKDOWN.JS — Converts Markdown Text to Web Page Content
 * ============================================================
 *
 *  WHAT IS MARKDOWN?
 *  Markdown is a simple way to format text using plain characters.
 *  You write plain text with special symbols, and it gets converted
 *  into properly formatted HTML (the language web pages are written in).
 *
 *  EXAMPLES:
 *  You write this...        It displays as...
 *  ─────────────────────    ──────────────────────────
 *  # My Big Title           A large heading
 *  ## Smaller Heading       A medium heading
 *  **bold text**            bold text
 *  *italic text*            italic text
 *  `some code`              code in a box
 *  - item one               • item one
 *  - item two               • item two
 *  [Link text](https://…)   A clickable link
 *
 *  WHY MARKDOWN?
 *  It's much easier to write than raw HTML. You can focus on
 *  content instead of memorising tags like <h2>, <strong>, etc.
 *  Most developer blogs (and GitHub itself) use Markdown.
 *
 *  HOW WE USE IT:
 *  When you type in the editor, you write Markdown.
 *  When a post is displayed on the blog, this file converts
 *  it to HTML using the "marked" library (loaded from a CDN in
 *  the HTML files). We then run the result through a sanitizer
 *  to remove anything unsafe before showing it on screen.
 * ============================================================
 */

'use strict';

const Markdown = (() => {

  /* ============================================================
   *  render — Converts Markdown text into safe HTML
   * ============================================================
   *
   *  This is the main function used every time a post is displayed.
   *
   *  The process:
   *  1. Pass the Markdown text to the "marked" library
   *     → marked is loaded in index.html and admin.html via a <script> tag
   *     → It converts Markdown syntax into HTML tags
   *  2. Run the resulting HTML through our __sanitize function
   *     → __sanitize is defined inline in the HTML files
   *     → It strips out any dangerous elements (scripts, iframe tricks, etc.)
   *     → Only safe, display-only HTML passes through
   *  3. Return the safe HTML string — the browser renders it as formatted text
   *
   *  PARAMETER:
   *  content — a Markdown-formatted string (e.g. "## My Post\n\nHello **world**")
   *
   *  RETURNS:
   *  A safe HTML string ready to be set as innerHTML
   *
   *  ERROR HANDLING:
   *  If the markdown library fails for any reason (e.g. malformed input),
   *  we fall back to showing the raw text as a plain paragraph —
   *  not pretty, but at least nothing breaks.
   */
  function render(content) {
    if (!content) return ''; // if there's nothing to render, return empty string immediately

    try {
      const raw = marked.parse(content); // convert Markdown → HTML using the "marked" library
      // Run through our custom sanitizer to remove dangerous HTML before displaying
      return window.__sanitize ? window.__sanitize(raw) : raw;
    } catch (e) {
      // If rendering fails, log the error (visible in browser DevTools) and show plain text
      console.error('Markdown render error:', e);
      return `<p>${content.replace(/</g, '&lt;')}</p>`; // escape < so no HTML injection
    }
  }


  /* ============================================================
   *  excerpt — Creates a short plain-text preview of a post
   * ============================================================
   *
   *  Used on the post cards in the blog feed to show a brief
   *  teaser without all the formatting. We strip out the Markdown
   *  symbols so the preview reads as plain, natural text.
   *
   *  EXAMPLES OF WHAT GETS STRIPPED:
   *  "## My Heading"      → "My Heading"
   *  "**bold text**"      → "bold text"
   *  "`some code`"        → "some code"
   *  "[Link](http://…)"   → "Link"
   *  "- bullet point"     → "bullet point"
   *
   *  The result is truncated to maxLen characters (default: 180).
   *  We also make sure not to cut off in the middle of a word —
   *  we trim back to the last complete word before the limit.
   *
   *  PARAMETERS:
   *  content — the raw Markdown string
   *  maxLen  — maximum characters in the excerpt (default: 180)
   */
  function excerpt(content, maxLen = 180) {
    // Strip Markdown formatting symbols to get plain text
    const plain = content
      .replace(/#{1,6}\s+/g, '')        // remove # ## ### etc. headings
      .replace(/\*\*(.+?)\*\*/g, '$1')  // remove **bold** → bold
      .replace(/\*(.+?)\*/g, '$1')      // remove *italic* → italic
      .replace(/`(.+?)`/g, '$1')        // remove `code` → code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // remove [text](url) → text
      .replace(/^\s*[-*>]\s+/gm, '')    // remove - and * bullets and > blockquotes
      .replace(/\n+/g, ' ')             // replace line breaks with spaces
      .trim();                           // remove leading/trailing whitespace

    // If the whole thing fits, return it as-is
    if (plain.length <= maxLen) return plain;

    // Otherwise, cut at the limit and then trim back to the last full word
    // This prevents the excerpt from ending mid-word like "I was working on nav…"
    return plain.slice(0, maxLen).replace(/\s+\S*$/, '') + '…'; // '…' is the ellipsis character
  }


  /*
   * WHAT THIS FILE EXPORTS
   * Both functions are used by public.js and admin.js.
   */
  return { render, excerpt };

})();
