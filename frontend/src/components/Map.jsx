import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect, useCallback, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import AnimatedBookmark from './AnimatedBookmark';
import { toLocalDate } from '../utils/listingFormat';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Create a custom price bubble divIcon with hardcoded colors
function createPriceBubble(price, isSelected) {
  return L.divIcon({
    className: 'price-bubble',
    html: `<div style="
      background-color: ${isSelected ? 'var(--badger-red)' : '#fff'};
      color: ${isSelected ? '#fff' : '#000'};
      border: 2px solid ${isSelected ? 'var(--badger-red)' : '#ccc'};
      border-radius: 25px;
      padding: 6px 12px;
      font-weight: bold;
      font-size: 14px;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      min-width: 40px;
      max-width: 60px;
      text-align: center;
    ">$${price}</div>`,
    iconSize: [75, 30],
    iconAnchor: [37, 15],
    popupAnchor: [0, -15]
  });
}

// Create a custom marker for multiple listings with hardcoded colors
function createClusterMarker(count, isSelected) {
  return L.divIcon({
    className: 'cluster-marker',
    html: `<div style="
      background-color: ${isSelected ? 'var(--badger-red)' : '#fff'};
      color: ${isSelected ? '#fff' : '#000'};
      border: 2px solid ${isSelected ? 'var(--badger-red)' : '#ccc'};
      border-radius: 25px;
      padding: 6px 12px;
      font-weight: bold;
      font-size: 14px;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      text-align: center;
      position: absolute;
      transform: translate(-50%, -50%);
    ">${count} Units</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -15]
  });
}

function normalizeListingType(raw) {
  if (!raw) return null;
  const v = String(raw).trim().toUpperCase();
  if (v === 'HOUSING' || v === 'PARKING' || v === 'BOTH') return v;
  return null;
}

function getParkingMonthlyPrice(listing) {
  // Prefer nested parking price if present; fall back to listing.price
  const nested = listing?.parking?.price ?? listing?.parkingPrice;
  if (typeof nested === 'number' && Number.isFinite(nested)) return nested;
  const direct = listing?.price;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  return null;
}

function coordKey(coords) {
  if (!coords || coords.length < 2) return '';
  return `${Number(coords[0]).toFixed(5)},${Number(coords[1]).toFixed(5)}`;
}

function offsetCoords(coords, index = 0) {
  // Small deterministic offset so overlapping markers are clickable.
  // ~0.00015° is ~12m latitude; small enough for UX, big enough to click.
  const baseLat = coords?.[0];
  const baseLng = coords?.[1];
  if (typeof baseLat !== 'number' || typeof baseLng !== 'number') return coords;

  const d = 0.00015;
  const ring = Math.floor(index / 4) + 1;
  const pos = index % 4;
  const deltas = [
    [d, 0],
    [-d, 0],
    [0, d],
    [0, -d],
  ];
  const [dl, dn] = deltas[pos];
  return [baseLat + dl * ring, baseLng + dn * ring];
}

function createParkingDot(isSelected, { faint = false } = {}) {
  const size = isSelected ? 26 : 22;
  const opacity = faint ? 0.35 : 1;
  return L.divIcon({
    className: 'parking-dot',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      border-radius: 9999px;
      background-color: #1e293b;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 11px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.18);
      border: 2px solid rgba(255,255,255,0.85);
      opacity: ${opacity};
      transform: ${isSelected ? 'scale(1.05)' : 'scale(1)'};
    ">P</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createParkingSelectedPill(price) {
  const safe = typeof price === 'number' ? price : 0;
  return L.divIcon({
    className: 'parking-pill',
    html: `<div style="
      background-color: #1e293b;
      color: #fff;
      border: 2px solid rgba(255,255,255,0.85);
      border-radius: 9999px;
      padding: 5px 10px 5px 7px;
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 1px 5px rgba(0,0,0,0.18);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    ">
      <span style="
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255,255,255,0.22);
        font-size: 10px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: 0.02em;
      ">P</span>
      <span>$${safe}/mo</span>
    </div>`,
    iconSize: [92, 28],
    iconAnchor: [46, 14],
    popupAnchor: [0, -14],
  });
}

function createParkingClusterMarker(count, isSelected) {
  return L.divIcon({
    className: 'parking-cluster',
    html: `<div style="
      background-color: #1e293b;
      color: #fff;
      border: 2px solid rgba(255,255,255,0.85);
      border-radius: 9999px;
      padding: 5px 10px;
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 1px 5px rgba(0,0,0,0.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transform: ${isSelected ? 'scale(1.05)' : 'scale(1)'};
      line-height: 1;
      letter-spacing: 0.01em;
    ">P (${count})</div>`,
    iconSize: [56, 28],
    iconAnchor: [28, 14],
    popupAnchor: [0, -14],
  });
}

/* previous badge style removed */

export default function Map({ listings = [], selectedListing = null, onMarkerClick, singleListing = null, savedListings, onSaveToggle, showRecenter = true, isMobile = false, persistViewKey = null }) {
  const { darkMode } = useContext(ThemeContext);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCluster, setActiveCluster] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedParking, setSelectedParking] = useState(null);
  const [showParkingPreview, setShowParkingPreview] = useState(false);
  const [activeParkingCluster, setActiveParkingCluster] = useState(null);
  const [parkingIndex, setParkingIndex] = useState(0);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [mapZoom, setMapZoom] = useState(null);

  // Define constants at the top of the component
  const DEFAULT_CENTER = [43.0709, -89.4];
  const DEFAULT_ZOOM = 15;
  const PARKING_REVEAL_ZOOM = 15;

  // Initialize map with default coordinates
  useEffect(() => {
    // Opt-in (persistViewKey): restore the last pan/zoom so going to a listing and back keeps your place
    let savedView = null;
    if (persistViewKey) {
      try {
        const v = JSON.parse(sessionStorage.getItem(persistViewKey));
        if (Number.isFinite(v?.lat) && Number.isFinite(v?.lng) && Number.isFinite(v?.zoom)) savedView = v;
      } catch { /* no saved view */ }
    }

    const newMap = L.map('map', {
      doubleClickZoom: false
    }).setView(
      savedView ? [savedView.lat, savedView.lng] : DEFAULT_CENTER,
      savedView ? savedView.zoom : DEFAULT_ZOOM
    );

    if (persistViewKey) {
      newMap.on('moveend', () => {
        const c = newMap.getCenter();
        try {
          sessionStorage.setItem(persistViewKey, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: newMap.getZoom() }));
        } catch { /* storage unavailable */ }
      });
    }
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(newMap);

    setMap(newMap);
    setMapZoom(newMap.getZoom());

    const onZoomEnd = () => setMapZoom(newMap.getZoom());
    newMap.on('zoomend', onZoomEnd);

    return () => {
      newMap.off('zoomend', onZoomEnd);
      newMap.remove();
    };
  }, []);
  // Simple navigation functions for the preview carousel
  const goToNext = () => {
    if (!activeCluster || activeCluster.listings.length <= 1) return;
    
    const nextIndex = (currentIndex + 1) % activeCluster.listings.length;
    setCurrentIndex(nextIndex);
  };

  const goToPrev = () => {
    if (!activeCluster || activeCluster.listings.length <= 1) return;
    
    const prevIndex = (currentIndex - 1 + activeCluster.listings.length) % activeCluster.listings.length;
    setCurrentIndex(prevIndex);
  };

  const goToNextParking = () => {
    if (!activeParkingCluster || activeParkingCluster.listings.length <= 1) return;
    const nextIndex = (parkingIndex + 1) % activeParkingCluster.listings.length;
    setParkingIndex(nextIndex);
  };

  const goToPrevParking = () => {
    if (!activeParkingCluster || activeParkingCluster.listings.length <= 1) return;
    const prevIndex = (parkingIndex - 1 + activeParkingCluster.listings.length) % activeParkingCluster.listings.length;
    setParkingIndex(prevIndex);
  };

  // Group listings by location
  const groupListingsByLocation = useCallback((listingsArray) => {
    const groups = {};
    
    listingsArray.forEach(listing => {
      // Create a key based on coordinates (rounded to 5 decimal places for proximity grouping)
      const key = `${listing.coords[0].toFixed(5)},${listing.coords[1].toFixed(5)}`;
      
      if (!groups[key]) {
        groups[key] = {
          coords: listing.coords,
          listings: []
        };
      }
      
      groups[key].listings.push(listing);
    });
    
    return Object.values(groups);
  }, []);

  // Close the preview when clicking elsewhere on the map
  const handleMapClick = useCallback((e) => {
    if (e.originalEvent.target.classList.contains('leaflet-container') ||
        e.originalEvent.target.classList.contains('leaflet-tile')) {
      
      setShowPreview(false);
      setActiveCluster(null);
      setShowParkingPreview(false);
      setSelectedParking(null);
      setActiveParkingCluster(null);
      setParkingIndex(0);
      
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      
      // Only fly to default view if we're not already there
      const latDiff = Math.abs(currentCenter.lat - DEFAULT_CENTER[0]);
      const lngDiff = Math.abs(currentCenter.lng - DEFAULT_CENTER[1]);
      
      if (latDiff > 0.0001 || lngDiff > 0.0001 || currentZoom !== DEFAULT_ZOOM) {
        map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
          duration: 0.75,
          easeLinearity: 0.25
        });
      }
      
      onMarkerClick?.(null);
    }
  }, [map, onMarkerClick]);

  // Updated marker effect
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    const newMarkers = [];

    // Handle single listing view
    if (singleListing) {
      const marker = L.marker(singleListing.coords, {
        icon: L.divIcon({
          className: 'pinpoint-marker',
          html: `<svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C8.268 0 2 6.268 2 14c0 9.941 12.09 24.045 12.602 24.627a2 2 0 0 0 2.796 0C17.91 38.045 30 23.941 30 14c0-7.732-6.268-14-14-14zm0 21a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" fill="var(--badger-red)"/>
            <circle cx="16" cy="14" r="5" fill="white"/>
          </svg>`,
          iconSize: [32, 40],
          iconAnchor: [16, 40]
        })
      }).addTo(map);

      marker.options.interactive = false;

      newMarkers.push(marker);
    }
    // Handle listings page view
    else {
      // Follow the existing page filters; just style markers based on listingType.
      const housingListings = listings.filter(l => {
        const t = normalizeListingType(l?.listingType);
        return t === 'HOUSING' || t === 'BOTH' || !t; // treat missing as housing
      });

      const parkingListings = listings.filter(l => normalizeListingType(l?.listingType) === 'PARKING');

      // Group listings by location
      const groupedListings = groupListingsByLocation(housingListings);
      
      // Check if activeCluster's listings are still in the filtered results
      if (activeCluster) {
        const activeListingsStillExist = activeCluster.listings.some(activeListing => 
          housingListings.some(l => l.id === activeListing.id)
        );
        
        if (!activeListingsStillExist) {
          setShowPreview(false);
          setActiveCluster(null);
        }
      }

      groupedListings.forEach(group => {
        // Check if this group is the active cluster
        const isSelected = activeCluster && 
          group.coords[0] === activeCluster.coords[0] && 
          group.coords[1] === activeCluster.coords[1];
        
        // Create a marker based on whether it's a single listing or multiple
        const marker = L.marker(group.coords, {
          icon: group.listings.length === 1
            ? createPriceBubble(group.listings[0].price, isSelected)
            : createClusterMarker(group.listings.length, isSelected),
          riseOnHover: true,
          riseOffset: 2000
        }).addTo(map);

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);

          // Ensure only one preview is ever open
          setShowParkingPreview(false);
          setSelectedParking(null);
          setActiveParkingCluster(null);
          setParkingIndex(0);
          
          // Check if this marker is already active
          if (activeCluster && 
              group.coords[0] === activeCluster.coords[0] && 
              group.coords[1] === activeCluster.coords[1]) {
            return; // Do nothing if clicking the same marker
          }
          
          onMarkerClick?.(group.listings[0]);

          // Update all markers to reset their icons
          newMarkers.forEach(m => {
            const markerGroup = groupedListings.find(g => 
              g.coords[0] === m.getLatLng().lat && 
              g.coords[1] === m.getLatLng().lng
            );
            if (markerGroup) {
              m.setIcon(markerGroup.listings.length === 1
                ? createPriceBubble(markerGroup.listings[0].price, false)
                : createClusterMarker(markerGroup.listings.length, false)
              );
            }
          });
          
          // Update clicked marker's icon
          marker.setIcon(group.listings.length === 1
            ? createPriceBubble(group.listings[0].price, true)
            : createClusterMarker(group.listings.length, true)
          );
          
          setActiveCluster(group);
          setCurrentIndex(0);
          setShowPreview(true);
        });

        newMarkers.push(marker);
      });

      // Parking markers: separate visual language (no price unless selected)
      const shouldRevealParking = (mapZoom ?? DEFAULT_ZOOM) >= PARKING_REVEAL_ZOOM;
      const hasHousingOnMap = housingListings.length > 0;
      const housingCoordKeys = new Set(groupedListings.map(g => coordKey(g.coords)));
      const groupedParking = groupListingsByLocation(parkingListings);
      if (groupedParking.length > 0) {
        groupedParking.forEach(group => {
          // De-clutter: when mixed with housing and zoomed out, hide parking markers
          if (!shouldRevealParking && hasHousingOnMap) return;

          const isSelectedCluster = !!activeParkingCluster &&
            group.coords[0] === activeParkingCluster.coords[0] &&
            group.coords[1] === activeParkingCluster.coords[1];

          const isSelectedSingle = !activeParkingCluster && selectedParking && group.listings.length === 1
            && group.listings[0].id === selectedParking.id;

          const listingForPrice = group.listings[0];
          const price = getParkingMonthlyPrice(listingForPrice);

          const icon = group.listings.length === 1
            ? ((isSelectedSingle && price != null) ? createParkingSelectedPill(price) : createParkingDot(isSelectedSingle, { faint: !shouldRevealParking }))
            : createParkingClusterMarker(group.listings.length, isSelectedCluster);

          const key = coordKey(group.coords);
          const collidesWithHousing = hasHousingOnMap && housingCoordKeys.has(key);
          const position = collidesWithHousing ? offsetCoords(group.coords, 0) : group.coords;

          const marker = L.marker(position, {
            icon,
            riseOnHover: true,
            riseOffset: 2000,
            zIndexOffset: 1000,
          }).addTo(map);

          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);

            // Close housing preview if open
            setShowPreview(false);
            setActiveCluster(null);
            onMarkerClick?.(null);

            // Ensure only one preview is ever open
            setShowParkingPreview(true);

            if (group.listings.length === 1) {
              setActiveParkingCluster(null);
              setParkingIndex(0);
              setSelectedParking(group.listings[0]);
            } else {
              setActiveParkingCluster(group);
              setParkingIndex(0);
              setSelectedParking(group.listings[0]);
            }
          });

          newMarkers.push(marker);
        });
      }

      // Check if selectedListing exists and is still in the listings array
      if (selectedListing) {
        const listingStillExists = housingListings.some(l => l.id === selectedListing.id);
        if (!listingStillExists) {
          // If the selected listing was filtered out, notify parent and return to default view
          onMarkerClick?.(null);
          map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
            duration: 0.75,
            easeLinearity: 0.25
          });
        }
      }
    }

    setMarkers(newMarkers);
  }, [map, listings, onMarkerClick, singleListing, selectedListing, groupListingsByLocation, handleMapClick, activeCluster, mapZoom, selectedParking, activeParkingCluster]);

  // Center/zoom the map on the single listing only when the listing itself changes,
  // NOT on every zoom event (otherwise the user scrolling out gets snapped back).
  useEffect(() => {
    if (!map || !singleListing?.coords) return;
    map.flyTo(singleListing.coords, 16);
  }, [map, singleListing?.coords?.[0], singleListing?.coords?.[1]]);

  // Add this new effect to update currentIndex when selectedListing changes
  useEffect(() => {
    if (selectedListing && activeCluster) {
      const index = activeCluster.listings.findIndex(listing => listing.id === selectedListing.id);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [selectedListing, activeCluster]);

  // Keep selectedParking in sync when cycling a parking cluster
  useEffect(() => {
    if (activeParkingCluster && activeParkingCluster.listings?.length > 0) {
      const next = activeParkingCluster.listings[parkingIndex] || activeParkingCluster.listings[0];
      if (next) setSelectedParking(next);
    }
  }, [activeParkingCluster, parkingIndex]);

  // First, add this function near the top of the component
  const resetMarkerIcons = useCallback((markers, groupedListings) => {
    const housingCoords = new Set(groupedListings.map(g => `${g.coords[0]},${g.coords[1]}`));
    markers.forEach(m => {
      const lat = m.getLatLng().lat;
      const lng = m.getLatLng().lng;
      const key = `${lat},${lng}`;
      if (!housingCoords.has(key)) return;
      const markerGroup = groupedListings.find(g => 
        g.coords[0] === lat && g.coords[1] === lng
      );
      if (markerGroup) {
        m.setIcon(markerGroup.listings.length === 1
          ? createPriceBubble(markerGroup.listings[0].price, false)
          : createClusterMarker(markerGroup.listings.length, false)
        );
      }
    });
  }, []);

  // Handle save/unsave
  const handleSaveToggle = async (e, listing) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent other click handlers
    
    // If user is not logged in, show auth modal
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    
    if (saveLoading) return;

    try {
      setSaveLoading(true);
      const listingId = listing.publicId || listing.id;
      await onSaveToggle(listingId, !savedListings.has(listingId));
    } catch {
      const listingId = listing.publicId || listing.id;
      setSaveError(`Error ${savedListings.has(listingId) ? 'unsaving' : 'saving'} the listing.`);
      setTimeout(() => setSaveError(''), 3000);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div id="map" style={{ height: '100%', width: '100%' }}></div>

      {saveError && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(197, 5, 12, 0.9)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          zIndex: 1000
        }}>
          {saveError}
        </div>
      )}
      
      {/* Listing Preview */}
      {showPreview && activeCluster && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '400px',
          backgroundColor: darkMode ? '#171514' : '#faf7f1',
          borderRadius: '8px',
          boxShadow: darkMode 
            ? '0 4px 12px rgba(0,0,0,0.4)'
            : '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
          overflow: 'visible',
          border: `1px solid ${darkMode ? '#2a2826' : '#e4ddd0'}`
        }}>
          {/* Preview Header */}
          <div style={{
            padding: '8px 14px',
            borderBottom: `1px solid ${darkMode ? '#2a2826' : '#e4ddd0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: darkMode ? '#8a8280' : '#999',
              fontFamily: 'Outfit, sans-serif',
            }}>
              {activeCluster.listings.length > 1
                ? `${activeCluster.listings.length} Units Available`
                : 'Unit Preview'}
            </span>
            <button
              onClick={() => {
                setShowPreview(false);
                setActiveCluster(null);
                const groupedListings = groupListingsByLocation(listings);
                resetMarkerIcons(markers, groupedListings);
              }}
              style={{
                background: 'none', border: 'none', fontSize: '18px',
                cursor: 'pointer', padding: '2px 6px',
                color: darkMode ? '#8a8280' : '#aaa', lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Preview Content */}
          <div style={{ padding: isMobile ? '10px' : '14px', color: darkMode ? '#f0ebe5' : '#1d1d1f' }}>
            {activeCluster.listings[currentIndex] && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.4rem' : '0.6rem' }}>
                  {/* Image and Details Row */}
                  <div
                    onClick={() => {
                      const listing = activeCluster.listings[currentIndex];
                      setShowPreview(false);
                      navigate(`/listings/${listing.id}`);
                    }}
                    className="map-preview-row"
                    style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', borderRadius: '8px', margin: '-4px', padding: '4px' }}
                  >
                    {/* Image Preview */}
                    <div style={{
                      width: isMobile ? '80px' : '115px', height: isMobile ? '80px' : '115px',
                      borderRadius: '8px', overflow: 'hidden',
                      backgroundColor: darkMode ? '#211f1e' : '#f3eee6',
                      flexShrink: 0,
                    }}>
                      {activeCluster.listings[currentIndex].images?.length > 0 ? (
                        <img
                          src={activeCluster.listings[currentIndex].images[0]}
                          alt="Listing preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: darkMode ? '#8a8280' : '#6e6e73', fontSize: '12px' }}>
                          No image
                        </div>
                      )}
                    </div>

                    {/* Listing Details */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {/* Title row with bookmark */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px', minWidth: 0 }}>
                        <h4
                          style={{
                            margin: 0, fontSize: isMobile ? '14px' : '17px', fontWeight: 700,
                            color: darkMode ? '#f0ebe5' : '#1d1d1f',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            minWidth: 0, flex: 1,
                          }}
                          title={activeCluster.listings[currentIndex].title}
                        >
                          {activeCluster.listings[currentIndex].title}
                        </h4>
                        <div
                          onClick={(e) => handleSaveToggle(e, activeCluster.listings[currentIndex])}
                          style={{ cursor: 'pointer', opacity: saveLoading ? 0.5 : 1, flexShrink: 0, marginTop: '-2px' }}
                        >
                          <AnimatedBookmark
                            isSaved={savedListings.has(activeCluster.listings[currentIndex].publicId || activeCluster.listings[currentIndex].id)}
                            darkMode={darkMode}
                            size={22}
                          />
                        </div>
                      </div>

                      {/* Price */}
                      <p style={{ margin: 0, fontWeight: 600, fontSize: isMobile ? '13px' : '15px', color: darkMode ? '#d4cfc9' : '#3a3530' }}>
                        ${activeCluster.listings[currentIndex].price}/mo
                      </p>

                      {/* Date */}
                      {!isMobile && (
                        <p style={{ margin: 0, fontSize: '13px', color: darkMode ? '#8a8280' : '#6e6e73' }}>
                          {activeCluster.listings[currentIndex].startDate &&
                            toLocalDate(activeCluster.listings[currentIndex].startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {activeCluster.listings[currentIndex].endDate &&
                            ` – ${toLocalDate(activeCluster.listings[currentIndex].endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                        </p>
                      )}
                    </div>

                  </div>
                  {/* Navigation Controls - only show if multiple listings */}
                  {activeCluster.listings.length > 1 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      paddingTop: isMobile ? '8px' : '10px',
                      borderTop: `1px solid ${darkMode ? '#2a2826' : '#e4ddd0'}`,
                    }}>
                      <button
                        onClick={goToPrev}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          color: darkMode ? '#f0ebe5' : '#555',
                          fontSize: '14px',
                          lineHeight: 1,
                          outline: 'none',
                        }}
                      >
                        ←
                      </button>
                      <span style={{ fontSize: '11px', color: darkMode ? '#f0ebe5' : '#555', fontFamily: 'Outfit, sans-serif' }}>
                        {currentIndex + 1} / {activeCluster.listings.length}
                      </span>
                      <button
                        onClick={goToNext}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: '2px 6px',
                          cursor: 'pointer',
                          color: darkMode ? '#f0ebe5' : '#555',
                          fontSize: '14px',
                          lineHeight: 1,
                          outline: 'none',
                        }}
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Parking Preview (lightweight) */}
      {showParkingPreview && selectedParking && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '400px',
          backgroundColor: darkMode ? '#171514' : '#faf7f1',
          borderRadius: '8px',
          boxShadow: darkMode
            ? '0 4px 12px rgba(0,0,0,0.4)'
            : '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000,
          overflow: 'visible',
          border: `1px solid ${darkMode ? '#2a2826' : '#e4ddd0'}`
        }}>
          {/* Preview Header (match Unit Preview formatting) */}
          <div style={{
            padding: '8px 14px',
            borderBottom: `1px solid ${darkMode ? '#2a2826' : '#e4ddd0'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: darkMode ? '#8a8280' : '#999',
              fontFamily: 'Outfit, sans-serif',
            }}>
              {activeParkingCluster && activeParkingCluster.listings.length > 1
                ? `${activeParkingCluster.listings.length} Spots Available`
                : 'Spot Preview'}
            </span>
            <button
              onClick={() => {
                setShowParkingPreview(false);
                setSelectedParking(null);
                setActiveParkingCluster(null);
                setParkingIndex(0);
              }}
              style={{
                background: 'none', border: 'none', fontSize: '18px',
                cursor: 'pointer', padding: '2px 6px',
                color: darkMode ? '#8a8280' : '#aaa', lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Preview Content (match Unit Preview formatting) */}
          <div style={{ padding: isMobile ? '10px' : '14px', color: darkMode ? '#f0ebe5' : '#1d1d1f' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.4rem' : '0.6rem' }}>
              <div
                onClick={() => {
                  setShowParkingPreview(false);
                  navigate(`/listings/${selectedParking.id}`);
                }}
                className="map-preview-row"
                style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', borderRadius: '8px', margin: '-4px', padding: '4px' }}
              >
                {/* Image Preview */}
                <div style={{
                  width: isMobile ? '80px' : '115px', height: isMobile ? '80px' : '115px',
                  borderRadius: '8px', overflow: 'hidden',
                  backgroundColor: darkMode ? '#211f1e' : '#f3eee6',
                  flexShrink: 0,
                }}>
                  {selectedParking.images?.length > 0 ? (
                    <img
                      src={selectedParking.images[0]}
                      alt="Listing preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: darkMode ? '#8a8280' : '#6e6e73', fontSize: '12px'
                    }}>
                      No image
                    </div>
                  )}
                </div>

                {/* Listing Details */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {/* Title row with bookmark */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px', minWidth: 0 }}>
                    <h4
                      style={{
                        margin: 0, fontSize: isMobile ? '14px' : '17px', fontWeight: 700,
                        color: darkMode ? '#f0ebe5' : '#1d1d1f',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        minWidth: 0, flex: 1,
                      }}
                      title={selectedParking.title}
                    >
                      {selectedParking.title || 'Parking Spot'}
                    </h4>
                    <div
                      onClick={(e) => handleSaveToggle(e, selectedParking)}
                      style={{ cursor: 'pointer', opacity: saveLoading ? 0.5 : 1, flexShrink: 0, marginTop: '-2px' }}
                    >
                      <AnimatedBookmark
                        isSaved={savedListings.has(selectedParking.publicId || selectedParking.id)}
                        darkMode={darkMode}
                        size={22}
                      />
                    </div>
                  </div>

                  {/* Price */}
                  <p style={{ margin: 0, fontWeight: 600, fontSize: isMobile ? '13px' : '15px', color: darkMode ? '#d4cfc9' : '#3a3530' }}>
                    {getParkingMonthlyPrice(selectedParking) != null ? `$${getParkingMonthlyPrice(selectedParking)}/mo` : 'Price unavailable'}
                  </p>

                  {/* Date */}
                  {!isMobile && (
                    <p style={{ margin: 0, fontSize: '13px', color: darkMode ? '#8a8280' : '#6e6e73' }}>
                      {selectedParking.startDate &&
                        toLocalDate(selectedParking.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {selectedParking.endDate &&
                        ` – ${toLocalDate(selectedParking.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  )}
                </div>

              </div>

              {/* Navigation Controls - only show if multiple parking listings */}
              {activeParkingCluster && activeParkingCluster.listings.length > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  paddingTop: isMobile ? '8px' : '10px',
                  borderTop: `1px solid ${darkMode ? '#2a2826' : '#e4ddd0'}`,
                }}>
                  <button
                    onClick={goToPrevParking}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      color: darkMode ? '#f0ebe5' : '#555',
                      fontSize: '14px',
                      lineHeight: 1,
                      outline: 'none',
                    }}
                  >
                    ←
                  </button>
                  <span style={{ fontSize: '11px', color: darkMode ? '#f0ebe5' : '#555', fontFamily: 'Outfit, sans-serif' }}>
                    {parkingIndex + 1} / {activeParkingCluster.listings.length}
                  </span>
                  <button
                    onClick={goToNextParking}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      color: darkMode ? '#f0ebe5' : '#555',
                      fontSize: '14px',
                      lineHeight: 1,
                      outline: 'none',
                    }}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recenter button */}
      {showRecenter && <button
        onClick={() => {
          // Check if we're already at default view
          const currentCenter = map.getCenter();
          const currentZoom = map.getZoom();
          const isAtDefault = 
            Math.abs(currentCenter.lat - DEFAULT_CENTER[0]) < 0.0001 && 
            Math.abs(currentCenter.lng - DEFAULT_CENTER[1]) < 0.0001 && 
            currentZoom === DEFAULT_ZOOM;
          
          if (isAtDefault) {
            return; // Do nothing if already at default view
          }
          
          map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
            duration: 0.75,
            easeLinearity: 0.25
          });
          setShowPreview(false);
          setActiveCluster(null);
          setShowParkingPreview(false);
          setSelectedParking(null);
          setActiveParkingCluster(null);
          setParkingIndex(0);
        }}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'white',
          color: '#000',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '8px 12px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: '500',
          outline: 'none'
        }}
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 8v8"/>
          <path d="M8 12h8"/>
        </svg>
        RECENTER
      </button>}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        darkMode={darkMode}
        title="Sign in to save listings"
      />
    </div>
  );
}
