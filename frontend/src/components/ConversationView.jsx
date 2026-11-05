import { useState, useContext, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMessagesQuery, useReplyMutation, useDeleteConversationMutation, useCurrentUserQuery, useConversationsQuery, useBlockUserMutation, useReportUserMutation } from '../services/messageQueries';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import AmbientBlobs from './AmbientBlobs';

export default function ConversationView() {
  const { conversationId } = useParams();
  const { darkMode } = useContext(ThemeContext);
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Override html/body bg so the chat background reaches the physical screen edges —
  // Android status bar samples body, iOS paints behind the dynamic island from html.
  useEffect(() => {
    if (!isMobile) return;
    const bg = darkMode ? '#161819' : '#faf7f1';
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = bg;
    document.documentElement.style.backgroundColor = bg;
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, [isMobile, darkMode]);

  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');
  const menuRef = useRef(null);

  // Use cached queries instead of useEffect
  const { data: currentUserData } = useCurrentUserQuery();
  const currentUserDbId = currentUserData?.userID;

  const { data: conversations = [] } = useConversationsQuery({
    enabled: !!currentUser && !authLoading
  });
  const conversation = conversations.find(c => c.conversationID === parseInt(conversationId));

  const { data: messages = [], isLoading, refetch } = useMessagesQuery(conversationId, {
    enabled: !!currentUser && !authLoading
  });
  const replyMutation = useReplyMutation();
  const deleteConversationMutation = useDeleteConversationMutation();
  const blockUserMutation = useBlockUserMutation();
  const reportUserMutation = useReportUserMutation();

  // Modal-only scroll-lock for overlays.
  useBodyScrollLock(showDeleteConfirm || showBlockConfirm || showReportModal);

  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isReporting, setIsReporting] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');
    // Reset textarea height after clearing
    if (inputRef.current) {
      inputRef.current.style.height = '42px';
      inputRef.current.style.overflowY = 'hidden';
    }

    try {
      await replyMutation.mutateAsync({
        conversationId: conversationId,
        content: messageContent
      });

      // Refetch messages to show the new one
      refetch();
    } catch {
      // Restore message content on error
      setNewMessage(messageContent);
      setSendError('Failed to send message. Try again.');
      setTimeout(() => setSendError(''), 3000);
    } finally {
      setIsSending(false);
    }
  };

  // Helper function to parse timestamps based on environment
  const parseTimestamp = (dateString) => {
    const isProduction = window.location.hostname !== 'localhost';

    if (isProduction) {
      return new Date(dateString + 'Z');
    } else {
      return new Date(dateString);
    }
  };

  const formatMessageTime = (dateString) => {
    const date = parseTimestamp(dateString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday - 86400000);
    const startOfWeek = new Date(startOfToday - (now.getDay() * 86400000));

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    if (date >= startOfToday) return timeStr;
    if (date >= startOfYesterday) return `Yesterday ${timeStr}`;
    if (date >= startOfWeek) return date.toLocaleDateString('en-US', { weekday: 'short' }) + ` ${timeStr}`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
  };

  const isMyMessage = (message) => {
    if (!currentUserDbId) return false;
    return message.senderID == currentUserDbId;
  };

  const handleBlockUser = async () => {
    if (isBlocking || !otherPerson.userId) return;
    setIsBlocking(true);
    try {
      await blockUserMutation.mutateAsync({ userId: otherPerson.userId });
      navigate('/profile', { state: { activeTab: 'messages' } });
    } catch {
      setBlockError('Failed to block user. Please try again.');
      setTimeout(() => setBlockError(''), 3000);
    } finally {
      setIsBlocking(false);
      setShowBlockConfirm(false);
    }
  };

  const handleReportUser = async () => {
    if (isReporting || !otherPerson.userId) return;
    if (!reportReason) {
      setReportError('Please select a reason.');
      return;
    }
    setIsReporting(true);
    setReportError('');
    try {
      await reportUserMutation.mutateAsync({
        userId: otherPerson.userId,
        reason: reportReason,
        details: reportDetails.trim(),
      });
      setReportSuccess(true);
    } catch {
      setReportError('Failed to submit report. Please try again.');
    } finally {
      setIsReporting(false);
    }
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setReportReason('');
    setReportDetails('');
    setReportError('');
    setReportSuccess(false);
  };

  const handleDeleteConversation = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteConversationMutation.mutateAsync({
        conversationId: conversationId
      });

      navigate('/profile', { state: { activeTab: 'messages' } });
    } catch {
      setDeleteError('Failed to delete conversation. Please try again.');
      setTimeout(() => setDeleteError(''), 3000);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Message grouping helpers
  const getMessagePosition = (index) => {
    if (messages.length <= 1) return 'alone';
    const current = messages[index];
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;
    const currentIsMine = isMyMessage(current);
    const prevSame = prev && isMyMessage(prev) === currentIsMine;
    const nextSame = next && isMyMessage(next) === currentIsMine;

    // Check if time gap breaks the group (5 min)
    const prevTimeTooFar = prev && (parseTimestamp(current.timestamp) - parseTimestamp(prev.timestamp)) > 300000;
    const nextTimeTooFar = next && (parseTimestamp(next.timestamp) - parseTimestamp(current.timestamp)) > 300000;

    const isFirst = !prevSame || prevTimeTooFar;
    const isLast = !nextSame || nextTimeTooFar;

    if (isFirst && isLast) return 'alone';
    if (isFirst) return 'first';
    if (isLast) return 'last';
    return 'middle';
  };

  // Keep all bubbles as consistent pills — grouping only affects spacing
  const bubbleRadius = '20px';

  if (isLoading || !currentUserDbId) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: `3px solid ${darkMode ? '#2a2826' : '#eee'}`,
          borderTop: `3px solid ${darkMode ? '#8a8280' : '#555'}`,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
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

  // Get other person's info from conversation details instead of messages
  const getOtherPersonInfo = () => {
    if (!conversation || !currentUserDbId) {
      return { name: 'Other Person', profilePicture: null, userId: null };
    }

    const isRequester = conversation.requesterID == currentUserDbId;

    return {
      name: isRequester ? conversation.listerName : conversation.requesterName,
      profilePicture: isRequester ? conversation.listerProfilePictureUrl : conversation.requesterProfilePictureUrl,
      userId: isRequester ? conversation.listerID : conversation.requesterID,
    };
  };

  const otherPerson = getOtherPersonInfo();

  // Unified background color for the entire chat view
  const chatBg = darkMode ? '#161819' : '#faf7f1';

  return (
    <>
    <div style={{
      position: isMobile ? 'fixed' : 'relative',
      inset: isMobile ? 0 : 'auto',
      zIndex: isMobile ? 1 : 103,
      display: 'flex',
      flexDirection: 'column',
      height: isMobile ? undefined : '100%',
      maxWidth: isMobile ? undefined : '900px',
      margin: isMobile ? undefined : '0 auto',
      padding: isMobile ? '0' : '1rem 1rem',
      backgroundColor: isMobile ? chatBg : undefined,
    }}>
      {/* Desktop: the same red glow as the other pages, behind a translucent chat card */}
      {!isMobile && <AmbientBlobs darkMode={darkMode} isMobile={false} layer={-1} />}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        backgroundColor: isMobile ? chatBg : (darkMode ? 'rgba(22,24,25,0.72)' : 'rgba(250,247,241,0.72)'),
        backdropFilter: isMobile ? undefined : 'blur(14px)',
        WebkitBackdropFilter: isMobile ? undefined : 'blur(14px)',
        borderRadius: isMobile ? '0' : '16px',
        overflow: 'hidden',
        border: isMobile ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
      }}>
      {/* Header */}
      <div style={{
        backgroundColor: isMobile ? chatBg : 'transparent',
        paddingTop: isMobile ? 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' : '0.75rem',
        paddingBottom: '0.75rem',
        paddingLeft: isMobile ? '0.75rem' : '1.25rem',
        paddingRight: isMobile ? '0.75rem' : '1.25rem',
        borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '0.5rem' : '0.75rem',
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--badger-red)',
            fontSize: '1.1rem',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            borderRadius: '8px',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {/* Avatar */}
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'var(--badger-red)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.9rem',
          fontWeight: '600',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}>
          {otherPerson.profilePicture ? (
            <img
              src={otherPerson.profilePicture}
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
            position: otherPerson.profilePicture ? 'absolute' : 'static',
            top: otherPerson.profilePicture ? '50%' : 'auto',
            left: otherPerson.profilePicture ? '50%' : 'auto',
            transform: otherPerson.profilePicture ? 'translate(-50%, -50%)' : 'none',
            zIndex: otherPerson.profilePicture ? '-1' : '1'
          }}>
            {otherPerson.name.includes(' ') ? otherPerson.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : otherPerson.name.substring(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.05rem',
            color: darkMode ? '#f0ebe5' : '#1a1a1a',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em',
          }}>
            {otherPerson.name}
          </h2>
        </div>

        {/* Menu button + dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              opacity: 0.4,
              transition: 'opacity 0.15s ease, background-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.8';
              e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.4';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="More options"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#f0ebe5' : '#333'} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>

          {showMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: darkMode ? '#2c2c2e' : '#ffffff',
              borderRadius: '12px',
              boxShadow: darkMode
                ? '0 8px 30px rgba(0,0,0,0.5)'
                : '0 8px 30px rgba(0,0,0,0.15)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              overflow: 'hidden',
              minWidth: '180px',
              zIndex: 100,
            }}>
              {[
                {
                  label: 'Block User',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                  onClick: () => { setShowBlockConfirm(true); setShowMenu(false); },
                },
                {
                  label: 'Report User',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
                  onClick: () => { setShowReportModal(true); setShowMenu(false); },
                },
                { divider: true },
                {
                  label: 'Delete Conversation',
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
                  danger: true,
                  onClick: () => { setShowDeleteConfirm(true); setShowMenu(false); },
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
          )}
        </div>
      </div>

      {/* Delete Error */}
      {deleteError && (
        <div style={{
          padding: '0.5rem 1rem',
          backgroundColor: darkMode ? 'rgba(220, 53, 69, 0.15)' : '#fff3f3',
          color: darkMode ? '#ff6b6b' : '#c5050c',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}>
          {deleteError}
        </div>
      )}

      {/* Block Error */}
      {blockError && (
        <div style={{
          padding: '0.5rem 1rem',
          backgroundColor: darkMode ? 'rgba(220, 53, 69, 0.15)' : '#fff3f3',
          color: darkMode ? '#ff6b6b' : '#c5050c',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}>
          {blockError}
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            backgroundColor: darkMode ? '#1c1e20' : 'white',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '340px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            textAlign: 'center',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.15)' : 'rgba(197, 5, 12, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5050c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </div>
            <h3 style={{
              margin: '0 0 0.5rem 0',
              color: darkMode ? '#f0ebe5' : '#1a1a1a',
              fontSize: '1.1rem',
              fontWeight: '600',
            }}>
              Block {otherPerson.name}?
            </h3>
            <p style={{
              margin: '0 0 1.75rem 0',
              color: darkMode ? '#8a8280' : '#666',
              lineHeight: '1.5',
              fontSize: '0.85rem',
            }}>
              They won't be able to message you and this conversation will be removed from your inbox.
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              <button
                onClick={handleBlockUser}
                disabled={isBlocking}
                style={{
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#c5050c',
                  color: 'white',
                  cursor: isBlocking ? 'not-allowed' : 'pointer',
                  opacity: isBlocking ? 0.5 : 1,
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  outline: 'none',
                }}
              >
                {isBlocking ? 'Blocking...' : 'Block'}
              </button>
              <button
                onClick={() => setShowBlockConfirm(false)}
                disabled={isBlocking}
                style={{
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: darkMode ? '#8a8280' : '#666',
                  cursor: isBlocking ? 'not-allowed' : 'pointer',
                  opacity: isBlocking ? 0.5 : 1,
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  outline: 'none',
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
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReportModal(); }}
        >
          <div style={{
            backgroundColor: darkMode ? '#1c1e20' : 'white',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            {reportSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: darkMode ? 'rgba(52, 199, 89, 0.15)' : 'rgba(52, 199, 89, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  color: darkMode ? '#f0ebe5' : '#1a1a1a',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                }}>
                  Report Submitted
                </h3>
                <p style={{
                  margin: '0 0 1.5rem 0',
                  color: darkMode ? '#8a8280' : '#666',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                }}>
                  Thanks for helping keep our community safe. We'll review your report shortly.
                </p>
                <button
                  onClick={closeReportModal}
                  style={{
                    width: '100%',
                    padding: '0.7rem',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: darkMode ? '#2a2d30' : '#f0f0f0',
                    color: darkMode ? '#f0ebe5' : '#1a1a1a',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    outline: 'none',
                    textDecoration: 'none',
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{
                    margin: 0,
                    color: darkMode ? '#f0ebe5' : '#1a1a1a',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                  }}>
                    Report {otherPerson.name}
                  </h3>
                  <button
                    onClick={closeReportModal}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: darkMode ? '#8a8280' : '#999',
                      fontSize: '1.3rem',
                      cursor: 'pointer',
                      padding: '0 0.25rem',
                      lineHeight: 1,
                      fontFamily: 'inherit',
                      outline: 'none',
                      textDecoration: 'none',
                    }}
                  >
                    &times;
                  </button>
                </div>
                <p style={{
                  margin: '0 0 1rem 0',
                  color: darkMode ? '#8a8280' : '#666',
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                }}>
                  Let us know why you're reporting this user. Our team will review it.
                </p>
                <select
                  value={reportReason}
                  onChange={(e) => { setReportReason(e.target.value); setReportError(''); }}
                  style={{
                    width: '100%',
                    padding: '0.65rem 2rem 0.65rem 0.75rem',
                    borderRadius: '10px',
                    border: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                    backgroundColor: darkMode ? '#161819' : '#f8f8f8',
                    color: darkMode ? '#f0ebe5' : '#333',
                    fontSize: '0.875rem',
                    marginBottom: '0.75rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${darkMode ? '%238a8280' : '%23999'}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
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
                  rows={3}
                  maxLength={500}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '10px',
                    border: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                    backgroundColor: darkMode ? '#161819' : '#f8f8f8',
                    color: darkMode ? '#f0ebe5' : '#333',
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{
                  textAlign: 'right',
                  fontSize: '0.7rem',
                  color: darkMode ? '#524e4c' : '#999',
                  marginBottom: '1rem',
                }}>
                  {reportDetails.length}/500
                </div>
                {reportError && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.12)' : '#fff3f3',
                    color: darkMode ? '#ff6b6b' : '#c5050c',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem',
                  }}>
                    {reportError}
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  <button
                    onClick={handleReportUser}
                    disabled={isReporting}
                    style={{
                      padding: '0.7rem',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#c5050c',
                      color: 'white',
                      cursor: isReporting ? 'not-allowed' : 'pointer',
                      opacity: isReporting ? 0.5 : 1,
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      fontFamily: 'inherit',
                      textDecoration: 'none',
                      outline: 'none',
                    }}
                  >
                    {isReporting ? 'Submitting...' : 'Submit Report'}
                  </button>
                  <button
                    onClick={closeReportModal}
                    disabled={isReporting}
                    style={{
                      padding: '0.7rem',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: darkMode ? '#8a8280' : '#666',
                      cursor: isReporting ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      fontFamily: 'inherit',
                      textDecoration: 'none',
                      outline: 'none',
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
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            backgroundColor: darkMode ? '#1c1e20' : 'white',
            padding: '2rem',
            borderRadius: '16px',
            maxWidth: '340px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            textAlign: 'center',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.15)' : 'rgba(197, 5, 12, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c5050c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </div>
            <h3 style={{
              margin: '0 0 0.5rem 0',
              color: darkMode ? '#f0ebe5' : '#1a1a1a',
              fontSize: '1.1rem',
              fontWeight: '600',
            }}>
              Delete Conversation
            </h3>
            <p style={{
              margin: '0 0 1.75rem 0',
              color: darkMode ? '#8a8280' : '#666',
              lineHeight: '1.5',
              fontSize: '0.85rem',
            }}>
              This will only remove it from your view. {otherPerson.name} will still see the conversation.
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              <button
                onClick={handleDeleteConversation}
                disabled={isDeleting}
                style={{
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#c5050c',
                  color: 'white',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  outline: 'none',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: darkMode ? '#8a8280' : '#666',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  outline: 'none',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        onTouchStart={() => { if (document.activeElement) document.activeElement.blur(); }}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isMobile ? '0.75rem' : '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          minHeight: 0,
        }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            color: darkMode ? '#8a8280' : '#999',
            textAlign: 'center',
            gap: '0.5rem',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '500', color: darkMode ? '#666' : '#aaa' }}>
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMine = isMyMessage(message);
            const position = getMessagePosition(index);
            const showTime = index === 0 ||
              (parseTimestamp(message.timestamp) -
               parseTimestamp(messages[index - 1].timestamp)) > 300000;

            // Spacing: tight between grouped messages, normal otherwise
            const isGroupedWithPrev = (position === 'middle' || position === 'last');
            const marginTop = showTime ? '0' : (isGroupedWithPrev ? '2px' : '8px');

            return (
              <div key={message.id} style={{ marginTop }}>
                {showTime && (
                  <div style={{
                    textAlign: 'center',
                    fontSize: '0.72rem',
                    fontWeight: '500',
                    color: darkMode ? '#555' : '#8e8e93',
                    margin: index === 0 ? '0.5rem 0 0.75rem 0' : '1.25rem 0 0.75rem 0',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}>
                    {formatMessageTime(message.timestamp)}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  paddingLeft: isMine ? '15%' : '0',
                  paddingRight: isMine ? '0' : '15%',
                }}>
                  <div style={{
                    minWidth: '3.25rem',
                    maxWidth: '100%',
                    padding: '0.5rem 1rem',
                    borderRadius: bubbleRadius,
                    backgroundColor: isMine
                      ? 'var(--badger-red)'
                      : (darkMode ? '#2a2a2c' : '#e9e9eb'),
                    color: isMine
                      ? 'white'
                      : (darkMode ? '#f0ebe5' : '#1a1a1a'),
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    fontSize: '0.95rem',
                    lineHeight: '1.35',
                    transition: 'border-radius 0.1s ease',
                  }}>
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div style={{
        backgroundColor: chatBg,
        padding: isMobile ? '0.5rem 0.75rem' : '0.65rem 1.25rem',
        paddingBottom: isMobile ? 'max(0.5rem, env(safe-area-inset-bottom, 0px))' : '0.75rem',
        flexShrink: 0,
        overflow: 'visible',
      }}>
        {sendError && (
          <p style={{
            color: darkMode ? '#ff6b6b' : '#c5050c',
            fontSize: '0.8rem',
            margin: '0 0 0.4rem 0.5rem'
          }}>
            {sendError}
          </p>
        )}
        {newMessage.length > 800 && (
          <div style={{
            textAlign: 'right',
            fontSize: '0.7rem',
            color: newMessage.length > 950 ? '#ff453a' : (darkMode ? '#8a8280' : '#999'),
            padding: '0 0.5rem 0.25rem 0',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {newMessage.length}/1000
          </div>
        )}
        <form onSubmit={handleSendMessage} style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          overflow: 'visible',
        }}>
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => {
              if (e.target.value.length <= 1000) {
                setNewMessage(e.target.value);
              }
              // Auto-resize: reset height to measure scrollHeight, then clamp
              e.target.style.height = '42px';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              e.target.style.overflowY = e.target.scrollHeight > 120 ? 'auto' : 'hidden';
            }}
            placeholder="Message"
            maxLength={1000}
            rows="1"
            style={{
              flex: 1,
              minWidth: 0,
              padding: '0.55rem 1rem',
              borderRadius: '22px',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
              backgroundColor: darkMode ? '#1f2123' : '#ffffff',
              color: darkMode ? '#f0ebe5' : '#1a1a1a',
              fontSize: '16px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: '120px',
              minHeight: '42px',
              height: '42px',
              lineHeight: '1.4',
              display: 'block',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            style={{
              width: '42px',
              height: '42px',
              minWidth: '42px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: (!newMessage.trim() || isSending)
                ? (darkMode ? '#48484a' : '#c7c7cc')
                : 'var(--badger-red)',
              cursor: (!newMessage.trim() || isSending) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'background-color 0.2s ease',
              padding: 0,
            }}
          >
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '1.25rem',
              fontWeight: '700',
              lineHeight: 1,
              marginTop: '-1px',
            }}>↑</span>
          </button>
        </form>
      </div>
      </div>
    </div>
    </>
  );
}