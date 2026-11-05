import { useState, useEffect, useRef, useContext } from 'react';
// eslint-disable-next-line no-unused-vars -- `motion` is used via JSX member expressions (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { motion, AnimatePresence } from 'framer-motion';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/apiService';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

export default function EditProfileModal({ isOpen, onClose }) {
  const { darkMode } = useContext(ThemeContext);
  const { currentUser, updateUserProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: '', profilePicture: null });
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen && currentUser) {
      setFormData({
        name: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        profilePicture: null,
      });
      setUpdateMessage('');
      setDeleteConfirmOpen(false);
    }
  }, [isOpen, currentUser]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (profilePicturePreview) URL.revokeObjectURL(profilePicturePreview);
    };
  }, [profilePicturePreview]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'profilePicture' && files && files[0]) {
      const file = files[0];
      if (!file.type.startsWith('image/')) {
        setUpdateMessage('Please select an image file.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUpdateMessage('Image size must be less than 5MB.');
        return;
      }
      setFormData(prev => ({ ...prev, profilePicture: file }));
      if (profilePicturePreview) URL.revokeObjectURL(profilePicturePreview);
      setProfilePicturePreview(URL.createObjectURL(file));
      setUpdateMessage('');
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const getStoragePathFromUrl = (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      const m = urlObj.pathname.match(/\/o\/(.+)$/);
      return m && m[1] ? decodeURIComponent(m[1]) : null;
    } catch { return null; }
  };

  const uploadProfilePicture = async (file, userId, currentPhotoURL) => {
    const timestamp = Date.now();
    const fileName = `profile_pictures/${userId}_${timestamp}.${file.name.split('.').pop()}`;
    const storageRef = ref(storage, fileName);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    if (currentPhotoURL) {
      try {
        const path = getStoragePathFromUrl(currentPhotoURL);
        if (path) await deleteObject(ref(storage, path));
      } catch {
        // Intentionally ignored - failing to delete the old profile picture is non-critical
      }
    }
    return downloadURL;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateMessage('');
    try {
      const updateData = { name: formData.name };
      if (formData.profilePicture) {
        setUpdateMessage('Uploading profile picture...');
        updateData.photoURL = await uploadProfilePicture(formData.profilePicture, currentUser.uid, currentUser.photoURL);
      }
      await updateUserProfile(updateData);
      if (profilePicturePreview) {
        URL.revokeObjectURL(profilePicturePreview);
        setProfilePicturePreview(null);
      }
      onClose();
    } catch (error) {
      setUpdateMessage(`Error updating profile: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await ApiService.delete('/user');
      await logout();
      onClose();
      navigate('/');
    } catch (error) {
      setUpdateMessage(`Error deleting account: ${error.message}`);
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const initials = currentUser
    ? (currentUser.displayName || currentUser.email || '')
        .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() ||
      (currentUser.email || '').substring(0, 2).toUpperCase()
    : '';

  const photo = profilePicturePreview || currentUser?.photoURL;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 3000,
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              left: 0, right: 0, bottom: 0,
              zIndex: 3001,
              backgroundColor: darkMode ? '#1a1918' : '#ffffff',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
              maxHeight: '92lvh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Grabber */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.55rem', paddingBottom: '0.4rem' }}>
              <div style={{
                width: '36px', height: '4px', borderRadius: '999px',
                backgroundColor: darkMode ? '#3a3633' : '#e3e1de',
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.25rem 1rem 0.6rem',
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: darkMode ? '#a8a29e' : '#666', fontSize: '0.875rem',
                  fontWeight: '500', padding: '0.25rem 0.25rem',
                }}
              >
                Cancel
              </button>
              <h2 style={{
                margin: 0, fontSize: '0.95rem', fontWeight: '600',
                color: darkMode ? '#f0ebe5' : '#18181b', letterSpacing: '-0.01em',
              }}>
                Edit Profile
              </h2>
              <button
                type="submit"
                form="edit-profile-form"
                disabled={isUpdating}
                style={{
                  background: 'none', border: 'none',
                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                  color: isUpdating ? (darkMode ? '#524e4c' : '#bbb') : 'var(--badger-red)',
                  fontSize: '0.875rem', fontWeight: '600',
                  padding: '0.25rem 0.25rem',
                }}
              >
                {isUpdating ? 'Saving…' : 'Save'}
              </button>
            </div>

            {/* Hairline */}
            <div style={{ height: '1px', backgroundColor: darkMode ? '#2a2826' : '#f0eeec' }} />

            {/* Body (scrolls) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.1rem 1.25rem 1rem' }}>
              <form id="edit-profile-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                {/* Avatar — tap to upload */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Change profile photo"
                    style={{
                      position: 'relative',
                      width: '88px', height: '88px',
                      borderRadius: '50%',
                      border: 'none', padding: 0, background: 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: '88px', height: '88px', borderRadius: '50%',
                      backgroundColor: '#c0392b', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.85rem', fontWeight: '700', overflow: 'hidden',
                      boxShadow: `0 0 0 3px ${darkMode ? '#1a1918' : 'white'}, 0 0 0 4px ${darkMode ? '#2a2826' : '#eee'}`,
                    }}>
                      {photo ? (
                        <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <span style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 30, height: 30, borderRadius: '50%',
                      backgroundColor: 'var(--badger-red)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 0 2px ${darkMode ? '#1a1918' : 'white'}`,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </span>
                  </button>
                  <input ref={fileInputRef} type="file" name="profilePicture" accept="image/*" onChange={handleInputChange} style={{ display: 'none' }} />
                  <span style={{ fontSize: '0.72rem', color: darkMode ? '#8a8280' : '#999', letterSpacing: '0.01em' }}>
                    {formData.profilePicture ? formData.profilePicture.name : 'Tap to change photo'}
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label style={{
                    display: 'block', marginBottom: '0.4rem',
                    fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: darkMode ? '#8a8280' : '#999', fontWeight: '600',
                  }}>
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    style={{
                      width: '100%', padding: '0.75rem 0.9rem',
                      borderRadius: '10px', boxSizing: 'border-box',
                      border: `1px solid ${darkMode ? '#3a3633' : '#e3e1de'}`,
                      backgroundColor: darkMode ? '#161514' : '#fafaf9',
                      color: darkMode ? 'white' : '#1a1a1a',
                      fontSize: '0.95rem', outline: 'none',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--badger-red)'; e.target.style.backgroundColor = darkMode ? '#1a1918' : '#fff'; }}
                    onBlur={e => { e.target.style.borderColor = darkMode ? '#3a3633' : '#e3e1de'; e.target.style.backgroundColor = darkMode ? '#161514' : '#fafaf9'; }}
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <label style={{
                    display: 'block', marginBottom: '0.4rem',
                    fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: darkMode ? '#8a8280' : '#999', fontWeight: '600',
                  }}>
                    Email
                  </label>
                  <div style={{
                    width: '100%', padding: '0.75rem 0.9rem',
                    borderRadius: '10px', boxSizing: 'border-box',
                    border: `1px solid ${darkMode ? '#2a2826' : '#f0eeec'}`,
                    backgroundColor: darkMode ? '#0f0e0d' : '#f5f4f2',
                    color: darkMode ? '#a8a29e' : '#777',
                    fontSize: '0.9rem', wordBreak: 'break-all',
                  }}>
                    {currentUser?.email}
                  </div>
                </div>

                {updateMessage && (
                  <div style={{
                    padding: '0.65rem 0.85rem', borderRadius: '10px',
                    backgroundColor: updateMessage.includes('Error')
                      ? (darkMode ? 'rgba(220, 38, 38, 0.12)' : '#fef2f2')
                      : (darkMode ? 'rgba(34, 197, 94, 0.12)' : '#f0fdf4'),
                    color: updateMessage.includes('Error') ? '#dc2626' : '#16a34a',
                    fontSize: '0.8rem',
                  }}>
                    {updateMessage}
                  </div>
                )}
              </form>

              {/* Danger zone */}
              <div style={{
                marginTop: '1.4rem', paddingTop: '1.1rem',
                borderTop: `1px solid ${darkMode ? '#2a2826' : '#f0eeec'}`,
              }}>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--badger-red)',
                    fontSize: '0.82rem', fontFamily: 'Outfit, sans-serif',
                    fontWeight: 600,
                    padding: '0.4rem 0.6rem', letterSpacing: '0.02em',
                    width: '100%', textAlign: 'center',
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Delete account
                </button>
              </div>
            </div>
          </motion.div>

          {deleteConfirmOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => {
                if (e.target === e.currentTarget && !isDeleting) {
                  setDeleteConfirmOpen(false);
                }
              }}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3002,
                padding: '1rem',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  width: '100%',
                  maxWidth: '340px',
                  backgroundColor: darkMode ? '#1c1a19' : '#ffffff',
                  borderRadius: '14px',
                  border: `1px solid ${darkMode ? '#2e2a28' : '#ebebeb'}`,
                  boxShadow: darkMode ? '0 24px 60px rgba(0,0,0,0.6)' : '0 24px 60px rgba(0,0,0,0.12)',
                  padding: '1rem',
                }}
              >
                <h3 style={{
                  margin: '0 0 0.5rem',
                  fontSize: '1.05rem',
                  fontWeight: '700',
                  color: darkMode ? '#f0ebe5' : '#1a1a1a',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '-0.01em',
                }}>
                  Delete account
                </h3>
                <p style={{
                  margin: '0 0 1rem',
                  fontSize: '0.85rem',
                  color: darkMode ? '#6a6664' : '#999',
                  lineHeight: 1.6,
                }}>
                  Your listings, messages, and saved items will be permanently removed. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      padding: '0.6rem 1rem',
                      backgroundColor: 'transparent',
                      border: `1px solid ${darkMode ? '#2e2a28' : '#e8e8e8'}`,
                      borderRadius: '8px',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      color: darkMode ? '#8a8280' : '#888',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    style={{
                      flex: 1,
                      padding: '0.6rem 1rem',
                      backgroundColor: darkMode ? '#2a1010' : '#1a1a1a',
                      color: darkMode ? '#f87171' : 'white',
                      border: `1px solid ${darkMode ? '#5a2020' : 'transparent'}`,
                      borderRadius: '8px',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      opacity: isDeleting ? 0.6 : 1,
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
