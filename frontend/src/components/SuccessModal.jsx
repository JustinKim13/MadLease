import { useState, useContext, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';

const CONFETTI_COLORS = ['#c5050c', '#22c55e', '#0ea5e9', '#facc15', '#a855f7', '#f97316'];

function ConfettiBurst({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h * 0.35;

    const particles = Array.from({ length: 120 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 12;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: 5 + Math.random() * 7,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        isCircle: Math.random() > 0.55,
        life: 0,
        maxLife: 90 + Math.random() * 60,
      };
    });

    let animId;
    const gravity = 0.12;

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;

      for (const p of particles) {
        if (p.life >= p.maxLife) continue;
        alive = true;
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.vx *= 0.99;
        p.rotation += p.rotSpeed;
        const fade = p.life / p.maxLife;
        const opacity = fade < 0.7 ? 1 : 1 - (fade - 0.7) / 0.3;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        if (p.isCircle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(-p.size / 2, -p.size / 4, p.size, p.size / 2, 1);
          ctx.fill();
        }
        ctx.restore();
      }

      if (alive) {
        animId = requestAnimationFrame(animate);
      }
    };

    const delay = setTimeout(() => {
      animId = requestAnimationFrame(animate);
    }, 350);

    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(animId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1001,
      }}
    />
  );
}

const TOTAL_STEPS = 4;

export default function SuccessModal({ isOpen, onClose, listing }) {
  const { darkMode } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animateIn, setAnimateIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [canBackdropDismiss, setCanBackdropDismiss] = useState(false);
  const [animPhase, setAnimPhase] = useState(0);
  const [canHoverBounce, setCanHoverBounce] = useState(false);
  const [hoveredShareAction, setHoveredShareAction] = useState(null);
  const confettiPlayedRef = useRef(false);
  const slideRef = useRef(null);

  const shareUrl = `${window.location.origin}/listings/${listing?.id}`;
  const shareTitle = `${listing?.title} - MadLease`;
  const shareText = `Check out this listing: ${shareTitle}`;
  const primaryImageUrl = listing?.preSignedGetUrls?.[0];
  const listingPrice = listing?.rent ?? listing?.price;
  const listingPriceText = Number.isFinite(Number(listingPrice))
    ? `$${Number(listingPrice)}/mo`
    : 'Price unavailable';

  const formatFullDate = useCallback((dateValue) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const startDateText = formatFullDate(listing?.startDate);
  const endDateText = formatFullDate(listing?.endDate);
  const listingDateText = startDateText && endDateText
    ? `${startDateText} - ${endDateText}`
    : startDateText
      ? `Starting ${startDateText}`
      : endDateText
        ? `Until ${endDateText}`
        : 'Dates not set';

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateHoverCapability = () => {
      const canHover = mediaQuery.matches;
      setCanHoverBounce(canHover);
      if (!canHover) setHoveredShareAction(null);
    };

    updateHoverCapability();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateHoverCapability);
      return () => mediaQuery.removeEventListener('change', updateHoverCapability);
    }
    mediaQuery.addListener(updateHoverCapability);
    return () => mediaQuery.removeListener(updateHoverCapability);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setDirection(1);
      setCopied(false);
      setShowConfetti(false);
      setCanBackdropDismiss(false);
      setHoveredShareAction(null);
      confettiPlayedRef.current = false;
      const t = setTimeout(() => setAnimateIn(true), 30);
      const backdropDismissTimer = setTimeout(() => {
        setCanBackdropDismiss(true);
      }, 500);
      const confettiTimer = setTimeout(() => {
        if (!confettiPlayedRef.current) {
          confettiPlayedRef.current = true;
          setShowConfetti(true);
        }
      }, 400);
      return () => { clearTimeout(t); clearTimeout(confettiTimer); clearTimeout(backdropDismissTimer); };
    }
    setAnimateIn(false);
    setShowConfetti(false);
    setCanBackdropDismiss(false);
    setHoveredShareAction(null);
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') handleDismiss();
      if (e.key === 'ArrowRight' && step < TOTAL_STEPS - 1) {
        setDirection(1);
        setStep(s => s + 1);
      }
      if (e.key === 'ArrowLeft' && step > 0) {
        setDirection(-1);
        setStep(s => s - 1);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [isOpen, step, handleDismiss]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = slideRef.current;
    if (!el) return;
    const animName = direction > 0 ? 'slideInRight' : 'slideInLeft';
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = `${animName} 0.35s cubic-bezier(0.25, 1, 0.5, 1) both`;
  }, [isOpen, step, direction]);

  // Animation state machine for Step 3 status demo — loops while Step 3 is visible
  useEffect(() => {
    if (!isOpen || step !== 3) return;

    const timings = [
      1500, // phase 0: show card with Available badge
      500,  // phase 1: cursor moves to badge
      150,  // phase 2: badge press effect
      300,  // phase 3: dropdown fades in (Available checked)
      600,  // phase 4: cursor moves to Pending row, highlights
      300,  // phase 5: dropdown closes, badge becomes Pending
      1500, // phase 6: hold on Pending
      500,  // phase 7: cursor moves back to badge
      150,  // phase 8: badge press effect
      300,  // phase 9: dropdown fades in (Pending checked)
      600,  // phase 10: cursor moves to Completed row, highlights
      300,  // phase 11: dropdown closes, badge becomes Completed
      2200, // phase 12: hold on Completed (final state) before looping
    ];
    const TOTAL_PHASES = timings.length;
    let currentPhase = 0;
    setAnimPhase(0);

    const timers = [];
    const scheduleNext = () => {
      const t = setTimeout(() => {
        currentPhase = currentPhase >= TOTAL_PHASES - 1 ? 0 : currentPhase + 1;
        setAnimPhase(currentPhase);
        scheduleNext();
      }, timings[currentPhase]);
      timers.push(t);
    };
    scheduleNext();

    return () => timers.forEach(clearTimeout);
  }, [isOpen, step]);

  if (!isOpen || !listing) return null;

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep(s => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch { /* cancelled */ }
      return;
    }
    await handleCopyLink();
  };

  const handleTextMessage = () => {
    window.open(`sms:?&body=${encodeURIComponent(shareText + '\n' + shareUrl)}`, '_self');
  };

  // -- Palette (Apple HIG-inspired) --
  const bg = darkMode ? '#1c1c1e' : '#ffffff';
  const cardShadow = darkMode
    ? '0 24px 80px rgba(0,0,0,0.7)'
    : '0 24px 80px rgba(0,0,0,0.15)';
  const badgerRed = darkMode ? '#ef4444' : '#c5050c';
  const mutedText = darkMode ? '#98989f' : '#86868b';
  const surfaceBg = darkMode ? '#2c2c2e' : '#f5f5f7';
  const borderColor = darkMode ? '#3a3a3c' : '#e5e5ea';
  const primaryText = darkMode ? '#f5f5f7' : '#1d1d1f';
  const iconColor = darkMode ? '#98989f' : '#86868b';
  const accentBg = darkMode ? '#2a1215' : '#fef2f2';
  const accentBorder = darkMode ? '#7f1d1d' : '#fecaca';
  const arrowColor = darkMode ? '#98989f' : '#86868b';

  const shareButtonStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.875rem',
    backgroundColor: surfaceBg,
    border: `1px solid ${borderColor}`,
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '80px',
    height: '80px',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  };

  const labelStyle = {
    fontSize: '0.7rem',
    fontWeight: '500',
    color: mutedText,
    letterSpacing: '0.01em',
  };
  const infoIconWrapperStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    backgroundColor: surfaceBg,
    border: `1px solid ${borderColor}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 0,
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };
  const infoIconStyle = {
    display: 'block',
    flexShrink: 0,
    shapeRendering: 'geometricPrecision',
    vectorEffect: 'non-scaling-stroke',
  };
  const heroIconStyle = {
    display: 'block',
    lineHeight: 0,
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    shapeRendering: 'geometricPrecision',
    vectorEffect: 'non-scaling-stroke',
  };
  const getShareIconStyle = (action) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transform: canHoverBounce && hoveredShareAction === action
      ? 'translateY(-2px) scale(1.1)'
      : 'translateY(0) scale(1)',
    transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.2, 1.15)',
  });
  const handleShareHover = (action) => {
    if (!canHoverBounce) return;
    setHoveredShareAction(action);
  };

  const secondaryText = darkMode ? '#d1d1d6' : '#424245';
  const isManageStep = step === 3;

  const modalSizeStyle = isManageStep
    ? {
      maxWidth: '440px',
      padding: '2rem 2rem 1.5rem',
      contentMinHeight: '400px',
      slideMinHeight: '400px',
    }
    : {
      maxWidth: '390px',
      padding: '1.5rem 1.5rem 1.2rem',
      contentMinHeight: '340px',
      slideMinHeight: '340px',
    };

  const renderStep = () => {
    const slideStyle = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: modalSizeStyle.slideMinHeight,
      justifyContent: 'center',
    };

    switch (step) {
      // STEP 0: Congrats
      case 0:
        return (
          <div style={slideStyle}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: accentBg,
              border: `2px solid ${accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              overflow: 'hidden',
              lineHeight: 0,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}>
              <svg style={heroIconStyle} width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
              </svg>
            </div>
            <h2 style={{
              margin: '0 0 0.5rem',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: primaryText,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}>
              Your listing is live!
            </h2>
            <p style={{
              margin: '0 0 1.5rem',
              fontSize: '0.95rem',
              color: mutedText,
              lineHeight: 1.6,
              maxWidth: '300px',
            }}>
              Let's walk you through what happens next.
            </p>

            {/* Listing preview card */}
            <div style={{
              width: '100%',
              maxWidth: '320px',
              backgroundColor: surfaceBg,
              borderRadius: '14px',
              padding: '1rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              textAlign: 'left',
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                backgroundColor: accentBg,
                border: `1px solid ${accentBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                {primaryImageUrl ? (
                  <img
                    src={primaryImageUrl}
                    alt={listing.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{
                  margin: 0,
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: primaryText,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {listing.title}
                </p>
                <p style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.8rem',
                  color: mutedText,
                }}>
                  {listingPriceText} · {listingDateText}
                </p>
              </div>
            </div>
          </div>
        );

      // STEP 1: Discoverability
      case 1:
        return (
          <div style={slideStyle}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: surfaceBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h2 style={{
              margin: '0 0 0.35rem',
              fontSize: '1.35rem',
              fontWeight: '700',
              color: primaryText,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}>
              People can find you
            </h2>
            <p style={{
              margin: '0 0 1.25rem',
              fontSize: '0.85rem',
              color: mutedText,
              lineHeight: 1.5,
            }}>
              Your listing is discoverable in two ways
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              textAlign: 'left',
              width: '100%',
              maxWidth: '320px',
            }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={infoIconWrapperStyle}>
                  <svg style={infoIconStyle} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.15rem', fontSize: '0.875rem', fontWeight: '600', color: primaryText }}>Browse page</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: mutedText, lineHeight: 1.45 }}>Shows up in search results and on the map</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={infoIconWrapperStyle}>
                  <svg style={infoIconStyle} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.15rem', fontSize: '0.875rem', fontWeight: '600', color: primaryText }}>Direct messages</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: mutedText, lineHeight: 1.45 }}>Anyone can message you right from the listing</p>
                </div>
              </div>
            </div>
          </div>
        );

      // STEP 2: Share
      case 2:
        return (
          <div style={slideStyle}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: surfaceBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              lineHeight: 0,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}>
              <svg style={heroIconStyle} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <h2 style={{
              margin: '0 0 0.35rem',
              fontSize: '1.35rem',
              fontWeight: '700',
              color: primaryText,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}>
              Spread the word
            </h2>
            <p style={{
              margin: '0 0 1.25rem',
              fontSize: '0.85rem',
              color: mutedText,
              lineHeight: 1.5,
            }}>
              The more you share, the faster it fills
            </p>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}>
              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                onMouseEnter={() => handleShareHover('copy')}
                onMouseLeave={() => setHoveredShareAction(null)}
                style={{
                  ...shareButtonStyle,
                  backgroundColor: copied ? accentBg : surfaceBg,
                  borderColor: copied ? accentBorder : borderColor,
                }}
              >
                <div style={getShareIconStyle('copy')}>
                  {copied ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  )}
                </div>
                <span style={{ ...labelStyle, color: copied ? badgerRed : labelStyle.color }}>
                  {copied ? 'Copied!' : 'Copy Link'}
                </span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                onMouseEnter={() => handleShareHover('share')}
                onMouseLeave={() => setHoveredShareAction(null)}
                style={shareButtonStyle}
              >
                <div style={getShareIconStyle('share')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </div>
                <span style={labelStyle}>Share</span>
              </button>

              {/* Message */}
              <button
                onClick={handleTextMessage}
                onMouseEnter={() => handleShareHover('message')}
                onMouseLeave={() => setHoveredShareAction(null)}
                style={shareButtonStyle}
              >
                <div style={getShareIconStyle('message')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span style={labelStyle}>Message</span>
              </button>
            </div>
          </div>
        );

      // STEP 3: Manage — animated status demo (Available → Pending → Completed)
      case 3: {
        const availableColor = '#57BC6C';
        const pendingColor = '#EAA65D';
        const completedColor = '#777777';

        // Determine current badge state based on phase
        const currentStatus = (() => {
          if (animPhase >= 11) return 'completed';
          if (animPhase >= 5) return 'pending';
          return 'available';
        })();

        const statusConfig = {
          available: { label: 'Available', color: availableColor, bg: darkMode ? 'rgba(52,199,89,0.10)' : '#ecfdf5' },
          pending: { label: 'Pending', color: pendingColor, bg: darkMode ? 'rgba(234,166,93,0.10)' : '#fff7ed' },
          completed: { label: 'Completed', color: completedColor, bg: darkMode ? 'rgba(255,255,255,0.05)' : '#f4f4f5' },
        };
        const badge = statusConfig[currentStatus];

        // Dropdown visibility: phases 3-4 (first open) and 9-10 (second open)
        const showDropdown = animPhase === 3 || animPhase === 4 || animPhase === 9 || animPhase === 10;
        // Which row is highlighted in dropdown
        const hoverPending = animPhase === 4;
        const hoverCompleted = animPhase === 10;
        // Badge press effect
        const badgePressed = animPhase === 2 || animPhase === 8;
        // Cursor visible during interaction phases
        const showCursor = (animPhase >= 1 && animPhase <= 4) || (animPhase >= 7 && animPhase <= 10);
        // Which status is "checked" in the dropdown
        const checkedInDropdown = (animPhase >= 9) ? 'pending' : 'available';

        // Cursor tip = top-left of 16×20 SVG. For right-positioned element,
        // tip lands at (top, right+16px from wrapper right).
        // Badge center: ~28px down, ~49px from right → tip at top:27, right:33
        // Pending row center: ~90px down, ~70px from right → tip at top:89, right:54
        // Completed row center: ~128px down, ~70px from right → tip at top:127, right:54
        const cursorStyle = (() => {
          if ([1, 2, 3, 7, 8, 9].includes(animPhase)) return { top: '27px', right: '33px' };
          if (animPhase === 4) return { top: '89px', right: '54px' };
          if (animPhase === 10) return { top: '127px', right: '54px' };
          return { top: '27px', right: '33px' };
        })();

        return (
          <div style={slideStyle}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: surfaceBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              lineHeight: 0,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}>
              <svg style={heroIconStyle} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <h2 style={{
              margin: '0 0 0.35rem',
              fontSize: '1.35rem',
              fontWeight: '700',
              color: primaryText,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}>
              Manage your listing
            </h2>
            <p style={{
              margin: '0 0 1.25rem',
              fontSize: '0.85rem',
              color: mutedText,
              lineHeight: 1.5,
            }}>
              Everything lives on your profile page
            </p>

            {/* Animated mini mockup */}
            <div style={{
              width: '100%',
              maxWidth: '360px',
              position: 'relative',
            }}>
              <div style={{
                backgroundColor: darkMode ? '#1e1e1e' : '#fff',
                borderRadius: '10px',
                border: `1px solid ${darkMode ? '#2e2c2b' : '#e8e8e8'}`,
                padding: '0.85rem',
                boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                {/* Top row: image + listing info */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{
                    width: '72px',
                    height: '60px',
                    borderRadius: '7px',
                    backgroundColor: darkMode ? '#2a2826' : '#f5f5f5',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                    {primaryImageUrl ? (
                      <img
                        src={primaryImageUrl}
                        alt={listing.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#444' : '#ccc'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, opacity: currentStatus === 'completed' ? 0.5 : 1, transition: 'opacity 0.3s ease' }}>
                    <p style={{
                      margin: '0 0 0.15rem', fontSize: '0.85rem', fontWeight: '600',
                      color: primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {listing.title}
                    </p>
                    <p style={{ margin: '0 0 0.1rem', fontSize: '0.78rem', fontWeight: '600', color: primaryText }}>
                      {listingPriceText}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: mutedText }}>
                      {listingDateText}
                    </p>
                  </div>

                  {/* Animated status badge */}
                  <div style={{ flexShrink: 0, position: 'relative', alignSelf: 'flex-start', marginTop: '4px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: badge.bg,
                      color: badge.color,
                      fontSize: 11,
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      lineHeight: 1,
                      userSelect: 'none',
                      transform: badgePressed ? 'scale(0.93)' : 'scale(1)',
                      transition: 'transform 0.15s ease, background-color 0.15s ease, color 0.15s ease',
                    }}>
                      {badge.label}
                      {currentStatus !== 'completed' && (
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" style={{ marginLeft: 1, opacity: 0.35 }}>
                          <path d="M1.5 2.75L4 5.25L6.5 2.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>

                    {/* Animated dropdown */}
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      zIndex: 100,
                      background: darkMode ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 12,
                      minWidth: 160,
                      boxShadow: darkMode
                        ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.05)'
                        : '0 4px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
                      padding: '3px',
                      opacity: showDropdown ? 1 : 0,
                      transform: showDropdown ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.97)',
                      transition: 'opacity 0.2s ease, transform 0.2s ease',
                      pointerEvents: 'none',
                    }}>
                      {/* Available option */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        fontFamily: 'Outfit, sans-serif', fontSize: 13,
                        fontWeight: checkedInDropdown === 'available' ? 600 : 400,
                        color: checkedInDropdown === 'available' ? (darkMode ? '#f5f5f7' : '#1a1a1a') : (darkMode ? '#98989d' : '#666'),
                        letterSpacing: '0.01em',
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: availableColor, flexShrink: 0, opacity: checkedInDropdown === 'available' ? 1 : 0.5 }} />
                        Available
                        {checkedInDropdown === 'available' && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#f5f5f7' : '#1a1a1a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      {/* Pending option */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        fontFamily: 'Outfit, sans-serif', fontSize: 13,
                        fontWeight: checkedInDropdown === 'pending' ? 600 : 400,
                        color: (hoverPending || checkedInDropdown === 'pending') ? (darkMode ? '#f5f5f7' : '#1a1a1a') : (darkMode ? '#98989d' : '#666'),
                        background: hoverPending ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                        transition: 'background 0.15s ease, color 0.15s ease',
                        letterSpacing: '0.01em',
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: pendingColor, flexShrink: 0, opacity: (hoverPending || checkedInDropdown === 'pending') ? 1 : 0.5 }} />
                        Pending
                        {checkedInDropdown === 'pending' && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#f5f5f7' : '#1a1a1a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      {/* Divider */}
                      <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '3px 6px' }} />
                      {/* Mark as Completed */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        fontFamily: 'Outfit, sans-serif', fontSize: 13,
                        fontWeight: 400,
                        color: hoverCompleted ? '#D57463' : (darkMode ? '#636366' : '#999'),
                        background: hoverCompleted ? (darkMode ? 'rgba(255,69,58,0.08)' : 'rgba(255,69,58,0.06)') : 'transparent',
                        transition: 'background 0.15s ease, color 0.15s ease',
                        letterSpacing: '0.01em',
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: completedColor, flexShrink: 0, opacity: hoverCompleted ? 1 : 0.5 }} />
                        Mark as Completed
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom row: Edit + Delete buttons */}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <span style={{
                    flex: 1, textAlign: 'center', padding: '0.4rem 0.75rem',
                    borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500',
                    backgroundColor: badgerRed, color: '#ffffff', cursor: 'default',
                  }}>
                    Edit
                  </span>
                  <span style={{
                    flex: 1, textAlign: 'center', padding: '0.4rem 0.75rem',
                    borderRadius: '6px', fontSize: '0.75rem', fontWeight: '500',
                    backgroundColor: 'transparent', color: mutedText,
                    border: `1px solid ${borderColor}`, cursor: 'default',
                  }}>
                    Delete
                  </span>
                </div>
              </div>

              {/* Animated cursor — positioned relative to the card wrapper */}
              <div style={{
                position: 'absolute',
                top: cursorStyle.top,
                right: cursorStyle.right,
                opacity: showCursor ? 0.85 : 0,
                transition: 'top 0.4s cubic-bezier(0.25, 1, 0.5, 1), right 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease',
                pointerEvents: 'none',
                zIndex: 110,
                filter: darkMode ? 'invert(1)' : 'none',
              }}>
                <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                  <path d="M1 1L1 14.5L4.5 11L8.5 18.5L11 17L7 9.5L12 9.5L1 1Z" fill="#000" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Annotations below the card */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              textAlign: 'left',
              width: '100%',
              maxWidth: '360px',
              marginTop: '1rem',
            }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <p style={{ margin: 0, fontSize: '0.78rem', color: secondaryText, lineHeight: 1.45 }}>
                  <strong style={{ color: primaryText }}>Edit</strong> to update photos, price, or details
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p style={{ margin: 0, fontSize: '0.78rem', color: secondaryText, lineHeight: 1.45 }}>
                  <strong style={{ color: primaryText }}>Tap the status</strong> to update availability
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={badgerRed} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                <p style={{ margin: 0, fontSize: '0.78rem', color: secondaryText, lineHeight: 1.45 }}>
                  <strong style={{ color: primaryText }}>Delete</strong> to remove it entirely
                </p>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <>
    {/* Fullscreen confetti burst */}
    <ConfettiBurst active={showConfetti} />

    <div
      onClick={() => {
        if (canBackdropDismiss) handleDismiss();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: animateIn ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: '1rem',
        transition: 'background-color 0.3s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: bg,
          borderRadius: '20px',
          padding: modalSizeStyle.padding,
          maxWidth: modalSizeStyle.maxWidth,
          width: '100%',
          boxShadow: cardShadow,
          transform: animateIn ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
          opacity: animateIn ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(40px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-40px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>
        {/* Step content with slide animation */}
        <div style={{ overflow: 'hidden', minHeight: modalSizeStyle.contentMinHeight }}>
          <div ref={slideRef} style={{ opacity: 0 }}>
            <div key={step}>
              {renderStep()}
            </div>
          </div>
        </div>

        {/* Bottom bar: arrows + dots */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}>
          {/* Left side — fixed-width wrapper matching the right side */}
          <div style={{ width: '64px', flexShrink: 0 }}>
            <button
              onClick={goBack}
              disabled={step === 0}
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
                cursor: step === 0 ? 'default' : 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: step === 0 ? 0 : 1,
                color: arrowColor,
                transition: 'opacity 0.2s ease, color 0.15s ease',
                width: '36px',
              }}
              onMouseEnter={(e) => { if (step > 0) e.currentTarget.style.color = primaryText; }}
              onMouseLeave={(e) => { if (step > 0) e.currentTarget.style.color = arrowColor; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: i === step ? badgerRed : (darkMode ? '#48484a' : '#d1d1d6'),
                    transformOrigin: 'left center',
                    transform: i === step ? 'scaleX(1)' : 'scaleX(0.3)',
                    transition: 'transform 0.32s cubic-bezier(0.22, 0.8, 0.2, 1), background-color 0.18s linear',
                    willChange: 'transform',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Right side — stable container with crossfade to avoid end-of-transition wobble */}
          <div style={{ width: '64px', height: '32px', position: 'relative', flexShrink: 0 }}>
            <button
              onClick={goNext}
              aria-hidden={isLastStep}
              tabIndex={isLastStep ? -1 : 0}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                background: 'none',
                border: 'none',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
                cursor: isLastStep ? 'default' : 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: arrowColor,
                transition: 'opacity 0.3s ease, color 0.15s ease',
                width: '36px',
                opacity: isLastStep ? 0 : 1,
                pointerEvents: isLastStep ? 'none' : 'auto',
              }}
              onMouseEnter={(e) => { if (!isLastStep) e.currentTarget.style.color = primaryText; }}
              onMouseLeave={(e) => { if (!isLastStep) e.currentTarget.style.color = arrowColor; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              onClick={onClose}
              aria-hidden={!isLastStep}
              tabIndex={isLastStep ? 0 : -1}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                background: badgerRed,
                border: 'none',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
                borderRadius: '8px',
                cursor: isLastStep ? 'pointer' : 'default',
                padding: '0',
                fontSize: '0.8rem',
                fontWeight: '600',
                color: '#ffffff',
                transition: 'opacity 0.3s ease',
                letterSpacing: '0.01em',
                width: '64px',
                height: '32px',
                opacity: isLastStep ? 1 : 0,
                pointerEvents: isLastStep ? 'auto' : 'none',
              }}
              onMouseEnter={(e) => { if (isLastStep) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { if (isLastStep) e.currentTarget.style.opacity = '1'; }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
