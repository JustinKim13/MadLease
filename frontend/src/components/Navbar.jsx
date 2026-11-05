import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useContext, useEffect, useLayoutEffect, useState, useRef } from 'react';
import { ThemeContext } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import EditProfileModal from './EditProfileModal';
import { ThemeToggle } from './ThemeToggle';
// eslint-disable-next-line no-unused-vars -- `motion` is used via JSX member expressions (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, LayoutList, PlusCircle, User, LogOut, Home, Search } from 'lucide-react';
import { useConversationsQuery } from '../services/messageQueries';
import { useUserListingsQuery } from '../services/listingQueries';

// Define color constants
const colorLight = "#faf7f1"; // Warm cream
const colorDark = "#0f0e0e"; // Dark background color (warm near-black)

// Helper function to set element styles
const setElementStyle = (element, styles) => {
  Object.assign(element.style, styles);
};

// User icon component
const UserIcon = ({ user, darkMode }) => {
  const initials = user?.displayName
    ? (user.displayName.includes(' ') ? user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : user.displayName.substring(0, 2).toUpperCase())
    : user?.email?.substring(0, 2).toUpperCase() || 'U';
  
  return (
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      backgroundColor: 'var(--badger-red)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      border: `2px solid ${darkMode ? '#fff' : '#000'}`,
      transition: 'all 0.2s ease',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {user?.photoURL ? (
        <img 
          src={user.photoURL} 
          alt="Profile" 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%'
          }}
          onLoad={(e) => {
            // Make background transparent when image loads successfully
            e.target.parentElement.style.backgroundColor = 'transparent';
          }}
          onError={(e) => {
            // Hide the failed image and show initials
            e.target.style.display = 'none';
          }}
        />
      ) : null}
      {/* Always show initials as fallback */}
      <span style={{
        position: user?.photoURL ? 'absolute' : 'static',
        top: user?.photoURL ? '50%' : 'auto',
        left: user?.photoURL ? '50%' : 'auto',
        transform: user?.photoURL ? 'translate(-50%, -50%)' : 'none',
        zIndex: user?.photoURL ? '-1' : '1'
      }}>
        {initials}
      </span>
    </div>
  );
};

export default function Navbar() {
  const { darkMode, toggleDarkMode } = useContext(ThemeContext);
  const { currentUser, logout } = useAuth();
  const { data: conversations = [] } = useConversationsQuery({ enabled: !!currentUser });
  const { data: userListings = [] } = useUserListingsQuery(currentUser?.uid, { enabled: !!currentUser });
  const totalUnreadCount = conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  // Desktop Home / Listings / Profile: one pill that glides to the active link
  const desktopNavItems = [
    { label: 'Home', to: '/', end: true },
    { label: 'Listings', to: '/listings', end: false },
    { label: 'Profile', to: '/profile', end: false },
  ];
  const navContainerRef = useRef(null);
  const navLinkRefs = useRef([]);
  const [navPill, setNavPill] = useState({ left: 0, width: 0, measured: false, animate: false });
  useLayoutEffect(() => {
    const measure = (animate) => {
      const container = navContainerRef.current;
      const idx = desktopNavItems.findIndex(({ to, end }) =>
        end ? location.pathname === to : location.pathname.startsWith(to));
      const link = navLinkRefs.current[idx];
      if (!container || !link) return;
      const box = link.getBoundingClientRect();
      const origin = container.getBoundingClientRect().left;
      setNavPill((prev) => ({ left: box.left - origin, width: box.width, measured: true, animate: animate && prev.measured }));
    };
    measure(true);
    const onResize = () => measure(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const [, setIsTabletLandscape] = useState(
    window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight && window.innerHeight >= 600
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [postExpanded, setPostExpanded] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const myListsTargetTab = userListings.length > 0 ? 'myListings' : 'savedListings';

  // Open auth modal if redirected here from a protected route
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has('showAuth')) {
      setShowAuthModal(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  // Refs for click-outside detection
  const mobileDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  
  // Toggle user dropdown menu
  const toggleUserDropdown = () => {
    setUserDropdownOpen(!userDropdownOpen);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      setUserDropdownOpen(false);
      setDropdownOpen(false);
    } catch (error) {
      // Logout errors are non-critical - Firebase will clean up session eventually
      console.error('Logout error:', error);
    }
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
      setIsTabletLandscape(
        window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight && window.innerHeight >= 600
      );
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Apply theme changes when darkMode changes
  useEffect(() => {
    const setThemeColor = (color) => {
      document.querySelectorAll('meta[name="theme-color"]').forEach(el => el.remove());
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = color;
      document.head.appendChild(meta);
    };

    if (darkMode) {
      // Apply dark mode styles
      setElementStyle(document.body, {
        backgroundColor: colorDark,
        color: '#fff',
      });
      document.documentElement.style.backgroundColor = colorDark;
      setThemeColor(colorDark);
      
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
      
      // Update link styles
      let links = Array.from(document.getElementsByTagName("a"));
      links.forEach(item => {
        item.classList.add("dark-link");
        item.classList.remove("light-link");
      });
    } else {
      // Apply light mode styles - using light grey instead of white
      setElementStyle(document.body, {
        backgroundColor: colorLight,
        color: '#333',
      });
      document.documentElement.style.backgroundColor = colorLight;
      setThemeColor(colorLight);

      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
      
      // Update link styles
      let links = Array.from(document.getElementsByTagName("a"));
      links.forEach(item => {
        item.classList.add("light-link");
        item.classList.remove("dark-link");
      });
    }
  }, [darkMode]);

  // Handle click outside dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close mobile dropdown if clicking outside
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(event.target) && dropdownOpen) {
        setDropdownOpen(false);
        setPostExpanded(false);
      }
      
      // Close user dropdown if clicking outside
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target) && userDropdownOpen) {
        setUserDropdownOpen(false);
        setPostExpanded(false);
      }
    };

    // Add event listener when any dropdown is open
    if (dropdownOpen || userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen, userDropdownOpen]);

  // Hide the global navbar on mobile inside a single conversation — the chat
  // has its own header with back/avatar/name, and stacking both feels clunky.
  const hideOnMobileConversation = isMobile && /^\/messages\/[^/]+/.test(location.pathname);
  if (hideOnMobileConversation) return null;

  return (
    <>
      <style>{`
        @keyframes navPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.25); }
        }
      `}</style>
      {/* Paints the iOS status-bar safe area with the navbar color so there's no
          light strip above the nav. Fixed position so it doesn't affect layout. */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'env(safe-area-inset-top, 0px)',
          backgroundColor: darkMode ? colorDark : colorLight,
          zIndex: isMobile ? 2001 : 101,
          pointerEvents: 'none',
        }}
      />
      <nav style={{
        display: 'flex',
        justifyContent: isMobile ? 'center' : 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0 1rem' : '0 2rem',
        height: isMobile ? '50px' : '60px',
        minHeight: isMobile ? '50px' : '60px',
        flexShrink: 0,
        borderBottom: 'transparent',
        // Desktop: transparent in both themes, so the page's red glow shows through the nav
        // (the glow sits under the nav at every state). Mobile keeps a solid bar.
        backgroundColor: isMobile ? (darkMode ? colorDark : colorLight) : 'transparent',
        backdropFilter: darkMode && !isMobile ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: darkMode && !isMobile ? 'blur(12px)' : 'none',
        boxShadow: 'none',
        // Fixed on mobile so overscroll bounce can't pull it down over the listings header.
        // relative on desktop keeps the existing app-shell flow.
        position: isMobile ? 'fixed' : 'relative',
        top: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
        left: isMobile ? 0 : undefined,
        right: isMobile ? 0 : undefined,
        // Constant on desktop, so opening a menu doesn't change which layer the navbar is in
        zIndex: isMobile ? 2000 : 104
      }}>
        {/* Logo on the left */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          width: isMobile ? 'auto' : '33%' // Give it a third of the space
        }}>
          {/* Mobile inbox icon - shows for all mobile users */}
          {isMobile && (
            <div
              onClick={(e) => {
                e.preventDefault();
                if (currentUser) {
                  // If logged in, navigate to messages
                  navigate('/messages');
                } else {
                  // If not logged in, show auth modal
                  setShowAuthModal(true);
                }
              }}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: darkMode ? '#fff' : '#333',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 100
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = darkMode ? '#333' : '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {totalUnreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--badger-red)',
                    border: `2px solid ${darkMode ? colorDark : '#fff'}`,
                    display: 'block',
                  }} />
                )}
              </div>
            </div>
          )}
          
          <Link to="/" style={{ textDecoration: 'none' }} onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}>
            {isMobile ? (
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: darkMode ? '#fff' : '#111' }}>MadLease</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img
                  src="/madlease_logo_new.png"
                  alt="MadLease"
                  style={{ height: '34px', width: 'auto', display: 'block', borderRadius: '6px', border: darkMode ? '1.5px solid #000' : '1.5px solid rgba(0,0,0,0.10)' }}
                />
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: darkMode ? '#fff' : '#111' }}>MadLease</span>
              </div>
            )}
          </Link>
        </div>
        
        {/* Navigation links in the center */}
        {!isMobile && (
          <div ref={navContainerRef} style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            gap: '0.25rem',
            width: '33%'
          }}>
            <span aria-hidden="true" style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: navPill.left,
              width: navPill.width,
              borderRadius: '999px',
              backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              opacity: navPill.measured ? 1 : 0,
              transition: navPill.animate ? 'left 0.38s cubic-bezier(0.32, 0.72, 0, 1), width 0.38s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
            }} />
            {desktopNavItems.map(({ label, to, end }, i) => (
              <NavLink
                key={label}
                ref={(el) => { navLinkRefs.current[i] = el; }}
                to={to}
                end={end}
                style={{ textDecoration: 'none', position: 'relative' }}
              >
                <span style={{
                  display: 'inline-block',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '999px',
                  color: darkMode ? '#fff' : '#333',
                  fontWeight: '500',
                }}>
                  {label}
                </span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Right side with toggle and user area */}
        {!isMobile ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem',
            justifyContent: 'flex-end',
            width: '33%' 
          }}>
            {!currentUser && <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />}

            {currentUser ? (
              <div ref={userDropdownRef} style={{ position: 'relative' }}>
                                  <div
                    onClick={toggleUserDropdown}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      transition: 'background-color 0.2s ease',
                      backgroundColor: userDropdownOpen ? (darkMode ? '#333' : '#f0f0f0') : 'transparent'
                    }}
                  >
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                      <UserIcon user={currentUser} darkMode={darkMode} />
                      {totalUnreadCount > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--badger-red)',
                          animation: 'navPulse 1.8s ease-in-out infinite',
                          border: `2px solid ${darkMode ? colorDark : '#fff'}`,
                          display: 'block',
                        }} />
                      )}
                    </div>
                    <span style={{
                      color: darkMode ? '#fff' : '#333',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}>
                      {currentUser.displayName || currentUser.email?.split('@')[0]}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{
                        transform: userDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke={darkMode ? '#fff' : '#333'}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                
                                  {/* User Dropdown */}
                  <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        right: '0',
                        backgroundColor: darkMode ? colorDark : colorLight,
                        border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                        borderRadius: '14px',
                        padding: '8px',
                        zIndex: 2001,
                        width: '240px',
                        boxShadow: darkMode
                          ? '0 8px 32px rgba(0,0,0,0.45)'
                          : '0 8px 24px rgba(0,0,0,0.12)',
                      }}
                    >
                      {/* Top user info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px 12px' }}>
                        <UserIcon user={currentUser} darkMode={darkMode} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            color: darkMode ? '#f0ebe5' : '#18181b',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {currentUser.displayName || currentUser.email?.split('@')[0]}
                          </div>
                          <div style={{
                            color: darkMode ? '#8a8280' : '#71717a',
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {currentUser.email}
                          </div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '0 4px 8px' }} />

                      {/* Quick actions — 3 columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: postExpanded ? '4px' : '8px' }}>
                        {[
                          { icon: MessageSquare, label: 'Messages', path: '/profile', state: { activeTab: 'messages' } },
                          { icon: LayoutList, label: 'My Lists', path: '/profile', state: { activeTab: myListsTargetTab } },
                          { icon: PlusCircle, label: 'Post', path: null },
                        ].map(({ icon: Icon, label, path, state }) => (  // eslint-disable-line no-unused-vars -- Icon is used as a JSX tag below; this bare config doesn't detect that usage for destructured params
                          <button
                            key={label}
                            onClick={() => {
                              if (label === 'Post') {
                                setPostExpanded(!postExpanded);
                              } else {
                                navigate(path, state ? { state } : undefined); setUserDropdownOpen(false); setPostExpanded(false);
                              }
                            }}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              padding: '10px 6px',
                              backgroundColor: label === 'Post' && postExpanded ? (darkMode ? '#2a2826' : '#f5f5f5') : 'transparent',
                              border: 'none',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              color: label === 'Post' && postExpanded ? (darkMode ? '#f0ebe5' : '#18181b') : (darkMode ? '#8a8280' : '#71717a'),
                              transition: 'background-color 0.15s, color 0.15s',
                              outline: 'none',
                              boxShadow: 'none',
                              appearance: 'none',
                              WebkitAppearance: 'none',
                              WebkitTapHighlightColor: 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = darkMode ? '#2a2826' : '#f5f5f5';
                              e.currentTarget.style.color = darkMode ? '#f0ebe5' : '#18181b';
                            }}
                            onMouseLeave={(e) => {
                              if (label === 'Post' && postExpanded) return;
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = darkMode ? '#8a8280' : '#71717a';
                            }}
                          >
                            <Icon size={17} strokeWidth={1.75} />
                            <span style={{ fontSize: '0.7rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              {label}
                              {label === 'Messages' && totalUnreadCount > 0 && (
                                <span style={{
                                  backgroundColor: 'var(--badger-red)',
                                  color: 'white',
                                  borderRadius: '8px',
                                  padding: '0 4px',
                                  fontSize: '0.6rem',
                                  fontWeight: '700',
                                  lineHeight: '1.4',
                                }}>
                                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Post sub-menu */}
                      {postExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginBottom: '8px', paddingTop: '2px' }}>
                          <p style={{ fontSize: '0.725rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#333', fontFamily: 'Outfit, sans-serif', margin: '0 0 2px 0' }}>
                            What are you listing?
                          </p>
                          {[
                            { label: 'Housing', type: 'HOUSING' },
                            { label: 'Housing + Parking', type: 'BOTH' },
                            { label: 'Parking', type: 'PARKING' },
                          ].map(({ label, type }) => (
                            <button
                              key={type}
                              onClick={() => { navigate(`/listings/new?type=${type}`); setUserDropdownOpen(false); setPostExpanded(false); }}
                              style={{
                                width: '92%',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: `1.5px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                                backgroundColor: 'transparent',
                                color: darkMode ? '#f0ebe5' : '#333',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                fontFamily: 'Outfit, sans-serif',
                                transition: 'all 0.15s ease',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                outline: 'none',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--badger-red)';
                                e.currentTarget.style.backgroundColor = darkMode ? 'rgba(197,5,12,0.12)' : 'rgba(197,5,12,0.06)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#e4e4e7';
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Divider */}
                      <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '4px 4px 8px' }} />

                      {/* Theme toggle row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        marginBottom: '4px',
                      }}>
                        <span style={{ color: darkMode ? '#8a8280' : '#71717a', fontSize: '0.875rem', fontWeight: '500' }}>
                          {darkMode ? 'Dark' : 'Light'} Mode
                        </span>
                        <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />
                      </div>

                      <button
                        onClick={handleLogout}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '9px 10px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          color: 'var(--badger-red)',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = darkMode ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <LogOut size={15} strokeWidth={1.75} />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                  </AnimatePresence>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
                  style={{
                    backgroundColor: 'transparent',
                    color: darkMode ? '#d4cfc9' : '#374151',
                    border: `1px solid ${darkMode ? '#3a3633' : '#d1d5db'}`,
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? '#2a2826' : '#f5f5f5';
                    e.currentTarget.style.borderColor = darkMode ? '#4a4643' : '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#d1d5db';
                  }}
                >
                  Log In
                </button>
                <button
                  onClick={() => { setAuthModalMode('signup'); setShowAuthModal(true); }}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--badger-red)',
                    border: '1px solid var(--badger-red)',
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(204,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        ) : (
          // Mobile Navigation
          <div 
            ref={mobileDropdownRef}
            onClick={() => setDropdownOpen(!dropdownOpen)} 
            style={{ 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '16px',
              position: 'absolute',
              right: '1rem',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          >
            {/* Hamburger Icon */}
            <div style={{ width: '22px', height: '2px', backgroundColor: darkMode ? '#fff' : '#333', margin: '2px 0' }}></div>
            <div style={{ width: '22px', height: '2px', backgroundColor: darkMode ? '#fff' : '#333', margin: '2px 0' }}></div>
            <div style={{ width: '22px', height: '2px', backgroundColor: darkMode ? '#fff' : '#333', margin: '2px 0' }}></div>
            
            {/* Mobile Dropdown */}
            <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '36px',
                  right: '0',
                  backgroundColor: darkMode ? colorDark : colorLight,
                  border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                  borderRadius: '14px',
                  padding: '8px',
                  zIndex: 2001,
                  width: currentUser ? '240px' : '190px',
                  boxShadow: darkMode
                    ? '0 8px 32px rgba(0,0,0,0.5)'
                    : '0 8px 24px rgba(0,0,0,0.12)',
                }}
              >
                {currentUser ? (
                  <>
                    {/* User info row with edit pencil */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 10px 12px' }}>
                      <UserIcon user={currentUser} darkMode={darkMode} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          color: darkMode ? '#f0ebe5' : '#18181b',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {currentUser.displayName || currentUser.email?.split('@')[0]}
                        </div>
                        <div style={{
                          color: darkMode ? '#8a8280' : '#71717a',
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {currentUser.email}
                        </div>
                      </div>
                      <motion.button
                        type="button"
                        aria-label="Edit profile"
                        onClick={() => { setDropdownOpen(false); setEditProfileOpen(true); }}
                        initial="idle"
                        whileHover="hover"
                        whileTap={{ scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                        variants={{
                          idle: {
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            boxShadow: `0 0 0 1px ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'} inset, 0 0 0 0px rgba(0,0,0,0)`,
                          },
                          hover: {
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
                            boxShadow: `0 0 0 1px ${darkMode ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)'} inset, 0 0 0 4px ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                          },
                        }}
                        style={{
                          flexShrink: 0,
                          width: '28px', height: '28px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: 'none',
                          borderRadius: '999px',
                          cursor: 'pointer',
                          padding: 0,
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        <motion.svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13" height="13" viewBox="0 0 24 24"
                          fill="none" strokeWidth="2.1"
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{ display: 'block', flexShrink: 0, originX: 0.5, originY: 0.5 }}
                          variants={{
                            idle: { rotate: -8, stroke: darkMode ? '#ffffff' : '#333333' },
                            hover: { rotate: 4, stroke: darkMode ? '#ffffff' : '#333333' },
                          }}
                          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        >
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                          <path d="m15 5 4 4"></path>
                        </motion.svg>
                      </motion.button>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '0 4px 8px' }} />

                    {/* Quick actions */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: postExpanded ? '4px' : '8px' }}>
                      {[
                        { icon: MessageSquare, label: 'Messages', path: '/messages' },
                        { icon: LayoutList, label: 'My Lists', path: '/profile', state: { activeTab: myListsTargetTab } },
                        { icon: PlusCircle, label: 'Post', path: null },
                      ].map(({ icon: Icon, label, path, state }) => (  // eslint-disable-line no-unused-vars -- Icon is used as a JSX tag below; this bare config doesn't detect that usage for destructured params
                        <button
                          key={label}
                          onClick={() => {
                            if (label === 'Post') {
                              setPostExpanded(!postExpanded);
                            } else {
                              navigate(path, state ? { state } : undefined); setDropdownOpen(false); setPostExpanded(false);
                            }
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            padding: '10px 6px',
                            backgroundColor: label === 'Post' && postExpanded ? (darkMode ? '#2a2826' : '#f5f5f5') : 'transparent',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            color: label === 'Post' && postExpanded ? (darkMode ? '#f0ebe5' : '#18181b') : (darkMode ? '#8a8280' : '#71717a'),
                            transition: 'background-color 0.15s, color 0.15s',
                            outline: 'none',
                            boxShadow: 'none',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = darkMode ? '#2a2826' : '#f5f5f5';
                            e.currentTarget.style.color = darkMode ? '#f0ebe5' : '#18181b';
                          }}
                          onMouseLeave={(e) => {
                            if (label === 'Post' && postExpanded) return;
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = darkMode ? '#8a8280' : '#71717a';
                          }}
                        >
                          <Icon size={17} strokeWidth={1.75} />
                          <span style={{ fontSize: '0.7rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {label}
                            {label === 'Messages' && totalUnreadCount > 0 && (
                              <span style={{
                                backgroundColor: 'var(--badger-red)',
                                color: 'white',
                                borderRadius: '8px',
                                padding: '0 4px',
                                fontSize: '0.6rem',
                                fontWeight: '700',
                                lineHeight: '1.4',
                              }}>
                                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Post sub-menu */}
                    {postExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginBottom: '8px', paddingTop: '2px' }}>
                        <p style={{ fontSize: '0.725rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#333', fontFamily: 'Outfit, sans-serif', margin: '0 0 2px 0' }}>
                          What are you listing?
                        </p>
                        {[
                          { label: 'Housing', type: 'HOUSING' },
                          { label: 'Housing + Parking', type: 'BOTH' },
                          { label: 'Parking', type: 'PARKING' },
                        ].map(({ label, type }) => (
                          <button
                            key={type}
                            onClick={() => { navigate(`/listings/new?type=${type}`); setDropdownOpen(false); setPostExpanded(false); }}
                            style={{
                              width: '92%',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              border: `1.5px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                              backgroundColor: 'transparent',
                              color: darkMode ? '#f0ebe5' : '#333',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              fontFamily: 'Outfit, sans-serif',
                              transition: 'all 0.15s ease',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--badger-red)';
                              e.currentTarget.style.backgroundColor = darkMode ? 'rgba(197,5,12,0.12)' : 'rgba(197,5,12,0.06)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#e4e4e7';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Divider */}
                    <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '0 4px 8px' }} />

                    {/* Nav links */}
                    {[
                      { icon: Home, label: 'Home', path: '/', end: true },
                      { icon: Search, label: 'Listings', path: '/listings', end: false },
                      { icon: User, label: 'Profile', path: '/profile', end: false },
                    ].map(({ icon: Icon, label, path, end }) => (  // eslint-disable-line no-unused-vars -- Icon is used as a JSX tag below; this bare config doesn't detect that usage for destructured params
                      <NavLink
                        key={label}
                        to={path}
                        end={end}
                        onClick={() => setDropdownOpen(false)}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          fontSize: '0.875rem',
                          fontWeight: isActive ? '600' : '500',
                          color: isActive ? 'var(--badger-red)' : (darkMode ? '#d4cfc9' : '#374151'),
                          backgroundColor: 'transparent',
                          transition: 'background-color 0.15s',
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon size={15} strokeWidth={isActive ? 2.25 : 1.75} />
                            {label}
                          </>
                        )}
                      </NavLink>
                    ))}

                    {/* Divider */}
                    <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '8px 4px' }} />

                    {/* Theme toggle row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                    }}>
                      <span style={{ color: darkMode ? '#8a8280' : '#71717a', fontSize: '0.875rem', fontWeight: '500' }}>
                        {darkMode ? 'Dark' : 'Light'} Mode
                      </span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />
                      </div>
                    </div>

                    {/* Sign out */}
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '9px 10px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: 'var(--badger-red)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        textAlign: 'left',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = darkMode ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <LogOut size={15} strokeWidth={1.75} />
                      Sign Out
                    </button>
                  </>
                ) : (
                  /* Not logged in — nav links + auth buttons + theme */
                  <>
                    {[
                      { icon: Home, label: 'Home', path: '/', end: true },
                      { icon: Search, label: 'Listings', path: '/listings', end: false },
                    ].map(({ icon: Icon, label, path, end }) => (  // eslint-disable-line no-unused-vars -- Icon is used as a JSX tag below; this bare config doesn't detect that usage for destructured params
                      <NavLink
                        key={label}
                        to={path}
                        end={end}
                        onClick={() => setDropdownOpen(false)}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          fontSize: '0.875rem',
                          fontWeight: isActive ? '600' : '500',
                          color: isActive ? 'var(--badger-red)' : (darkMode ? '#d4cfc9' : '#374151'),
                          backgroundColor: 'transparent',
                        })}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon size={15} strokeWidth={isActive ? 2.25 : 1.75} />
                            {label}
                          </>
                        )}
                      </NavLink>
                    ))}

                    <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '4px 4px 8px' }} />

                    <div style={{ display: 'flex', gap: '6px', padding: '2px 4px', marginBottom: '4px' }}>
                      <button
                        onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); setDropdownOpen(false); }}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          backgroundColor: 'transparent',
                          color: darkMode ? '#d4cfc9' : '#374151',
                          border: `1px solid ${darkMode ? '#3a3633' : '#d1d5db'}`,
                          borderRadius: '7px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                        }}
                      >
                        Log In
                      </button>
                      <button
                        onClick={() => { setAuthModalMode('signup'); setShowAuthModal(true); setDropdownOpen(false); }}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          backgroundColor: 'transparent',
                          color: 'var(--badger-red)',
                          border: '1px solid var(--badger-red)',
                          borderRadius: '7px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                        }}
                      >
                        Sign Up
                      </button>
                    </div>

                    <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0f0f0', margin: '8px 4px' }} />

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px' }}>
                      <span style={{ color: darkMode ? '#8a8280' : '#71717a', fontSize: '0.875rem', fontWeight: '500' }}>
                        {darkMode ? 'Dark' : 'Light'} Mode
                      </span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )}
      </nav>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        darkMode={darkMode}
        initialMode={authModalMode}
      />
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
    </>
  );
}