import { useState, useEffect, useContext, useRef } from 'react';
// eslint-disable-next-line no-unused-vars -- `motion` is used via JSX member expressions (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import { useSavedListingsQuery, useSaveListingMutations, useUserListingsQuery, useDeleteListingMutation, useUpdateListingStatusMutation } from '../services/listingQueries';
import StatusBadge from '../components/StatusBadge';
import StatusDropdown from '../components/StatusDropdown';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import ConversationList from '../components/ConversationList';
import { useConversationsQuery } from '../services/messageQueries';
import { ApiService } from '../services/apiService';
import Seo from '../components/Seo';
import ReportModal from '../components/ReportModal';
import ShareModal from '../components/ShareModal';
import EditProfileModal from '../components/EditProfileModal';

export default function Profile() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('savedListings');
  const hasInitializedDefaultTab = useRef(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const [isTabletCompact, setIsTabletCompact] = useState(window.innerWidth <= 1024);
  const [isNarrowDesktopTabs, setIsNarrowDesktopTabs] = useState(window.innerWidth > 768 && window.innerWidth <= 1024);
  const [isTabletLandscape, setIsTabletLandscape] = useState(
    window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight && window.innerHeight >= 600
  );
  const [isTabletPortrait, setIsTabletPortrait] = useState(
    window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerHeight >= 600 && !(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600)
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
      setIsTabletCompact(window.innerWidth <= 1024);
      setIsNarrowDesktopTabs(window.innerWidth > 768 && window.innerWidth <= 1024);
      setIsTabletLandscape(window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight && window.innerHeight >= 600);
      const mobile = window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600;
      setIsTabletPortrait(window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerHeight >= 600 && !mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const useCompactMyListingsLayout = isMobile || isTabletCompact;
  const hideMessagesTab = false;


  const [showCreateOptionsSidebar, setShowCreateOptionsSidebar] = useState(false);
  const [showCreateOptionsEmpty, setShowCreateOptionsEmpty] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState(null);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [listingToComplete, setListingToComplete] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState(null);
  const [openCardMenuId, setOpenCardMenuId] = useState(null);
  const [openOverflowMenuId, setOpenOverflowMenuId] = useState(null);
  const [reportListingTarget, setReportListingTarget] = useState(null);
  const [shareListingTarget, setShareListingTarget] = useState(null);
  const [sortOrder, setSortOrder] = useState('recent');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasSeenConversations, setHasSeenConversations] = useState(false);
  
  // Form state for editing profile
  const [formData, setFormData] = useState({
    name: '',
    profilePicture: null
  });
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const fileInputRef = useRef(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [showMobileTypeChooser, setShowMobileTypeChooser] = useState(false);
  const [openMobileListingMenuId, setOpenMobileListingMenuId] = useState(null);
  const { darkMode } = useContext(ThemeContext);
  const { currentUser, logout, loading: authLoading, updateUserProfile } = useAuth();
  const navigate = useNavigate();

  // Check if we should show a specific tab based on navigation state
  useEffect(() => {
    if (location.state?.activeTab) {
      const tab = location.state.activeTab;
      setActiveTab(tab);
      hasInitializedDefaultTab.current = true;
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate, location.pathname]);

  // If user leaves My Listings, reset the empty-state "create options" panel
  useEffect(() => {
    if (activeTab !== 'myListings' && showCreateOptionsEmpty) {
      setShowCreateOptionsEmpty(false);
    }
  }, [activeTab, showCreateOptionsEmpty]);
  
  // Move all hooks to the top before any conditional returns
  const userId = currentUser?.uid; // Use actual Firebase user ID

  // Use real backend queries - only when user is authenticated
  const { data: savedListings = [], isLoading: isLoadingSaved, error: savedError } = useSavedListingsQuery(userId, {
    enabled: !!currentUser && !authLoading // Only run query when user is authenticated AND auth is not loading
  });
  const { data: userListings = [], isLoading: isLoadingUserListings, error: userListingsError } = useUserListingsQuery(userId, {
    enabled: !!currentUser && !authLoading // Only run query when user is authenticated AND auth is not loading
  });

  // Default tab: Saved
  useEffect(() => {
    if (hasInitializedDefaultTab.current || isLoadingUserListings) return;
    setActiveTab('savedListings');
    hasInitializedDefaultTab.current = true;
  }, [isLoadingUserListings, userListings.length]);

  const { unsaveMutation } = useSaveListingMutations(userId);
  const deleteListingMutation = useDeleteListingMutation(userId);
  const updateStatusMutation = useUpdateListingStatusMutation(userId);
  
  // Get conversations for unread count
  const { data: conversations = [] } = useConversationsQuery({
    enabled: !!currentUser && !authLoading
  });
  
  // Calculate total unread messages
  const totalUnreadCount = conversations.reduce((total, conversation) => {
    return total + (conversation.unreadCount || 0);
  }, 0);
  
  // Reset "seen conversations" when new messages arrive (totalUnreadCount increases)
  useEffect(() => {
    if (totalUnreadCount > 0 && hasSeenConversations) {
      // Only reset if we're not currently on the messages tab
      if (activeTab !== 'messages') {
        setHasSeenConversations(false);
      }
    }
  }, [totalUnreadCount, hasSeenConversations, activeTab]);
  
  // Close status dropdown on outside click
  useEffect(() => {
    if (!openStatusDropdownId) return;
    const close = () => setOpenStatusDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openStatusDropdownId]);

  // Close card menus and sort dropdown on outside click
  useEffect(() => {
    if (!openCardMenuId && !openOverflowMenuId && !sortDropdownOpen && !openMobileListingMenuId) return;
    const close = () => { setOpenCardMenuId(null); setOpenOverflowMenuId(null); setSortDropdownOpen(false); setOpenMobileListingMenuId(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openCardMenuId, openOverflowMenuId, sortDropdownOpen, openMobileListingMenuId]);

  // Initialize form data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        profilePicture: null
      });
    }
  }, [currentUser]);

  // Check authentication on component mount
  useEffect(() => {
    if (!currentUser) {
      // Don't automatically show the modal - let users see the page first
      // setShowAuthModal(true);
    }
  }, [currentUser]);

  // Cleanup profile picture preview on component unmount
  useEffect(() => {
    return () => {
      if (profilePicturePreview) {
        URL.revokeObjectURL(profilePicturePreview);
      }
    };
  }, [profilePicturePreview]);

  // If user is not authenticated, show auth modal
  if (!currentUser) {
    return (
      <div style={{
        position: 'relative',
        zIndex: 103,
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        textAlign: 'center',
        color: darkMode ? '#fff' : '#333',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
      {/* Animated background blobs (same as the homepage) */}
      <div className="blob blob-1" style={{
        position: 'fixed', top: '-20%', left: '15%', width: '650px', height: '650px', borderRadius: '50%',
        background: darkMode ? 'rgba(197,5,12,0.09)' : 'rgba(197,5,12,0.10)',
        filter: 'blur(140px)', pointerEvents: 'none', zIndex: 102, willChange: 'transform', display: isMobile ? 'none' : undefined,
      }} />
      <div className="blob blob-2" style={{
        position: 'fixed', top: '0%', left: '-20%', width: '500px', height: '500px', borderRadius: '50%',
        background: 'rgba(197,5,12,0.06)',
        filter: 'blur(120px)', pointerEvents: 'none', zIndex: 102, willChange: 'transform', display: isMobile ? 'none' : undefined,
      }} />
      <div className="blob blob-3" style={{
        position: 'fixed', top: '-10%', right: '-15%', width: '480px', height: '480px', borderRadius: '50%',
        background: 'rgba(197,5,12,0.06)',
        filter: 'blur(125px)', pointerEvents: 'none', zIndex: 102, willChange: 'transform', display: isMobile ? 'none' : undefined,
      }} />
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
      `}</style>
          <h2 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Sign in to view your profile</h2>
        <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>You need to be signed in to access your profile.</p>
        
        <button
          onClick={() => setShowAuthModal(true)}
          style={{
            backgroundColor: 'var(--badger-red)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
        >
          Sign In
        </button>
        
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => {
            setShowAuthModal(false);
            // Don't redirect - let them stay on the page
          }}
          darkMode={darkMode}
          title="Sign in to view your profile"
        />
      </div>
    );
  }

  // Real functions for backend operations
  const handleUnsave = async (listingId) => {
    try {
      await unsaveMutation.mutateAsync({ listingId });
    } catch {
      setActionError('Failed to unsave listing. Please try again.');
      setTimeout(() => setActionError(''), 3000);
    }
  };

  const handleDeleteClick = (listing) => {
    setListingToDelete(listing);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!listingToDelete) return;

    try {
      await deleteListingMutation.mutateAsync(listingToDelete.id);
      setDeleteModalOpen(false);
      setListingToDelete(null);
    } catch {
      setActionError('Failed to delete listing. Please try again.');
      setTimeout(() => setActionError(''), 3000);
    }
  };

  const handleMarkCompleteFromDelete = () => {
    setListingToComplete(listingToDelete);
    setDeleteModalOpen(false);
    setListingToDelete(null);
    setCompletionModalOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setListingToDelete(null);
  };

  const handleStatusChange = async (listing, newStatus) => {
    // Clear stale status errors before a new action.
    setStatusError('');

    if (newStatus === 'COMPLETED') {
      setListingToComplete(listing);
      setCompletionModalOpen(true);
      return;
    }
    try {
      await updateStatusMutation.mutateAsync({
        publicId: listing.publicId || listing.id,
        status: newStatus,
      });
    } catch (err) {
      setStatusError(err.message || 'Failed to update status');
    }
  };

  const handleConfirmComplete = async () => {
    if (!listingToComplete) return;
    try {
      await updateStatusMutation.mutateAsync({
        publicId: listingToComplete.publicId || listingToComplete.id,
        status: 'COMPLETED',
      });
      setCompletionModalOpen(false);
      setListingToComplete(null);
      setStatusError('');
    } catch (err) {
      setStatusError(err.message || 'Failed to mark as completed');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      // Logout errors are non-critical - Firebase will clean up session eventually
      console.error('Logout error:', error);
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(user?.email || '');
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      // Intentionally ignored - clipboard write failures are non-critical
    }
  };

  // Form handling functions
  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'profilePicture' && files && files[0]) {
      const file = files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUpdateMessage('Please select an image file.');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUpdateMessage('Image size must be less than 5MB.');
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        profilePicture: file
      }));
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setProfilePicturePreview(previewUrl);
      setUpdateMessage(''); // Clear any previous errors
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Helper function to extract storage path from Firebase URL
  const getStoragePathFromUrl = (url) => {
    if (!url) return null;
    
    try {
      // Firebase Storage URLs follow the pattern:
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?{params}
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
      
      if (pathMatch && pathMatch[1]) {
        // Decode the URL-encoded path
        return decodeURIComponent(pathMatch[1]);
      }
      
      return null;
    } catch {
      return null;
    }
  };

  // Helper function to delete old profile picture from Firebase Storage
  const deleteOldProfilePicture = async (oldPhotoURL) => {
    if (!oldPhotoURL) return;
    
    try {
      const storagePath = getStoragePathFromUrl(oldPhotoURL);
      if (storagePath) {
        const oldImageRef = ref(storage, storagePath);
        await deleteObject(oldImageRef);
      }
    } catch {
      // Don't throw error for deletion failures - just log it
      // The upload should still proceed even if old image deletion fails
    }
  };

  // Helper function to upload profile picture to Firebase Storage
  const uploadProfilePicture = async (file, userId, currentPhotoURL = null) => {
    try {
      // Upload new profile picture first
      const timestamp = Date.now();
      const fileName = `profile_pictures/${userId}_${timestamp}.${file.name.split('.').pop()}`;
      const storageRef = ref(storage, fileName);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Only delete old profile picture after successful upload
      // Don't let deletion failure affect the overall operation
      if (currentPhotoURL) {
        try {
          await deleteOldProfilePicture(currentPhotoURL);
        } catch {
          // Continue with successful upload - don't throw error
        }
      }
      
      return downloadURL;
    } catch {
      throw new Error('Failed to upload profile picture. Please try again.');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateMessage('');

    try {
      const updateData = {
        name: formData.name
      };

      // Handle profile picture upload if a new one was selected
      if (formData.profilePicture) {
        setUpdateMessage('Uploading profile picture...');
        const photoURL = await uploadProfilePicture(formData.profilePicture, currentUser.uid, currentUser.photoURL);
        updateData.photoURL = photoURL;
      }

      await updateUserProfile(updateData);
      setEditMode(false);
      if (isMobile) setProfileExpanded(false);

      // Clean up preview URL and reset form
      if (profilePicturePreview) {
        URL.revokeObjectURL(profilePicturePreview);
        setProfilePicturePreview(null);
      }
      setFormData(prev => ({ ...prev, profilePicture: null }));
    } catch (error) {
      setUpdateMessage(`Error updating profile: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    // Clean up preview URL
    if (profilePicturePreview) {
      URL.revokeObjectURL(profilePicturePreview);
      setProfilePicturePreview(null);
    }

    // Reset form data to current user data
    if (currentUser) {
      setFormData({
        name: currentUser.displayName || currentUser.email?.split('@')[0] || '',
        profilePicture: null
      });
    }
    setEditMode(false);
    if (isMobile) setProfileExpanded(false);
    setUpdateMessage('');
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await ApiService.delete('/user');
      await logout();
      navigate('/');
    } catch (error) {
      setUpdateMessage(`Error deleting account: ${error.message}`);
      setIsDeletingAccount(false);
      setDeleteAccountModalOpen(false);
    }
  };

  // User data from Firebase
  const user = {
    name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
    email: currentUser.email,
    joinDate: new Date(currentUser.metadata?.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    profileImage: currentUser.photoURL,
    isVerified: currentUser.email?.toLowerCase().endsWith('wisc.edu') ?? false,
  };
  


  const sortLabels = { recent: 'Recently saved', priceLow: 'Price: low to high', priceHigh: 'Price: high to low', moveIn: 'Move-in date' };

  const sortListings = (listings) => {
    if (sortOrder === 'priceLow') return [...listings].sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sortOrder === 'priceHigh') return [...listings].sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sortOrder === 'moveIn') return [...listings].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
    return listings;
  };

  const tabStyle = (isActive) => ({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '0.5rem 1.25rem' : '0.45rem 1.1rem',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '7px',
    color: isActive
      ? (darkMode ? '#f0ebe5' : '#1a1a1a')
      : (darkMode ? '#8a8280' : '#6b6760'),
    fontWeight: isActive ? '600' : '500',
    cursor: 'pointer',
    outline: 'none',
    transition: 'color 0.2s ease',
    fontSize: isMobile ? '0.82rem' : '0.84rem',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
    fontFamily: 'Outfit, sans-serif',
    zIndex: 1,
  });

  const tabLabelStyle = () => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  });

  return (
    <>
    <Seo title="Your Profile" description="Manage your MadLease account, listings, and saved items." path="/profile" noindex />

    {/* Animated background blobs (same as the homepage) */}
    <div className="blob blob-1" style={{
      position: 'fixed', top: '-20%', left: '15%', width: '650px', height: '650px', borderRadius: '50%',
      background: darkMode ? 'rgba(197,5,12,0.09)' : 'rgba(197,5,12,0.10)',
      filter: 'blur(140px)', pointerEvents: 'none', zIndex: 102, willChange: 'transform', display: isMobile ? 'none' : undefined,
    }} />
    <div className="blob blob-2" style={{
      position: 'fixed', top: '0%', left: '-20%', width: '500px', height: '500px', borderRadius: '50%',
      background: 'rgba(197,5,12,0.06)',
      filter: 'blur(120px)', pointerEvents: 'none', zIndex: 102, willChange: 'transform', display: isMobile ? 'none' : undefined,
    }} />
    <div className="blob blob-3" style={{
      position: 'fixed', top: '-10%', right: '-15%', width: '480px', height: '480px', borderRadius: '50%',
      background: 'rgba(197,5,12,0.06)',
      filter: 'blur(125px)', pointerEvents: 'none', zIndex: 102, willChange: 'transform', display: isMobile ? 'none' : undefined,
    }} />
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
    `}</style>

    {/* ═══════════ MOBILE LAYOUT ═══════════ */}
    {isMobile && (
      <div style={{
        minHeight: '100lvh',
        background: darkMode ? 'transparent' : '#faf7f1',
        zIndex: 103,
        fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
        position: 'relative',
        paddingBottom: 0,
      }}>
        {/* Screen-reader live region for copy toast */}
        <div aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          {copiedEmail ? 'Copied to clipboard' : ''}
        </div>

        {/* ── Identity Row ── */}
        <div style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            aria-label={user.isVerified ? 'Verified account' : undefined}
            style={{ position: 'relative', flexShrink: 0, width: '56px', height: '56px' }}
          >
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: user.profileImage ? 'transparent' : 'linear-gradient(135deg, #c0392b 0%, #8e1a12 100%)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: '700', overflow: 'hidden',
            }}>
              {user.profileImage && (
                <img src={user.profileImage} alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              {!user.profileImage && (
                <span>{user.name.includes(' ') ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : user.name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            {user.isVerified ? (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#3fb96b',
                border: `2px solid ${darkMode ? '#0f0e0e' : '#faf7f1'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '18px', height: '18px', borderRadius: '50%',
                background: darkMode ? '#2e2c2b' : '#d0d0d0',
                border: `2px solid ${darkMode ? '#0f0e0e' : '#f5f6f8'}`,
              }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '18px', fontWeight: '600', letterSpacing: '-0.2px',
              color: darkMode ? '#ECECEE' : '#1a1a1a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
            }}>
              {user.name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontSize: '13px', color: darkMode ? 'rgba(236,236,238,0.66)' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {user.email}
              </span>
              <button
                onClick={handleCopyEmail}
                aria-label="Copy email address"
                title={copiedEmail ? 'Copied!' : 'Copy email'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px', margin: '-10px',
                  flexShrink: 0,
                  color: copiedEmail ? '#3fb96b' : (darkMode ? 'rgba(236,236,238,0.45)' : '#888'),
                  display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                }}
              >
                {copiedEmail ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => setEditProfileModalOpen(true)}
            aria-label="Edit profile"
            style={{
              width: '36px', height: '36px', borderRadius: '50%', padding: 0,
              border: `1.5px solid ${darkMode ? 'rgba(236,236,238,0.25)' : 'rgba(0,0,0,0.18)'}`,
              background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              color: darkMode ? 'rgba(236,236,238,0.66)' : '#555',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={darkMode ? 'rgba(236,236,238,0.66)' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
          </button>
        </div>

        {/* ── Stats Strip ── */}
        <div style={{
          margin: '0 18px',
          background: darkMode ? '#1a1918' : '#fff',
          border: `1px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: '12px', padding: '12px 0',
          display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
        }}>
          {[
            { label: 'Saved', value: savedListings.length },
            null,
            { label: 'My listings', value: userListings.filter(l => l.status !== 'COMPLETED').length },
            null,
            { label: 'Conversations', value: conversations.length },
          ].map((col, i) =>
            col === null ? (
              <div key={i} style={{ width: '1px', height: '22px', alignSelf: 'center', background: darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)' }} />
            ) : (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '19px', fontWeight: '700', letterSpacing: '-0.3px', color: darkMode ? '#ECECEE' : '#1a1a1a', lineHeight: 1 }}>{col.value}</span>
                <span style={{ fontSize: '11px', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888', marginTop: '2px' }}>{col.label}</span>
              </div>
            )
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div
          role="tablist"
          style={{
            padding: '22px 18px 0',
            display: 'flex', justifyContent: 'center', gap: '32px',
            borderBottom: darkMode ? '1px solid #2a2826' : 'none',
          }}
        >
          {[
            { id: 'savedListings', label: 'Saved' },
            { id: 'myListings', label: 'My listings' },
            { id: 'messages', label: 'Messages' },
          ].map(({ id, label }) => {
            const isActive = activeTab === id;
            const showUnreadDot = id === 'messages' && totalUnreadCount > 0 && !isActive;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                id={`mobile-tab-${id}`}
                aria-controls={`mobile-panel-${id}`}
                onClick={() => { hasInitializedDefaultTab.current = true; setActiveTab(id); if (id === 'messages') setHasSeenConversations(true); }}
                style={{
                  position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 0 10px',
                  fontSize: '14px', fontWeight: isActive ? '600' : '500',
                  color: isActive ? (darkMode ? '#ECECEE' : '#1a1a1a') : (darkMode ? 'rgba(236,236,238,0.66)' : '#555'),
                  transition: 'color 0.15s', outline: 'none',
                  fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
                {isActive && (
                  <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', borderRadius: 0, background: darkMode ? '#ECECEE' : '#1a1a1a' }} />
                )}
                {showUnreadDot && (
                  <span style={{ position: 'absolute', top: 0, right: '-10px', width: '6px', height: '6px', borderRadius: '50%', background: '#E5322C' }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Saved Listings Panel ── */}
        {activeTab === 'savedListings' && (
          <div
            role="tabpanel"
            id="mobile-panel-savedListings"
            aria-labelledby="mobile-tab-savedListings"
            style={{ padding: '14px 18px 96px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {actionError && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(229,50,44,0.12)', border: '1px solid #E5322C', borderRadius: '8px', color: '#E5322C', fontSize: '0.875rem' }}>
                {actionError}
              </div>
            )}
            {isLoadingSaved ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888', fontSize: '14px' }}>Loading saved listings…</div>
            ) : savedError ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#E5322C', fontSize: '14px' }}>Error loading saved listings. Please try again.</div>
            ) : sortListings(savedListings).length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? 'rgba(236,236,238,0.45)' : '#ccc'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <p style={{ fontSize: '15px', fontWeight: '600', color: darkMode ? '#ECECEE' : '#1a1a1a', margin: '0 0 6px' }}>No saved listings yet</p>
                <p style={{ fontSize: '13px', color: darkMode ? 'rgba(236,236,238,0.66)' : '#666', margin: '0 0 20px', lineHeight: 1.5 }}>Tap the bookmark on any listing to save it for later</p>
                <Link to="/listings" style={{ padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.15)'}`, color: darkMode ? '#ECECEE' : '#1a1a1a', fontSize: '14px', fontWeight: '500' }}>
                  Browse listings
                </Link>
              </div>
            ) : (
              sortListings(savedListings).map(listing => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/listings/${listing.publicId || listing.id}`)}
                  style={{
                    background: darkMode ? '#1a1918' : '#fff',
                    border: `1px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: '12px', padding: '10px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '84px', height: '84px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.1)' : '#eee' }}>
                    {(listing.preSignedGetUrls?.[0] || listing.images?.[0]) ? (
                      <img src={listing.preSignedGetUrls?.[0] || listing.images?.[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${darkMode ? 'rgba(255,255,255,0.1)' : '#e8e8e8'} 0%, ${darkMode ? '#211f1e' : '#d8d8d8'} 100%)` }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: darkMode ? '#ECECEE' : '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {listing.title}
                    </div>
                    {listing.address && (
                      <div style={{ fontSize: '11px', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.address}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '8px', flexWrap: 'nowrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.2px', color: darkMode ? '#ECECEE' : '#1a1a1a', whiteSpace: 'nowrap' }}>
                        ${listing.price}<span style={{ fontSize: '10px', fontWeight: '500', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888' }}>/mo</span>
                      </span>
                      {listing.startDate && listing.endDate && (
                        <>
                          <span style={{ fontSize: '11px', color: darkMode ? 'rgba(236,236,238,0.25)' : '#ccc' }}>·</span>
                          <span style={{ fontSize: '11px', color: darkMode ? 'rgba(236,236,238,0.66)' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {new Date(listing.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(listing.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnsave(listing.id); }}
                    aria-pressed={true}
                    aria-label="Unsave listing"
                    style={{
                      alignSelf: 'center', flexShrink: 0,
                      width: '36px', height: '36px', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: '8px', background: 'transparent',
                      cursor: 'pointer',
                      color: darkMode ? '#ECECEE' : '#333',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={darkMode ? '#ECECEE' : '#333'} stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── My Listings Panel ── */}
        {activeTab === 'myListings' && (
          <div
            role="tabpanel"
            id="mobile-panel-myListings"
            aria-labelledby="mobile-tab-myListings"
            style={{ padding: '14px 18px 96px', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {actionError && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(229,50,44,0.12)', border: '1px solid #E5322C', borderRadius: '8px', color: '#E5322C', fontSize: '0.875rem' }}>
                {actionError}
              </div>
            )}
            {isLoadingUserListings ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888', fontSize: '14px' }}>Loading your listings…</div>
            ) : userListingsError ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#E5322C', fontSize: '14px' }}>Error loading your listings. Please try again.</div>
            ) : userListings.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? 'rgba(236,236,238,0.45)' : '#ccc'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <p style={{ fontSize: '15px', fontWeight: '600', color: darkMode ? '#ECECEE' : '#1a1a1a', margin: '0 0 6px' }}>You haven't posted yet</p>
                <p style={{ fontSize: '13px', color: darkMode ? 'rgba(236,236,238,0.66)' : '#666', margin: 0, lineHeight: 1.5 }}>Create a listing and start subletting your place</p>
              </div>
            ) : (
              sortListings(userListings).map(listing => (
                <div key={listing.id} style={{ display: 'grid', gap: '0.5rem' }}>
                  {listing.status === 'EXPIRED' && (
                    <div style={{
                      borderRadius: '10px',
                      border: `1px solid ${darkMode ? 'rgba(217,106,106,0.35)' : 'rgba(217,106,106,0.4)'}`,
                      background: darkMode ? 'rgba(217,106,106,0.1)' : '#fef2f2',
                      color: darkMode ? '#f2b9b9' : '#9f3a3a',
                      padding: '8px 10px',
                      fontSize: '12px',
                      lineHeight: 1.35,
                    }}>
                      This listing is past its end date. Update it, mark it completed, or remove it.
                    </div>
                  )}
                  <div
                    onClick={() => navigate(`/listings/${listing.id}`)}
                    style={{
                      background: darkMode ? '#1a1918' : '#fff',
                      border: `1px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: '12px', padding: '10px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      cursor: 'pointer', position: 'relative',
                    }}
                  >
                  <div style={{ width: '84px', height: '84px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: darkMode ? 'rgba(255,255,255,0.1)' : '#eee' }}>
                    {(listing.preSignedGetUrls?.[0] || listing.images?.[0]) ? (
                      <img src={listing.preSignedGetUrls?.[0] || listing.images?.[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${darkMode ? 'rgba(255,255,255,0.1)' : '#e8e8e8'} 0%, ${darkMode ? '#211f1e' : '#d8d8d8'} 100%)` }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: darkMode ? '#ECECEE' : '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {listing.title}
                    </div>
                    {listing.address && (
                      <div style={{ fontSize: '11px', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.address}
                      </div>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.2px', color: darkMode ? '#ECECEE' : '#1a1a1a' }}>
                        ${listing.price}<span style={{ fontSize: '10px', fontWeight: '500', color: darkMode ? 'rgba(236,236,238,0.45)' : '#888' }}>/mo</span>
                      </span>
                    </div>
                  </div>
                  {/* Fixed width so the options button lines up across cards, whatever the status badge's width */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', alignSelf: 'flex-start', flexShrink: 0, width: '116px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ position: 'relative' }}>
                      <StatusBadge
                        status={listing.status || 'AVAILABLE'}
                        onClick={listing.status !== 'COMPLETED' ? (e) => { e.stopPropagation(); setOpenStatusDropdownId(id => id === listing.id ? null : listing.id); } : undefined}
                      />
                      {openStatusDropdownId === listing.id && (
                        <StatusDropdown
                          currentStatus={listing.status || 'AVAILABLE'}
                          onSelect={(newStatus) => { handleStatusChange(listing, newStatus); setOpenStatusDropdownId(null); }}
                          style={{ right: 0, left: 'auto', top: '100%', marginTop: '0.25rem' }}
                        />
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMobileListingMenuId(id => id === listing.id ? null : listing.id); }}
                        aria-label="More options"
                        style={{
                          width: '30px', height: '30px', padding: 0,
                          border: `1px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
                          borderRadius: '8px', background: 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: darkMode ? 'rgba(236,236,238,0.66)' : '#555',
                          fontSize: '16px', lineHeight: 1,
                        }}
                      >⋯</button>
                      {openMobileListingMenuId === listing.id && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                          background: darkMode ? '#1a1918' : '#fff',
                          border: `1px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
                          borderRadius: '12px', padding: '4px',
                          boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.55)' : '0 8px 24px rgba(0,0,0,0.1)',
                          zIndex: 100, minWidth: '130px',
                        }}>
                          {listing.status !== 'COMPLETED' && (
                            <Link
                              to={`/listings/${listing.id}/edit`}
                              onClick={() => setOpenMobileListingMenuId(null)}
                              style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', color: darkMode ? '#ECECEE' : '#1a1a1a', textDecoration: 'none', fontSize: '13px', fontWeight: 400 }}
                              onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : '#f5f5f5'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >Edit listing</Link>
                          )}
                          <div style={{ height: '1px', background: darkMode ? 'rgba(255,255,255,0.06)' : '#f0f0f0', margin: '3px 4px' }} />
                          <button
                            onClick={() => { handleDeleteClick(listing); setOpenMobileListingMenuId(null); }}
                            style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', borderRadius: '8px', background: 'transparent', color: '#e07060', cursor: 'pointer', fontSize: '13px', textAlign: 'left', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : '#f5f5f5'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Messages Panel ── */}
        {activeTab === 'messages' && (
          <div
            role="tabpanel"
            id="mobile-panel-messages"
            aria-labelledby="mobile-tab-messages"
            style={{ padding: '14px 0 0', width: '100%', overflow: 'hidden' }}
          >
            <ConversationList embedded={true} />
          </div>
        )}

        {/* ── Sticky CTA ── */}
        {activeTab !== 'messages' && (
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0,
            padding: `12px 18px max(28px, env(safe-area-inset-bottom))`,
            pointerEvents: 'none',
            background: darkMode ? 'linear-gradient(to bottom, transparent 0%, #0f0e0e 55%)' : 'linear-gradient(to bottom, transparent 0%, #faf7f1 55%)',
            zIndex: 10,
          }}>
            <button
              onClick={() => setShowMobileTypeChooser(true)}
              style={{
                width: '100%', pointerEvents: 'auto',
                background: '#E5322C', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '14px 18px',
                fontSize: '15px', fontWeight: '600',
                boxShadow: '0 8px 22px -8px rgba(229,50,44,0.5)',
                cursor: 'pointer',
                fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
              }}
            >
              + Create new listing
            </button>
          </div>
        )}

        {/* ── Type Chooser Bottom Sheet ── */}
        {showMobileTypeChooser && (
          <>
            <div onClick={() => setShowMobileTypeChooser(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
            <div style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
              background: darkMode ? '#1a1918' : '#fff',
              borderRadius: '20px 20px 0 0',
              padding: `20px 18px max(28px, env(safe-area-inset-bottom))`,
            }}>
              <p style={{ fontSize: '16px', fontWeight: '600', color: darkMode ? '#ECECEE' : '#1a1a1a', margin: '0 0 16px', textAlign: 'center', fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                What are you listing?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { type: 'HOUSING', label: 'Housing' },
                  { type: 'BOTH', label: 'Housing + Parking' },
                  { type: 'PARKING', label: 'Parking' },
                ].map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => { navigate(`/listings/new?type=${type}`); setShowMobileTypeChooser(false); }}
                    style={{
                      width: '100%', padding: '14px', borderRadius: '12px',
                      border: `1.5px solid ${darkMode ? '#2a2826' : 'rgba(0,0,0,0.08)'}`,
                      background: 'transparent', color: darkMode ? '#ECECEE' : '#1a1a1a',
                      fontSize: '15px', fontWeight: '600', cursor: 'pointer',
                      fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowMobileTypeChooser(false)}
                style={{ width: '100%', marginTop: '12px', padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: darkMode ? 'rgba(236,236,238,0.66)' : '#555', fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        <EditProfileModal isOpen={editProfileModalOpen} onClose={() => setEditProfileModalOpen(false)} />
      </div>
    )}

    {/* ═══════════ DESKTOP LAYOUT ═══════════ */}
    {!isMobile && (<div style={{
      position: 'relative',
      zIndex: 103,
      paddingBottom: 0,
      paddingTop: isMobile ? '0.75rem' : isTabletLandscape ? '0.5rem' : '2rem',
      paddingLeft: isMobile ? '0.75rem' : '2rem',
      paddingRight: isMobile ? '0.75rem' : '2rem',
      width: '100%',
      maxWidth: isMobile ? undefined : 'min(1400px, 92vw)',
      marginLeft: isMobile ? undefined : 'auto',
      marginRight: isMobile ? undefined : 'auto',
      marginTop: 0,
      boxSizing: 'border-box',
      minHeight: isMobile ? '100lvh' : 0,
      height: isMobile ? 'auto' : '100%',
      maxHeight: isMobile ? undefined : '100%',
      overflow: 'visible',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? undefined : (isNarrowDesktopTabs ? '1rem' : '2rem'),
      alignItems: isMobile ? undefined : 'flex-start',
    }}>
      {/* Header card */}
      <div style={{
        backgroundColor: darkMode ? '#171514' : 'white',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#d8d4ce'}`,
        borderRadius: '12px',
        padding: isMobile ? '0.65rem 1rem' : isTabletLandscape ? '1rem 1.75rem' : (isNarrowDesktopTabs ? '1.2rem' : '1.75rem'),
        marginBottom: isMobile ? '0.5rem' : 0,
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.25)' : '0 2px 16px rgba(0,0,0,0.10)',
        width: isMobile ? 'calc(100% - 1.5rem)' : (isNarrowDesktopTabs ? '250px' : '320px'),
        flexShrink: 0,
        alignSelf: isMobile ? 'center' : 'flex-start',
        position: isMobile ? undefined : 'sticky',
        top: isMobile ? undefined : '0',
        marginTop: isMobile ? undefined : (isTabletLandscape ? '1rem' : '3.25rem'),
        zoom: isTabletLandscape ? 0.85 : 1,
        maxHeight: isTabletLandscape ? 'calc(100dvh - 3.5rem)' : undefined,
        overflowY: isTabletLandscape ? 'auto' : undefined,
      }}>
        {isMobile ? (
          <>
            {/* Compact row — always visible, tap to expand */}
            <div
              onClick={() => setProfileExpanded(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ position: 'relative', flexShrink: 0, width: '36px', height: '36px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  backgroundColor: '#c0392b', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: '700', overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 0 0 2px ' + (darkMode ? 'rgba(255,255,255,0.1)' : '#d8d4ce'),
                }}>
                  {user.profileImage ? (
                    <img src={user.profileImage} alt="Profile"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      onLoad={(e) => { e.target.parentElement.style.backgroundColor = 'transparent'; }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : null}
                  <span style={{
                    position: user.profileImage ? 'absolute' : 'static',
                    top: user.profileImage ? '50%' : 'auto', left: user.profileImage ? '50%' : 'auto',
                    transform: user.profileImage ? 'translate(-50%, -50%)' : 'none',
                    zIndex: user.profileImage ? '-1' : '1',
                  }}>
                    {user.name.includes(' ') ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : user.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                {user.isVerified && (
                  <span title="Verified UW-Madison Student" style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 16, height: 16, borderRadius: '50%',
                    backgroundColor: darkMode ? '#171514' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#c5050c" stroke="none">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </span>
                )}
              </div>
              <span style={{ flex: 1, fontWeight: '700', fontSize: '1rem', color: darkMode ? '#e0e0e0' : '#1a1a1a', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '4px', marginTop: '2px' }}>
                {user.name}
              </span>
              <motion.svg
                animate={{ rotate: profileExpanded ? 180 : 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={darkMode ? '#555' : '#7a7570'} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </motion.svg>
            </div>

            <AnimatePresence initial={false}>
              {profileExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ paddingTop: '1rem', marginTop: '1rem', borderTop: `1px solid ${darkMode ? '#2a2826' : '#d8d4ce'}`, textAlign: 'center' }}>
                    {editMode ? (
                      <form onSubmit={handleFormSubmit}>
                        <div style={{ marginBottom: '0.75rem', textAlign: 'left' }}>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', color: darkMode ? '#888' : '#666' }}>Name</label>
                          <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                            style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', boxSizing: 'border-box', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#ccc'}`, backgroundColor: darkMode ? '#1a1918' : '#f9f9f9', color: darkMode ? 'white' : 'black', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div style={{ marginBottom: '0.75rem', textAlign: 'left' }}>
                          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.8rem', color: darkMode ? '#888' : '#666' }}>Profile Picture</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#c0392b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', overflow: 'hidden', flexShrink: 0 }}>
                              {(profilePicturePreview || user.profileImage) ? (
                                <img src={profilePicturePreview || user.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                              ) : user.name.substring(0, 2).toUpperCase()}
                            </div>
                            <input ref={fileInputRef} type="file" name="profilePicture" accept="image/*" onChange={handleInputChange} style={{ display: 'none' }} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: `1px solid ${darkMode ? '#555' : '#ccc'}`, backgroundColor: 'transparent', color: darkMode ? '#ccc' : '#444', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              ↑ Choose Photo
                            </button>
                            {formData.profilePicture && <span style={{ fontSize: '0.75rem', color: 'var(--badger-red)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.profilePicture.name}</span>}
                          </div>
                        </div>
                        {updateMessage && (
                          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', backgroundColor: updateMessage.includes('Error') ? '#fee' : '#efe', color: updateMessage.includes('Error') ? '#c33' : '#363', fontSize: '0.8rem' }}>
                            {updateMessage}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button type="submit" disabled={isUpdating} style={{ flex: 1, maxWidth: '120px', backgroundColor: isUpdating ? '#ccc' : 'var(--badger-red)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', cursor: isUpdating ? 'not-allowed' : 'pointer' }}>
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" onClick={handleCancelEdit} style={{ flex: 1, maxWidth: '120px', backgroundColor: 'transparent', color: darkMode ? '#ccc' : '#555', border: `1px solid ${darkMode ? '#444' : '#ddd'}`, borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
                          <p style={{ margin: 0, color: darkMode ? '#888' : '#666', fontSize: '0.875rem' }}>{user.email}</p>
                          <button onClick={handleCopyEmail} title={copiedEmail ? 'Copied!' : 'Copy email'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', color: copiedEmail ? '#22c55e' : (darkMode ? '#555' : '#ccc'), display: 'flex', alignItems: 'center', transition: 'color 0.15s ease' }}>
                            {copiedEmail ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            )}
                          </button>
                        </div>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.775rem', color: darkMode ? '#555' : '#7a7570' }}>Member since {user.joinDate}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => { setEditMode(true); setProfileExpanded(true); }} style={{ flex: 1, maxWidth: '120px', backgroundColor: 'var(--badger-red)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                            Edit Profile
                          </button>
                          <button onClick={handleLogout} style={{ flex: 1, maxWidth: '120px', backgroundColor: 'transparent', color: darkMode ? '#ccc' : '#555', border: `1px solid ${darkMode ? '#444' : '#ddd'}`, borderRadius: '8px', padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                            Log Out
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%',
                backgroundColor: '#c0392b', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.75rem', fontWeight: '700', overflow: 'hidden',
                position: 'relative',
                boxShadow: `0 0 0 3px ${darkMode ? '#171514' : '#faf7f1'}, 0 0 0 5px ${darkMode ? 'rgba(255,255,255,0.1)' : '#7a7672'}`,
              }}>
                {user.profileImage ? (
                  <img src={user.profileImage} alt="Profile"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onLoad={(e) => { e.target.parentElement.style.backgroundColor = 'transparent'; }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : null}
                <span style={{
                  position: user.profileImage ? 'absolute' : 'static',
                  top: user.profileImage ? '50%' : 'auto', left: user.profileImage ? '50%' : 'auto',
                  transform: user.profileImage ? 'translate(-50%, -50%)' : 'none',
                  zIndex: user.profileImage ? '-1' : '1',
                }}>
                  {user.name.includes(' ') ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : user.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              {user.isVerified && (
                <span title="Verified UW-Madison Student" style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 30, height: 30, borderRadius: '50%',
                  backgroundColor: darkMode ? '#171514' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#c5050c" stroke="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </span>
              )}
            </div>

            {/* Name */}
            <h2 style={{ margin: '0 0 0.4rem', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontSize: '1.35rem', fontWeight: '700', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {user.name}
            </h2>

            {/* Email + copy */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: 0, color: darkMode ? '#8a8280' : '#666', fontSize: '0.825rem', wordBreak: 'break-all' }}>{user.email}</p>
              <button onClick={handleCopyEmail} title={copiedEmail ? 'Copied!' : 'Copy email'} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: '4px', flexShrink: 0,
                color: copiedEmail ? '#22c55e' : (darkMode ? '#524e4c' : '#ccc'), display: 'flex', alignItems: 'center', transition: 'color 0.15s ease',
              }}>
                {copiedEmail ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            </div>

            {/* Edit Profile button */}
            <button onClick={() => setEditMode(!editMode)} style={{
              backgroundColor: 'transparent',
              color: darkMode ? '#f0ebe5' : '#333',
              border: `1px solid ${darkMode ? '#3a3633' : '#ddd'}`,
              borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer', width: '100%',
              marginBottom: '1.5rem',
              transition: 'border-color 0.15s ease',
            }}>
              {editMode ? 'Cancel Editing' : 'Edit Profile'}
            </button>

            {/* Info block */}
            <div style={{ width: '100%', height: '1px', backgroundColor: darkMode ? '#2a2826' : '#d8d4ce', marginBottom: '1.25rem' }} />

            {/* Crossfade replacement (no reserved blank space) */}
            <div style={{ width: '100%', marginBottom: '1.25rem' }}>
              <motion.div
                initial={false}
                animate={{
                  opacity: showCreateOptionsSidebar ? 0 : 1,
                  height: showCreateOptionsSidebar ? 0 : 'auto',
                }}
                transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.9rem',
                  pointerEvents: showCreateOptionsSidebar ? 'none' : 'auto',
                  willChange: 'opacity,height',
                }}
              >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#524e4c' : '#7a7570'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: '0.825rem', color: darkMode ? '#8a8280' : '#888' }}>Status</span>
                    <span style={{ fontSize: '0.825rem', fontWeight: '500', color: user.isVerified ? '#22c55e' : (darkMode ? '#8a8280' : '#888') }}>
                      {user.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#524e4c' : '#7a7570'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: '0.825rem', color: darkMode ? '#8a8280' : '#888' }}>Member since</span>
                    <span style={{ fontSize: '0.825rem', fontWeight: '500', color: darkMode ? '#f0ebe5' : '#333' }}>{user.joinDate}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#524e4c' : '#7a7570'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: '0.825rem', color: darkMode ? '#8a8280' : '#888' }}>Active listings</span>
                    <span style={{ fontSize: '0.825rem', fontWeight: '500', color: darkMode ? '#f0ebe5' : '#333' }}>
                      {userListings.filter(l => l.status !== 'COMPLETED').length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#524e4c' : '#7a7570'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: '0.825rem', color: darkMode ? '#8a8280' : '#888' }}>Saved</span>
                    <span style={{ fontSize: '0.825rem', fontWeight: '500', color: darkMode ? '#f0ebe5' : '#333' }}>
                      {savedListings.length}
                    </span>
                  </div>
              </motion.div>

              <motion.div
                initial={false}
                animate={{
                  opacity: showCreateOptionsSidebar ? 1 : 0,
                  height: showCreateOptionsSidebar ? 'auto' : 0,
                }}
                transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.6rem',
                  pointerEvents: showCreateOptionsSidebar ? 'auto' : 'none',
                  willChange: 'opacity,height',
                }}
              >
                <p style={{
                  fontSize: '0.825rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#333',
                  fontFamily: 'Outfit, sans-serif', margin: 0,
                }}>
                  What are you listing?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
                  {[
                    { value: 'HOUSING', label: 'Housing' },
                    { value: 'BOTH', label: 'Housing + Parking' },
                    { value: 'PARKING', label: 'Parking' },
                  ].map(({ value, label }) => (
                    <motion.button
                      key={value}
                      type="button"
                      onClick={() => navigate(`/listings/new?type=${value}`)}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '92%',
                        margin: '0 auto',
                        maxWidth: '240px',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                        backgroundColor: 'transparent',
                        color: darkMode ? '#f0ebe5' : '#333',
                        cursor: 'pointer',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        fontFamily: 'Outfit, sans-serif',
                        transition: 'all 0.15s ease',
                        outline: 'none',
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
                    </motion.button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCreateOptionsSidebar(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.7rem', fontFamily: 'Outfit, sans-serif',
                    color: darkMode ? '#524e4c' : '#7a7570',
                    transition: 'color 0.15s ease', padding: 0,
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#8a8280' : '#888'}
                  onMouseLeave={e => e.currentTarget.style.color = darkMode ? '#524e4c' : '#7a7570'}
                >
                  Cancel
                </button>
              </motion.div>
            </div>

            <div style={{ width: '100%', height: '1px', backgroundColor: darkMode ? '#2a2826' : '#d8d4ce', marginBottom: '1.25rem' }} />

            {/* Bottom actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
              {!showCreateOptionsSidebar && (
                <button
                  onClick={() => setShowCreateOptionsSidebar(true)}
                  style={{
                    display: 'block', textAlign: 'center',
                    backgroundColor: 'var(--badger-red)', color: 'white',
                    borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.875rem', fontWeight: '600',
                    transition: 'opacity 0.15s ease', width: '100%', boxSizing: 'border-box',
                    border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  Create New Listing
                </button>
              )}
              <button onClick={handleLogout} style={{
                backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#999',
                border: 'none', borderRadius: '8px',
                padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', width: '100%',
                transition: 'color 0.15s ease',
              }}>
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Main content area */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: isMobile ? 'auto' : 0, overflow: 'visible', flex: 1, minWidth: 0, alignSelf: isMobile ? undefined : 'stretch', paddingBottom: 0, paddingTop: 0, position: 'relative', zIndex: 1 }}>
        {(!isMobile && editMode) ? (
          <div style={{
            backgroundColor: darkMode ? '#171514' : 'white',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#d8d4ce'}`,
            borderRadius: '12px',
            padding: isMobile ? '1.25rem' : '1.5rem',
            boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,0.25)' : '0 2px 16px rgba(0,0,0,0.10)',
            color: darkMode ? '#e0e0e0' : '#1a1a1a',
            marginTop: isTabletLandscape ? '1rem' : '3.75rem',
          }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '700' }}>Edit Profile</h2>
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#ccc'}`,
                    backgroundColor: darkMode ? '#171514' : 'white',
                    color: darkMode ? 'white' : 'black'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Email
                </label>
                <div style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#ccc'}`,
                  backgroundColor: darkMode ? '#211f1e' : '#f5f5f5',
                  color: darkMode ? '#aaa' : '#666',
                  fontSize: '0.9rem'
                }}>
                  {currentUser?.email}
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: darkMode ? '#666' : '#999',
                    marginLeft: '0.5rem'
                  }}>
                    (managed by Google)
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                  Profile Picture
                </label>
                
                {/* Inline layout: profile picture preview + file input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  {/* Current profile picture or preview */}
                  <div style={{ 
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#c0392b',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0,
                    border: '2px solid white',
                    transition: 'all 0.2s ease'
                  }}>
                    {(profilePicturePreview || user.profileImage) ? (
                      <img 
                        src={profilePicturePreview || user.profileImage} 
                        alt="Profile Preview" 
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
                        }}
                      />
                    ) : null}
                    {/* Always show initials as fallback */}
                    <span style={{
                      position: (profilePicturePreview || user.profileImage) ? 'absolute' : 'static',
                      top: (profilePicturePreview || user.profileImage) ? '50%' : 'auto',
                      left: (profilePicturePreview || user.profileImage) ? '50%' : 'auto',
                      transform: (profilePicturePreview || user.profileImage) ? 'translate(-50%, -50%)' : 'none',
                      zIndex: (profilePicturePreview || user.profileImage) ? '-1' : '1'
                    }}>
                      {user.name.includes(' ') ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : user.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  
                  {/* File input — hidden, triggered by styled button */}
                  <div style={{ flex: 1 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      name="profilePicture"
                      accept="image/*"
                      onChange={handleInputChange}
                      style={{ display: 'none' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '6px',
                          border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
                          backgroundColor: 'transparent',
                          color: darkMode ? '#ccc' : '#444',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        ↑ Choose Photo
                      </button>
                      <span style={{
                        fontSize: '0.8rem',
                        color: formData.profilePicture ? 'var(--badger-red)' : (darkMode ? '#666' : '#999'),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '160px'
                      }}>
                        {formData.profilePicture ? formData.profilePicture.name : 'No file chosen'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <p style={{ fontSize: '0.875rem', color: darkMode ? '#aaa' : '#666', margin: 0 }}>
                  Supported formats: JPG, PNG, GIF (max 5MB). Leave empty to keep current picture.
                </p>
              </div>

              {updateMessage && (
                <div style={{ 
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  backgroundColor: updateMessage.includes('Error') ? '#fee' : '#efe',
                  color: updateMessage.includes('Error') ? '#c33' : '#363',
                  border: `1px solid ${updateMessage.includes('Error') ? '#faa' : '#afa'}`
                }}>
                  {updateMessage}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="submit"
                  disabled={isUpdating}
                  style={{
                    backgroundColor: isUpdating ? '#ccc' : 'var(--badger-red)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    backgroundColor: 'transparent',
                    color: darkMode ? '#ccc' : '#555',
                    border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                    borderRadius: '8px',
                    padding: '0.55rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>

              <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: `1px solid ${darkMode ? '#2a2826' : '#f0f0f0'}`, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setDeleteAccountModalOpen(true)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: darkMode ? '#6b4040' : '#c4a0a0',
                    fontSize: '0.8rem', fontWeight: '400',
                    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#c87171' : '#b91c1c'}
                  onMouseLeave={e => e.currentTarget.style.color = darkMode ? '#6b4040' : '#c4a0a0'}
                >
                  Delete account
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: 0,
            boxShadow: 'none',
            paddingBottom: 0,
            paddingTop: isMobile ? 0 : isTabletLandscape ? '0.5rem' : '2rem',
          }}>
            {/* Your activity heading (desktop only) */}
            {!isMobile && (
              <div style={{ marginBottom: '16px', flexShrink: 0, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 600, letterSpacing: '-0.4px', color: darkMode ? '#ECECEE' : '#1a1a1a' }}>
                  Your activity
                </h2>
                <p style={{ margin: '5px 0 0', fontSize: '15px', color: darkMode ? 'rgba(236,236,238,0.42)' : '#888' }}>
                  Saved listings, your own posts, and messages from renters
                </p>
              </div>
            )}

            {/* Tabs + Sort row — desktop underline style, mobile pill style */}
            {isMobile ? (
              <div className="profile-tabs" style={{
                display: 'flex', position: 'relative', gap: '3px', whiteSpace: 'nowrap',
                padding: '3px', backgroundColor: darkMode ? '#1a1918' : '#f0f0f0',
                borderRadius: '10px', width: 'fit-content', marginTop: '0.35rem', marginBottom: 0, flexShrink: 0, alignSelf: 'center',
              }}>
                {(hideMessagesTab ? ['savedListings', 'myListings'] : ['savedListings', 'myListings', 'messages']).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { hasInitializedDefaultTab.current = true; setActiveTab(tab); if (tab === 'messages') setHasSeenConversations(true); }}
                    style={{ ...tabStyle(activeTab === tab), flex: 'none', justifyContent: 'center', position: 'relative' }}
                  >
                    {activeTab === tab && (
                      <motion.div layoutId="activeTabPill" style={{ position: 'absolute', inset: 0, borderRadius: '7px', backgroundColor: darkMode ? '#2a2826' : '#fff', boxShadow: darkMode ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)', zIndex: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    )}
                    <span style={tabLabelStyle()}>
                      {tab === 'savedListings' ? 'Saved Listings' : tab === 'myListings' ? 'My Listings' : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          Messages
                          {totalUnreadCount > 0 && <span style={{ backgroundColor: 'var(--badger-red)', color: 'white', borderRadius: '50px', minWidth: '18px', height: '18px', padding: '0 5px', fontSize: '0.7rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxSizing: 'border-box' }}>{totalUnreadCount > 99 ? '99+' : totalUnreadCount}</span>}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
              <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                {(hideMessagesTab ? ['savedListings', 'myListings'] : ['savedListings', 'myListings', 'messages']).map((tab) => {
                  const isActive = activeTab === tab;
                  const count = tab === 'savedListings' ? savedListings.length : tab === 'myListings' ? userListings.length : conversations.length;
                  const hasUnreadDot = tab === 'messages' && totalUnreadCount > 0 && !isActive;
                  return (
                    <button
                      key={tab}
                      onClick={() => { hasInitializedDefaultTab.current = true; setActiveTab(tab); if (tab === 'messages') setHasSeenConversations(true); }}
                      style={{
                        background: 'transparent', border: 'none', borderRadius: 0,
                        borderBottom: '2px solid transparent',
                        color: isActive ? (darkMode ? '#ECECEE' : '#1a1a1a') : (darkMode ? 'rgba(236,236,238,0.62)' : '#6b6760'),
                        fontSize: '14px', fontWeight: isActive ? 600 : 500,
                        padding: '12px 6px', marginRight: '18px', marginBottom: '-1px',
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        cursor: 'pointer', outline: 'none', fontFamily: 'Outfit, sans-serif',
                        transition: 'color 0.15s', whiteSpace: 'nowrap',
                        position: 'relative',
                      }}
                    >
                      {tab === 'savedListings' ? 'Saved' : tab === 'myListings' ? 'My listings' : 'Messages'}
                      <span style={{
                        position: 'relative',
                        backgroundColor: isActive ? (darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)') : 'transparent',
                        color: isActive ? (darkMode ? '#ECECEE' : '#1a1a1a') : (darkMode ? 'rgba(236,236,238,0.42)' : '#777'),
                        fontSize: '11px', fontWeight: 600,
                        padding: isActive ? '2px 7px' : '0', borderRadius: isActive ? '999px' : '0',
                      }}>
                        {count}
                        {hasUnreadDot && (
                          <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#E5322C' }} />
                        )}
                      </span>
                      {isActive && (
                        <span style={{ position: 'absolute', bottom: '-1px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 8px)', height: '2px', backgroundColor: darkMode ? '#ECECEE' : '#1a1a1a', borderRadius: '1px' }} />
                      )}
                    </button>
                  );
                })}
                {activeTab === 'savedListings' && !isTabletPortrait && (
                  <div style={{ position: 'relative', alignSelf: 'center', marginLeft: 'auto', marginBottom: '0' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setSortDropdownOpen(o => !o)}
                      style={{
                        background: 'transparent', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'}`,
                        color: darkMode ? 'rgba(236,236,238,0.62)' : '#555', padding: '6px 12px', borderRadius: '8px',
                        fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      Sort: {sortLabels[sortOrder]}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sortDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {sortDropdownOpen && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, backgroundColor: darkMode ? '#1a1918' : '#fff', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e4e4e7'}`, borderRadius: '12px', padding: '4px', boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.55)' : '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '190px' }}>
                        {Object.entries(sortLabels).map(([key, label]) => (
                          <button
                            key={key}
                            onClick={() => { setSortOrder(key); setSortDropdownOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: sortOrder === key ? (darkMode ? '#ECECEE' : '#1a1a1a') : (darkMode ? 'rgba(236,236,238,0.62)' : '#555'), cursor: 'pointer', fontSize: '13px', fontWeight: sortOrder === key ? 500 : 400, fontFamily: 'Outfit, sans-serif' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : '#f5f5f5'; e.currentTarget.style.color = darkMode ? '#ECECEE' : '#1a1a1a'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = sortOrder === key ? (darkMode ? '#ECECEE' : '#1a1a1a') : (darkMode ? 'rgba(236,236,238,0.62)' : '#555'); }}
                          >
                            {label}
                            {sortOrder === key && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#ECECEE' : '#1a1a1a'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ height: '1px', backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)', margin: '0 1.25rem 18px' }} />
              </>
            )}

            {/* Action Error */}
            {actionError && (
              <div style={{
                padding: '0.75rem 1rem',
                margin: isMobile ? '0.75rem 0.75rem 0' : '1rem 1.25rem 0',
                backgroundColor: 'rgba(197, 5, 12, 0.1)',
                border: '1px solid var(--badger-red)',
                borderRadius: '8px',
                color: 'var(--badger-red)',
                fontSize: '0.9rem',
                flexShrink: 0,
              }}>
                {actionError}
              </div>
            )}

            {/* Tab content */}
            <div className="profile-tab-content" style={{ flex: isMobile ? 'unset' : 1, minHeight: isMobile ? 'auto' : 0, overflowY: isMobile ? 'visible' : 'auto', paddingTop: isMobile ? '0.4rem' : '6px', paddingLeft: isMobile ? '0.75rem' : '1.25rem', paddingRight: isMobile ? '0.75rem' : '1.25rem', paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '2rem' }}>
              {/* My Listings Tab */}
              {activeTab === 'myListings' && (
                <div>

                  {isLoadingUserListings ? (
                    <div style={{ 
                      backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px var(--shadow-color)'
                    }}>
                      <p>Loading your listings...</p>
                    </div>
                  ) : userListingsError ? (
                    <div style={{ 
                      backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px var(--shadow-color)'
                    }}>
                      <p style={{ color: 'var(--badger-red)' }}>Error loading your listings</p>
                      <p style={{ fontSize: '0.9rem', color: darkMode ? '#ccc' : '#666' }}>
                        {userListingsError.message.includes('401') || userListingsError.message.includes('Unauthorized') 
                          ? 'Authentication error. Please try signing out and back in.'
                          : 'Please try refreshing the page'
                        }
                      </p>
                      <p style={{ fontSize: '0.8rem', color: darkMode ? '#999' : '#888', fontFamily: 'monospace' }}>
                        Error: {userListingsError.message}
                      </p>
                    </div>
                  ) : userListings.length === 0 ? (
                    <div style={{
                      backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                      borderRadius: '8px',
                      padding: '4rem 2rem',
                      textAlign: 'center',
                      boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35), 0 1px 6px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.08), 0 1px 6px rgba(0,0,0,0.05)',
                      position: 'relative',
                      minHeight: '320px',
                    }}>
                      {/* Keep the + icon stable; only swap the content below it */}
                      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center', color: darkMode ? '#444' : '#ccc' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <line x1="12" y1="8" x2="12" y2="16"/>
                          <line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                      </div>

                      {/* Default content stays in-flow to define card height */}
                      <div style={{
                        opacity: showCreateOptionsEmpty ? 0 : 1,
                        transition: 'opacity 0.12s ease-out',
                        pointerEvents: showCreateOptionsEmpty ? 'none' : 'auto',
                      }}>
                        <p style={{ marginBottom: '0.4rem', fontSize: '0.95rem', fontWeight: '600' }}>
                          You haven't created any listings yet.
                        </p>
                        <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: darkMode ? '#6a6664' : '#999' }}>
                          Create a listing and start subletting your place.
                        </p>
                        <button
                          onClick={() => setShowCreateOptionsEmpty(true)}
                          style={{
                            backgroundColor: 'var(--badger-red)',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            fontFamily: 'Outfit, sans-serif',
                            lineHeight: 1.2,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxSizing: 'border-box',
                            WebkitAppearance: 'none',
                            appearance: 'none',
                          }}
                        >
                          Create New Listing
                        </button>
                      </div>

                      {/* Options overlay: does not affect outer box size */}
                      {showCreateOptionsEmpty && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 0,
                          bottom: 0,
                          paddingLeft: '2rem',
                          paddingRight: '2rem',
                          paddingBottom: '4rem',
                          // Match the card padding, then start content under the fixed + icon
                          paddingTop: 'calc(4rem + 48px + 0.75rem)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: '1rem',
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                            <p style={{
                              fontSize: '0.95rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#333',
                              fontFamily: 'Outfit, sans-serif', margin: 0,
                            }}>
                              What are you listing?
                            </p>
                            <p style={{
                              margin: 0,
                              fontSize: '0.8rem',
                              color: darkMode ? '#8a8280' : '#999',
                              fontFamily: 'Outfit, sans-serif',
                              lineHeight: 1.2,
                              textAlign: 'center',
                            }}>
                              Choose one to start your listing.
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[
                              { value: 'HOUSING', label: 'Housing' },
                              { value: 'BOTH', label: 'Housing + Parking' },
                              { value: 'PARKING', label: 'Parking' },
                            ].map(({ value, label }) => (
                              <motion.button
                                key={value}
                                type="button"
                                onClick={() => navigate(`/listings/new?type=${value}`)}
                                whileTap={{ scale: 0.96 }}
                                style={{
                                  padding: '0.55rem 1.15rem',
                                  borderRadius: '8px',
                                  border: `1.5px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                                  backgroundColor: 'transparent',
                                  color: darkMode ? '#f0ebe5' : '#333',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  fontFamily: 'Outfit, sans-serif',
                                  transition: 'all 0.15s ease',
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
                              </motion.button>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowCreateOptionsEmpty(false)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '0.75rem', fontFamily: 'Outfit, sans-serif',
                              color: darkMode ? '#524e4c' : '#7a7570',
                              transition: 'color 0.15s ease', padding: 0,
                              outline: 'none', boxShadow: 'none',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = darkMode ? '#8a8280' : '#888'}
                            onMouseLeave={e => e.currentTarget.style.color = darkMode ? '#524e4c' : '#7a7570'}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {sortListings(userListings).map(listing => (
                        <div key={listing.id} style={{ display: 'grid', gap: '0.5rem', position: 'relative', zIndex: openCardMenuId === `my-${listing.id}` ? 10 : undefined }}>
                          {listing.status === 'EXPIRED' && (
                            <div style={{
                              borderRadius: '10px',
                              border: `1px solid ${darkMode ? 'rgba(217,106,106,0.35)' : 'rgba(217,106,106,0.4)'}`,
                              background: darkMode ? 'rgba(217,106,106,0.1)' : '#fef2f2',
                              color: darkMode ? '#f2b9b9' : '#9f3a3a',
                              padding: '9px 11px',
                              fontSize: '12px',
                              lineHeight: 1.35,
                            }}>
                              This listing is past its end date. Update it, mark it completed, or remove it.
                            </div>
                          )}
                          <div
                            className="profile-listing-card"
                            style={{
                              backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                              borderRadius: '10px',
                              border: `1px solid ${darkMode ? '#2e2c2b' : '#e8e8e8'}`,
                              padding: useCompactMyListingsLayout ? '0.85rem' : '12px 1.25rem',
                              boxShadow: darkMode
                                ? '0 2px 8px rgba(0,0,0,0.2)'
                                : '0 2px 8px rgba(0,0,0,0.07)',
                              display: 'flex',
                              gap: '1rem',
                              alignItems: useCompactMyListingsLayout ? 'flex-start' : 'center',
                              flexDirection: useCompactMyListingsLayout ? 'column' : 'row',
                              minWidth: 0,
                              position: 'relative',
                            }}
                          >
                          {/* Image Preview */}
                          <div style={{
                            width: useCompactMyListingsLayout ? '100%' : '120px',
                            height: useCompactMyListingsLayout ? '90px' : '100px',
                            borderRadius: '7px',
                            overflow: 'hidden',
                            backgroundColor: darkMode ? '#2a2826' : '#f5f5f5',
                            flexShrink: 0,
                            maxWidth: useCompactMyListingsLayout ? '100%' : '120px'
                          }}>
                            {(listing.preSignedGetUrls && listing.preSignedGetUrls.length > 0) || (listing.images && listing.images.length > 0) ? (
                              <img
                                src={(listing.preSignedGetUrls && listing.preSignedGetUrls[0]) || (listing.images && listing.images[0])}
                                alt={listing.title}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: darkMode ? '#444' : '#ccc',
                              }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, width: '100%', opacity: listing.status === 'COMPLETED' ? 0.5 : 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                              <h3 style={{
                                flex: 1,
                                margin: 0,
                                color: darkMode ? 'white' : 'black',
                                fontSize: useCompactMyListingsLayout ? '1.05rem' : '1rem',
                                lineHeight: '1.3',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                <Link
                                  to={`/listings/${listing.id}`}
                                  style={{ color: darkMode ? 'white' : 'black', textDecoration: 'none' }}
                                >
                                  {listing.title}
                                </Link>
                              </h3>
                              {useCompactMyListingsLayout && (
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                  <StatusBadge
                                    status={listing.status || 'AVAILABLE'}
                                    onClick={listing.status !== 'COMPLETED' ? (e) => { e.stopPropagation(); setOpenStatusDropdownId(id => id === listing.id ? null : listing.id); } : undefined}
                                  />
                                  {openStatusDropdownId === listing.id && (
                                    <StatusDropdown
                                      currentStatus={listing.status || 'AVAILABLE'}
                                      onSelect={(newStatus) => { handleStatusChange(listing, newStatus); setOpenStatusDropdownId(null); }}
                                      style={{ right: 0, left: 'auto', top: '100%', marginTop: '0.25rem' }}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                            <p style={{ margin: '0 0 0.1rem', fontSize: useCompactMyListingsLayout ? '0.95rem' : '0.9rem', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontWeight: '600' }}>
                              ${listing.price}/mo
                            </p>
                            {listing.startDate && listing.endDate && (
                              <p style={{ margin: 0, fontSize: '0.825rem', color: darkMode ? '#8a8280' : '#5a5550' }}>
                                  {new Date(listing.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(listing.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                            {!useCompactMyListingsLayout && listing.address && (
                              <p style={{ fontSize: '0.775rem', color: darkMode ? '#524e4c' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {listing.address}
                              </p>
                            )}
                          </div>
                          {useCompactMyListingsLayout ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginTop: '0.1rem', alignSelf: 'stretch' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                {listing.status !== 'COMPLETED' && (
                                  <Link to={`/listings/${listing.id}/edit`} style={{ flex: 1, padding: '0.5rem 1rem', backgroundColor: 'var(--badger-red)', color: 'white', textDecoration: 'none', borderRadius: '6px', fontSize: '0.875rem', textAlign: 'center' }}>Edit</Link>
                                )}
                                <button onClick={() => handleDeleteClick(listing)} style={{ flex: 1, padding: '0.5rem 1rem', backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#999', border: `1px solid ${darkMode ? '#3a3633' : '#ddd'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>Delete</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: '1.5rem', flexShrink: 0, width: '116px' }} onClick={e => e.stopPropagation()}>
                              <div style={{ position: 'relative' }}>
                                <StatusBadge
                                  status={listing.status || 'AVAILABLE'}
                                  onClick={listing.status !== 'COMPLETED' ? (e) => { e.stopPropagation(); setOpenStatusDropdownId(id => id === listing.id ? null : listing.id); } : undefined}
                                />
                                {openStatusDropdownId === listing.id && (
                                  <StatusDropdown
                                    currentStatus={listing.status || 'AVAILABLE'}
                                    onSelect={(newStatus) => { handleStatusChange(listing, newStatus); setOpenStatusDropdownId(null); }}
                                    style={{ right: 0, left: 'auto' }}
                                  />
                                )}
                              </div>
                              {/* 3-dot menu */}
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => setOpenCardMenuId(id => id === `my-${listing.id}` ? null : `my-${listing.id}`)}
                                  aria-label="More"
                                  title="More"
                                  style={{ background: 'transparent', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'}`, color: darkMode ? 'rgba(236,236,238,0.62)' : '#444', padding: '7px 9px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', lineHeight: 1, transition: 'background 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >⋯</button>
                                {openCardMenuId === `my-${listing.id}` && (
                                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, backgroundColor: darkMode ? '#1a1918' : '#fff', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : '#e4e4e7'}`, borderRadius: '12px', padding: '4px', boxShadow: darkMode ? '0 12px 32px rgba(0,0,0,0.55)' : '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '100px' }}>
                                    {listing.status !== 'COMPLETED' && (
                                      <Link to={`/listings/${listing.id}/edit`} onClick={() => setOpenCardMenuId(null)} style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', color: darkMode ? '#ECECEE' : '#1a1a1a', textDecoration: 'none', fontSize: '13px', fontWeight: 400, fontFamily: 'Outfit, sans-serif', textAlign: 'center' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : '#f5f5f5'; e.currentTarget.style.color = darkMode ? '#ECECEE' : '#1a1a1a'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = darkMode ? '#ECECEE' : '#1a1a1a'; }}
                                      >Edit listing</Link>
                                    )}
                                    <div style={{ height: '1px', backgroundColor: darkMode ? 'rgba(255,255,255,0.06)' : '#f0f0f0', margin: '3px 4px' }} />
                                    <button onClick={() => { handleDeleteClick(listing); setOpenCardMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '8px 12px', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: '#e07060', cursor: 'pointer', fontSize: '13px', fontWeight: 400, fontFamily: 'Outfit, sans-serif' }}
                                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : '#f5f5f5'; }}
                                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >Delete</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Saved Listings Tab */}
              {activeTab === 'savedListings' && (
                <div>


                  {isLoadingSaved ? (
                    <div style={{
                      backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px var(--shadow-color)'
                    }}>
                      <p>Loading your saved listings...</p>
                    </div>
                  ) : savedError ? (
                    <div style={{
                      backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      boxShadow: '0 2px 4px var(--shadow-color)'
                    }}>
                      <p style={{ color: 'var(--badger-red)' }}>Error loading saved listings</p>
                      <p style={{ fontSize: '0.9rem', color: darkMode ? '#ccc' : '#666' }}>
                        {savedError.message.includes('401') || savedError.message.includes('Unauthorized') 
                          ? 'Authentication error. Please try signing out and back in.'
                          : 'Please try refreshing the page'
                        }
                      </p>
                      <p style={{ fontSize: '0.8rem', color: darkMode ? '#999' : '#888', fontFamily: 'monospace' }}>
                        Error: {savedError.message}
                      </p>
                    </div>
                  ) : savedListings.length === 0 ? (
                    <div style={{
                      backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                      borderRadius: '8px',
                      padding: '4rem 2rem',
                      textAlign: 'center',
                      boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35), 0 1px 6px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.08), 0 1px 6px rgba(0,0,0,0.05)',
                      minHeight: '320px',
                    }}>
                      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center', color: darkMode ? '#444' : '#ccc' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                      </div>
                      <p style={{ marginBottom: '0.4rem', fontSize: '0.95rem', fontWeight: '600' }}>You haven't saved any listings yet.</p>
                      <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: darkMode ? '#6a6664' : '#999' }}>
                        Browse listings and save the ones you're interested in.
                      </p>
                      <Link
                        to="/listings"
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
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {sortListings(savedListings).map(listing => (
                        <div
                          key={listing.id}
                          className="profile-listing-card"
                          onClick={() => navigate(`/listings/${listing.publicId || listing.id}`)}
                          style={{
                            backgroundColor: darkMode ? '#171514' : 'var(--card-background)',
                            borderRadius: '10px',
                            border: `1px solid ${darkMode ? '#2e2c2b' : '#e8e8e8'}`,
                            padding: useCompactMyListingsLayout ? '0.85rem' : '12px 1.25rem',
                            boxShadow: darkMode
                              ? '0 2px 8px rgba(0,0,0,0.2)'
                              : '0 2px 8px rgba(0,0,0,0.07)',
                            display: 'flex',
                            gap: '1rem',
                            alignItems: useCompactMyListingsLayout ? 'flex-start' : 'center',
                            flexDirection: useCompactMyListingsLayout ? 'column' : 'row',
                            minWidth: 0,
                            cursor: 'pointer',
                          }}
                        >
                          {/* Image Preview */}
                          <div style={{
                            width: useCompactMyListingsLayout ? '100%' : '120px',
                            height: useCompactMyListingsLayout ? '90px' : '100px',
                            borderRadius: '7px',
                            overflow: 'hidden',
                            backgroundColor: darkMode ? '#2a2826' : '#f5f5f5',
                            flexShrink: 0,
                            maxWidth: useCompactMyListingsLayout ? '100%' : '120px'
                          }}>
                            {(listing.preSignedGetUrls && listing.preSignedGetUrls.length > 0) || (listing.images && listing.images.length > 0) ? (
                              <img
                                src={(listing.preSignedGetUrls && listing.preSignedGetUrls[0]) || (listing.images && listing.images[0])}
                                alt={listing.title}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: darkMode ? '#444' : '#ccc',
                              }}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                            <h3 style={{
                              marginBottom: '0.3rem',
                              color: darkMode ? 'white' : 'black',
                              fontSize: useCompactMyListingsLayout ? '1.05rem' : '1rem',
                              lineHeight: '1.3',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              <Link
                                to={`/listings/${listing.id}`}
                                style={{
                                  color: darkMode ? 'white' : 'black',
                                  textDecoration: 'none'
                                }}
                              >
                                {listing.title}
                              </Link>
                            </h3>
                            <p style={{ marginBottom: '0.1rem', fontSize: useCompactMyListingsLayout ? '0.95rem' : '0.9rem', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontWeight: '600' }}>
                              ${listing.price}/mo
                            </p>
                            {listing.startDate && listing.endDate && (
                              <p style={{ marginBottom: 0, fontSize: '0.825rem', color: darkMode ? '#8a8280' : '#5a5550' }}>
                                {new Date(listing.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {new Date(listing.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            )}
                            {!useCompactMyListingsLayout && listing.address && (
                              <p style={{ fontSize: '0.775rem', color: darkMode ? '#524e4c' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {listing.address}
                              </p>
                            )}
                          </div>
                          {useCompactMyListingsLayout ? (
                            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.1rem' }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => handleUnsave(listing.id)} style={{ flex: 1, padding: '0.5rem 1rem', backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#999', border: `1px solid ${darkMode ? '#3a3633' : '#ddd'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>Unsave</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              {/* Bookmark / Unsave */}
                              <button
                                onClick={() => handleUnsave(listing.id)}
                                aria-label="Unsave"
                                title="Unsave"
                                style={{ background: 'transparent', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'}`, color: darkMode ? '#ECECEE' : '#333', padding: '7px 9px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <svg width="13" height="14" viewBox="0 0 13 14" fill={darkMode ? '#ECECEE' : '#333'}><path d="M2 1.5h9v11l-4.5-3-4.5 3v-11Z"/></svg>
                              </button>
                              {/* Overflow / More */}
                              <div style={{ position: 'relative' }}>
                                <button
                                  aria-label="More"
                                  title="More"
                                  onClick={() => setOpenOverflowMenuId(id => id === listing.id ? null : listing.id)}
                                  style={{ background: 'transparent', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'}`, color: darkMode ? 'rgba(236,236,238,0.62)' : '#444', padding: '7px 9px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', lineHeight: 1, transition: 'background 0.15s' }}
                                  onMouseEnter={e => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >⋯</button>
                                {openOverflowMenuId === listing.id && (
                                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, backgroundColor: '#1a1918', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', boxShadow: '0 12px 32px rgba(0,0,0,0.55)', zIndex: 100, minWidth: '100px' }}>
                                    <button onClick={() => { setShareListingTarget(listing); setOpenOverflowMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '8px 12px', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: 'rgba(236,236,238,0.62)', cursor: 'pointer', fontSize: '13px', fontWeight: 400, fontFamily: 'Outfit, sans-serif' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#ECECEE'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'rgba(236,236,238,0.62)'; }}>Share</button>
                                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '3px 4px' }} />
                                    <button onClick={() => { setReportListingTarget(listing); setOpenOverflowMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '8px 12px', border: 'none', borderRadius: '8px', backgroundColor: 'transparent', color: '#e07060', cursor: 'pointer', fontSize: '13px', fontWeight: 400, fontFamily: 'Outfit, sans-serif' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Report</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Messages Tab */}
              {activeTab === 'messages' && (
                <div>
                  <ConversationList embedded={true} />
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {shareListingTarget && (
        <ShareModal
          isOpen={!!shareListingTarget}
          onClose={() => setShareListingTarget(null)}
          listing={{ ...shareListingTarget, id: shareListingTarget.publicId || shareListingTarget.id }}
        />
      )}

      {reportListingTarget && (
        <ReportModal
          onClose={() => setReportListingTarget(null)}
          listingId={reportListingTarget.publicId || reportListingTarget.id}
          firebaseId={reportListingTarget.firebaseId}
          darkMode={darkMode}
        />
      )}

      {deleteModalOpen && (
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
          zIndex: 2100
        }}>
          <div style={{
            backgroundColor: darkMode ? '#171514' : 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: darkMode ? 'white' : 'black' }}>Delete Listing</h3>
            <p style={{ marginBottom: '1.5rem', color: darkMode ? '#ccc' : '#666' }}>
              Are you sure you want to delete this listing? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteCancel}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: darkMode ? '#211f1e' : 'var(--background-color)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: darkMode ? 'white' : 'black'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--badger-red)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
            {listingToDelete?.status !== 'COMPLETED' && (
              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: darkMode ? '#666' : '#999', textAlign: 'center' }}>
                Is this listing complete?{' '}
                <button
                  onClick={handleMarkCompleteFromDelete}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: darkMode ? '#8a8280' : '#888', fontSize: '0.8rem', textDecoration: 'underline' }}
                >
                  Mark it instead
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {deleteAccountModalOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeletingAccount) setDeleteAccountModalOpen(false); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{
              backgroundColor: darkMode ? '#1c1a19' : 'white',
              padding: '2rem',
              borderRadius: '14px',
              maxWidth: '360px',
              width: '90%',
              boxShadow: darkMode ? '0 24px 60px rgba(0,0,0,0.6)' : '0 24px 60px rgba(0,0,0,0.12)',
              border: `1px solid ${darkMode ? '#2e2a28' : '#ebebeb'}`,
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontWeight: '700', color: darkMode ? '#f0ebe5' : '#1a1a1a', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
              Delete account
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: darkMode ? '#6a6664' : '#999', lineHeight: 1.6 }}>
              Your listings, messages, and saved items will be permanently removed. This can't be reversed.
            </p>
            {updateMessage?.includes('Error deleting') && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#b91c1c' }}>{updateMessage}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setDeleteAccountModalOpen(false)}
                disabled={isDeletingAccount}
                style={{
                  flex: 1, padding: '0.6rem 1rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${darkMode ? '#2e2a28' : '#e8e8e8'}`,
                  borderRadius: '8px', cursor: 'pointer',
                  color: darkMode ? '#8a8280' : '#888', fontSize: '0.875rem', fontWeight: '500',
                  fontFamily: 'Outfit, sans-serif', transition: 'border-color 0.15s ease',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
                style={{
                  flex: 1, padding: '0.6rem 1rem',
                  backgroundColor: darkMode ? '#2a1010' : '#1a1a1a',
                  color: darkMode ? '#f87171' : 'white',
                  border: `1px solid ${darkMode ? '#5a2020' : 'transparent'}`,
                  borderRadius: '8px', cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem', fontWeight: '600',
                  opacity: isDeletingAccount ? 0.6 : 1,
                  fontFamily: 'Outfit, sans-serif',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {isDeletingAccount ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {completionModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100
        }}>
          <div style={{
            backgroundColor: darkMode ? '#171514' : 'white',
            padding: '2rem', borderRadius: '8px',
            maxWidth: '400px', width: '90%',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginBottom: '1rem', color: darkMode ? 'white' : 'black' }}>Mark as Completed?</h3>
            <p style={{ marginBottom: '1.5rem', color: darkMode ? '#ccc' : '#666' }}>
              This will remove <strong>{listingToComplete?.title}</strong> from public search. Your listing history will be saved. This cannot be undone.
            </p>
            {statusError && (
              <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{statusError}</p>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => { setCompletionModalOpen(false); setListingToComplete(null); setStatusError(''); }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: darkMode ? '#211f1e' : 'var(--background-color)',
                  border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'var(--border-color)'}`,
                  borderRadius: '4px', cursor: 'pointer',
                  color: darkMode ? 'white' : 'black'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmComplete}
                disabled={updateStatusMutation.isPending}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--badger-red)',
                  color: 'white', border: 'none',
                  borderRadius: '4px', cursor: 'pointer',
                  opacity: updateStatusMutation.isPending ? 0.6 : 1
                }}
              >
                {updateStatusMutation.isPending ? 'Saving...' : 'Mark as Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>)}
    </>
  );
}

