import { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import ShareModal from '../components/ShareModal';
import Map from '../components/Map';
import { useSaveListingMutations, useListingDetailsQuery, useSavedListingsQuery, useListingCountsQuery, useUpdateListingStatusMutation } from '../services/listingQueries';
import StatusBadge from '../components/StatusBadge';
import StatusDropdown from '../components/StatusDropdown';
import AnimatedBookmark from '../components/AnimatedBookmark';
import { useQueryClient } from '@tanstack/react-query';
import { useFindOrCreateConversationMutation, messageKeys } from '../services/messageQueries';
import ReportModal from '../components/ReportModal';
import Seo from '../components/Seo';


export default function ListingDetails() {
  const { darkMode } = useContext(ThemeContext);
  const { currentUser } = useAuth();
  const { id } = useParams();
  const [activeImage, setActiveImage] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const lockedAxis = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOwnListingModal, setShowOwnListingModal] = useState(false);
  const [contactError, setContactError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [statusError, setStatusError] = useState('');
  
  // Get userId from currentUser
  const userId = currentUser?.uid;
  
  const { saveMutation, unsaveMutation } = useSaveListingMutations(userId);
  const updateStatusMutation = useUpdateListingStatusMutation(userId);
  const findOrCreateConversationMutation = useFindOrCreateConversationMutation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Use React Query to fetch and cache listing details
  // Pass userId to get isOwner check from backend
  const { data: listing, isLoading: loading, error: queryError } = useListingDetailsQuery(id, userId);

  // Build dynamic SEO metadata from listing
  const seoCanonical = `https://www.madlease.net/listings/${id}`;
  const seoImage = listing?.preSignedGetUrls?.[0] || 'https://www.madlease.net/madlease_logo_new.png';
  const seoPrice = listing?.rent || listing?.parking?.price || null;
  const seoDescription = listing
    ? [
        seoPrice && `$${seoPrice}/mo`,
        listing.bedrooms && `${listing.bedrooms} bed`,
        listing.bathrooms && `${listing.bathrooms} bath`,
        [listing.street, listing.city, listing.state].filter(Boolean).join(', '),
      ].filter(Boolean).join(' • ')
    : undefined;
  const seoJsonLd = listing ? {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': seoCanonical,
    name: listing.title,
    description: listing.description || '',
    url: seoCanonical,
    image: listing.preSignedGetUrls?.length ? listing.preSignedGetUrls : undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: listing.street || '',
      addressLocality: listing.city || '',
      addressRegion: listing.state || '',
      postalCode: listing.zipcode ? String(listing.zipcode) : '',
      addressCountry: 'US',
    },
    offers: {
      '@type': 'Offer',
      price: seoPrice || 0,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    numberOfRooms: listing.bedrooms || undefined,
    numberOfBathroomsTotal: listing.bathrooms || undefined,
  } : undefined;
  // Fetch live view/save counts separately so they stay fresh without busting the 10-min details cache
  // (not currently displayed - see commented-out view/save count spans below - but the hook call is kept
  // so the fetch still runs; only the unused destructured binding was removed)
  useListingCountsQuery(id);
  const isNotFound = queryError?.message?.includes('404') || queryError?.message?.includes('Not Found');
  const error = queryError && !isNotFound ? 'Failed to load listing' : null;

  // Use shared React Query cache for saved listings - syncs with ListingCard/Map
  const { data: savedListings = [] } = useSavedListingsQuery(userId, {
    enabled: !!userId && !!listing,
  });
  
  // Check if current listing is saved using the shared cache
  const isSaved = listing ? savedListings.some(saved =>
    saved.publicId === listing.id || saved.id === listing.id
  ) : false;

  // to toggle save/unsave
  const handleSaveToggle = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    
    try {
      if (isSaved) {
        await unsaveMutation.mutateAsync({ listingId: listing.id });
      } else {
        await saveMutation.mutateAsync({ listingId: listing.id });
      }
      // No need to manually set state - React Query cache update will trigger re-render
    } catch {
      setSaveError(`Failed to ${isSaved ? 'unsave' : 'save'} listing. Try again.`);
      setTimeout(() => setSaveError(''), 3000);
    }
  };

  // Handle share button click - opens share modal
  const handleShare = () => {
    setShowShareModal(true);
  };

  // Handle owner status change
  const handleOwnerStatusChange = (newStatus) => {
    // Clear stale status errors before a new action.
    setStatusError('');

    if (newStatus === 'COMPLETED') {
      setStatusDropdownOpen(false);
      setCompletionModalOpen(true);
      return;
    }
    updateStatusMutation.mutate(
      { publicId: id, status: newStatus },
      { onError: (err) => setStatusError(err.message) }
    );
    setStatusDropdownOpen(false);
  };

  const handleConfirmComplete = () => {
    updateStatusMutation.mutate(
      { publicId: id, status: 'COMPLETED' },
      {
        onSuccess: () => { setCompletionModalOpen(false); navigate('/profile'); },
        onError: (err) => setStatusError(err.message),
      }
    );
  };

  // Handle report button click - requires auth
  const handleReportClick = () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    setShowReportModal(true);
  };

  // Handle contact button click
  const handleContactClick = async () => {
    // Clear any previous error
    setContactError('');
    
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    // Check if user is trying to contact themselves (server-side ownership check)
    if (listing.isOwner) {
      setShowOwnListingModal(true);
      return;
    }
    
    try {
      // Find or create conversation without sending a message
      const conversation = await findOrCreateConversationMutation.mutateAsync({
        listingId: listing.id
      });

      // Wait for conversations cache to update before navigating
      await queryClient.refetchQueries({ queryKey: messageKeys.conversations(currentUser.uid) });

      // Navigate directly to the conversation
      navigate(`/messages/${conversation.conversationID}`);
    } catch (error) {
      
      // Handle specific error cases
      if (error.message && error.message.includes('conversation with yourself')) {
        setContactError("You cannot start a conversation with yourself about your own listing! To edit your listing, go to Profile → My Listings → Edit.");
      } else if (error.message && error.message.includes('Listing not found')) {
        setContactError("This listing is no longer available.");
      } else if (error.message && error.message.includes('401') || error.message && error.message.includes('Unauthorized')) {
        setContactError("Please sign in again to contact the lister.");
        setShowAuthModal(true);
      } else {
        setContactError("Failed to start conversation. Please try again later.");
      }
    }
  };

  // Scroll to top when page loads or listing changes
  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      return;
    } else {
      document.querySelector('main')?.scrollTo(0, 0);
    }
  }, [id]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusDropdownOpen) return;
    const close = () => setStatusDropdownOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [statusDropdownOpen]);

  // Handle image navigation
  const nextImage = () => {
    if (listing && listing.images) {
      setActiveImage((prev) => (prev + 1) % listing.images.length);
    }
  };

  const prevImage = () => {
    if (listing && listing.images) {
      setActiveImage((prev) => (prev - 1 + listing.images.length) % listing.images.length);
    }
  };

  useEffect(() => {
    if (!listing?.images?.length) return;
    const len = listing.images.length;
    [-2, -1, 1, 2].map((offset) => (activeImage + offset + len * 2) % len).forEach((i) => {
      const img = new Image();
      img.src = listing.images[i];
    });
  }, [activeImage, listing?.images]);

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '50vh',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: `3px solid ${darkMode ? '#333' : '#e0e0e0'}`,
          borderTop: '3px solid var(--badger-red)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '960px',
        margin: '0 auto',
        textAlign: 'center',
        color: darkMode ? '#fff' : '#333'
      }}>
        <h2>Error loading listing</h2>
        <p>{error}</p>
        <Link to="/listings" style={{
          display: 'inline-block',
          marginTop: '1rem',
          color: 'var(--badger-red)',
          textDecoration: 'none'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to listings
        </Link>
      </div>
    );
  }

  // If listing not found (404) or no listing data
  if (isNotFound || !listing) {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto',
        textAlign: 'center',
        color: darkMode ? '#fff' : '#333',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1rem',
          opacity: 0.5
        }}>
          🏠
        </div>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          marginBottom: '0.75rem',
          color: darkMode ? '#fff' : '#333'
        }}>
          Listing Not Found
        </h1>
        <p style={{
          fontSize: '1rem',
          color: darkMode ? '#999' : '#666',
          marginBottom: '1.5rem',
          maxWidth: '400px',
          lineHeight: '1.5'
        }}>
          This listing may have been removed or the link is incorrect. Check out other available listings below.
        </p>
        <Link
          to="/listings"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--badger-red)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '0.95rem',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.9'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          Browse Listings
        </Link>
      </div>
    );
  }

  return (
    <>
    <Seo
      title={listing?.title}
      description={seoDescription}
      canonical={seoCanonical}
      image={seoImage}
      type="product"
      jsonLd={seoJsonLd}
    />

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
    <div style={{
      position: 'relative',
      zIndex: 103,
      padding: isMobile ? 0 : '1rem',
      paddingBottom: isMobile ? 0 : '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      marginTop: isMobile ? 0 : '1rem',
      color: darkMode ? '#fff' : '#333'
    }}>
      {/* Back button (desktop text link) */}
      {!isMobile && (
        <Link
          to="/listings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            marginBottom: '1rem',
            color: darkMode ? '#ccc' : '#555',
            textDecoration: 'none',
            borderRadius: '6px',
            padding: '4px 8px',
            transition: 'background-color 0.15s',
            fontSize: '0.95rem'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to listings
        </Link>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        // Mobile dark: same near-black as the page, so there's no grey band behind the text
        backgroundColor: darkMode ? (isMobile ? '#0f0e0e' : '#1e1e1e') : '#faf7f1',
        borderRadius: isMobile ? 0 : '8px',
        boxShadow: isMobile
          ? 'none'
          : (darkMode
            ? '0 2px 4px rgba(0, 0, 0, 0.3)'
            : '0 2px 4px var(--shadow-color)'),
        overflow: 'hidden'
      }}>
        {/* Image gallery */}
        <div
          style={{
            position: 'relative',
            height: isMobile ? '42vh' : '420px',
            backgroundColor: darkMode ? '#333' : '#f0f0f0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            touchAction: 'pan-y'
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            lockedAxis.current = null;
          }}
          onTouchMove={(e) => {
            if (touchStartX.current === null) return;
            const dx = e.touches[0].clientX - touchStartX.current;
            const dy = e.touches[0].clientY - touchStartY.current;
            if (lockedAxis.current === null) {
              if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
              lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
              if (lockedAxis.current === 'x') setIsDragging(true);
            }
            if (lockedAxis.current === 'x') setDragX(dx);
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            if (lockedAxis.current === 'x') {
              const delta = e.changedTouches[0].clientX - touchStartX.current;
              const total = listing.images ? listing.images.length : 0;
              if (delta < -60 && activeImage < total - 1) setActiveImage(activeImage + 1);
              else if (delta > 60 && activeImage > 0) setActiveImage(activeImage - 1);
            }
            setDragX(0);
            setIsDragging(false);
            touchStartX.current = null;
            touchStartY.current = null;
            lockedAxis.current = null;
          }}
          onTouchCancel={() => {
            setDragX(0);
            setIsDragging(false);
            touchStartX.current = null;
            touchStartY.current = null;
            lockedAxis.current = null;
          }}
        >
          {listing.images && listing.images.length > 0 ? (
            <>
              {/* Blurred copy of the current photo fills the frame, so the letterboxed sides aren't empty grey */}
              <img
                src={listing.images[activeImage]}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '-24px',
                  width: 'calc(100% + 48px)',
                  height: 'calc(100% + 48px)',
                  objectFit: 'cover',
                  filter: darkMode ? 'blur(28px) brightness(0.45) saturate(1.1)' : 'blur(28px) brightness(1.08) saturate(0.85)',
                  opacity: darkMode ? 1 : 0.7,
                  transform: 'scale(1.05)',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              />
              <div style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                width: '100%',
                height: '100%',
                transform: `translateX(calc(${-activeImage * 100}% + ${dragX}px))`,
                transition: isDragging ? 'none' : 'transform 0.3s ease',
                willChange: 'transform'
              }}>
                {listing.images.map((img, i) => (
                  <div key={i} style={{
                    flex: '0 0 100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={img}
                      alt={`View ${i + 1} of ${listing.title}`}
                      draggable={false}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: 'block',
                        transform: 'scale(1.16)',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Image navigation buttons */}
              <button
                onClick={prevImage}
                className="gallery-arrow"
                aria-label="Previous photo"
                style={{
                  position: 'absolute',
                  zIndex: 2,
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width={isMobile ? 20 : 28} height={isMobile ? 20 : 28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <button
                onClick={nextImage}
                className="gallery-arrow"
                aria-label="Next photo"
                style={{
                  position: 'absolute',
                  zIndex: 2,
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: 'transparent',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width={isMobile ? 20 : 28} height={isMobile ? 20 : 28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              {/* Image counter */}
              <div style={{
                position: 'absolute',
                zIndex: 2,
                bottom: '10px',
                right: '10px',
                backgroundColor: 'rgba(0,0,0,0.62)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color: 'white',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: '600',
                letterSpacing: '0.01em',
              }}>
                {activeImage + 1} / {listing.images.length}
              </div>

              {/* Floating back button (mobile) */}
              {isMobile && (
                <Link
                  to="/listings"
                  aria-label="Back to listings"
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    textDecoration: 'none',
                    zIndex: 2
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </Link>
              )}
            </>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-color)'
            }}>
              No images available
            </div>
          )}
        </div>

        {/* Listing details */}
        <div style={{
          padding: '1rem',
          backgroundColor: darkMode ? (isMobile ? '#0f0e0e' : '#1e1e1e') : '#faf7f1'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'flex-start',
            gap: '1rem',
            width: '100%',
          }}>
            <div style={{ width: isMobile ? '100%' : 'calc(100% - 220px)' }}>
              {(listing.isOwner || listing.status === 'PENDING') && (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                  <StatusBadge
                    status={listing.status || 'AVAILABLE'}
                    onClick={listing.isOwner && listing.status !== 'COMPLETED' ? (e) => { e.stopPropagation(); setStatusDropdownOpen(o => !o); } : undefined}
                  />
                  {statusDropdownOpen && listing.isOwner && listing.status !== 'COMPLETED' && (
                    <StatusDropdown
                      currentStatus={listing.status || 'AVAILABLE'}
                      onSelect={handleOwnerStatusChange}
                    />
                  )}
                </div>
              )}
              <h1 style={{
                marginBottom: '0.5rem',
                fontSize: isMobile ? '1.5rem' : '2rem',
                color: darkMode ? '#fff' : '#333'
              }}>{listing.title}</h1>
              <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}><strong>{listing.price != null ? `$${listing.price}/mo` : ''}</strong></p>
              
              {/* Availability dates */}
              <div style={{ marginBottom: '0.5rem', color: darkMode ? '#ccc' : '#666' }}>
                {listing.startDate && listing.endDate ? (
                  <span>
                    {new Date(listing.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' – '}
                    {new Date(listing.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : listing.startDate ? (
                  <span>
                    Starting {new Date(listing.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                ) : null}
              </div>

              <p style={{ marginTop: '0.5rem' }}>{listing.address}</p>

              {/* Save count visible to all; view count only visible to owner */}
              <div style={{ display: 'flex', gap: '1rem', color: darkMode ? '#aaa' : '#888', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {/* {listing.isOwner && <span>{counts?.viewCount ?? 0} views</span>} */}
                {/* <span>{counts?.saveCount ?? 0} {counts?.saveCount === 1 ? 'save' : 'saves'}</span> */}
              </div>
            </div>

            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              width: isMobile ? '100%' : '200px',
              textAlign: isMobile ? 'center' : 'center',
              alignSelf: isMobile ? 'stretch' : 'flex-start',
              boxSizing: 'border-box',
            }}>
              <button 
                onClick={handleContactClick}
                style={{
                  backgroundColor: 'var(--badger-red)',
                  color: 'white',
                  border: darkMode ? '1.5px solid rgba(255,255,255,0.15)' : '1.5px solid rgba(150,0,5,0.35)',
                  borderRadius: '4px',
                  padding: '0.75rem 1.5rem',
                  width: '100%',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  outline: 'none',
                  marginBottom: contactError ? '0.5rem' : '1rem',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}>
                Contact Lister
              </button>

              {contactError && (
                <div style={{
                  backgroundColor: darkMode ? 'rgba(244, 67, 54, 0.1)' : '#ffebee',
                  color: darkMode ? '#ff6b6b' : '#c62828',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                  border: `1px solid ${darkMode ? 'rgba(244, 67, 54, 0.3)' : '#ffcdd2'}`,
                  lineHeight: '1.4'
                }}>
                  {contactError}
                </div>
              )}

              {/* Save & Share buttons - side by side */}
              <div style={{
                display: 'flex',
                gap: '0.75rem',
                width: '100%',
              }}>
                <button
                  onClick={handleSaveToggle}
                  title={isSaved ? 'Unsave listing' : 'Save listing'}
                  aria-pressed={isSaved}
                  className="detail-action"
                  style={{
                    flex: 1,
                    backgroundColor: isSaved ? (darkMode ? 'rgba(197,5,12,0.14)' : 'rgba(197,5,12,0.07)') : (darkMode ? '#2a2a2a' : '#f3eee6'),
                    color: isSaved ? 'var(--badger-red)' : (darkMode ? '#ccc' : '#555'),
                    border: `1.5px solid ${isSaved ? 'var(--badger-red)' : (darkMode ? '#555' : '#d6cdbd')}`,
                    borderRadius: '8px',
                    padding: '0.75rem',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
                  }}
                >
                  {/* AnimatedBookmark is a fixed 40px box; a 20px wrapper keeps the button as tall as Share's icon.
                      The burst can overflow the wrapper, so the animation is unchanged. */}
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px' }}>
                    <AnimatedBookmark isSaved={isSaved} darkMode={darkMode} size={20} />
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: '600' }}>
                    {isSaved ? 'Saved' : 'Save'}
                  </span>
                </button>

                <button
                  onClick={handleShare}
                  title="Share listing"
                  className="detail-action"
                  style={{
                    flex: 1,
                    backgroundColor: darkMode ? '#2a2a2a' : '#f3eee6',
                    color: darkMode ? '#ccc' : '#555',
                    border: `1.5px solid ${darkMode ? '#555' : '#d6cdbd'}`,
                    borderRadius: '8px',
                    padding: '0.75rem',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <span style={{ fontSize: '0.8125rem', fontWeight: '600' }}>
                    Share
                  </span>
                </button>
              </div>
              {saveError && (
                <p style={{
                  color: 'var(--badger-red)',
                  fontSize: '0.85rem',
                  margin: '0.5rem 0 0 0',
                  textAlign: 'center'
                }}>{saveError}</p>
              )}

            </div>
          </div>

          <hr style={{
            margin: '0.5rem 0',
            border: 'none',
            borderTop: `1px solid ${darkMode ? '#444' : 'var(--border-color)'}`
          }} />

          {/* Property details — housing only */}
          {listing.listingType !== 'PARKING' && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              marginBottom: '1rem',
              fontSize: isMobile ? '1.25rem' : '1.5rem'
            }}>Property Details</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: '0.75rem'
            }}>
              {[
                { label: 'Bedrooms', value: listing.bedrooms, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M2 11v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6"/><path d="M7 11v-1a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1"/></svg>
                )},
                { label: 'Bathrooms', value: listing.bathrooms, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" y1="5" x2="8" y2="7"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                )},
                { label: 'Sq Ft', value: listing.squareFeet, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                )},
                { label: 'Roommates', value: listing.roommates, icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                )},
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  backgroundColor: darkMode ? '#2a2a2a' : '#f3eee6',
                  border: `1px solid ${darkMode ? '#444' : '#e4ddd0'}`,
                  borderRadius: '8px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}>
                  <div style={{ color: darkMode ? '#b3aba7' : '#999' }}>{icon}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: darkMode ? '#fff' : '#111', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.75rem', color: darkMode ? '#888' : '#6b6461', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Description</h2>
            <p style={{ lineHeight: '1.6' }}>{listing.description}</p>
          </div>

          {/* Amenities — housing only */}
          {listing.listingType !== 'PARKING' && listing.amenities && listing.amenities.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{
              marginBottom: '1rem',
              fontSize: isMobile ? '1.25rem' : '1.5rem'
            }}>Amenities</h2>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {listing.amenities.map((amenity, index) => (
                <div key={index} className="amenity-chip" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  backgroundColor: darkMode ? '#2a2a2a' : '#f3eee6',
                  border: `1px solid ${darkMode ? '#444' : '#e4ddd0'}`,
                  fontSize: '0.85rem',
                  color: darkMode ? '#ccc' : '#555',
                  fontWeight: '400'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#e5484d' : 'var(--badger-red)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {amenity}
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Parking */}
          {listing.parking && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: isMobile ? '1.25rem' : '1.5rem' }}>{listing.listingType === 'PARKING' ? 'Parking Details' : 'Parking Spot'}</h2>
              <div style={{
                backgroundColor: darkMode ? '#2a2a2a' : '#f3eee6',
                border: `1px solid ${darkMode ? '#444' : '#e4ddd0'}`,
                borderRadius: '10px',
                overflow: 'hidden',
              }}>
                {/* Stats row */}
                <div style={{
                  display: 'flex',
                  borderBottom: `1px solid ${darkMode ? '#444' : '#e4ddd0'}`,
                }}>
                  {[
                    { label: 'Type', value: { COVERED_GARAGE: 'Covered Garage', SURFACE_LOT: 'Surface Lot', STREET: 'Street', DRIVEWAY: 'Driveway' }[listing.parking.parkingType] || listing.parking.parkingType },
                    { label: 'Spots', value: listing.parking.spots },
                    { label: 'Price/mo', value: listing.parking.price > 0 ? `$${listing.parking.price}` : 'Included' },
                  ].map(({ label, value }, i, arr) => (
                    <div key={label} style={{
                      flex: 1,
                      padding: '1rem 1.25rem',
                      borderRight: i < arr.length - 1 ? `1px solid ${darkMode ? '#444' : '#e4ddd0'}` : 'none',
                    }}>
                      <div style={{ fontSize: '0.7rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: darkMode ? '#524e4c' : '#999', marginBottom: '0.35rem' }}>{label}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#1a1a1a', fontFamily: 'Outfit, sans-serif' }}>{value}</div>
                    </div>
                  ))}
                </div>
                {/* Notes */}
                {listing.parking.notes && (
                  <div style={{ padding: '0.875rem 1.25rem', borderBottom: listing.parking.imageUrl ? `1px solid ${darkMode ? '#444' : '#e4ddd0'}` : 'none' }}>
                    <div style={{ fontSize: '0.7rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: darkMode ? '#524e4c' : '#999', marginBottom: '0.35rem' }}>Notes</div>
                    <p style={{ fontSize: '0.9rem', color: darkMode ? '#8a8280' : '#555', margin: 0, lineHeight: 1.5, fontFamily: 'Outfit, sans-serif' }}>{listing.parking.notes}</p>
                  </div>
                )}
                {/* Photo */}
                {listing.parking.imageUrl && (
                  <div style={{ padding: '1rem 1.25rem 1.25rem', display: 'flex', justifyContent: 'center' }}>
                    <img
                      src={listing.parking.imageUrl}
                      alt="Parking photo"
                      style={{ width: isMobile ? '100%' : '50%', display: 'block', borderRadius: '6px' }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map */}
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Location</h2>
            <div style={{
              height: '300px',
              position: 'relative',
              borderRadius: '8px',
              overflow: 'hidden',
              border: darkMode ? '1px solid #444' : 'none'
            }}>
              <Map
                listings={[]}
                singleListing={listing}
                showRecenter={false}
              />
            </div>
          </div>

          {/* About the lister */}
          <div style={{ marginBottom: '0.5rem' }}>
            <h2 style={{
              marginBottom: '1rem',
              fontSize: isMobile ? '1.25rem' : '1.5rem'
            }}>About the Lister</h2>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'center' : 'flex-start',
              textAlign: isMobile ? 'center' : 'left',
              backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : '#f3eee6',
              padding: '1rem',
              borderRadius: '8px',
              gap: '1rem'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'var(--badger-red)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginRight: isMobile ? 0 : '1rem',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {/* Always use backend data for consistency */}
                {listing.poster.profilePictureUrl ? (
                  <img 
                    src={listing.poster.profilePictureUrl} 
                    alt={`${listing.poster.name}'s profile`} 
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
                      e.target.parentElement.style.backgroundColor = 'var(--badger-red)';
                    }}
                  />
                ) : (
                  (listing.poster.name.includes(' ') ? listing.poster.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : listing.poster.name.substring(0, 2).toUpperCase())
                )}
              </div>
              <div>
                <div style={{ marginBottom: '0.25rem' }}>
                  <h3 style={{ marginBottom: isMobile ? '0.5rem' : '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                    {listing.poster.name}
                    {!isMobile && listing.poster.isVerified && (
                      <span
                        title="Verified UW-Madison Student"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.15)' : 'rgba(197, 5, 12, 0.08)',
                          color: '#c5050c',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '100px',
                          border: '1px solid rgba(197, 5, 12, 0.3)',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.01em'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#c5050c" stroke="none">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        UW Student
                      </span>
                    )}
                  </h3>
                  {isMobile && listing.poster.isVerified && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
                      <span
                        title="Verified UW-Madison Student"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: darkMode ? 'rgba(197, 5, 12, 0.15)' : 'rgba(197, 5, 12, 0.08)',
                          color: '#c5050c',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '100px',
                          border: '1px solid rgba(197, 5, 12, 0.3)',
                          whiteSpace: 'nowrap',
                          letterSpacing: '0.01em'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#c5050c" stroke="none">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        UW Student
                      </span>
                    </div>
                  )}
                </div>
                <p style={{ marginBottom: '0.25rem' }}>{listing.poster.email}</p>
                <p style={{ marginBottom: '0.25rem' }}>
                  {listing.poster.joinDate}
                </p>
              </div>
            </div>
            {/* Report link — inside About the Lister */}
            <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
              <button
                onClick={handleReportClick}
                style={{
                  background: 'none',
                  border: 'none',
                  color: darkMode ? '#777' : '#999',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#c5050c'}
                onMouseOut={(e) => e.currentTarget.style.color = darkMode ? '#777' : '#999'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                Report this listing
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        darkMode={darkMode}
        title="Sign in to continue"
      />

      {/* Own Listing Modal */}
      {showOwnListingModal && (
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
            borderRadius: '12px',
            maxWidth: '400px',
            margin: '1rem',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>
              🏠
            </div>
            <h3 style={{
              margin: '0 0 1rem 0',
              color: darkMode ? 'white' : 'black',
              fontSize: '1.3rem'
            }}>
              This is Your Listing
            </h3>
            <p style={{
              margin: '0 0 1.5rem 0',
              color: darkMode ? '#ccc' : '#666',
              lineHeight: '1.5'
            }}>
              You can't contact yourself! To edit or manage this listing, visit your profile page.
            </p>
            <button
              onClick={() => setShowOwnListingModal(false)}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--badger-red)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        listing={listing}
      />

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          listingId={listing.id}
          firebaseId={currentUser?.uid}
          darkMode={darkMode}
        />
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
              This will remove your listing from public search. Your listing history will be saved. This cannot be undone.
            </p>
            {statusError && (
              <p style={{ color: '#f87171', fontSize: '0.875rem', marginBottom: '1rem' }}>{statusError}</p>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => { setCompletionModalOpen(false); setStatusError(''); }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: darkMode ? '#2a2e35' : 'var(--background-color)',
                  border: `1px solid ${darkMode ? '#333' : 'var(--border-color)'}`,
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
    </div>
    </>
  );
}