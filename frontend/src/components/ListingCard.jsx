import { Link } from 'react-router-dom'; // navigation links without full page reload
import React, { useContext, useRef, useState } from 'react';
import { ThemeContext } from '../context/ThemeContext.jsx';
import StatusBadge from './StatusBadge';
import AnimatedBookmark from './AnimatedBookmark';
import { formatSpecs, formatAvailability } from '../utils/listingFormat';

function ListingCard({ listing, isSelected, id, isSaved, onSaveToggle, onSaveScroll, isMobile = true }) {
  const { darkMode } = useContext(ThemeContext);
  // Desktop cards get a taller photo area; the mobile layout is unchanged
  const photoHeight = isMobile ? 180 : 208;
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false); // Use ref instead of state to avoid re-renders - persists values across renders instead of re-rendering

  const handleSaveToggle = async (e) => {
    // needed to prevent from going to listing card when clicking on save icon
    e.preventDefault(); // since save button is a link within a clickable listing card, this prevents the user from navigating to the lsiting detail page when clicking the save icon
    e.stopPropagation(); // prevents the click event from "bubbling up" to parent elts (listing card as a whole)

    if (savingRef.current) return;
    savingRef.current = true;
    setSaveError('');

    try {
      await onSaveToggle(listing.publicId || listing.id, !isSaved); // using !isSaved to just toggle it to the opposite
    } catch {
      setSaveError(`Failed to ${!isSaved ? 'save' : 'unsave'}. Try again.`);
      setTimeout(() => setSaveError(''), 3000);
    } finally {
      savingRef.current = false;
    }
  };

  // Grab up to 3 images
  const images = (listing.preSignedGetUrls || listing.images || []).slice(0, 3);

  // Compute grid layout based on number of images
  let gridStyles = {};
  if (images.length === 1) {
    gridStyles = {
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'minmax(0, 1fr)',
      height: photoHeight,
    };
  } else if (images.length === 2) {
    gridStyles = {
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: 'minmax(0, 1fr)',
      height: photoHeight,
    };
  } else {
    // 3 or more
    gridStyles = {
      gridTemplateColumns: '1.5fr 1fr',
      gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)',
      height: photoHeight,
      gridTemplateAreas: `
        "left right-top"
        "left right-bottom"
      `,
    };
  }

  return (
    <>
      <Link
        to={`/listings/${listing.publicId || listing.id}`}
        id={id}
        className="listing-link"
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          // A little extra hit area below the card, so the lift on hover can't drop the hover at the bottom edge
          paddingBottom: 6,
          marginBottom: -6,
        }}
        onClick={() => {
          if (onSaveScroll) {
            onSaveScroll();
          }
        }}
      >
        <div
          className="listing-card hm-card"
          style={{
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            border: isSelected
              ? (darkMode ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(0,0,0,0.2)')
              : darkMode ? '2px solid #333' : '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            marginBottom: isMobile ? '1rem' : '1rem',
            backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: isSelected
              ? (darkMode ? '0 10px 28px -12px rgba(0,0,0,0.7)' : '0 10px 28px -12px rgba(0,0,0,0.25)')
              : darkMode
              ? '0 2px 4px rgba(0,0,0,0.3)'
              : '0 1px 2px rgba(0,0,0,0.04), 0 3px 10px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
          }}
        >
          {/* Adaptive Image Grid */}

          <div
          style={{
            // fixed image-area container
            position: 'relative',
            height: photoHeight,
            borderBottom: `1px solid ${darkMode ? '#333' : '#e0e0e0'}`,
            overflow: 'hidden',
          }}
        >
        {listing.status === 'PENDING' && (
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
            <StatusBadge status="PENDING" style={{
              fontSize: 12,
              padding: '5px 10px',
              borderRadius: 6,
              background: darkMode ? 'rgba(10,9,9,0.82)' : 'rgba(255,247,237,0.95)',
              backdropFilter: 'blur(8px)',
              border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(234,166,93,0.35)',
            }} />
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
        {images.length === 0 ? (
          <div
            style={{
              // full-size flex fallback
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
              color: darkMode ? 'white' : '#666',
              fontSize: '1rem',
            }}
          >
            No image found
          </div>
        ) : (
          <div
            style={{
              // grid uses the container's full height
              display: 'grid',
              gap: '2px',
              width: '100%',
              minWidth: 0,
              overflow: 'hidden',
              ...gridStyles,       // e.g. gridTemplateColumns/Rows
            }}
          >
            {images.map((src, idx) => (
              <div
                key={idx}
                className="skeleton"
                style={{
                  width: '100%',
                  height: '100%',
                  minWidth: 0,
                  minHeight: 0,
                  // Only apply gridArea for 3+ images where gridTemplateAreas is defined
                  ...(images.length >= 3 && {
                    gridArea: idx === 0 ? 'left' : idx === 1 ? 'right-top' : 'right-bottom'
                  })
                }}
              >
                <img
                  src={src}
                  alt={`Listing image ${idx + 1}`}
                  decoding="async"
                  width="600"
                  height="400"
                  fetchPriority={idx === 0 ? 'high' : 'low'}
                  onLoad={(e) => e.target.parentElement.classList.remove('skeleton')}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

        {/* Listing Details */}
        <div style={{ padding: '1rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '0.6rem', right: '0.6rem' }}>
            <div
              className="bookmark-hit"
              onClick={handleSaveToggle}
              style={{ borderRadius: '50%', cursor: 'pointer' }}
            >
              <AnimatedBookmark isSaved={isSaved} darkMode={darkMode} />
            </div>
          </div>


          <h2
            style={{
              color: darkMode ? 'white' : 'black',
              fontSize: '1.05rem',
              marginBottom: '0.5rem',
              fontWeight: 600,
              paddingRight: '3rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {listing.title}
          </h2>
          <div style={{ marginBottom: '0.3rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: darkMode ? 'white' : 'black' }}>
              {listing.price != null ? `$${listing.price}/mo` : ''}
            </span>
            {listing.listingType === 'BOTH' && listing.parking && (
              <span style={{ fontSize: '0.85rem', color: darkMode ? '#8a8280' : '#888', marginLeft: '0.5rem', fontFamily: 'Outfit, sans-serif' }}>
                {listing.parking.price > 0 ? `+ $${listing.parking.price}/mo parking` : '+ parking incl.'}
              </span>
            )}
          </div>

            <>
              {formatSpecs(listing) && (
                <div style={{ fontSize: '0.9rem', color: darkMode ? '#a39b97' : '#6e6e73', marginBottom: '0.35rem' }}>{formatSpecs(listing)}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.85rem', color: darkMode ? '#8a8280' : '#6e6e73' }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.street || listing.address}</span>
                {formatAvailability(listing) && (
                  <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{formatAvailability(listing)}</span>
                )}
              </div>
            </>
          {saveError && (
            <p style={{
              color: 'var(--badger-red)',
              fontSize: '0.8rem',
              margin: '0.5rem 0 0 0'
            }}>{saveError}</p>
          )}
        </div>
      </div>
    </Link>
    </>
  );
}

export default React.memo(ListingCard);
