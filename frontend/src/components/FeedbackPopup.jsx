import { useEffect, useState, useCallback, useContext, useRef } from 'react';
import { useLocation } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- `motion` is used via a JSX member expression (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { motion } from 'framer-motion';
import { ApiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

// Routes where the user is mid-task — don't interrupt with a popup.
const isBusyPath = (pathname) =>
  pathname === '/listings/new' ||
  /^\/listings\/[^/]+\/edit$/.test(pathname) ||
  pathname.startsWith('/messages');

const LS_KEY_PREFIX = 'madlease_feedback_lastShown';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const lsKeyFor = (uid) => `${LS_KEY_PREFIX}:${uid || 'anon'}`;

const isInCooldown = (uid) => {
  try {
    const raw = localStorage.getItem(lsKeyFor(uid));
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch { return false; }
};

const markShown = (uid) => {
  try { localStorage.setItem(lsKeyFor(uid), String(Date.now())); } catch { /* ignore */ }
};


/**
 * FeedbackPopup
 *
 * Fetches GET /api/popups/feedback (auth optional). If the backend returns a popup,
 * renders a centered card.
 *
 * Interaction posts are sent ONLY on an explicit user action:
 *   - submit  → SUBMIT  (+ feedback: { feedbackType, feedbackMessage })
 *   - dismiss → DONT_SHOW_AGAIN
 *   - X / click-outside → VIEWED
 *
 * No post on mount. Exactly one interaction per popup open.
 */
export default function FeedbackPopup() {
  const { darkMode } = useContext(ThemeContext) || { darkMode: false };
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const [popup, setPopup] = useState(null);
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState('ask');      // 'ask' | 'submitting' | 'thanks'
  const [choice, setChoice] = useState(null);     // 'LIKE' | 'DISLIKE' | 'OTHER'
  const [note, setNote] = useState('');
  const sentRef = useRef(false);                  // guard: one interaction per open
  const remainingRef = useRef(180_000);           // active ms left before fetch; persists across route changes
  const firedRef = useRef(false);                 // don't re-fetch after popup has been shown/dismissed

  useBodyScrollLock(visible);

  useEffect(() => {
    if (firedRef.current) return;
    if (isInCooldown(currentUser?.uid)) { firedRef.current = true; return; }
    let cancelled = false;
    let startedAt = null;
    let timer = null;

    const fire = async () => {
      firedRef.current = true;
      try {
        const data = await ApiService.get('/popups/feedback', !!currentUser);
        if (cancelled) return;
        if (data) {
          setPopup(data);
          setVisible(true);
        }
      } catch { /* best-effort */ }
    };

    const canRun = () =>
      document.visibilityState === 'visible' && !isBusyPath(pathname);

    const start = () => {
      if (timer != null) return;
      startedAt = Date.now();
      timer = setTimeout(fire, remainingRef.current);
    };
    const pause = () => {
      if (timer == null) return;
      clearTimeout(timer);
      timer = null;
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
    const sync = () => { canRun() ? start() : pause(); };

    sync();
    document.addEventListener('visibilitychange', sync);

    return () => {
      cancelled = true;
      pause();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [pathname]);

  const send = useCallback(async (body) => {
    if (sentRef.current) return;
    // Anonymous users: only record when they actually submit feedback —
    // skip VIEWED / DONT_SHOW_AGAIN to avoid noise from drive-by closes.
    if (!currentUser && body.interactionType !== 'SUBMIT') return;
    sentRef.current = true;
    if (!popup?.popupId) return;
    try {
      await ApiService.post(`/popups/${popup.popupId}/interactions`, body, !!currentUser);
    } catch { /* best-effort */ }
  }, [popup, currentUser]);

  const closeAsViewed = useCallback(() => {
    send({ interactionType: 'VIEWED' });
    markShown(currentUser?.uid);
    setVisible(false);
  }, [send, currentUser]);

  const dontShowAgain = useCallback(() => {
    send({ interactionType: 'DONT_SHOW_AGAIN' });
    markShown(currentUser?.uid);
    setVisible(false);
  }, [send, currentUser]);

  const submit = useCallback(async () => {
    if (!choice) return;
    setStage('submitting');
    await send({
      interactionType: 'SUBMIT',
      feedback: {
        feedbackType: choice,
        feedbackMessage: note.trim() ? note.trim() : null,
      },
    });
    markShown(currentUser?.uid);
    setStage('thanks');
    setTimeout(() => setVisible(false), 1400);
  }, [choice, note, send, currentUser]);

  // Reset everything when the authenticated user changes so account A's
  // submit/thanks state doesn't leak into account B on the same browser.
  const lastUidRef = useRef(currentUser?.uid ?? null);
  useEffect(() => {
    const uid = currentUser?.uid ?? null;
    if (lastUidRef.current === uid) return;
    lastUidRef.current = uid;
    setVisible(false);
    setPopup(null);
    setStage('ask');
    setChoice(null);
    setNote('');
    sentRef.current = false;
    firedRef.current = false;
    remainingRef.current = 180_000;
  }, [currentUser?.uid]);

  if (!visible || !popup) return null;

  // Apple HIG palette: neutral grays, heavy use of translucency/layering.
  const text      = darkMode ? '#f5f5f7' : '#1d1d1f';
  const muted     = darkMode ? '#98989d' : '#6e6e73';
  const fieldBg   = darkMode ? 'rgba(118, 118, 128, 0.24)' : 'rgba(118, 118, 128, 0.08)';

  const sf = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fbp-fade 260ms cubic-bezier(.32,.72,0,1) both',
        fontFamily: sf,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Share feedback"
    >
      <style>{`
        @keyframes fbp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fbp-pop  {
          from { opacity: 0; transform: translateY(10px) scale(0.96) }
          to   { opacity: 1; transform: translateY(0)    scale(1) }
        }
        .fbp-chip { transition: background 220ms cubic-bezier(.32,.72,0,1), color 220ms ease, box-shadow 220ms ease; }
        .fbp-chip:hover:not([aria-pressed="true"]) { color: ${text} !important; }
        .fbp-chip:active { transform: scale(0.97); transition: transform 80ms ease; }
        .fbp-submit {
          transition: background 200ms ease, opacity 160ms ease, transform 120ms cubic-bezier(.32,.72,0,1), box-shadow 220ms ease;
          -webkit-font-smoothing: antialiased;
        }
        .fbp-submit:hover:not(:disabled) { background: #b81414 !important; }
        .fbp-submit:active:not(:disabled) { transform: scale(0.97); }
        .fbp-ghost { transition: color 160ms ease; }
        .fbp-ghost:hover:not(:disabled) { color: ${text} !important; }
        .fbp-close { transition: background 160ms ease; }
        .fbp-close:hover { background: ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} !important; }
        .fbp-textarea { transition: background 180ms ease, box-shadow 180ms ease; }
        .fbp-textarea:focus {
          background: ${darkMode ? 'rgba(118,118,128,0.32)' : 'rgba(118,118,128,0.14)'} !important;
          box-shadow: 0 0 0 3px ${darkMode ? 'rgba(255,69,58,0.25)' : 'rgba(192,0,0,0.15)'} !important;
        }
        .fbp-textarea::placeholder { color: ${muted}; }
      `}</style>

      <div
        style={{
          background: darkMode ? '#1e1e1e' : '#ffffff',
          color: text,
          borderRadius: 20,
          maxWidth: 440,
          width: '100%',
          padding: '1.75rem 1.75rem 1.25rem',
          boxShadow: darkMode
            ? '0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
            : '0 30px 80px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.04)',
          border: `1px solid ${darkMode ? '#333' : '#eee'}`,
          animation: 'fbp-pop 420ms cubic-bezier(.32,.72,0,1) both',
          position: 'relative',
          letterSpacing: '-0.01em',
        }}
      >
        {/* Close X */}
        <button
          className="fbp-close"
          onClick={closeAsViewed}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, borderRadius: '50%',
            border: 'none',
            background: darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
            color: muted, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        {stage === 'thanks' ? (
          <div style={{ textAlign: 'center', padding: '1.25rem 0 0.5rem' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: darkMode ? 'rgba(48, 209, 88, 0.18)' : 'rgba(52, 199, 89, 0.14)',
              color: darkMode ? '#30d158' : '#30a14e',
              display: 'grid', placeItems: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 12 10 17 19 8" />
              </svg>
            </div>
            <h3 style={{
              margin: '0 0 0.3rem', fontSize: '1.3rem', fontWeight: 600,
              letterSpacing: '-0.02em',
            }}>
              Thanks for the feedback
            </h3>
            <p style={{ margin: 0, color: muted, fontSize: '0.95rem', lineHeight: 1.45 }}>
              {choice === 'LIKE'    ? 'Glad MadLease is working for you.'
              : choice === 'DISLIKE' ? "We'll use this to make it better."
              :                        "We'll take a look."}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '1.25rem', paddingRight: '2.25rem' }}>
              <h3 style={{
                margin: '0 0 0.35rem',
                fontSize: '1.375rem',
                fontWeight: 600,
                lineHeight: 1.18,
                letterSpacing: '-0.022em',
              }}>
                How's MadLease working for you?
              </h3>
              <p style={{
                margin: 0, color: muted,
                fontSize: '0.9375rem', lineHeight: 1.45,
                letterSpacing: '-0.005em',
              }}>
                Takes 10 seconds.
              </p>
            </div>

            {/* Profile-style segmented tabs with sliding pill */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              position: 'relative',
              gap: '3px',
              padding: '3px',
              marginBottom: '1.25rem',
              backgroundColor: darkMode ? '#1a1918' : '#f0f0f0',
              borderRadius: '10px',
              width: '100%',
            }}>
              {[
                { key: 'LIKE',    label: 'Like it', icon: <ThumbUpIcon /> },
                { key: 'DISLIKE', label: "Don't",   icon: <ThumbDownIcon /> },
                { key: 'OTHER',   label: 'Other',   icon: <DotsIcon /> },
              ].map(({ key, label, icon }) => {
                const isActive = choice === key;
                return (
                  <button
                    key={key}
                    onClick={() => setChoice(key)}
                    aria-pressed={isActive}
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '0.6rem 0.5rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '7px',
                      color: isActive
                        ? (darkMode ? '#f0ebe5' : '#1a1a1a')
                        : (darkMode ? '#8a8280' : '#888'),
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'color 0.2s ease',
                      fontSize: '0.82rem',
                      letterSpacing: '0.01em',
                      whiteSpace: 'nowrap',
                      fontFamily: sf,
                      zIndex: 1,
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="fbp-activeChoicePill"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '7px',
                          backgroundColor: darkMode ? '#2a2826' : '#fff',
                          boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                          zIndex: -1,
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: isActive ? 'var(--badger-red)' : 'inherit',
                    }}>
                      {icon}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Textarea */}
            <div style={{ marginBottom: '1.25rem' }}>
              <textarea
                className="fbp-textarea"
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  choice === 'OTHER'   ? 'Tell us more…'
                : choice === 'LIKE'    ? 'What works well for you? (optional)'
                : choice === 'DISLIKE' ? 'What could be better? (optional)'
                :                        'Thoughts, bugs, ideas… (optional)'
                }
                rows={3}
                style={{
                  width: '100%',
                  resize: 'none',
                  minHeight: 92,
                  padding: '0.75rem 0.9rem',
                  borderRadius: 10,
                  border: 'none',
                  background: fieldBg,
                  color: text,
                  fontSize: '0.9375rem',
                  lineHeight: 1.45,
                  fontFamily: sf,
                  letterSpacing: '-0.005em',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{
                textAlign: 'right', fontSize: '0.72rem',
                color: muted, marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {note.length}/2000
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <button
                className="fbp-ghost"
                onClick={dontShowAgain}
                disabled={stage === 'submitting'}
                style={{
                  background: 'none', border: 'none', padding: '0.5rem 0',
                  color: muted, cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  fontFamily: sf,
                  letterSpacing: '-0.005em',
                }}
              >
                Don't show again
              </button>
              <button
                className="fbp-submit"
                onClick={submit}
                disabled={!choice || stage === 'submitting' || (choice === 'OTHER' && !note.trim())}
                style={{
                  background: 'var(--badger-red)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 980,
                  padding: '0.625rem 1.25rem',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  fontFamily: sf,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  opacity: (!choice || (choice === 'OTHER' && !note.trim())) ? 0.4 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                }}
              >
                {stage === 'submitting' ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const ThumbUpIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10v11" />
    <path d="M7 10l4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.1 21H7" />
  </svg>
);

const ThumbDownIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 14V3" />
    <path d="M17 14l-4 7a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 6.9 3H17" />
  </svg>
);

const DotsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="18" cy="12" r="1.3" fill="currentColor" />
  </svg>
);
