import { useState, useContext, useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function ShareModal({ isOpen, onClose, listing }) {
  const { darkMode } = useContext(ThemeContext);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useBodyScrollLock(isOpen);

  const shareUrl = `${window.location.origin}/listings/${listing?.id}`;
  const shareTitle = `${listing?.title} - $${listing?.price}/mo`;
  const shareText = `Check out this listing: ${shareTitle}`;

  // Reset copied state when modal opens
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  useEffect(() => {
    setCanNativeShare(typeof navigator.share === 'function');
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !listing) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTextMessage = () => {
    const smsUrl = `sms:?&body=${encodeURIComponent(shareText + '\n' + shareUrl)}`;
    window.open(smsUrl, '_self');
    onClose();
  };

  const handleShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch {
        // user cancelled
      }
      return;
    }
    await handleCopyLink();
  };

  const buttonStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '80px',
    height: '80px',
    flexShrink: 0,
  };

  const iconStyle = {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
  };

  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: darkMode ? '#ccc' : '#555',
  };

  return (
    <div
      onClick={onClose}
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
        zIndex: 2100,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: darkMode ? '#1a1a1a' : 'white',
          borderRadius: '16px',
          padding: '1.5rem',
          maxWidth: '340px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '1.1rem',
            fontWeight: '600',
            color: darkMode ? 'white' : 'black',
          }}>
            Share
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: darkMode ? '#888' : '#999',
              padding: '0',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Share Options */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            style={{
              ...buttonStyle,
              backgroundColor: copied 
                ? (darkMode ? '#1a3d1a' : '#e8f5e9') 
                : (darkMode ? '#2a2a2a' : '#f5f5f5'),
            }}
          >
            <div style={iconStyle}>
              {copied ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#ccc' : '#555'} strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              )}
            </div>
            <span style={{ ...labelStyle, color: copied ? '#4caf50' : labelStyle.color }}>
              {copied ? 'Copied!' : 'Copy Link'}
            </span>
          </button>

          {/* Text Message */}
          <button onClick={handleShare} style={buttonStyle}>
            <div style={iconStyle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#ccc' : '#555'} strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <span style={labelStyle}>Share</span>
          </button>

          {/* Text Message */}
          <button onClick={handleTextMessage} style={buttonStyle}>
            <div style={iconStyle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#ccc' : '#555'} strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <span style={labelStyle}>Message</span>
          </button>

        </div>

        {/* URL Preview */}
        <div style={{
          marginTop: '1.25rem',
          padding: '0.75rem',
          backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: darkMode ? '#888' : '#666',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {shareUrl}
        </div>
      </div>
    </div>
  );
}

