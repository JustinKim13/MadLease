import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext'; // Restored the original import

export default function Footer() {
  const { darkMode } = useContext(ThemeContext);
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const [isTabletPortrait, setIsTabletPortrait] = useState(
    window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerHeight >= 600 && !(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600)
  );
  const [showMobileFooter, setShowMobileFooter] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600;
      setIsMobile(mobile);
      setIsTabletPortrait(
        window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerHeight >= 600 && !mobile
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const setThemeColor = (color) => {
    document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  };

  const openModal = () => {
    const sheetColor = darkMode ? '#0f0e0e' : '#ffffff';
    // html bg fills the physical screen edges on iOS (viewport-fit=cover).
    // Set it to the sheet color before the animation starts so there's no
    // color mismatch behind the browser toolbar during the slide-up.
    document.documentElement.style.backgroundColor = sheetColor;
    document.body.style.backgroundColor = sheetColor;
    setThemeColor(sheetColor);
    setShowMobileFooter(true);
  };

  const closeModal = () => {
    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = darkMode ? '#0f0e0e' : '#faf7f1';
    setThemeColor(darkMode ? '#0f0e0e' : '#ffffff');
    setShowMobileFooter(false);
  };

  // Check if we're on the home page
  const isHomePage = location.pathname === '/';

  // Hide footer entirely on conversation view — chat fills the viewport
  const isConversationView = /^\/messages\/[^/]+/.test(location.pathname);
  if (isConversationView) return null;

  // Style definitions
  const footerStyle = {
    backgroundColor: darkMode ? '#0f0e0e' : '#f2ede3',
    borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(40,30,15,0.07)'}`,
    padding: '0.3rem 0',
    marginTop: 'auto',
    textAlign: 'center'
  };

  const containerStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 1rem'
  };

  const linkStyle = {
    color: darkMode ? '#999' : '#555',
    textDecoration: 'none',
    margin: '0 0.5rem',
    fontSize: '0.75rem',
    transition: 'color 0.2s'
  };

  const copyrightStyle = {
    color: darkMode ? '#8a8280' : '#555',
    fontSize: '0.75rem',
    marginTop: '0.25rem'
  };

  const floatingButtonStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: darkMode ? '#2a2a2a' : '#ffffff',
    border: `1px solid ${darkMode ? '#404040' : '#e0e0e0'}`,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: '600',
    color: darkMode ? '#999' : '#666',
    zIndex: 2002,
    transition: 'all 0.2s ease',
    marginBottom: 'env(safe-area-inset-bottom, 0px)',
    marginRight: 'env(safe-area-inset-right, 0px)'
  };

const modalContentStyle = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: darkMode ? '#0f0e0e' : '#ffffff',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '1.5rem',
    paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
    maxHeight: '50vh',
    overflowY: 'auto',
    boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    animation: 'footerSheetSlide 0.3s ease',
  };

  const FooterContent = ({ inModal = false }) => (
    <div style={inModal ? {} : containerStyle}>
      {inModal && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem',
          borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
          paddingBottom: '0.75rem'
        }}>
          <h3 style={{ 
            margin: 0, 
            color: darkMode ? '#fff' : '#333',
            fontSize: '1rem'
          }}>
            Legal & Info
          </h3>
          <button
            onClick={closeModal}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: darkMode ? '#999' : '#666',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ marginBottom: inModal ? '1rem' : '0.25rem' }}>
        {[
          { to: '/privacy', label: 'Privacy Policy' },
          { to: '/terms', label: 'Terms of Service' },
          { to: '/about', label: 'About' },
          { to: '/contact', label: 'Contact Us' },
        ].map(({ to, label }) => {
          // The page you're on stays highlighted, matching the navbar's active state
          const isCurrent = location.pathname === to;
          const idleColor = darkMode ? '#999' : '#555';
          const color = isCurrent ? 'var(--badger-red)' : idleColor;
          return (
            <Link
              key={to}
              to={to}
              aria-current={isCurrent ? 'page' : undefined}
              style={{
                ...linkStyle,
                color,
                fontWeight: isCurrent ? 600 : 400,
                fontSize: inModal ? '1rem' : '0.75rem',
                display: inModal ? 'block' : 'inline',
                margin: inModal ? (to === '/contact' ? '0' : '0 0 0.75rem 0') : '0 0.5rem',
                padding: inModal ? '0.5rem 0' : '0'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--badger-red)'}
              onMouseLeave={(e) => e.currentTarget.style.color = color}
              onClick={inModal ? closeModal : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div style={{
        ...copyrightStyle,
        fontSize: inModal ? '0.875rem' : '0.68rem',
        color: darkMode ? '#8a8280' : '#555',
        textAlign: 'center'
      }}>
        © {new Date().getFullYear()} MadLease. All rights reserved.
      </div>
    </div>
  );

  if (isTabletPortrait && !isHomePage) {
    return null;
  }

  if (isMobile) {
    if (!isHomePage) {
      return null;
    }

    return (
      <>
        {!showMobileFooter && (
          <button
            style={floatingButtonStyle}
            onClick={openModal}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = darkMode ? '#3a3a3a' : '#f5f5f5';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = darkMode ? '#2a2a2a' : '#ffffff';
              e.target.style.transform = 'scale(1)';
            }}
            title="Legal & Info"
          >
            i
          </button>
        )}

        {showMobileFooter && (
          <>
            {/* Scrim fades in from transparent so there's no dark flash at the
                bottom before the sheet arrives */}
            <div
              style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 999,
                animation: 'scrimFadeIn 0.3s ease forwards',
              }}
              onClick={closeModal}
            />
            {/* Sheet slides up from the physical bottom of the screen */}
            <div style={modalContentStyle}>
              <FooterContent inModal={true} />
            </div>
          </>
        )}

        <style>{`
          @keyframes scrimFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes footerSheetSlide {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </>
    );
  }

  return (
    <footer style={footerStyle}>
      <FooterContent />
    </footer>
  );
}
