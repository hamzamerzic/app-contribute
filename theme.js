// One module-level stylesheet rendered once at the app root as
// <style>{CSS}</style>. Semantic co-* classNames; state rides is-*
// modifier classes; every color is a theme token so the app follows the
// owner's light/dark theme. Shared chrome blocks carry mobius-ui fences
// so a future library harvest can find them.
export const CSS = `
/* mobius-ui:Root v1 — app-owned copy; library candidate. */
.co-root {
  box-sizing: border-box; position: relative; min-height: 0; height: 100%;
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
.co-root *, .co-root *::before, .co-root *::after { box-sizing: inherit; }
/* /mobius-ui:Root */

/* mobius-ui:Scrollskin v2 — keep in sync; hidden by default, content stays scrollable. */
.co-page,
.co-diff-view {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.co-page::-webkit-scrollbar,
.co-diff-view::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
/* /mobius-ui:Scrollskin */

/* mobius-ui:Focus v1 — one keyboard-focus ring for every interactive
   control, so nothing ships without a visible focus indicator. */
:where(button, a, input, textarea, select, summary, [role="button"],
       [tabindex]:not([tabindex="-1"])):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

/* mobius-ui:ReducedMotion v1 — collapse motion to ~instant for
   motion-sensitive users. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
/* /mobius-ui:ReducedMotion */

.co-page {
  flex: 1; min-height: 0; width: min(100%, 680px); margin: 0 auto;
  padding: 0 16px 48px; overflow-y: auto; overflow-x: hidden;
  overscroll-behavior: contain;
}

.co-header {
  display: flex; align-items: center; gap: 11px;
  padding: max(16px, env(safe-area-inset-top)) 0 4px;
}
.co-brand-icon {
  width: 34px; height: 34px; border-radius: 8px;
  object-fit: cover; flex-shrink: 0; display: block;
}
.co-brand-fallback {
  width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 700;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}
.co-title { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0; }
.co-subtitle { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }

.co-offline-note { display: block; margin: 8px 0 0; font-size: 12px; color: var(--muted); }

/* Stat tiles: label + value wear text tokens, never status colors — the
   counts are magnitudes, and the group labels below carry the identity. */
.co-tiles {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  margin: 14px 0 10px;
}
.co-tile {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 14px;
}
.co-tile-value { font-size: 24px; font-weight: 650; line-height: 1.2; letter-spacing: 0; }
.co-tile-label { margin-top: 2px; font-size: 12px; color: var(--muted); }

/* Connection card. The dot is decorative — the text always carries the
   state, so color is never the only signal. */
.co-conn {
  display: flex; align-items: flex-start; gap: 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 13px 14px;
}
.co-conn-dot {
  flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
  margin-top: 6px; background: var(--muted);
}
.co-conn-dot.is-ok { background: var(--green); }
.co-conn-dot.is-warn { background: var(--danger); }
.co-conn-dot.is-accent { background: var(--accent); }
.co-conn-body { min-width: 0; flex: 1; }
.co-conn-title { font-size: 14px; font-weight: 650; margin: 0 0 2px; }
.co-conn-text { margin: 0; font-size: 13px; line-height: 1.55; color: var(--muted); }
.co-conn-text strong { color: var(--text); font-weight: 650; }
.co-conn-text a, .co-conn-hint a { color: var(--accent); }

/* Connect flow (device + PAT), shown inline when disconnected. The card
   switches to a column layout so the controls stack; every control uses the
   shared theme tokens and a 44px min touch target. */
.co-conn.is-column { flex-direction: column; align-items: stretch; gap: 13px; }
.co-conn-row { display: flex; align-items: flex-start; gap: 10px; }
.co-conn-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.co-conn-body .co-conn-actions { margin-top: 10px; }
.co-conn-device { display: flex; flex-direction: column; gap: 10px; }
.co-conn-pat { display: flex; flex-direction: column; gap: 8px; margin: 0; }
.co-conn-form { display: flex; flex-direction: column; gap: 8px; }

/* mobius-ui:Button v1 — app-owned copy; library candidate. */
.co-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 10px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--surface); color: var(--text);
  font-family: var(--font); font-size: 14px; font-weight: 500; cursor: pointer;
  transition: background .14s ease, border-color .14s ease, transform .1s ease;
}
.co-btn:active { transform: scale(0.97); }
.co-btn:disabled { opacity: 0.5; cursor: default; }
.co-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.co-btn-danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
.co-btn-sm { min-height: 36px; padding: 7px 12px; font-size: 13px; }
.co-btn-block { width: 100%; }
/* /mobius-ui:Button */

/* mobius-ui:Input v1 — app-owned copy; library candidate. */
.co-conn-input {
  display: block; width: 100%; box-sizing: border-box; min-height: 44px;
  padding: 11px 12px; background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: 10px; outline: none;
  font-family: var(--mono, var(--font)); font-size: 16px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
.co-conn-input:focus,
.co-conn-input:focus-visible {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}
/* /mobius-ui:Input */

/* The one-time device code: large, monospaced, selectable as a whole. */
.co-conn-code {
  font-family: var(--mono, var(--font)); font-size: 30px; font-weight: 700;
  letter-spacing: 0; text-align: center; padding: 14px 12px;
  border-radius: 10px; background: var(--surface2, var(--bg));
  border: 1px dashed var(--border); color: var(--text); user-select: all;
}
.co-conn-wait { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.co-conn-waiting { margin: 0; font-size: 13px; color: var(--muted); }
.co-conn-hint { margin: 0; font-size: 12.5px; color: var(--muted); line-height: 1.5; }
.co-conn-hint code {
  font-family: var(--mono, var(--font)); font-size: 12px;
  padding: 1px 5px; border-radius: 5px;
  background: color-mix(in srgb, var(--text) 8%, transparent);
}
.co-conn-error { margin: 2px 0 0; font-size: 13px; color: var(--danger); line-height: 1.45; }
.co-conn-divider {
  display: flex; align-items: center; gap: 10px;
  font-size: 11px; color: var(--muted); letter-spacing: 0;
}
.co-conn-divider::before, .co-conn-divider::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}

.co-section { margin-top: 22px; }
.co-section-title { margin: 0; font-size: 13px; font-weight: 650; color: var(--muted); }
.co-section-hint { margin: 3px 0 0; font-size: 12px; color: var(--muted); }

/* mobius-ui:Card v1 — app-owned copy; library candidate. */
.co-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 13px 14px; margin-top: 8px;
}
/* /mobius-ui:Card */

.co-card-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 10px;
}
.co-card-title {
  font-size: 15px; font-weight: 650; line-height: 1.35; color: var(--text);
  text-decoration: none; min-width: 0; overflow-wrap: anywhere;
  /* generous tap area for the text link without shifting layout */
  padding: 4px 0; margin: -4px 0;
}
@media (hover: hover) {
  a.co-card-title:hover { text-decoration: underline; }
}
.co-chip {
  flex: 0 0 auto; font-size: 11px; font-weight: 650; line-height: 1;
  padding: 5px 9px; border-radius: 999px;
  background: var(--surface2, var(--surface)); color: var(--muted);
}
.co-chip.is-prepared,
.co-chip.is-submitting,
.co-chip.is-open {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.co-chip.is-merged {
  background: color-mix(in srgb, var(--green) 14%, transparent);
  color: var(--green);
}
.co-card-summary { margin: 6px 0 0; font-size: 13px; line-height: 1.5; }
.co-card-meta {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
  font-size: 12px; color: var(--muted);
}

/* Review view: the staged plan a prepared card expands into. Prose stays in
   the app font; the diff is monospace and scrolls INSIDE its own block (both
   axes) so a wide hunk never stretches the card or the page. */
.co-review-toggle { margin-top: 10px; }
.co-review {
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
  margin-top: 10px; padding-top: 12px; border-top: 1px solid var(--border);
}
.co-review-badge {
  font-size: 11px; font-weight: 650; line-height: 1; padding: 5px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.co-review-title { font-size: 14px; font-weight: 650; line-height: 1.4; }
.co-review-coauthor {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 28px; padding: 5px 9px; border-radius: 8px;
  background: color-mix(in srgb, var(--green) 12%, transparent);
  color: var(--green); font-size: 12px; line-height: 1.2;
}
.co-review-coauthor strong { color: var(--green); font-weight: 700; }
.co-review-section {
  align-self: stretch; display: flex; flex-direction: column; gap: 8px;
}
.co-review-section-title {
  font-size: 12px; font-weight: 650; color: var(--muted);
}
.co-markdown {
  font-size: 13px; line-height: 1.58; color: var(--text);
  overflow-wrap: anywhere;
}
.co-markdown > * { margin: 0; }
.co-markdown > * + * { margin-top: 9px; }
.co-markdown h1,
.co-markdown h2,
.co-markdown h3 {
  font-size: 14px; line-height: 1.35; font-weight: 700; text-wrap: balance;
}
.co-markdown ul,
.co-markdown ol { padding-left: 20px; }
.co-markdown li + li { margin-top: 4px; }
.co-markdown a { color: var(--accent); }
.co-markdown code {
  font-family: var(--mono, var(--font)); font-size: 12px;
  padding: 1px 5px; border-radius: 5px;
  background: color-mix(in srgb, var(--text) 9%, transparent);
}
.co-markdown pre {
  overflow: auto; padding: 10px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--surface2, var(--bg));
}
.co-markdown pre code {
  display: block; padding: 0; background: transparent; white-space: pre;
}
.co-markdown blockquote {
  margin: 0; padding: 0 0 0 12px; border-left: 1px solid var(--border);
  color: var(--muted);
}
.co-review-diffwrap {
  align-items: flex-start;
}
.co-review-diffstat {
  font-family: var(--mono, var(--font)); font-size: 12px; line-height: 1.5;
  color: var(--muted); white-space: pre-wrap; overflow-wrap: anywhere;
}
.co-diff-view {
  align-self: stretch; max-height: 420px; overflow: auto;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface2, var(--bg));
}
.co-diff-file + .co-diff-file { border-top: 1px solid var(--border); }
.co-diff-file-head {
  position: sticky; top: 0; z-index: 1;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  min-width: max-content; padding: 8px 10px;
  background: var(--surface2, var(--bg)); border-bottom: 1px solid var(--border);
}
.co-diff-file-name {
  font-family: var(--mono, var(--font)); font-size: 12px; font-weight: 650;
}
.co-diff-file-stat {
  font-family: var(--mono, var(--font)); font-size: 12px; color: var(--muted);
}
.co-diff-lines { min-width: max-content; padding: 4px 0; }
.co-diff-row {
  display: grid; grid-template-columns: 48px 48px 24px max-content;
  min-width: max-content; font-family: var(--mono, var(--font));
  font-size: 12px; line-height: 1.5;
}
.co-diff-row.is-add {
  background: color-mix(in srgb, var(--green) 12%, transparent);
}
.co-diff-row.is-del {
  background: color-mix(in srgb, var(--danger) 11%, transparent);
}
.co-diff-num {
  padding: 0 8px; color: var(--muted); text-align: right;
  user-select: none;
}
.co-diff-mark {
  padding: 0 4px; color: var(--muted); user-select: none;
}
.co-diff-code { padding-right: 12px; white-space: pre; color: var(--text); }
.co-diff-hunk,
.co-diff-meta {
  min-width: max-content; padding: 4px 10px;
  font-family: var(--mono, var(--font)); font-size: 12px; line-height: 1.45;
  color: var(--muted); white-space: pre;
}
.co-diff-hunk {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
.co-review-link { font-size: 13px; color: var(--accent); }
.co-review-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.co-review-note { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.co-review-error { margin: 0; font-size: 13px; line-height: 1.5; color: var(--danger); }

/* mobius-ui:Empty v1 — app-owned copy; library candidate. */
.co-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center; gap: 8px;
  min-height: 46dvh; max-width: 440px; margin: 0 auto; padding: 40px 24px;
  color: var(--muted);
}
.co-empty-mark {
  width: 64px; height: 64px; margin-bottom: 10px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.co-empty-title { font-size: 17px; font-weight: 700; color: var(--text); }
.co-empty-text { margin: 0; font-size: 14px; line-height: 1.6; }
/* /mobius-ui:Empty */
`
