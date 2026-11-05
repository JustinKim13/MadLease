import { useState, useEffect, useCallback, useRef, useContext, useLayoutEffect, useMemo, forwardRef } from 'react';
import * as ReactWindow from 'react-window';
const { FixedSizeList: List } = ReactWindow; 
import { useSearchParams } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import { INTERACTION_CSS } from '../styles/interactions';
import Filters from '../components/Filters';
import MobileFilterSheet from '../components/MobileFilterSheet';
import AmbientBlobs from '../components/AmbientBlobs';
import Map from '../components/Map';
import { ThemeContext } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useListingsQuery, useSavedListingsQuery, useSaveListingMutations } from '../services/listingQueries';
import AuthModal from '../components/AuthModal';
import Seo from '../components/Seo';

// Custom inner element for react-window to add padding at the bottom
const ListInnerElement = forwardRef(({ style, ...rest }, ref) => (
  <div
    ref={ref}
    style={{
      ...style,
      height: `${parseFloat(style.height) + 20}px` // Add 20px padding at bottom for last card
    }}
    {...rest}
  />
));

// Row renderer defined OUTSIDE Listings so its reference is stable across parent re-renders.
// react-window uses createElement(children, ...) — if children is an inline arrow function
// that changes reference every render, React unmounts+remounts every visible card on each
// parent re-render, causing the card to flash/shake when the save mutation fires.
const ListingRow = ({ index, style, data }) => {
  const { listings, savedListingIds, updateSavedStatus, saveScrollPosition, isMobile, cardHeight, selectedId } = data;
  const listing = listings[index];
  if (!listing) return null;
  return (
    <div style={style}>
      <div className="listing-row" style={{ height: cardHeight, paddingTop: '4px', paddingBottom: '4px', paddingRight: isMobile ? '0' : '16px' }}>
        <ListingCard
          id={`listing-${listing.id}`}
          listing={listing}
          isMobile={isMobile}
          isSelected={(listing.publicId || listing.id) === selectedId}
          isSaved={savedListingIds.has(listing.publicId || listing.id)}
          onSaveToggle={updateSavedStatus}
          onSaveScroll={saveScrollPosition}
        />
      </div>
    </div>
  );
};


const commonAmenities = [
  'In-unit laundry', 'Central A/C', 'Balcony', 'Dishwasher',
  'Wifi', 'Furnished', 'Parking available', 'Gym',
];

const SORT_OPTIONS = [
  { value: '',           label: 'Default' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest',     label: 'Date Listed: Newest' },
  { value: 'oldest',     label: 'Date Listed: Oldest' },
  { value: 'start_asc',  label: 'Start Date: Closest' },
];

const SEMESTER_OPTIONS = [
  { value: '',            label: 'Any'         },
  { value: 'spring',      label: 'Spring'      },
  { value: 'summer',      label: 'Summer'      },
  { value: 'fall',        label: 'Fall'        },
  { value: 'entire_year', label: 'Entire Year' },
];

// Returns the set of semester keys a listing belongs to.
// Primary semester is determined by start month, with boundary rules:
//   Apr/May start → summer, unless end is also ≤ May → spring
//   Aug start     → fall,   unless end is also ≤ Aug → summer
// Cross-semester: if a listing extends past its primary semester it shows in the next one too.
function getListingSemesters(listing) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!listing.startDate) return [];

  const listingStart = new Date(listing.startDate);
  const listingEnd   = listing.endDate ? new Date(listing.endDate) : null;
  const effectiveEnd = listingEnd ?? new Date(9999, 11, 31);

  if (effectiveEnd < today) return [];

  const startMonth = listingStart.getMonth() + 1; // 1–12

  // Stretch cross-year end months linearly so threshold comparisons stay simple
  // e.g. March of next year = 3 + 12 = 15, which is > 8, so it extends into fall
  const effectiveEndMonth = !listingEnd
    ? 99
    : listingEnd.getMonth() + 1 + (listingEnd.getFullYear() - listingStart.getFullYear()) * 12;

  // December leases are spring (move-in before Jan semester start); shift thresholds by 12
  const offset = startMonth === 12 ? 12 : 0;

  let primary;
  if (startMonth <= 3 || startMonth === 12) {
    primary = 'spring';
  } else if (startMonth <= 5) {
    // Apr or May: spring if it also ends in spring (≤ May), otherwise summer
    primary = effectiveEndMonth <= 5 ? 'spring' : 'summer';
  } else if (startMonth <= 7) {
    primary = 'summer';
  } else if (startMonth === 8) {
    // Aug: summer if it also ends in summer (≤ Aug), otherwise fall
    primary = effectiveEndMonth <= 8 ? 'summer' : 'fall';
  } else {
    primary = 'fall';
  }

  const semesters = new Set([primary]);

  //spring and summer if it starts in spring and ends in summer/before fall
  if (primary === 'spring' && effectiveEndMonth > (5 + offset) && effectiveEndMonth <= (8 + offset)) semesters.add('summer');
  //summer and fall if it starts in summer and ends in fall/before spring
  if (primary === 'summer' && effectiveEndMonth > 8 && effectiveEndMonth <= 13) semesters.add('fall');
  //CANNOT have fall and spring, because that makes it just a full year lease!

  if(primary === 'fall' && effectiveEndMonth > 15){
    semesters.add('entire_year');
    semesters.delete('fall');
  }
  if(primary === 'spring' && effectiveEndMonth > (11 + offset)){
    semesters.add('entire_year');
    semesters.delete('spring');
  }


  return [...semesters];
}

function MobileSortModal({ darkMode, current, onChange, onClose }) {
  const chipStyle = (isSelected) => ({
    padding: '0.4rem 0.75rem',
    borderRadius: '18px',
    border: 'none',
    backgroundColor: isSelected ? 'var(--badger-red)' : (darkMode ? '#333' : '#eee'),
    color: isSelected ? 'white' : (darkMode ? '#ccc' : '#555'),
    fontSize: '0.8rem',
    fontWeight: isSelected ? '600' : '400',
    cursor: 'pointer',
  });

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: darkMode ? '#1a1a1a' : 'white', borderRadius: '12px', padding: '0.85rem', width: 'calc(100% - 2rem)', maxWidth: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h3 style={{ margin: 0, color: darkMode ? 'white' : 'black', fontSize: '1rem', fontWeight: '700' }}>Sort By</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '0.25rem', cursor: 'pointer', color: darkMode ? '#888' : '#666', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {SORT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => onChange(opt.value)} style={{ ...chipStyle(current === opt.value), textAlign: 'center', borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Listings() {
  const { darkMode } = useContext(ThemeContext);
  const { currentUser, loading: authLoading } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const [isTabletPortrait, setIsTabletPortrait] = useState(
    window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerHeight >= 600 && !(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600)
  );
  const [useCompactFiltersHeader, setUseCompactFiltersHeader] = useState(window.innerWidth < 1400);
  const [selectedListing, setSelectedListing] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showMap, setShowMap] = useState(() => sessionStorage.getItem('listingsView') === 'map');
  // Which way the mobile list/map slide should travel; null on first load so nothing animates
  const [viewDirection, setViewDirection] = useState(null);
  const viewSlideClass = viewDirection ? `hm-view-in-${viewDirection}` : undefined;
  const [sortOption, setSortOption] = useState(() => sessionStorage.getItem('listingsSort') || '');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [showSortModal, setShowSortModal] = useState(false);
  const [listHeight, setListHeight] = useState(600); // Height for virtualized list
  const listingsContainerRef = useRef(null);
  const virtualListRef = useRef(null); // Ref for react-window list
  const virtualListOuterRef = useRef(null); // Ref for react-window's scroll container
  const filtersInteractedRef = useRef(false); // true once user (or restore) has set non-default filters
  const pendingRestoreRef = useRef(false); // true between setSearchParams(saved) and searchParams propagating
  const [filterKey, setFilterKey] = useState('init')
  const [filterResetSignal, setFilterResetSignal] = useState(0)

  // Card height constant for virtualization (image 242px + details ~130px + border)
  const CARD_HEIGHT = 388;
  const CARD_GAP = 0;

  // Get userId from currentUser
  const userId = currentUser?.uid;

  // Derive API filters from URL params
  const [searchParams, setSearchParams] = useSearchParams();
  // Price bounds are applied client-side (see rentFilter below) so dragging the slider doesn't refetch
  const filters = useMemo(() => {
    const f = {};
    const listingType = searchParams.get('listingType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const roommates = searchParams.get('roommates');
    const bedrooms = searchParams.get('bedrooms');
    const amenities = searchParams.get('amenities');

    if (listingType !== null) f.listingType = listingType;
    if (startDate !== null) f.startDate = startDate;
    if (endDate !== null) f.endDate = endDate;
    if (roommates !== null) f.roommates = roommates;
    if (bedrooms !== null) f.bedrooms = bedrooms;
    if (amenities !== null) f.amenities = amenities;

    return f;
  }, [searchParams]);

  // Convert URL params back to UI format for the Filters component
  const initialFilters = useMemo(() => ({
    listingType: searchParams.get('listingType') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
    priceRange: [
      parseInt(searchParams.get('minRent')) || 0,
      parseInt(searchParams.get('maxRent')) || 3000
    ],
    roommates: searchParams.has('roommates') ? parseInt(searchParams.get('roommates')) : -1,
    amenities: commonAmenities.reduce((acc, amenity) => {
      const selected = searchParams.get('amenities')?.split(',') || [];
      acc[amenity] = selected.includes(amenity);
      return acc;
    }, {})
  }), [searchParams]);

  const hasActiveFilters = !!(
    initialFilters.listingType ||
    initialFilters.startDate ||
    initialFilters.endDate ||
    initialFilters.priceRange[0] !== 0 ||
    initialFilters.priceRange[1] !== 3000 ||
    initialFilters.roommates !== -1 ||
    Object.values(initialFilters.amenities).some(v => v) ||
    semesterFilter
  );

  // Filtered against `price` (rent for HOUSING/BOTH, parking.price for PARKING-only —
  // see fetchListings), NOT the raw `rent` field, which is null for parking-only listings
  // and would otherwise drop them the instant either bound is set.
  const rentFilter = useMemo(() => {
    const minRent = searchParams.get('minRent');
    const maxRent = searchParams.get('maxRent');
    const min = minRent !== null ? parseInt(minRent) : null;
    const max = maxRent !== null ? parseInt(maxRent) : null;
    return { min: Number.isNaN(min) ? null : min, max: Number.isNaN(max) ? null : max };
  }, [searchParams]);

  // use TanStack Query hooks for data fetching
  const { data: fetchedListings = [], isLoading: listingsLoading } = useListingsQuery(filters);
  const listings = useMemo(() => {
    const { min, max } = rentFilter;
    if (min === null && max === null) return fetchedListings;
    return fetchedListings.filter((l) => {
      if (l.price == null) return false;
      if (min !== null && l.price < min) return false;
      if (max !== null && l.price > max) return false;
      return true;
    });
  }, [fetchedListings, rentFilter]);
  const sortedListings = useMemo(() => {
    let arr = [...listings];

    if (sortOption === 'price_asc')
      arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sortOption === 'price_desc')
      arr.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    else if (sortOption === 'newest')
      arr.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    else if (sortOption === 'oldest')
      arr.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    else if (sortOption === 'start_asc') {
      const today = Date.now();
      arr.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return Math.abs(new Date(a.startDate) - today) - Math.abs(new Date(b.startDate) - today);
      });
    } else if (semesterFilter) {
      // When semester active with no explicit sort, sort chronologically (2026 before 2027)
      arr.sort((a, b) => {
        if (!a.startDate && !b.startDate) return 0;
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return new Date(a.startDate) - new Date(b.startDate);
      });
    }

    if (semesterFilter) {
      arr = arr.filter(l => getListingSemesters(l).includes(semesterFilter));
    }

    return arr;
  }, [listings, sortOption, semesterFilter]);
  const { data: savedListings = [] } = useSavedListingsQuery(userId, {
    enabled: !!currentUser && !authLoading // Only fetch saved listings if user is authenticated AND auth is not loading
  }); // get saved listings for user
  const { saveMutation, unsaveMutation } = useSaveListingMutations(userId); // get save/unsave mutation objects
 // ^^ lets us trigger a "save" or "unsave" action on a listing

  // Store mutateAsync in refs so updateSavedStatus stays stable across mutation state transitions.
  // TanStack Query recreates mutation objects on every state change (idle→pending→success→idle),
  // which would otherwise bust React.memo on every ListingCard and cause the hover-lift to bounce.
  const saveMutateRef = useRef(null);
  const unsaveMutateRef = useRef(null);
  saveMutateRef.current = saveMutation.mutateAsync;
  unsaveMutateRef.current = unsaveMutation.mutateAsync;

  // use a set to store saved listing IDs for quick lookup (using publicId)
  const savedListingIds = useMemo(() =>
    new Set(savedListings.map(listing => listing.publicId || listing.id)),
    [savedListings]
  );


  // handle window resize and measure container height for virtualization
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600;
      setIsMobile(mobile);
      setIsTabletPortrait(
        window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth && window.innerHeight >= 600 && !mobile
      );
      setUseCompactFiltersHeader(window.innerWidth < 1400);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use ResizeObserver for reliable container height measurement
  // Depends on listingsLoading because the container doesn't exist in DOM during loading state
  useEffect(() => {
    const container = listingsContainerRef.current;
    if (!container) return;

    // Measure function to get container height
    const measureHeight = () => {
      const height = container.getBoundingClientRect().height;
      if (height > 0) {
        setListHeight(height);
      }
    };

    // Measure immediately after layout settles (using requestAnimationFrame for accurate measurement)
    requestAnimationFrame(() => {
      requestAnimationFrame(measureHeight);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          setListHeight(height);
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [listingsLoading]); // Re-run when loading completes so container is in DOM


  // Restore saved filters on mount (when URL has no params).
  // Must be useEffect (not useLayoutEffect) — setSearchParams does not propagate
  // to React Router's searchParams state when called from useLayoutEffect.
  // filtersInteractedRef ensures Filters' initial default-state mount call
  // (which fires before this, child effects run before parent effects) is a no-op.
  useEffect(() => {
    const saved = sessionStorage.getItem('listingsFilters');
    if (!window.location.search && saved) {
      pendingRestoreRef.current = true;
      setSearchParams(new URLSearchParams(saved), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force Filters to remount only after searchParams has propagated.
  useEffect(() => {
    if (pendingRestoreRef.current && searchParams.toString()) {
      pendingRestoreRef.current = false;
      setFilterKey('restored');
    }
  }, [searchParams]);

  // Write filter state to URL — triggers a new server-side query via the filters useMemo
  const handleFilterChange = useCallback((filterState) => {
    const params = new URLSearchParams();

    if (filterState.listingType) params.set('listingType', filterState.listingType);
    if (filterState.startDate) params.set('startDate', filterState.startDate);
    if (filterState.endDate) params.set('endDate', filterState.endDate);
    if (filterState.priceRange[0] !== 0) params.set('minRent', filterState.priceRange[0]);
    if (filterState.priceRange[1] !== 3000) params.set('maxRent', filterState.priceRange[1]);
    if (filterState.roommates !== -1) params.set('roommates', filterState.roommates);

    const selectedAmenities = Object.entries(filterState.amenities)
      .filter(([, selected]) => selected)
      .map(([amenity]) => amenity);
    if (selectedAmenities.length > 0) params.set('amenities', selectedAmenities.join(','));

    if (params.toString()) {
      filtersInteractedRef.current = true;
      setSearchParams(params, { replace: true });
      sessionStorage.setItem('listingsFilters', params.toString());
    } else if (filtersInteractedRef.current) {
      // Only update URL/storage once user has actually interacted — prevents
      // the Filters component's initial mount call (with all-default state)
      // from resetting the URL and wiping sessionStorage before the restore
      // effect has a chance to apply the saved filters.
      setSearchParams(params, { replace: true });
      sessionStorage.removeItem('listingsFilters');
    }

  }, [setSearchParams]);

  const handleSortChange = useCallback((val) => {
    setSortOption(val);
    if (val) sessionStorage.setItem('listingsSort', val);
    else sessionStorage.removeItem('listingsSort');
  }, []);

  const handleSemesterChange = useCallback((val) => {
    setSemesterFilter(val);
  }, []);

  const resetAllFilters = useCallback(() => {
    filtersInteractedRef.current = true;
    // Tell the Filters chips to reset too, not just the URL
    setFilterResetSignal((s) => s + 1);
    handleFilterChange({
      listingType: '',
      startDate: '',
      endDate: '',
      priceRange: [0, 3000],
      roommates: -1,
      amenities: commonAmenities.reduce((acc, a) => { acc[a] = false; return acc; }, {}),
    });
    setSemesterFilter('');
  }, [handleFilterChange]);

  // function to update saved status using TanStack mutations
  // Reads mutateAsync from refs so this callback never changes reference during a mutation lifecycle
  const updateSavedStatus = useCallback(async (listingId, isSaving) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      if (isSaving) {
        await saveMutateRef.current({ listingId });
      } else {
        await unsaveMutateRef.current({ listingId });
      }
    } catch {
      // Error already displayed by ListingCard component
    }
  }, [currentUser]); // stable — only changes when auth state changes, not on mutation state transitions

  // Callback for saving scroll position before navigation
  const saveScrollPosition = useCallback(() => {
    if (isMobile) {
      sessionStorage.setItem('listingsScroll', String(window.scrollY));
      return;
    }
    if (virtualListOuterRef.current) {
      sessionStorage.setItem('listingsScroll', virtualListOuterRef.current.scrollTop);
    }
  }, [isMobile]);

  // Clicking a pin highlights its card without moving the list, so the scroll position is kept
  const handlePinClick = (listing) => {
    setSelectedListing(listing ?? null);
  };

  // itemData passed to ListingRow — memoized so ListingRow only re-renders when data actually changes
  const itemData = useMemo(() => ({
    listings: sortedListings,
    savedListingIds,
    updateSavedStatus,
    saveScrollPosition,
    isMobile,
    cardHeight: CARD_HEIGHT,
    selectedId: selectedListing ? (selectedListing.publicId || selectedListing.id) : null,
  }), [sortedListings, savedListingIds, updateSavedStatus, saveScrollPosition, isMobile, selectedListing]);

  // Lock body scroll when map view is open on mobile.
  // overflow:hidden is ignored by iOS Safari — position:fixed is the only reliable fix.
  // Scroll to top before locking so the map container (in normal flow) renders at the
  // correct position regardless of how far down the user has scrolled in list view.
  useEffect(() => {
    if (!isMobile || !showMap) return;
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.width = '100%';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isMobile, showMap]);

  // Set browser scroll restoration to manual
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);


  // Scroll restoration for virtualized list
  useLayoutEffect(() => {
    if (listingsLoading) return;
    const savedScroll = sessionStorage.getItem('listingsScroll');
    if (!savedScroll) return;
    const scrollTop = parseInt(savedScroll, 10);
    if (isMobile) {
      window.scrollTo(0, scrollTop);
      sessionStorage.removeItem('listingsScroll');
      return;
    }
    if (virtualListRef.current) {
      // Use react-window's scrollTo method
      virtualListRef.current.scrollTo(scrollTop);
      sessionStorage.removeItem('listingsScroll');
    }
  }, [isMobile, listingsLoading]);

  if (listingsLoading) {
    return (
      <div style={{
        padding: '2rem',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '6px solid #ccc',
          borderTop: '6px solid #555',
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

  return (
    <>
    <Seo
      title="Browse Subleases & Parking"
      description="Search hundreds of UW-Madison subleases, rooms, and parking spots near campus. Filter by price, beds, dates, and amenities."
      path="/listings"
    />
    <style>{INTERACTION_CSS}</style>
    {/* Animated background blobs (same as the homepage) */}
    <AmbientBlobs darkMode={darkMode} isMobile={isMobile} />
    <div className="listings-page hm-root" style={{
      position: 'relative',
      zIndex: 103,
      width: '100%',
      boxSizing: 'border-box',
      padding: isMobile ? '0.75rem' : '1.5rem',
      paddingTop: isMobile ? 'calc(48px + 0.75rem)' : '1.5rem', // 48px = fixed listings header height
      paddingBottom: isMobile ? 'calc(44px + env(safe-area-inset-bottom, 0px))' : 0,
      paddingLeft: isMobile ? 'max(0.75rem, env(safe-area-inset-left))' : '1.5rem',
      paddingRight: isMobile ? 'max(0.75rem, env(safe-area-inset-right))' : '1.5rem',
      maxWidth: isMobile ? '100%' : isTabletPortrait ? 'min(900px, 94vw)' : 'min(1500px, 94vw)',
      margin: '0 auto',
      minHeight: isMobile ? '100lvh' : 0,
      height: isMobile ? 'auto' : '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: isMobile ? 'visible' : 'hidden',
    }}>
      {isMobile || useCompactFiltersHeader ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0 0.25rem',
          minWidth: 0,
          marginBottom: isMobile ? 0 : '0.75rem',
          ...(isMobile && {
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 50px)',
            left: 0,
            right: 0,
            height: '48px',
            zIndex: 100,
            backgroundColor: darkMode ? '#0f0e0e' : '#faf7f1',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
            boxShadow: 'none',
          }),
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.25rem',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            Available Listings ({sortedListings.length})
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => setShowFilterModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: darkMode ? '#2a2a2a' : '#faf7f1',
                border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
                borderRadius: '20px',
                color: darkMode ? 'white' : 'black',
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6"></line>
                <line x1="6" y1="12" x2="18" y2="12"></line>
                <line x1="8" y1="18" x2="16" y2="18"></line>
              </svg>
              Filters
              {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--badger-red)', marginLeft: 2 }} />}
            </button>
            {!isMobile && (
              <button
                onClick={() => setShowSortModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: darkMode ? '#2a2a2a' : 'white',
                  border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
                  borderRadius: '20px',
                  color: sortOption ? (darkMode ? 'white' : 'black') : (darkMode ? '#8a8280' : '#888'),
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
                </svg>
                Sort
                {sortOption && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--badger-red)', marginLeft: 2 }} />}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          alignItems: 'center',
          columnGap: '2rem',
          marginBottom: '0.75rem',
        }}>
          <h2 style={{ color: darkMode ? undefined : '#1d1d1f', margin: 0 }}>
            Available Listings ({sortedListings.length})
          </h2>
          <Filters
            key={filterKey}
            onFilterChange={handleFilterChange}
            initialFilters={initialFilters}
            resetSignal={filterResetSignal}
            sortOption={sortOption}
            onSortChange={handleSortChange}
            sortOptions={SORT_OPTIONS}
            semesterFilter={semesterFilter}
            onSemesterChange={handleSemesterChange}
            />
        </div>
      )}


      <div style={{
        display: 'flex',
        gap: '2rem',
        flex: isMobile ? 'unset' : 1,
        overflow: isMobile ? 'visible' : 'hidden',
        minWidth: 0,
      }}>

        <div
          ref={listingsContainerRef}
          id="listings-scroll-container"
          className="listings-scroll"
          style={{
            flex: isMobile || isTabletPortrait ? 1 : 0.5,
            overflow: isMobile ? 'visible' : 'hidden',
            minWidth: 0,
          }}
        >
          {sortedListings.length > 0 ? (
            isMobile ? (
              showMap ? (
                <div key="map" className={viewSlideClass} style={{
                  // Leave room for the fixed List/Map bar: its bottom offset + ~46px pill + a 26px gap
                  height: 'calc(100dvh - env(safe-area-inset-top, 0px) - 50px - 48px - max(2px, env(safe-area-inset-bottom, 0px)) - 46px - 26px)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}>
                  <Map
                    listings={sortedListings}
                    selectedListing={selectedListing}
                    savedListings={savedListingIds}
                    onSaveToggle={updateSavedStatus}
                    isMobile={true}
                    persistViewKey="listingsMapView"
                  />
                </div>
              ) : (
              <div key="list" className={viewSlideClass} style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%', minWidth: 0 }}>
                {sortedListings.map((listing) => (
                  <div key={listing.publicId || listing.id} style={{ width: '100%', minWidth: 0 }}>
                    <ListingCard
                      id={`listing-${listing.id}`}
                      listing={listing}
                      isSaved={savedListingIds.has(listing.publicId || listing.id)}
                      onSaveToggle={updateSavedStatus}
                      onSaveScroll={saveScrollPosition}
                    />
                  </div>
                ))}
              </div>
              )
            ) : (
              <List
                ref={virtualListRef}
                outerRef={virtualListOuterRef}
                style={{ willChange: 'transform' }}
                height={listHeight || 600}
                itemCount={sortedListings.length}
                itemSize={CARD_HEIGHT + CARD_GAP}
                width="100%"
                overscanCount={8}
                innerElementType={ListInnerElement}
                itemData={itemData}
              >
                {ListingRow}
              </List>
            )
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem 2rem',
              margin: '1rem 0',
              borderRadius: '12px',
              border: `1px solid ${darkMode ? '#333' : '#e5e7eb'}`,
              backgroundColor: darkMode ? '#1e1f22' : '#ffffff',
              textAlign: 'center',
              gap: '0.75rem',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#666' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <p style={{ margin: 0, fontWeight: '600', fontSize: '1rem', color: darkMode ? '#e5e7eb' : '#111827' }}>
                No listings found
              </p>
              <p style={{ margin: 0, fontSize: '0.875rem', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                No listings match your current filters. Try widening your search.
              </p>
              <button
                onClick={resetAllFilters}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1.25rem',
                  backgroundColor: 'var(--badger-red)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {!isMobile && !isTabletPortrait && (
          <div style={{
            flex: 0.5,
            position: 'sticky',
            top: 0,
            height: 'calc(100% - 0.75rem)',
            marginBottom: '0.75rem',
            borderRadius: '12px',
            overflow: 'hidden',
            border: darkMode ? '1px solid var(--border-color)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <Map
              listings={sortedListings}
              selectedListing={selectedListing}
              onMarkerClick={handlePinClick}
              savedListings={savedListingIds}
              onSaveToggle={updateSavedStatus}
              persistViewKey="listingsMapView"
            />
          </div>
        )}
      </div>

      {/* Mobile bottom bar: List/Map segmented control with a Sort button */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'max(2px, env(safe-area-inset-bottom, 0px))',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          borderRadius: '999px',
          backgroundColor: darkMode ? 'rgba(23,21,20,0.92)' : 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}>
          {/* One pill behind both segments glides to whichever is active */}
          <div style={{ position: 'relative', display: 'flex' }}>
          <div aria-hidden="true" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '92px',
            height: '36px',
            borderRadius: '999px',
            backgroundColor: darkMode ? '#2a2725' : '#1d1d1f',
            transform: showMap ? 'translateX(92px)' : 'translateX(0)',
            transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
          }} />
          {[
            { key: 'list', label: 'List', icon: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><line x1=\"8\" y1=\"6\" x2=\"21\" y2=\"6\"/><line x1=\"8\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"8\" y1=\"18\" x2=\"21\" y2=\"18\"/><line x1=\"3\" y1=\"6\" x2=\"3.01\" y2=\"6\"/><line x1=\"3\" y1=\"12\" x2=\"3.01\" y2=\"12\"/><line x1=\"3\" y1=\"18\" x2=\"3.01\" y2=\"18\"/></svg>", active: !showMap },
            { key: 'map', label: 'Map', icon: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><polygon points=\"1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"18\"/><line x1=\"16\" y1=\"6\" x2=\"16\" y2=\"22\"/></svg>", active: showMap },
          ].map((seg) => (
            <button
              key={seg.key}
              type="button"
              className="hm-press"
              aria-pressed={seg.active}
              onClick={() => {
                setShowMap(seg.key === 'map');
                setViewDirection(seg.key === 'map' ? 'right' : 'left');
                if (seg.key === 'map') sessionStorage.setItem('listingsView', 'map');
                else sessionStorage.removeItem('listingsView');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
                position: 'relative',
                width: '92px',
                height: '36px',
                padding: '0',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '14px',
                fontWeight: '600',
                backgroundColor: 'transparent',
                color: seg.active ? '#fff' : (darkMode ? '#a39b97' : '#6e6e73'),
                transition: 'color 0.25s ease',
              }}
              dangerouslySetInnerHTML={{ __html: seg.icon + seg.label }}
            />
          ))}
          </div>
          <div style={{ width: '1px', height: '20px', margin: '0 4px', backgroundColor: darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
          <button
            type="button"
            className="hm-press"
            aria-label="Sort"
            onClick={() => setShowSortModal(true)}
            style={{
              position: 'relative',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: sortOption ? (darkMode ? '#f0ebe5' : '#1d1d1f') : (darkMode ? '#a39b97' : '#6e6e73'),
            }}
          >
            <span style={{ display: 'flex' }} dangerouslySetInnerHTML={{ __html: "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><line x1=\"12\" y1=\"20\" x2=\"12\" y2=\"10\"/><line x1=\"18\" y1=\"20\" x2=\"18\" y2=\"4\"/><line x1=\"6\" y1=\"20\" x2=\"6\" y2=\"16\"/></svg>" }} />
            {sortOption && <span style={{ position: 'absolute', top: '6px', right: '6px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--badger-red)' }} />}
          </button>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        darkMode={darkMode}
        title="Sign in to save listings"
      />

      {/* Mobile Sort Modal */}
      {showSortModal && (
        <MobileSortModal
          darkMode={darkMode}
          current={sortOption}
          onChange={(val) => {
            setSortOption(val);
            if (val) sessionStorage.setItem('listingsSort', val);
            else sessionStorage.removeItem('listingsSort');
            setShowSortModal(false);
          }}
          onClose={() => setShowSortModal(false)}
        />
      )}

      {/* Mobile Filter Sheet */}
      {showFilterModal && (
        <MobileFilterSheet
          isOpen={showFilterModal}
          onDismiss={() => setShowFilterModal(false)}
          onCommit={(newFilters, newSemester) => {
            filtersInteractedRef.current = true;
            handleFilterChange(newFilters);
            handleSemesterChange(newSemester);
            setShowFilterModal(false);
          }}
          initialFilters={initialFilters}
          initialSemester={semesterFilter}
          listings={fetchedListings}
          darkMode={darkMode}
        />
      )}

      {/* Sleek scrollbar styles for react-window's scroll container */}
      <style>{`
        /* Hide scrollbar on mobile */
        @media (max-width: 768px) {
          .listings-scroll > div::-webkit-scrollbar {
            display: none !important;
          }
          .listings-scroll > div {
            scrollbar-width: none !important;
          }
        }

        /* Desktop scrollbar */
        @media (min-width: 769px) {
          .listings-scroll > div::-webkit-scrollbar {
            width: 8px !important;
            display: block !important;
          }

          .listings-scroll > div::-webkit-scrollbar-track {
            background: transparent !important;
            margin-top: 4px !important;
            margin-bottom: 40px !important;
          }

          .listings-scroll > div::-webkit-scrollbar-thumb {
            background: ${darkMode ? '#3a3633' : '#a39a8c'} !important;
            border-radius: 4px !important;
            transition: background-color 0.15s ease !important;
          }

          .listings-scroll > div::-webkit-scrollbar-thumb:hover {
            background: ${darkMode ? '#524e4c' : '#8f8576'} !important;
          }

          /* For Firefox */
          .listings-scroll > div {
            scrollbar-width: thin !important;
            scrollbar-color: ${darkMode ? '#3a3633' : '#a39a8c'} transparent !important;
          }
        }
      `}</style>
    </div>
    </>
  );
}
