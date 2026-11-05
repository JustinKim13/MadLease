// Microinteractions shared by the phone and desktop layouts. Everything is scoped to .hm-root
// (both page roots and the listing-type modal), so it never touches other pages.
export const INTERACTION_CSS = `
.hm-root :focus-visible { outline: 2px solid var(--badger-red); outline-offset: 3px; }

/* Press: buttons, links and cards shrink slightly while pressed */
.hm-root .hm-press { transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1); }
.hm-root .hm-card { transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, border-color 0.3s ease; }
.hm-root .hm-press:active { transform: scale(0.97); }
.hm-root .hm-card:active { transform: scale(0.985); }
.browse-btn:active, .list-btn:active { transform: scale(0.97) !important; transition-duration: 0.08s !important; }

/* Photos: fade in on load, zoom on pointer hover */
.hm-root .hm-img { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease; }

/* Mobile list/map switch: the incoming view drifts in a few pixels and fades up */
@keyframes hmSlideFromRight {
  from { opacity: 0; transform: translateX(10px); }
  to { opacity: 1; transform: none; }
}
@keyframes hmSlideFromLeft {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: none; }
}
/* Softer iOS-style curve and a longer run, so the switch eases in rather than snapping */
.hm-root .hm-view-in-right { animation: hmSlideFromRight 0.38s cubic-bezier(0.32, 0.72, 0, 1) both; }
.hm-root .hm-view-in-left { animation: hmSlideFromLeft 0.38s cubic-bezier(0.32, 0.72, 0, 1) both; }

/* Filter menus: fade and slide in when opened, options highlight on hover */
@keyframes hmMenuIn {
  from { opacity: 0; translate: 0 -4px; }
  to { opacity: 1; translate: 0 0; }
}
.hm-root .hm-menu-in { animation: hmMenuIn 0.18s cubic-bezier(0.22, 1, 0.36, 1); }
.hm-root .hm-option { transition: background-color 0.12s ease; }
.hm-root .hm-option:hover { background-color: rgba(127, 127, 127, 0.14) !important; }

/* Listing cards: no lift on hover (the lift moved the card out from under the cursor and caused stutter at the bottom edge); the shadow and border highlight still show */
/* The lift is driven by the row, so the card moving never drops the hover (no stutter at the bottom edge) */
.hm-root .listing-link:hover .listing-card { transform: translateY(-3px); }
.hm-root .listing-link:hover .listing-card:active { transform: scale(0.985); }
/* Pressing the bookmark must not press the card: keep the hover lift, drop the press scale */
.hm-root .listing-link:has(.bookmark-hit:active) .listing-card:active { transform: translateY(-3px) !important; }
.hm-root .listing-card:hover { transform: none; box-shadow: 0 6px 18px -10px rgba(0, 0, 0, 0.22) !important; border-color: rgba(0, 0, 0, 0.14) !important; }
body.dark-mode .hm-root .listing-card:hover { box-shadow: 0 10px 28px -12px rgba(0, 0, 0, 0.7) !important; border-color: rgba(255, 255, 255, 0.22) !important; }

/* Filter chips: the border firms up on hover (a brightness filter washed the text out on dark) */
.hm-root .hm-chip { transition: transform 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s ease; }
.hm-root .hm-chip:hover { border-color: rgba(127, 127, 127, 0.5) !important; }
.hm-root .hm-chip[data-active="true"]:hover { border-color: rgba(197, 5, 12, 0.6) !important; }

/* Native form controls in the filter menus pick up the brand red */
.hm-root input[type="checkbox"], .hm-root input[type="range"] { accent-color: var(--badger-red); }

/* Arrow nudge on "View all" */
.hm-root .hm-arrow { display: inline-block; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); }

/* Hover-only effects: on touch screens :hover sticks after a tap, so gate them on a real pointer */
@media (hover: hover) and (pointer: fine) {
  .hm-root .hm-card:hover .hm-img { transform: scale(1.04); }
  .hm-root a:hover > .hm-arrow { transform: translateX(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .hm-root .hm-menu-in, .hm-root .hm-view-in-right, .hm-root .hm-view-in-left { animation: none; }
  .hm-root .hm-press, .hm-root .hm-card, .hm-root .hm-img, .hm-root .hm-arrow { transition: none !important; }
  .hm-root .hm-press:active, .hm-root .hm-card:active, .hm-root .hm-card:hover .hm-img, .hm-root a:hover > .hm-arrow { transform: none !important; }
}
`;
