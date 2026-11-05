import { useContext, useState, useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { useListingsQuery } from '../services/listingQueries';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import Seo from '../components/Seo';
// eslint-disable-next-line no-unused-vars -- `motion` is used via JSX member expressions (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { motion, AnimatePresence } from 'framer-motion';
import { INTERACTION_CSS } from '../styles/interactions';

const HomeIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);


// "2 bd · 1 ba" for housing; parking spots have no bed/bath count
// Phone homepage shows the three features that answer student questions; the rest live on About
const MOBILE_FEATURE_TITLES = ['UW-Madison only', 'Encrypted messaging', 'Free, forever'];

const formatSpecs = (listing) => {
  if (listing.listingType === 'PARKING') return null;
  const parts = [];
  if (listing.bedrooms) parts.push(`${listing.bedrooms} bd`);
  if (listing.bathrooms) parts.push(`${listing.bathrooms} ba`);
  return parts.length ? parts.join(' · ') : null;
};

// "Aug 1 – May 1" or "Starting Aug 1, 2026". Date-only strings are parsed as local dates
// so they don't shift back a day in US time zones.
const formatAvailability = (listing) => {
  const toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d));
  const fmt = (d, withYear) => toDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  if (listing.startDate && listing.endDate) return `${fmt(listing.startDate)} – ${fmt(listing.endDate, true)}`;
  if (listing.startDate) return `Starting ${fmt(listing.startDate, true)}`;
  return null;
};

// Photos fade in once loaded so they don't pop in; broken images are shown rather than hidden
function FadeImage({ src, alt, className, style }) {
  const [loaded, setLoaded] = useState(false);
  const show = () => setLoaded(true);
  return (
    <img src={src} alt={alt} className={className} onLoad={show} onError={show} style={{ ...style, opacity: loaded ? 1 : 0 }} />
  );
}

export default function Home() {
  const { darkMode } = useContext(ThemeContext);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isTabletLandscape, setIsTabletLandscape] = useState(
    window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight && window.innerHeight >= 600
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showListingMenu, setShowListingMenu] = useState(false);
  const [pendingListMenu, setPendingListMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
const { data: allListings = [] } = useListingsQuery({});
  const trendingListings = allListings.slice(0, 3);


  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setIsTabletLandscape(
        window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight && window.innerHeight >= 600
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768 || Math.min(windowWidth, window.innerHeight) < 600;
  const isTabletPortrait = !isMobile && !isTabletLandscape && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    if (currentUser && pendingListMenu) {
      setPendingListMenu(false);
      setShowAuthModal(false);
      setShowListingMenu(true);
    }
  }, [currentUser, pendingListMenu]);

  // ── Mobile home page (≤768px) ──────────────────────────────────────
  if (isMobile) {
    const bodyText = darkMode ? '#f0ebe5' : '#1d1d1f';
    const muted = darkMode ? '#8a8280' : '#6e6e73';
    const dim = darkMode ? '#8a8280' : '#6e6e73';
    const cardBg = darkMode ? '#1a1918' : '#ffffff';
    const cardBorder = darkMode ? '#2a2826' : 'rgba(40,30,15,0.08)';
    const cardShadow = darkMode
      ? '0 8px 24px -12px rgba(0,0,0,0.4)'
      : '0 1px 2px rgba(40,30,15,0.04), 0 8px 24px -12px rgba(40,30,15,0.10)';

    return (
      <div className="hm-root" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))', position: 'relative' }}>
        <style>{INTERACTION_CSS}</style>
        <Seo
          description="UW-Madison's student marketplace for subleases and parking spots near campus. Browse trending listings, find parking for game days, or post your own in minutes — all free."
          path="/"
        />


        {/* ── Hero block ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '5rem 24px 0',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          <h1 style={{
            fontSize: '56px',
            fontWeight: 800,
            lineHeight: 0.96,
            letterSpacing: '-2.6px',
            color: bodyText,
            margin: 0,
          }}>
            Subleases<br />&amp; parking,
          </h1>
          <div style={{
            fontSize: '38px',
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: '-1.4px',
            color: muted,
            marginTop: '6px',
            textWrap: 'balance',
          }}>
            all in one place.
          </div>
          <p style={{
            fontSize: '15px',
            lineHeight: 1.5,
            color: muted,
            maxWidth: '30ch',
            margin: '20px 0 0 0',
          }}>
            Skip the Facebook chaos. Find your next place near campus in minutes.
          </p>
          <Link
            to="/listings"
            className="hm-press"
            style={{
              display: 'block',
              width: '100%',
              backgroundColor: '#E11A1A',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '14px',
              padding: '16px 22px',
              textDecoration: 'none',
              textAlign: 'center',
              marginTop: '40px',
              boxShadow: '0 8px 20px -8px rgba(225,26,26,0.55)',
              boxSizing: 'border-box',
            }}
          >
            Browse Listings
          </Link>
          <button
            className="hm-press"
            onClick={() => {
              if (currentUser) setShowListingMenu(true);
              else { setPendingListMenu(true); setShowAuthModal(true); }
            }}
            style={{
              display: 'block',
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: bodyText,
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: '10px',
              padding: '12px 22px',
              textAlign: 'center',
            }}
          >
            Post a Listing <span style={{ color: dim }}>›</span>
          </button>
        </div>

        {/* ── Latest Listings ─────────────────────────────────────── */}
        {trendingListings.length > 0 && (
          <div style={{ padding: '0 18px', marginTop: '5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: bodyText, margin: 0 }}>Latest Listings</h2>
              <Link to="/listings" style={{ fontSize: '13px', fontWeight: 500, color: dim, textDecoration: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#E11A1A'; }}
                onMouseLeave={e => { e.currentTarget.style.color = dim; }}>
                View all <span className="hm-arrow">→</span>
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {trendingListings.map(listing => (
                <Link key={listing.id} to={`/listings/${listing.publicId || listing.id}`} className="hm-card"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderRadius: '16px', backgroundColor: cardBg, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, overflow: 'hidden' }}>
                  <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
                    {listing.images?.[0] ? (
                      <FadeImage className="hm-img" src={listing.images[0]} alt={listing.title || 'Listing'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5', color: darkMode ? '#444' : '#ccc' }}>
                        <HomeIcon />
                      </div>
                    )}
                    {listing.listingType && listing.listingType !== 'HOUSING' && (
                      <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 8px', borderRadius: 8, background: 'rgba(10,9,9,0.78)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0ebe5', fontSize: 11, fontWeight: 500 }}>
                        {listing.listingType === 'PARKING' ? 'Parking' : 'Housing + Parking'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '14px 16px 16px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: bodyText, margin: '0 0 0.5rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</h3>
                    <div style={{ marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: bodyText }}>${listing.price?.toLocaleString()}/mo</span>
                    </div>
                    {formatSpecs(listing) && (
                      <div style={{ fontSize: '0.9rem', color: muted, marginBottom: '0.35rem' }}>{formatSpecs(listing)}</div>
                    )}
                    {(listing.street || listing.address || formatAvailability(listing)) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', fontSize: '0.85rem', color: muted }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.street || listing.address}</span>
                        {formatAvailability(listing) && <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{formatAvailability(listing)}</span>}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── How MadLease Works ──────────────────────────────────── */}
        <div style={{ padding: '6rem 18px 0' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: bodyText, marginBottom: '0.5rem', letterSpacing: '-0.025em', textAlign: 'center' }}>How MadLease Works</h2>
          <p style={{ fontSize: '1rem', color: muted, textAlign: 'center', marginBottom: '1.75rem', lineHeight: 1.6 }}>Built by UW-Madison students, for UW-Madison students.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { title: 'Create a free account', body: 'Sign up with any email or Google in seconds. Use your @wisc.edu address to get an automatic verified badge.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              { title: 'Browse or post a listing', body: 'Search subleases and parking by price, dates, and amenities — or post your own in minutes.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
              { title: 'Message securely', body: "Connect through encrypted in-app messaging. Share contact info only when you're ready.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
            ].map((step) => (
              <div key={step.title} style={{ padding: '1.5rem', borderRadius: '16px', backgroundColor: darkMode ? '#161514' : '#fafafa', border: darkMode ? '1px solid #252220' : '1px solid #f0f0f0', textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: darkMode ? 'rgba(197,5,12,0.12)' : 'rgba(197,5,12,0.08)', color: darkMode ? '#ff5a5f' : 'var(--badger-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>{step.icon}</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: bodyText, marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>{step.title}</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: muted, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Why MadLease ────────────────────────────────────────── */}
        <div style={{ padding: '6rem 18px 0' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: bodyText, marginBottom: '0.5rem', letterSpacing: '-0.025em', textAlign: 'center' }}>Why MadLease?</h2>
          <p style={{ fontSize: '1rem', color: muted, textAlign: 'center', marginBottom: '2rem', lineHeight: 1.6 }}>A sublease and parking marketplace built specifically for UW-Madison — not a generic classifieds site.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {[
              { title: 'UW-Madison only', body: 'Every listing is near campus. No noise from out-of-state listings or unrelated cities.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
              { title: 'Encrypted messaging', body: 'AES-256 end-to-end encryption. Your conversations stay private unless you choose to share.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
              { title: 'Parking spots, too', body: 'List or find a standalone parking spot near campus — not just full subleases. Perfect for game days and tight lots.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg> },
              { title: 'Save your favorites', body: 'Bookmark listings you love and come back to compare them side-by-side before you commit.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> },
              { title: 'Browse by map', body: 'See every listing pinned on an interactive map of Madison. Filter by walking distance to your favorite buildings.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
              { title: 'Free, forever', body: 'No listing fees, no premium tiers, no ads. Built to make student housing easier.', icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg> },
            ].filter((feat) => MOBILE_FEATURE_TITLES.includes(feat.title)).map((feat) => (
              <div key={feat.title} style={{ display: 'flex', gap: '1.1rem', alignItems: 'flex-start' }}>
                <div style={{ width: '44px', height: '44px', flexShrink: 0, borderRadius: '12px', backgroundColor: darkMode ? 'rgba(197,5,12,0.10)' : 'rgba(197,5,12,0.07)', color: darkMode ? '#ff5a5f' : 'var(--badger-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{feat.icon}</div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: bodyText, margin: '0.25rem 0 0.4rem 0', letterSpacing: '-0.01em' }}>{feat.title}</h3>
                  <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: muted, margin: 0 }}>{feat.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <div style={{ padding: '6rem 18px 0' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: bodyText, marginBottom: '0.5rem', letterSpacing: '-0.025em', textAlign: 'center' }}>Frequently Asked Questions</h2>
          <p style={{ fontSize: '1rem', color: muted, textAlign: 'center', marginBottom: '1.75rem', lineHeight: 1.6 }}>Everything you need to know about using MadLease.</p>
          <div style={{ backgroundColor: darkMode ? '#161514' : '#fafafa', border: darkMode ? '1px solid #252220' : '1px solid #f0f0f0', borderRadius: '16px', padding: '0.5rem 1.25rem' }}>
            {[
              { q: 'Who can use MadLease?', a: 'Anyone can browse listings without an account. To post a listing or message someone, just sign up for free with any email or Google.' },
              { q: 'Is MadLease free to use?', a: 'Yes — completely free. There are no fees to post a listing, browse, or contact other students. No ads, no premium tiers either.' },
              { q: 'How do I post a sublease or parking spot?', a: "Create a free account, click \"List Your Place,\" then choose whether you're listing a sublease or a parking spot. Add photos, price, dates, and a description — your listing goes live immediately." },
              { q: 'How does messaging work?', a: 'Every message on MadLease is end-to-end encrypted with AES-256. Conversations stay inside the platform — you never have to share your personal phone number or email until you choose to.' },
              { q: 'Can I post just a parking spot?', a: 'Yes — MadLease supports standalone parking spot listings, not just full subleases. Great for game days or commuters looking for a reliable spot near campus.' },
              { q: 'Can I save listings I like?', a: 'Yes — tap the bookmark icon on any listing to save it to your profile. You can come back later to compare your saved listings side-by-side before reaching out.' },
              { q: 'What does the verified badge mean?', a: "Users who sign up with a @wisc.edu email automatically earn a verified badge, so others know they're a real UW-Madison student. It's optional — you can use MadLease fully with any email." },
            ].map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={item.q} style={{ borderTop: i === 0 ? 'none' : `1px dashed ${darkMode ? '#2a2826' : '#ececec'}` }}>
                  <button type="button" className="hm-press" onClick={() => setOpenFaq(isOpen ? null : i)}
                    style={{ width: '100%', padding: '1.1rem 0', background: 'none', border: 'none', outline: 'none', WebkitTapHighlightColor: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: '0.98rem', fontWeight: 600, color: bodyText, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', letterSpacing: '-0.005em', fontFamily: 'inherit' }}>
                    <span>{item.q}</span>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: darkMode ? '#8a8280' : '#86868b', transition: 'transform 0.25s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                      <path d="M4 6.5L9 11.5L14 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ margin: 0, paddingBottom: '1.1rem', fontSize: '0.9rem', lineHeight: 1.65, color: muted }}>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: '1.5rem', fontSize: '0.95rem', lineHeight: 1.6, color: muted, textAlign: 'center' }}>
            Can&apos;t find what you&apos;re looking for?{' '}
            <Link to="/contact" style={{ color: darkMode ? '#ff5a5f' : 'var(--badger-red)', textDecoration: 'none', fontWeight: 600 }}>Contact us</Link>.
          </p>
        </div>

        {/* ── "What are you listing?" modal ───────────────────────── */}
        <AnimatePresence>
          {showListingMenu && (
            <motion.div
              className="hm-root"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowListingMenu(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem', paddingBottom: '15vh' }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                onClick={e => e.stopPropagation()}
                style={{ backgroundColor: darkMode ? '#1a1918' : 'white', border: `1px solid ${darkMode ? '#2a2826' : '#e4e4e7'}`, borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '440px', position: 'relative', boxShadow: darkMode ? '0 24px 64px rgba(0,0,0,0.7)' : '0 8px 40px rgba(0,0,0,0.16)' }}
              >
                <button className="hm-press" onClick={() => setShowListingMenu(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: darkMode ? '#524e4c' : '#bbb', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: darkMode ? '#f0ebe5' : '#1d1d1f', margin: '0 0 0.4rem 0', letterSpacing: '-0.02em', textAlign: 'center' }}>What are you listing?</h3>
                <p style={{ fontSize: '0.9rem', color: darkMode ? '#7a7674' : '#6e6e73', margin: '0 0 1.5rem 0', textAlign: 'center' }}>Choose one to start your listing.</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {[{ value: 'HOUSING', label: 'Sublease' }, { value: 'BOTH', label: 'Sublease + Parking' }, { value: 'PARKING', label: 'Parking Spot' }].map(({ value, label }) => (
                    <button key={value} className="hm-press" onClick={() => { navigate(`/listings/new?type=${value}`); setShowListingMenu(false); }}
                      style={{ flex: 1, padding: '0.85rem 0.5rem', borderRadius: '10px', border: `1.5px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`, backgroundColor: darkMode ? '#211f1e' : '#fafafa', color: darkMode ? '#f0ebe5' : '#1d1d1f', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', textAlign: 'center' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} darkMode={darkMode} title="Sign in to continue" />
      </div>
    );
  }

  return (
    <div className="hm-root" style={isTabletLandscape ? { zoom: 0.78 } : undefined}>
      <style>{INTERACTION_CSS}</style>
    <Seo
      description="UW-Madison's student marketplace for subleases and parking spots near campus. Browse trending listings, find parking for game days, or post your own in minutes — all free."
      path="/"
      jsonLd={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Who can use MadLease?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Anyone can browse listings without an account. To post a listing or message someone, just sign up for free with any email or Google.'
            }
          },
          {
            '@type': 'Question',
            name: 'Is MadLease free to use?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes — MadLease is completely free. There are no fees to post a listing, browse, or contact other students. No ads, no premium tiers either.'
            }
          },
          {
            '@type': 'Question',
            name: 'How do I post a sublease or parking spot?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Create a free account, click "List Your Place," then choose whether you are listing a sublease or a parking spot. Add photos, price, dates, and a description. Your listing goes live immediately and is visible to other students browsing the marketplace.'
            }
          },
          {
            '@type': 'Question',
            name: 'How does messaging work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Every message on MadLease is end-to-end encrypted with AES-256. Conversations stay inside the platform — you never have to share your personal phone number or email until you choose to.'
            }
          },
          {
            '@type': 'Question',
            name: 'Can I post just a parking spot?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes — MadLease supports standalone parking spot listings, not just full subleases. Great for game days or commuters looking for a reliable spot near campus.'
            }
          },
          {
            '@type': 'Question',
            name: 'Can I save listings I like?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. Tap the bookmark icon on any listing to save it to your profile. You can come back later to compare your saved listings side-by-side before reaching out.'
            }
          },
          {
            '@type': 'Question',
            name: 'What does the verified badge mean?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Users who sign up with a @wisc.edu email automatically earn a verified badge, so others know they are a real UW-Madison student. It is optional — you can use MadLease fully with any email.'
            }
          }
        ]
      }}
    />
    {/* Animated background blobs */}
    <div className="blob blob-1" style={{
      position: 'fixed',
      top: '-20%',
      left: '15%',
      width: '650px',
      height: '650px',
      borderRadius: '50%',
      background: darkMode ? 'rgba(197,5,12,0.09)' : 'rgba(197,5,12,0.10)',
      filter: 'blur(100px)',
      pointerEvents: 'none',
      zIndex: 9999,
      willChange: 'transform',
    }} />
    <div className="blob blob-2" style={{
      position: 'fixed',
      top: '0%',
      left: '-20%',
      width: '500px',
      height: '500px',
      borderRadius: '50%',
      background: darkMode ? 'rgba(197,5,12,0.06)' : 'rgba(197,5,12,0.06)',
      filter: 'blur(85px)',
      pointerEvents: 'none',
      zIndex: 9999,
      willChange: 'transform',
    }} />
    <div className="blob blob-3" style={{
      position: 'fixed',
      top: '-10%',
      right: '-15%',
      width: '480px',
      height: '480px',
      borderRadius: '50%',
      background: darkMode ? 'rgba(197,5,12,0.06)' : 'rgba(197,5,12,0.06)',
      filter: 'blur(90px)',
      pointerEvents: 'none',
      zIndex: 9999,
      willChange: 'transform',
    }} />
    <div style={{
      padding: isMobile ? '2rem' : '1rem',
      paddingTop: 0,
      paddingBottom: isMobile ? '3rem' : '4rem',
      maxWidth: '1400px',
      margin: '0 auto',
      backgroundColor: 'transparent',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      zIndex: 1,
    }}>

      {/* Above-the-fold wrapper: hero + trending fill the viewport */}
      <div data-snap-section style={{
        minHeight: isMobile ? 'calc(100lvh - 120px)' : 'calc(100dvh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        paddingTop: isMobile ? '3.25rem' : isTabletLandscape ? '1.5rem' : isTabletPortrait ? '6rem' : '3.5rem',
        position: 'relative',
      }}>

      {/* Hero */}
      <div style={{
        textAlign: 'center',
        marginBottom: isMobile ? '1.5rem' : '0.75rem',
        marginTop: '0',
        animation: 'fadeIn 0.8s ease-out',
      }}>

        <h1 style={{
          fontSize: isMobile ? '2.5rem' : isTabletLandscape ? '3.25rem' : '4rem',
          fontWeight: '700',
          lineHeight: '1.02',
          letterSpacing: '-1.6px',
          maxWidth: '700px',
          margin: '0 auto 0.75rem auto',
        }}>
          <span style={{ color: darkMode ? '#ECECEE' : '#1d1d1f', display: 'block', whiteSpace: isTabletLandscape ? 'nowrap' : 'normal' }}>
            {isTabletPortrait ? <>Subleases<br />&amp; parking,</> : 'Subleases & parking,'}
          </span>
          <span style={{ color: darkMode ? 'rgba(236,236,238,0.62)' : '#6e6e73', display: 'block', fontWeight: 600, fontSize: isMobile ? '2rem' : isTabletLandscape ? '2.75rem' : '3.5rem' }}>
            all in one place.
          </span>
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: darkMode ? '#aaa' : '#6e6e73',
          maxWidth: '700px',
          margin: '0 auto 2rem auto',
          lineHeight: '1.6',
          whiteSpace: isMobile || isTabletPortrait ? 'normal' : 'nowrap',
        }}>
          {isTabletPortrait ? <>Skip the Facebook chaos.<br />Find your next place near campus in minutes.</> : 'Skip the Facebook chaos. Find your next place near campus in minutes.'}
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: isMobile ? '1rem' : '0.5rem' }}>
          <Link
            to="/listings"
            className="browse-btn hm-press"
            style={{
              backgroundColor: 'var(--badger-red)',
              color: 'white',
              padding: '0.85rem 2rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.05rem',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(197,5,12,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            Browse Listings
          </Link>
          <button
            onClick={() => {
              if (currentUser) {
                setShowListingMenu(true);
              } else {
                setPendingListMenu(true);
                setShowAuthModal(true);
              }
            }}
            className="list-btn hm-press"
            style={{
              backgroundColor: 'transparent',
              color: darkMode ? '#9a9290' : '#6e6e73',
              padding: '0.85rem 1.5rem',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '500',
              border: `1px solid ${darkMode ? '#2a2826' : '#ddd'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            Post a Listing
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

      </div>

      {/* Latest Listings */}
      {trendingListings.length > 0 && (
        <div style={{
          marginTop: isMobile ? '-0.25rem' : '-0.5rem',
          opacity: 0,
          animation: 'slideUp 0.8s ease-out forwards',
          animationDelay: '0.2s',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            maxWidth: isMobile ? '100%' : '1030px',
            margin: '0 auto 1rem auto',
          }}>
            <h2 style={{
              fontSize: '1.05rem',
              fontWeight: '700',
              color: darkMode ? '#f0f0f0' : '#1d1d1f',
              margin: 0,
            }}>
              Latest Listings
            </h2>
            <Link
              to="/listings"
              style={{
                fontSize: '0.85rem',
                fontWeight: '500',
                color: darkMode ? 'rgba(236,236,238,0.42)' : '#9c978d',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--badger-red)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = darkMode ? 'rgba(236,236,238,0.42)' : '#9c978d'; }}
            >
              View all <span className="hm-arrow">→</span>
            </Link>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: '1rem',
            maxWidth: isMobile ? '100%' : isTabletPortrait ? '860px' : '1030px',
            margin: '0 auto',
          }}>
            {trendingListings.slice(0, 3).map(listing => (
              <Link
                key={listing.id}
                to={`/listings/${listing.id}`}
                className="trending-card hm-card"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  border: darkMode ? '1px solid #333' : 'none',
                  borderRadius: '12px',
                  backgroundColor: darkMode ? '#1a1a1a' : 'white',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: darkMode
                    ? '0 2px 4px rgba(0,0,0,0.3)'
                    : '0 1px 2px rgba(40,30,15,0.04), 0 8px 24px -12px rgba(40,30,15,0.08)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Image */}
                <div style={{
                  position: 'relative',
                  height: isMobile ? '180px' : '160px',
                  overflow: 'hidden',
                }}>
                  {listing.images?.[0] ? (
                    <FadeImage
                      className="hm-img"
                      src={listing.images[0]}
                      alt={listing.title || 'Listing'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: darkMode ? 'brightness(0.9)' : 'none' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                      color: darkMode ? '#444' : '#ccc',
                    }}>
                      <HomeIcon />
                    </div>
                  )}
                  {listing.listingType && listing.listingType !== 'HOUSING' && (
                    <div style={{
                      position: 'absolute', bottom: 10, left: 10, zIndex: 2,
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px 4px 8px', borderRadius: 8,
                      background: 'rgba(10,9,9,0.78)', backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#f0ebe5', fontSize: 11, fontFamily: 'Outfit, sans-serif',
                      letterSpacing: '0.02em', fontWeight: 500,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0ebe5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="3"/>
                        <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
                      </svg>
                      {listing.listingType === 'PARKING' ? 'Parking' : 'Housing + Parking'}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div style={{ padding: '0.75rem 0.9rem' }}>
                  <h2 style={{
                    color: darkMode ? 'white' : '#1d1d1f',
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {listing.title}
                  </h2>
                  <div style={{ marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: darkMode ? 'white' : '#1d1d1f' }}>
                      ${listing.price?.toLocaleString()}/mo
                    </span>
                  </div>
                  {formatSpecs(listing) && (
                    <div style={{ fontSize: '0.9rem', color: darkMode ? '#a39b97' : '#6e6e73', marginBottom: '0.35rem' }}>{formatSpecs(listing)}</div>
                  )}
                  {(listing.address || listing.city || formatAvailability(listing)) && (
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.85rem', color: darkMode ? '#8a8280' : '#6e6e73' }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.street || listing.address}</span>
                      {formatAvailability(listing) && <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{formatAvailability(listing)}</span>}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      </div>{/* end above-the-fold wrapper */}

      {/* How It Works */}
      <motion.section
        data-snap-section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: '1030px',
          margin: '0 auto',
          width: '100%',
          minHeight: isMobile ? 'auto' : 'calc(100dvh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: isMobile ? '4rem' : '0',
          paddingBottom: isMobile ? '4rem' : '0',
          position: 'relative',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: isMobile ? '2.5rem' : '3rem' }}
        >
          <h2 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem',
            fontWeight: '700',
            color: darkMode ? '#f0ebe5' : '#1d1d1f',
            marginBottom: '0.75rem',
            letterSpacing: '-0.025em',
          }}>
            How MadLease Works
          </h2>
          <p style={{
            fontSize: '1.05rem',
            color: darkMode ? '#8a8280' : '#6e6e73',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            Built by UW-Madison students, for UW-Madison students.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? '1rem' : '1.25rem',
        }}>
          {[
            {
              n: '1',
              title: 'Create a free account',
              body: 'Sign up with any email or Google in seconds. Use your @wisc.edu address to get an automatic verified badge.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              ),
            },
            {
              n: '2',
              title: 'Browse or post a listing',
              body: 'Search subleases and parking by price, dates, and amenities — or post your own in minutes.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              ),
            },
            {
              n: '3',
              title: 'Message securely',
              body: 'Connect through encrypted in-app messaging. Share contact info only when you\'re ready.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ),
            },
          ].map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`how-it-works-tile${darkMode ? ' how-it-works-tile--dark' : ''}`}
              whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
              style={{
                padding: isMobile ? '1.5rem' : '1.75rem',
                borderRadius: '16px',
                backgroundColor: darkMode ? '#161514' : '#fafafa',
                border: darkMode ? '1px solid #252220' : '1px solid #f0f0f0',
                textAlign: 'center',
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: darkMode ? 'rgba(197,5,12,0.12)' : 'rgba(197,5,12,0.08)',
                color: darkMode ? '#ff5a5f' : 'var(--badger-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
              }}>
                {step.icon}
              </div>
              <h3 style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: darkMode ? '#f0ebe5' : '#1d1d1f',
                marginBottom: '0.5rem',
                letterSpacing: '-0.01em',
              }}>
                {step.title}
              </h3>
              <p style={{
                fontSize: '0.9rem',
                lineHeight: '1.6',
                color: darkMode ? '#7a7674' : '#6e6e73',
                margin: 0,
              }}>
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Why MadLease */}
      <motion.section
        data-snap-section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: '1030px',
          margin: '0 auto',
          width: '100%',
          minHeight: isMobile ? 'auto' : 'calc(100dvh - 80px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: isMobile ? '4rem' : '0',
          paddingBottom: isMobile ? '4rem' : '0',
          position: 'relative',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: isMobile ? '2.5rem' : '3rem' }}
        >
          <h2 style={{
            fontSize: isMobile ? '1.75rem' : '2.5rem',
            fontWeight: '700',
            color: darkMode ? '#f0ebe5' : '#1d1d1f',
            marginBottom: '0.75rem',
            letterSpacing: '-0.025em',
          }}>
            Why MadLease?
          </h2>
          <p style={{
            fontSize: '1.05rem',
            color: darkMode ? '#8a8280' : '#6e6e73',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            A sublease and parking marketplace built specifically for UW-Madison — not a generic classifieds site.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '2rem' : '3rem 4rem',
        }}>
          {[
            {
              title: 'UW-Madison only',
              body: 'Every listing is near campus. No noise from out-of-state listings or unrelated cities.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              ),
            },
            {
              title: 'Encrypted messaging',
              body: 'AES-256 end-to-end encryption. Your conversations stay private unless you choose to share.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              ),
            },
            {
              title: 'Parking spots, too',
              body: 'List or find a standalone parking spot near campus — not just full subleases. Perfect for game days and tight lots.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
                </svg>
              ),
            },
            {
              title: 'Save your favorites',
              body: 'Bookmark listings you love and come back to compare them side-by-side before you commit.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              ),
            },
            {
              title: 'Browse by map',
              body: 'See every listing pinned on an interactive map of Madison. Filter by walking distance to your favorite buildings.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
                  <line x1="8" y1="2" x2="8" y2="18"/>
                  <line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
              ),
            },
            {
              title: 'Free, forever',
              body: 'No listing fees, no premium tiers, no ads. Built to make student housing easier.',
              icon: (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 12 20 22 4 22 4 12"/>
                  <rect x="2" y="7" width="20" height="5"/>
                  <line x1="12" y1="22" x2="12" y2="7"/>
                  <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                  <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                </svg>
              ),
            },
          ].map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                display: 'flex',
                gap: '1.1rem',
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                flexShrink: 0,
                borderRadius: '12px',
                backgroundColor: darkMode ? 'rgba(197,5,12,0.10)' : 'rgba(197,5,12,0.07)',
                color: darkMode ? '#ff5a5f' : 'var(--badger-red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {feat.icon}
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.05rem',
                  fontWeight: '600',
                  color: darkMode ? '#f0ebe5' : '#1d1d1f',
                  margin: '0.25rem 0 0.4rem 0',
                  letterSpacing: '-0.01em',
                }}>
                  {feat.title}
                </h3>
                <p style={{
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  color: darkMode ? '#7a7674' : '#6e6e73',
                  margin: 0,
                }}>
                  {feat.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        data-snap-section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: '1030px',
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: isMobile ? '4rem' : '6rem',
          paddingBottom: isMobile ? '3rem' : '4rem',
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr',
          gap: isMobile ? '2rem' : '4rem',
          alignItems: 'start',
        }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            style={{
              textAlign: isMobile ? 'center' : 'left',
              paddingTop: isMobile ? 0 : '3rem',
            }}
          >
            <h2 style={{
              fontSize: isMobile ? '1.75rem' : '2.5rem',
              fontWeight: '700',
              color: darkMode ? '#f0ebe5' : '#1d1d1f',
              marginBottom: '1rem',
              letterSpacing: '-0.025em',
              lineHeight: '1.1',
            }}>
              Frequently {!isMobile && <br />}Asked {!isMobile && <br />}Questions
            </h2>
            <p style={{
              fontSize: '1.05rem',
              color: darkMode ? '#8a8280' : '#6e6e73',
              lineHeight: '1.6',
              margin: 0,
            }}>
              Everything you need to know about using MadLease.
            </p>
          </motion.div>

          <div style={{
            width: '100%',
            backgroundColor: darkMode ? '#161514' : '#fafafa',
            border: darkMode ? '1px solid #252220' : '1px solid #f0f0f0',
            borderRadius: '16px',
            padding: isMobile ? '0.5rem 1.25rem' : '0.75rem 1.75rem',
          }}>
            {[
              {
                q: 'Who can use MadLease?',
                a: 'Anyone can browse listings without an account. To post a listing or message someone, just sign up for free with any email or Google.',
              },
              {
                q: 'Is MadLease free to use?',
                a: 'Yes — completely free. There are no fees to post a listing, browse, or contact other students. No ads, no premium tiers either.',
              },
              {
                q: 'How do I post a sublease or parking spot?',
                a: 'Create a free account, click "List Your Place," then choose whether you\'re listing a sublease or a parking spot. Add photos, price, dates, and a description — your listing goes live immediately.',
              },
              {
                q: 'How does messaging work?',
                a: 'Every message on MadLease is end-to-end encrypted with AES-256. Conversations stay inside the platform — you never have to share your personal phone number or email until you choose to.',
              },
              {
                q: 'Can I post just a parking spot?',
                a: 'Yes — MadLease supports standalone parking spot listings, not just full subleases. Great for game days or commuters looking for a reliable spot near campus.',
              },
              {
                q: 'Can I save listings I like?',
                a: 'Yes — tap the bookmark icon on any listing to save it to your profile. You can come back later to compare your saved listings side-by-side before reaching out.',
              },
              {
                q: 'What does the verified badge mean?',
                a: 'Users who sign up with a @wisc.edu email automatically earn a verified badge, so others know they\'re a real UW-Madison student. It\'s optional — you can use MadLease fully with any email.',
              },
            ].map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.35, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                  style={{
                    borderTop: i === 0 ? 'none' : `1px dashed ${darkMode ? '#2a2826' : '#ececec'}`,
                  }}
                >
                  <button
                    type="button"
                    className="hm-press"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    style={{
                      width: '100%',
                      padding: '1.1rem 0',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.98rem',
                      fontWeight: '600',
                      color: darkMode ? '#f0ebe5' : '#1d1d1f',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                      letterSpacing: '-0.005em',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span>{item.q}</span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        color: darkMode ? '#8a8280' : '#86868b',
                        transition: 'transform 0.25s ease',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                      }}
                    >
                      <path d="M4 6.5L9 11.5L14 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <div style={{
                    display: 'grid',
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s ease',
                  }}>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{
                        margin: 0,
                        paddingBottom: '1.1rem',
                        fontSize: '0.9rem',
                        lineHeight: '1.65',
                        color: darkMode ? '#7a7674' : '#6e6e73',
                      }}>
                        {item.a}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        <p style={{
          marginTop: '2rem',
          marginBottom: 0,
          fontSize: '0.95rem',
          lineHeight: '1.6',
          color: darkMode ? '#8a8280' : '#6e6e73',
          textAlign: 'center',
        }}>
          Can&apos;t find what you&apos;re looking for? Contact our{' '}
          <Link
            to="/contact"
            style={{
              color: darkMode ? '#ff5a5f' : 'var(--badger-red)',
              textDecoration: 'none',
              fontWeight: '600',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            customer support team
          </Link>
          .
        </p>
      </motion.section>


      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        darkMode={darkMode}
        title="Sign in to continue"
      />

      <style>{`
        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25%      { transform: translate(12%, 18%) scale(1.12); }
          50%      { transform: translate(-8%, 28%) scale(0.94); }
          75%      { transform: translate(18%, 10%) scale(1.07); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(22%, -12%) scale(1.15); }
          66%      { transform: translate(35%, 16%) scale(0.90); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40%      { transform: translate(-20%, 20%) scale(1.18); }
          80%      { transform: translate(-30%, 8%) scale(0.88); }
        }

        .blob-1 { animation: blobFloat1 18s ease-in-out infinite; }
        .blob-2 { animation: blobFloat2 24s ease-in-out infinite 2s; }
        .blob-3 { animation: blobFloat3 20s ease-in-out infinite 5s; }

        @media (prefers-reduced-motion: reduce) {
          .blob-1, .blob-2, .blob-3 { animation: none; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .browse-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(197,5,12,0.4) !important;
        }

        .list-btn:hover {
          ${darkMode ? `
            border-color: var(--badger-red) !important;
            color: var(--badger-red) !important;
            background-color: rgba(197,5,12,0.06) !important;
          ` : `
            background-color: rgba(0,0,0,0.1) !important;
          `}
        }

.trending-card:hover {
          transform: translateY(-4px) !important;
          box-shadow: ${darkMode
            ? '0 8px 24px rgba(0,0,0,0.45)'
            : '0 2px 4px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.1), 0 16px 40px rgba(0,0,0,0.06)'} !important;
        }
      `}</style>
    </div>

    {/* ── "What are you listing?" modal — outside the zIndex:1 stacking context so it covers the navbar ── */}
    <AnimatePresence>
      {showListingMenu && (
        <motion.div
          className="hm-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setShowListingMenu(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            padding: '1rem',
            paddingBottom: '15vh',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: darkMode ? '#1a1918' : 'white',
              border: `1px solid ${darkMode ? '#2a2826' : '#e4e4e7'}`,
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '440px',
              position: 'relative',
              boxShadow: darkMode
                ? '0 24px 64px rgba(0,0,0,0.7)'
                : '0 8px 40px rgba(0,0,0,0.16)',
            }}
          >
            <button
              className="hm-press"
              onClick={() => setShowListingMenu(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: darkMode ? '#524e4c' : '#bbb',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'color 0.15s ease',
                outline: 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#f0ebe5' : '#333'}
              onMouseLeave={e => e.currentTarget.style.color = darkMode ? '#524e4c' : '#bbb'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <h3 style={{
              fontSize: '1.35rem',
              fontWeight: 700,
              color: darkMode ? '#f0ebe5' : '#1d1d1f',
              margin: '0 0 0.4rem 0',
              letterSpacing: '-0.02em',
              textAlign: 'center',
            }}>
              What are you listing?
            </h3>
            <p style={{
              fontSize: '0.9rem',
              color: darkMode ? '#7a7674' : '#6e6e73',
              margin: '0 0 1.5rem 0',
              textAlign: 'center',
            }}>
              Choose one to start your listing.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[
                { value: 'HOUSING', label: 'Sublease' },
                { value: 'BOTH', label: 'Sublease + Parking' },
                { value: 'PARKING', label: 'Parking Spot' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  className="hm-press"
                  onClick={() => { navigate(`/listings/new?type=${value}`); setShowListingMenu(false); }}
                  style={{
                    flex: 1,
                    padding: '0.85rem 0.5rem',
                    borderRadius: '10px',
                    border: `1.5px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                    backgroundColor: darkMode ? '#211f1e' : '#fafafa',
                    color: darkMode ? '#f0ebe5' : '#1d1d1f',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--badger-red)';
                    e.currentTarget.style.color = 'var(--badger-red)';
                    e.currentTarget.style.backgroundColor = darkMode ? 'rgba(197,5,12,0.1)' : 'rgba(197,5,12,0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#e4e4e7';
                    e.currentTarget.style.color = darkMode ? '#f0ebe5' : '#1d1d1f';
                    e.currentTarget.style.backgroundColor = darkMode ? '#211f1e' : '#fafafa';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
