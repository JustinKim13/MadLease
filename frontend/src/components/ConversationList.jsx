import { useContext, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { useConversationsQuery, useDeleteConversationMutation, useCurrentUserQuery, useBlockUserMutation, useReportUserMutation, useBlockedUsersQuery, useUnblockUserMutation } from '../services/messageQueries';
import { useAuth } from '../context/AuthContext';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function ConversationList({ embedded = false }) {
  const { darkMode } = useContext(ThemeContext);
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const { data: conversations = [], isLoading } = useConversationsQuery({
    enabled: !!currentUser && !authLoading
  });

  const { data: currentUserData } = useCurrentUserQuery();
  const currentUserDbId = currentUserData?.userID;

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showBlockConfirm, setShowBlockConfirm] = useState(null);
  const [isBlocking, setIsBlocking] = useState(false);
  const [, setBlockError] = useState('');
  const [showReportModal, setShowReportModal] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const menuRef = useRef(null);

  const { data: blockedUsers = [] } = useBlockedUsersQuery();
  const deleteConversationMutation = useDeleteConversationMutation();
  const blockUserMutation = useBlockUserMutation();
  const reportUserMutation = useReportUserMutation();

  const anyOverlayOpen =
    !!deleteConfirm || !!showBlockConfirm || !!showReportModal || !!showBlockedUsers;
  useBodyScrollLock(anyOverlayOpen);

  const parseTimestamp = (dateString) => {
    const isProduction = window.location.hostname !== 'localhost';
    if (isProduction) {
      return new Date(dateString + 'Z');
    } else {
      return new Date(dateString);
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = parseTimestamp(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getOtherPersonName = (conversation) => {
    if (!currentUserDbId) return 'Loading...';
    return conversation.requesterID == currentUserDbId ? conversation.listerName : conversation.requesterName;
  };

  const getOtherPersonProfilePicture = (conversation) => {
    if (!currentUserDbId) return null;
    return conversation.requesterID == currentUserDbId ? conversation.listerProfilePictureUrl : conversation.requesterProfilePictureUrl;
  };

  const getOtherPersonId = (conversation) => {
    if (!currentUserDbId) return null;
    return conversation.requesterID == currentUserDbId ? conversation.listerID : conversation.requesterID;
  };

  const getMobileInitials = (name) => {
    if (!name || name === 'Unknown User' || name === 'Loading...') return 'UU';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const handleBlockUser = async (userId) => {
    if (isBlocking || !userId) return;
    setIsBlocking(true);
    try {
      await blockUserMutation.mutateAsync({ userId });
    } catch {
      setBlockError('Failed to block user. Please try again.');
      setTimeout(() => setBlockError(''), 3000);
    } finally {
      setIsBlocking(false);
      setShowBlockConfirm(null);
    }
  };

  const handleReportUser = async (userId) => {
    if (isReporting || !userId) return;
    if (!reportReason) {
      setReportError('Please select a reason.');
      return;
    }
    setIsReporting(true);
    setReportError('');
    try {
      await reportUserMutation.mutateAsync({ userId, reason: reportReason, details: reportDetails.trim() });
      setReportSuccess(true);
    } catch {
      setReportError('Failed to submit report. Please try again.');
    } finally {
      setIsReporting(false);
    }
  };

  const closeReportModal = () => {
    setShowReportModal(null);
    setReportReason('');
    setReportDetails('');
    setReportError('');
    setReportSuccess(false);
  };

  const handleDeleteConversation = async (conversationId) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteConversationMutation.mutateAsync({ conversationId });
      setDeleteConfirm(null);
    } catch {
      setDeleteError('Failed to delete conversation. Please try again.');
      setTimeout(() => setDeleteError(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !currentUserDbId) {
    return (
      <div style={{
        width: '100%',
        minHeight: embedded ? '300px' : 'calc(100vh - 120px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: `6px solid ${darkMode ? '#2a2826' : '#eee'}`,
          borderTop: `6px solid ${darkMode ? '#8a8280' : '#555'}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const containerStyle = embedded ? {} : {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '1rem'
  };

  const cardStyle = embedded ? {
    backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35), 0 1px 6px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.08), 0 1px 6px rgba(0,0,0,0.05)',
  } : {
    backgroundColor: darkMode ? '#171514' : 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: 'none'
  };

  // Color tokens for mobile embedded
  const m = {
    bgRaised:  darkMode ? '#2a2c32' : '#fff',
    bgHover:   darkMode ? '#33363d' : '#f5f5f7',
    border:    darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
    fg:        darkMode ? '#ECECEE' : '#1a1a1a',
    fgMuted:   darkMode ? 'rgba(236,236,238,0.66)' : '#555',
    fgDim:     darkMode ? 'rgba(236,236,238,0.45)' : '#888',
    fgFaint:   darkMode ? 'rgba(236,236,238,0.25)' : '#bbb',
    red:       '#E5322C',
  };

  return (
    <>
      {/* ── Mobile card layout (embedded in Profile or standalone /messages page) ── */}
      {isMobile ? (
        <div style={{
          minHeight: embedded ? undefined : '100lvh',
          background: embedded ? undefined : (darkMode ? '#0f0e0e' : '#faf7f1'),
          fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}>
          {/* Header — only on standalone /messages page */}
          {!embedded && (
            <div style={{
              padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px',
              display: 'flex', alignItems: 'center', gap: '12px',
              borderBottom: `1px solid ${m.border}`,
            }}>
              <button
                onClick={() => navigate(-1)}
                style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke={m.fgMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '600', color: m.fg, letterSpacing: '-0.2px' }}>
                Messages
              </h1>
            </div>
          )}

          <div style={{
            padding: `14px 18px ${embedded ? '96px' : 'max(24px, env(safe-area-inset-bottom))'}`,
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
          {deleteError && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(229,50,44,0.12)', color: m.red, fontSize: '13px' }}>
              {deleteError}
            </div>
          )}

          {conversations.length === 0 ? (
            <div style={{ marginTop: '80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none"
                stroke={darkMode ? 'rgba(236,236,238,0.25)' : '#ccc'}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ marginBottom: '16px' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '600', color: m.fg }}>
                No messages yet
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: m.fgMuted, lineHeight: 1.5 }}>
                Renters will reach out here when you post a listing.
              </p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const otherPersonName = getOtherPersonName(conversation);
              const otherPersonProfilePicture = getOtherPersonProfilePicture(conversation);
              const hasUnread = conversation.unreadCount > 0;
              const initials = getMobileInitials(otherPersonName);

              return (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Conversation with ${otherPersonName} about ${conversation.listingTitle}${hasUnread ? ', unread' : ''}`}
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/messages/${conversation.id}`); }}
                  onTouchStart={(e) => { e.currentTarget.style.background = m.bgHover; }}
                  onTouchEnd={(e) => { e.currentTarget.style.background = m.bgRaised; }}
                  style={{
                    background: m.bgRaised,
                    border: `1px solid ${m.border}`,
                    borderRadius: '12px', padding: '12px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      aria-label={hasUnread ? 'Unread' : undefined}
                      style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        background: hasUnread ? m.red : (darkMode ? '#33363d' : '#e8e8ea'),
                        border: hasUnread ? 'none' : `1px solid ${m.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                      }}
                    >
                      {otherPersonProfilePicture ? (
                        <img
                          src={otherPersonProfilePicture}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{
                          fontSize: '13px',
                          fontWeight: hasUnread ? '700' : '500',
                          color: hasUnread ? '#fff' : m.fgMuted,
                          letterSpacing: '0.2px',
                        }}>
                          {initials}
                        </span>
                      )}
                    </div>
                    {hasUnread && (
                      <div style={{
                        position: 'absolute', top: '-2px', right: '-2px',
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: m.red,
                        border: `2px solid ${m.bgRaised}`,
                      }} />
                    )}
                  </div>

                  {/* Meta column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Line 1: name */}
                    <div style={{
                      fontSize: '14px', fontWeight: '600', color: m.fg,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      lineHeight: 1.3,
                    }}>
                      {otherPersonName}
                    </div>

                    {/* Line 2: Re: subject + arrow */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '12px', fontStyle: 'italic', color: m.fgDim, flexShrink: 0 }}>Re:</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', overflow: 'hidden', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', color: m.fgMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conversation.listingTitle}
                        </span>
                        {conversation.listingPublicId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/listings/${conversation.listingPublicId}`); }}
                            aria-label={`Open ${conversation.listingTitle} listing`}
                            style={{
                              padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                              color: m.fgDim, display: 'flex', alignItems: 'center', flexShrink: 0,
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke={m.fgDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/>
                              <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </button>
                        )}
                      </span>
                    </div>

                    {/* Line 3: preview */}
                    <div style={{
                      fontSize: '11px', color: m.fgDim, marginTop: '4px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {conversation.lastMessageContent || 'No messages yet'}
                    </div>
                  </div>

                  {/* ⋮ overflow button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                      setOpenMenuId(openMenuId === conversation.id ? null : conversation.id);
                    }}
                    aria-label={`More actions for conversation with ${otherPersonName}`}
                    aria-haspopup="menu"
                    style={{
                      width: '30px', height: '30px', padding: 0, flexShrink: 0,
                      borderRadius: '50%',
                      border: `1px solid ${m.border}`,
                      background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: m.fgMuted, fontSize: '13px',
                    }}
                  >
                    ⋮
                  </button>
                </div>
              );
            })
          )}

          {/* Manage blocked users link */}
          {blockedUsers.length > 0 && (
            <div style={{ margin: '8px 0 0', paddingTop: '16px', borderTop: `1px solid ${m.border}` }}>
              <button
                onClick={() => navigate('/profile/blocked')}
                aria-label={`Manage blocked users, ${blockedUsers.length} blocked`}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: '13px', color: m.fgMuted,
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={m.fgMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                Manage blocked users
                <span style={{ color: m.fgDim }}>({blockedUsers.length})</span>
                <span style={{ color: m.fgFaint, fontSize: '11px' }}>›</span>
              </button>
            </div>
          )}
          </div>
        </div>

      ) : (
        /* ── Desktop / non-embedded layout (unchanged) ── */
        <div style={containerStyle}>
          <div style={cardStyle}>
            {!embedded && (
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
                backgroundColor: darkMode ? '#252a30' : '#f8f9fa',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                {isMobile && (
                  <button
                    onClick={() => navigate(-1)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--badger-red)',
                      fontSize: '1.3rem',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1
                    }}
                  >
                    ←
                  </button>
                )}
                <h1 style={{
                  margin: 0,
                  fontSize: isMobile ? '1.25rem' : '1.5rem',
                  color: darkMode ? 'white' : 'black',
                  fontWeight: '600'
                }}>
                  Messages
                </h1>
              </div>
            )}

            {deleteError && (
              <div style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'rgba(197, 5, 12, 0.1)',
                color: 'var(--badger-red)',
                fontSize: '0.9rem',
                borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`
              }}>{deleteError}</div>
            )}

            {conversations.length === 0 ? (
              <div style={{
                padding: '4rem 2rem',
                textAlign: 'center',
                minHeight: embedded ? '320px' : undefined,
              }}>
                <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center', color: darkMode ? '#444' : '#ccc' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <p style={{ marginBottom: '0.4rem', fontSize: '0.95rem', fontWeight: '600', color: darkMode ? 'white' : 'black' }}>
                  No conversations yet.
                </p>
                <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: darkMode ? '#6a6664' : '#999' }}>
                  Start messaging by clicking "Contact Lister" on any listing.
                </p>
                <a
                  href="/listings"
                  style={{
                    backgroundColor: 'var(--badger-red)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    fontFamily: 'Outfit, sans-serif',
                    lineHeight: 1.2,
                    boxSizing: 'border-box',
                  }}
                >
                  Browse Listings
                </a>
              </div>
            ) : (
              <div>
                {conversations.map((conversation, index) => {
                  const otherPersonName = getOtherPersonName(conversation);
                  const otherPersonProfilePicture = getOtherPersonProfilePicture(conversation);
                  const hasUnread = conversation.unreadCount > 0;

                  return (
                    <Link
                      key={conversation.id}
                      to={`/messages/${conversation.id}`}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        color: 'inherit'
                      }}
                    >
                      <div style={{
                        padding: '1rem 1.5rem',
                        borderBottom: index < conversations.length - 1
                          ? `1px solid ${darkMode ? '#333' : '#eee'}`
                          : 'none',
                        backgroundColor: darkMode ? '#171514' : 'white',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease',
                        boxShadow: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = darkMode ? '#181b1f' : '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = darkMode ? '#171514' : 'white';
                      }}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: '50px',
                          height: '50px',
                          flexShrink: 0,
                          position: 'relative',
                        }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--badger-red)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          fontWeight: '600',
                          overflow: 'hidden',
                        }}>
                          {otherPersonProfilePicture ? (
                            <img
                              src={otherPersonProfilePicture}
                              alt="Profile"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '50%'
                              }}
                              onLoad={(e) => {
                                e.target.parentElement.style.backgroundColor = 'transparent';
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.style.backgroundColor = 'var(--badger-red)';
                              }}
                            />
                          ) : null}
                          <span style={{
                            position: otherPersonProfilePicture ? 'absolute' : 'static',
                            top: otherPersonProfilePicture ? '50%' : 'auto',
                            left: otherPersonProfilePicture ? '50%' : 'auto',
                            transform: otherPersonProfilePicture ? 'translate(-50%, -50%)' : 'none',
                            zIndex: otherPersonProfilePicture ? '-1' : '1'
                          }}>
                            {otherPersonName.includes(' ') ? otherPersonName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : otherPersonName.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        {hasUnread && (
                          <div style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--badger-red)',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: '700',
                            display: 'grid',
                            placeItems: 'center',
                            border: `2px solid ${darkMode ? '#171514' : 'white'}`,
                            boxSizing: 'content-box',
                          }}>
                            {conversation.unreadCount > 99 ? '!' : conversation.unreadCount}
                          </div>
                        )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h3 style={{
                            margin: 0,
                            marginBottom: '0.25rem',
                            fontSize: isMobile ? '1.05rem' : '1rem',
                            lineHeight: '1.3',
                            fontWeight: hasUnread ? '600' : '500',
                            color: darkMode ? 'white' : 'black',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {otherPersonName}
                          </h3>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <p style={{
                              margin: 0,
                              fontSize: '0.825rem',
                              color: darkMode ? '#8a8280' : '#888',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              Re: {conversation.listingTitle}
                            </p>
                            {conversation.listingPublicId && (
                              <span
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  navigate(`/listings/${conversation.listingPublicId}`);
                                }}
                                title="View listing"
                                role="button"
                                tabIndex={0}
                                style={{
                                  color: darkMode ? '#999' : '#888',
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  opacity: 0.6,
                                  transition: 'opacity 0.2s ease, color 0.2s ease',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.color = 'var(--badger-red)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = '0.6';
                                  e.currentTarget.style.color = darkMode ? '#999' : '#888';
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </span>
                            )}
                          </div>

                          <p style={{
                            margin: '0.25rem 0 0 0',
                            fontSize: '0.775rem',
                            color: darkMode ? '#524e4c' : '#bbb',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {conversation.lastMessageContent || 'No messages yet'}
                          </p>
                        </div>

                        {/* Right side: timestamp + 3-dot menu */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.6rem',
                          flexShrink: 0,
                          alignSelf: 'center',
                          minWidth: '55px',
                        }}>
                          <span style={{
                            fontSize: '0.775rem',
                            color: darkMode ? '#8a8280' : '#888',
                            whiteSpace: 'nowrap',
                          }}>
                            {formatTime(conversation.lastMessageTime)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenMenuId(openMenuId === conversation.id ? null : conversation.id);
                            }}
                            style={{
                              backgroundColor: 'transparent',
                              border: `1.5px solid ${darkMode ? '#3a3633' : '#ddd'}`,
                              outline: 'none',
                              cursor: 'pointer',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                              transition: 'border-color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = darkMode ? '#524e4c' : '#bbb'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#ddd'}
                            title="More options"
                          >
                            <svg width="12" height="12" viewBox="0 0 20 20" fill={darkMode ? '#8a8280' : '#999'} style={{ minWidth: '12px', minHeight: '12px', flexShrink: 0 }}>
                              <circle cx="10" cy="4" r="2"/>
                              <circle cx="10" cy="10" r="2"/>
                              <circle cx="10" cy="16" r="2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Blocked Users toggle */}
            {blockedUsers.length > 0 && <button
              onClick={() => setShowBlockedUsers(!showBlockedUsers)}
              style={{
                width: '100%',
                padding: isMobile ? '0.85rem 1.25rem' : '0.75rem 1.5rem',
                background: 'none',
                border: 'none',
                borderTop: `1px solid ${darkMode ? '#2a2826' : '#eee'}`,
                color: showBlockedUsers ? (darkMode ? '#f0ebe5' : '#333') : (darkMode ? '#6a6664' : '#aaa'),
                fontSize: '0.8rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'color 0.15s',
                fontFamily: 'inherit',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#f0ebe5' : '#555'}
              onMouseLeave={e => e.currentTarget.style.color = showBlockedUsers ? (darkMode ? '#f0ebe5' : '#333') : (darkMode ? '#6a6664' : '#aaa')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
              Blocked Users
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showBlockedUsers ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>}

            {blockedUsers.length > 0 && showBlockedUsers && (
              <BlockedUsersPanel darkMode={darkMode} isMobile={isMobile} />
            )}
          </div>
        </div>
      )}

      {/* Fixed dropdown menu — rendered outside branches so it floats in both layouts */}
      {openMenuId && (() => {
        const conversation = conversations.find(c => c.id === openMenuId);
        if (!conversation) return null;
        return (
          <div
            ref={menuRef}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            style={{
              position: 'fixed',
              top: menuPosition.top,
              right: menuPosition.right,
              backgroundColor: darkMode ? '#1c1e20' : 'white',
              borderRadius: '12px',
              boxShadow: darkMode
                ? '0 8px 30px rgba(0,0,0,0.5)'
                : '0 8px 30px rgba(0,0,0,0.15)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              overflow: 'hidden',
              minWidth: '180px',
              zIndex: 1000,
            }}
          >
            {[
              {
                label: 'Block User',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                onClick: () => { setShowBlockConfirm(conversation); setOpenMenuId(null); },
              },
              {
                label: 'Report User',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
                onClick: () => { setShowReportModal(conversation); setOpenMenuId(null); },
              },
              { divider: true },
              {
                label: 'Delete Conversation',
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
                danger: true,
                onClick: () => { setDeleteConfirm(conversation.id); setOpenMenuId(null); },
              },
            ].map((item, i) =>
              item.divider ? (
                <div key={i} style={{
                  height: '1px',
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                }} />
              ) : (
                <button
                  key={i}
                  onClick={item.onClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    padding: '0.7rem 1rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: item.danger ? '#ff453a' : (darkMode ? '#f0ebe5' : '#1a1a1a'),
                    fontSize: '0.875rem',
                    fontWeight: '400',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    textDecoration: 'none',
                    outline: 'none',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ display: 'flex', opacity: 0.7 }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            )}
          </div>
        );
      })()}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            backgroundColor: darkMode ? '#1c1e20' : 'white',
            padding: '2rem', borderRadius: '16px', maxWidth: '340px', width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            textAlign: 'center',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.15)' : 'rgba(197, 5, 12, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5050c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontSize: '1.1rem', fontWeight: '600' }}>
              Block {getOtherPersonName(showBlockConfirm)}?
            </h3>
            <p style={{ margin: '0 0 1.75rem 0', color: darkMode ? '#8a8280' : '#666', lineHeight: '1.5', fontSize: '0.85rem' }}>
              They won't be able to message you and this conversation will be removed from your inbox.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => handleBlockUser(getOtherPersonId(showBlockConfirm))}
                disabled={isBlocking}
                style={{
                  padding: '0.7rem', borderRadius: '10px', border: 'none',
                  backgroundColor: '#c5050c', color: 'white',
                  cursor: isBlocking ? 'not-allowed' : 'pointer', opacity: isBlocking ? 0.5 : 1,
                  fontSize: '0.9rem', fontWeight: '600', fontFamily: 'inherit',
                  textDecoration: 'none', outline: 'none',
                }}
              >
                {isBlocking ? 'Blocking...' : 'Block'}
              </button>
              <button
                onClick={() => setShowBlockConfirm(null)}
                disabled={isBlocking}
                style={{
                  padding: '0.7rem', borderRadius: '10px', border: 'none',
                  backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#666',
                  cursor: isBlocking ? 'not-allowed' : 'pointer', opacity: isBlocking ? 0.5 : 1,
                  fontSize: '0.9rem', fontWeight: '500', fontFamily: 'inherit',
                  textDecoration: 'none', outline: 'none',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report User Modal */}
      {showReportModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReportModal(); }}
        >
          <div style={{
            backgroundColor: darkMode ? '#1c1e20' : 'white',
            padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {reportSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  backgroundColor: darkMode ? 'rgba(52, 199, 89, 0.15)' : 'rgba(52, 199, 89, 0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontSize: '1.1rem', fontWeight: '600' }}>
                  Report Submitted
                </h3>
                <p style={{ margin: '0 0 1.5rem 0', color: darkMode ? '#8a8280' : '#666', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Thanks for helping keep our community safe. We'll review your report shortly.
                </p>
                <button onClick={closeReportModal} style={{
                  width: '100%', padding: '0.7rem', borderRadius: '10px', border: 'none',
                  backgroundColor: darkMode ? '#2a2d30' : '#f0f0f0', color: darkMode ? '#f0ebe5' : '#1a1a1a',
                  cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'inherit',
                  outline: 'none', textDecoration: 'none',
                }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: darkMode ? '#f0ebe5' : '#1a1a1a', fontSize: '1.1rem', fontWeight: '600' }}>
                    Report {getOtherPersonName(showReportModal)}
                  </h3>
                  <button onClick={closeReportModal} style={{
                    background: 'none', border: 'none', color: darkMode ? '#8a8280' : '#999',
                    fontSize: '1.3rem', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1,
                    fontFamily: 'inherit', outline: 'none', textDecoration: 'none',
                  }}>
                    &times;
                  </button>
                </div>
                <p style={{ margin: '0 0 1rem 0', color: darkMode ? '#8a8280' : '#666', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  Let us know why you're reporting this user. Our team will review it.
                </p>
                <select
                  value={reportReason}
                  onChange={(e) => { setReportReason(e.target.value); setReportError(''); }}
                  style={{
                    width: '100%', padding: '0.65rem 2rem 0.65rem 0.75rem', borderRadius: '10px',
                    border: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                    backgroundColor: darkMode ? '#161819' : '#f8f8f8',
                    color: darkMode ? '#f0ebe5' : '#333', fontSize: '0.875rem',
                    marginBottom: '0.75rem', outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${darkMode ? '%238a8280' : '%23999'}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center',
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="Harassment or abusive messages">Harassment or abusive messages</option>
                  <option value="Spam or scam">Spam or scam</option>
                  <option value="Inappropriate content">Inappropriate content</option>
                  <option value="Suspicious or fake account">Suspicious or fake account</option>
                  <option value="Other">Other</option>
                </select>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Add any additional details..."
                  rows={3} maxLength={500}
                  style={{
                    width: '100%', padding: '0.65rem 0.75rem', borderRadius: '10px',
                    border: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                    backgroundColor: darkMode ? '#161819' : '#f8f8f8',
                    color: darkMode ? '#f0ebe5' : '#333', fontSize: '0.875rem',
                    marginBottom: '0.25rem', resize: 'vertical', fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ textAlign: 'right', fontSize: '0.7rem', color: darkMode ? '#524e4c' : '#999', marginBottom: '1rem' }}>
                  {reportDetails.length}/500
                </div>
                {reportError && (
                  <div style={{
                    padding: '0.5rem 0.75rem', borderRadius: '8px',
                    backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.12)' : '#fff3f3',
                    color: darkMode ? '#ff6b6b' : '#c5050c', fontSize: '0.8rem', marginBottom: '0.75rem',
                  }}>
                    {reportError}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleReportUser(getOtherPersonId(showReportModal))}
                    disabled={isReporting}
                    style={{
                      padding: '0.7rem', borderRadius: '10px', border: 'none',
                      backgroundColor: '#c5050c', color: 'white',
                      cursor: isReporting ? 'not-allowed' : 'pointer', opacity: isReporting ? 0.5 : 1,
                      fontSize: '0.9rem', fontWeight: '600', fontFamily: 'inherit',
                      textDecoration: 'none', outline: 'none',
                    }}
                  >
                    {isReporting ? 'Submitting...' : 'Submit Report'}
                  </button>
                  <button
                    onClick={closeReportModal}
                    disabled={isReporting}
                    style={{
                      padding: '0.7rem', borderRadius: '10px', border: 'none',
                      backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#666',
                      cursor: isReporting ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
                      fontWeight: '500', fontFamily: 'inherit', textDecoration: 'none', outline: 'none',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (() => {
        const conversation = conversations.find(c => c.id === deleteConfirm);
        const otherPersonName = conversation ? getOtherPersonName(conversation) : '';
        return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            backgroundColor: darkMode ? '#1c1e20' : 'white',
            padding: '2rem', borderRadius: '16px', maxWidth: '340px', width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            textAlign: 'center',
          }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.15)' : 'rgba(197, 5, 12, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5050c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontSize: '1.1rem', fontWeight: '600' }}>
              Delete Conversation
            </h3>
            <p style={{ margin: '0 0 1.75rem 0', color: darkMode ? '#8a8280' : '#666', lineHeight: '1.5', fontSize: '0.85rem' }}>
              This will only remove it from your view. {otherPersonName} will still see the conversation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() => handleDeleteConversation(deleteConfirm)}
                disabled={isDeleting}
                style={{
                  padding: '0.7rem', borderRadius: '10px', border: 'none',
                  backgroundColor: '#c5050c', color: 'white',
                  cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.5 : 1,
                  fontSize: '0.9rem', fontWeight: '600', fontFamily: 'inherit',
                  textDecoration: 'none', outline: 'none',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                style={{
                  padding: '0.7rem', borderRadius: '10px', border: 'none',
                  backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#666',
                  cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.5 : 1,
                  fontSize: '0.9rem', fontWeight: '500', fontFamily: 'inherit',
                  textDecoration: 'none', outline: 'none',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}

export function BlockedUsersPanel({ darkMode, isMobile }) {
  const { data: blockedUsers = [], isLoading } = useBlockedUsersQuery();
  const unblockMutation = useUnblockUserMutation();
  const [unblockingId, setUnblockingId] = useState(null);

  const handleUnblock = async (blockedId) => {
    if (unblockingId) return;
    setUnblockingId(blockedId);
    try {
      await unblockMutation.mutateAsync({ userId: blockedId });
    } catch {
      // Intentionally ignored - unblock failures are non-critical and silently retryable
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div style={{
      padding: isMobile ? '0.75rem 1.25rem 1rem' : '0.75rem 1.5rem 1rem',
    }}>
      {isLoading ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: darkMode ? '#8a8280' : '#999', textAlign: 'center', padding: '1rem 0' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {blockedUsers.map(row => {
            const name = row.blockedDisplayName || 'Unknown User';
            const initials = name.includes(' ')
              ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
              : name.substring(0, 2).toUpperCase();
            const isUnblocking = unblockingId === row.blockedID;
            return (
              <div
                key={row.blockedUserID}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderRadius: '10px',
                  transition: 'background-color 0.15s',
                }}
              >
                <div style={{
                  width: isMobile ? '36px' : '40px', height: isMobile ? '36px' : '40px', borderRadius: '50%',
                  backgroundColor: 'var(--badger-red)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: '600', overflow: 'hidden', flexShrink: 0,
                }}>
                  {row.blockedProfilePictureUrl ? (
                    <img src={row.blockedProfilePictureUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : initials}
                </div>
                <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: '500', color: darkMode ? '#f0ebe5' : '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
                <button
                  onClick={() => handleUnblock(row.blockedID)}
                  disabled={isUnblocking}
                  style={{
                    padding: '0.4rem 0.9rem', backgroundColor: 'transparent',
                    color: darkMode ? '#8a8280' : '#888',
                    border: `1px solid ${darkMode ? '#3a3633' : '#ddd'}`,
                    borderRadius: '8px', cursor: isUnblocking ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem', fontWeight: '500', flexShrink: 0, opacity: isUnblocking ? 0.5 : 1,
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { if (!isUnblocking) { e.currentTarget.style.color = darkMode ? '#f0ebe5' : '#333'; e.currentTarget.style.borderColor = darkMode ? '#524e4c' : '#999'; }}}
                  onMouseLeave={e => { if (!isUnblocking) { e.currentTarget.style.color = darkMode ? '#8a8280' : '#888'; e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#ddd'; }}}
                >
                  {isUnblocking ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
