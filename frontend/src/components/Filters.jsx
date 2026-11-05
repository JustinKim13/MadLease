import React, { useState, useEffect, useRef, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

function SortIcon({ sortOption, color }) {
  const s = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'block', width: '14px', height: '14px', flexShrink: 0 },
  };
  if (sortOption === 'price_asc') return (
    <svg {...s}>
      <line x1="12" y1="20" x2="12" y2="4"/><polyline points="6 10 12 4 18 10"/>
      <line x1="3" y1="15" x2="8" y2="15"/><line x1="3" y1="20" x2="8" y2="20"/>
    </svg>
  );
  if (sortOption === 'price_desc') return (
    <svg {...s}>
      <line x1="12" y1="4" x2="12" y2="20"/><polyline points="6 14 12 20 18 14"/>
      <line x1="3" y1="4" x2="8" y2="4"/><line x1="3" y1="9" x2="8" y2="9"/>
    </svg>
  );
  if (sortOption === 'newest') return (
    <svg {...s}>
      <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
    </svg>
  );
  if (sortOption === 'start_asc') return (
    <svg {...s}>
      <rect x="3" y="4" width="18" height="17" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  return (
    <svg {...s}>
      <path d="M7 16V4m0 0L3 8m4-4 4 4"/>
      <path d="M17 8v12m0 0 4-4m-4 4-4-4"/>
    </svg>
  );
}

// Amenities list - must match exactly with CreateListing.jsx and EditListings.jsx
const commonAmenities = [
  'In-unit laundry',
  'Central A/C',
  'Balcony',
  'Dishwasher',
  'Wifi',
  'Furnished',
  'Parking available',
  'Gym',
];

// Price Range Slider Component
const PriceRangeSlider = ({ value, onChange, min = 0, max = 3000, step = 50, darkMode = false, isMobile = false, onDragStart, onDragEnd }) => {
  const [isDragging, setIsDragging] = useState(null);
  const sliderRef = useRef(null);
  const valueRef = useRef(value);
  const dragRectRef = useRef(null);

  // Keep ref in sync with latest value to avoid stale closures
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleStart = (handle) => (e) => {
    dragRectRef.current = sliderRef.current?.getBoundingClientRect() ?? null;
    setIsDragging(handle);
    onDragStart?.();
  };

  const getClientX = (e) => {
    return e.touches ? e.touches[0].clientX : e.clientX;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      if (!sliderRef.current) return;

      const rect = dragRectRef.current ?? sliderRef.current.getBoundingClientRect();
      const clientX = getClientX(e);
      const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newValue = Math.round((percentage * (max - min) + min) / step) * step;
      const currentValue = valueRef.current;

      if (isDragging === 'min') {
        const newMin = Math.max(min, Math.min(newValue, currentValue[1] - step));
        if (newMin !== currentValue[0]) {
          onChange([newMin, currentValue[1]]);
        }
      } else {
        const newMax = Math.min(max, Math.max(newValue, currentValue[0] + step));
        if (newMax !== currentValue[1]) {
          onChange([currentValue[0], newMax]);
        }
      }
    };

    const handleEnd = () => {
      dragRectRef.current = null;
      setIsDragging(null);
      onDragEnd?.();
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, min, max, step, onChange]);

  const minPercent = ((value[0] - min) / (max - min)) * 100;
  const maxPercent = ((value[1] - min) / (max - min)) * 100;

  return (
    <div style={{ padding: '1rem', minWidth: '200px', width: '100%' }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px', fontWeight: '500', color: darkMode ? 'white' : '#333' }}>Price Range</span>
        <span style={{ fontSize: '14px', color: darkMode ? '#999' : '#666' }}>
          ${value[0]} - ${value[1]}
        </span>
      </div>

      <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center', width: isMobile ? '100%' : '85%', margin: isMobile ? '0' : '0 auto', padding: isMobile ? '0 12px' : '0', boxSizing: 'border-box' }}>
        {/* Track */}
        <div
          ref={sliderRef}
          style={{
            position: 'absolute',
            width: '100%',
            height: '4px',
            backgroundColor: darkMode ? '#555' : '#e0e0e0',
            borderRadius: '2px',
            cursor: 'pointer'
          }}
        />

        {/* Active track */}
        <div
          style={{
            position: 'absolute',
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
            height: '4px',
            backgroundColor: darkMode ? 'white' : '#333',
            borderRadius: '2px',
            pointerEvents: 'none'
          }}
        />

        {/* Min handle */}
        <div
          onMouseDown={handleStart('min')}
          onTouchStart={handleStart('min')}
          style={{
            position: 'absolute',
            left: `${minPercent}%`,
            transform: 'translateX(-50%)',
            width: '20px',
            height: '20px',
            backgroundColor: darkMode ? '#2a2a2a' : 'white',
            border: `2px solid ${darkMode ? 'white' : '#333'}`,
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: isDragging === 'min' ? 2 : 1,
            touchAction: 'none'
          }}
        />

        {/* Max handle */}
        <div
          onMouseDown={handleStart('max')}
          onTouchStart={handleStart('max')}
          style={{
            position: 'absolute',
            left: `${maxPercent}%`,
            transform: 'translateX(-50%)',
            width: '20px',
            height: '20px',
            backgroundColor: darkMode ? '#2a2a2a' : 'white',
            border: `2px solid ${darkMode ? 'white' : '#333'}`,
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
            zIndex: isDragging === 'max' ? 2 : 1,
            touchAction: 'none'
          }}
        />
      </div>
    </div>
  );
};

const SEMESTER_OPTIONS = [
  { value: '',            label: 'Any'         },
  { value: 'spring',      label: 'Spring'      },
  { value: 'summer',      label: 'Summer'      },
  { value: 'fall',        label: 'Fall'        },
  { value: 'entire_year', label: 'Entire Year' },
];

// Short sort names for the chip; the menu keeps the full labels from Listings.jsx
const SORT_SHORT_LABELS = {
  price_asc: 'Price low',
  price_desc: 'Price high',
  newest: 'Newest',
  oldest: 'Oldest',
  start_asc: 'Start date',
};

// Every filter chip shares one chevron instead of mixed glyphs
const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.6 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Marks the selected row in a menu
const CheckMark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--badger-red)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const optionRowStyle = (selected, darkMode) => ({
  padding: '0.5rem 0.6rem',
  cursor: 'pointer',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  fontWeight: selected ? 600 : 400,
  backgroundColor: selected ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)') : 'transparent',
});


export default function Filters({ onFilterChange, isModal = false, initialFilters, sortOption, onSortChange, sortOptions, semesterFilter, onSemesterChange, resetSignal = 0 }) {
  const { darkMode } = useContext(ThemeContext);

  // Create initial amenities state from commonAmenities array
  const defaultAmenities = commonAmenities.reduce((acc, amenity) => {
    acc[amenity] = false;
    return acc;
  }, {});

  // Initial filter state — sourced from URL params via initialFilters prop
  const [filters, setFilters] = useState(() => initialFilters || {
    listingType: '',
    startDate: '',
    endDate: '',
    priceRange: [0, 3000],
    roommates: -1,
    amenities: defaultAmenities,
  });

  // Track which dropdown is open
  const [openDropdown, setOpenDropdown] = useState(null);
  const triggerRef = useRef(null); // the chip that opened the menu, so Escape can return focus to it
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const [isPriceDragging, setIsPriceDragging] = useState(false);
  const hadActiveFiltersBeforeDrag = useRef(false);
  const frozenPriceLabelRef = useRef('');

  // Reference to the filters container
  const filtersRef = useRef(null);

  // Handle window resize to detect mobile/desktop
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle date changes
  const handleStartDateChange = (startDate) => {
    // Clear end date if it's now before the new start date
    const endDate = filters.endDate && filters.endDate < startDate ? '' : filters.endDate;
    const newFilters = { ...filters, startDate, endDate };
    setFilters(newFilters);
  };

  const handleEndDateChange = (endDate) => {
    const newFilters = { ...filters, endDate };
    setFilters(newFilters);
  };

  const clearDates = () => {
    const newFilters = { ...filters, startDate: '', endDate: '' };
    setFilters(newFilters);
    setOpenDropdown(null);
  };


  // Handle price range selection
  const handlePriceChange = (priceRange) => {
    const newFilters = { ...filters, priceRange };
    setFilters(newFilters);
  };

  // Handle roommates selection
  const handleRoommatesChange = (roommates) => {
    const newFilters = { ...filters, roommates: filters.roommates === roommates ? -1 : roommates };
    setFilters(newFilters);
    setOpenDropdown(null);
  };

  // Handle listing type selection
  const handleListingTypeChange = (type) => {
    const newFilters = { ...filters, listingType: filters.listingType === type ? '' : type };
    setFilters(newFilters);
    setOpenDropdown(null);
  };

  // Handle amenity toggle
  const handleAmenityChange = (amenity) => {
    const newAmenities = {
      ...filters.amenities,
      [amenity]: !filters.amenities[amenity]
    };
    const newFilters = { ...filters, amenities: newAmenities };
    setFilters(newFilters);
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    if (filters.listingType) return true;
    if (filters.startDate || filters.endDate) return true;
    if (filters.priceRange[0] !== 0 || filters.priceRange[1] !== 3000) return true;
    if (filters.roommates !== -1) return true;
    if (Object.values(filters.amenities).some(v => v)) return true;
    if (semesterFilter) return true;
    return false;
  };

  // Reset all filters to defaults
  const resetFilters = () => {
    const defaultFilters = {
      listingType: '',
      startDate: '',
      endDate: '',
      priceRange: [0, 3000],
      roommates: -1,
      amenities: defaultAmenities,
    };
    setFilters(defaultFilters);
    setOpenDropdown(null);
    onSemesterChange?.('');
  };

  // The parent bumps resetSignal (e.g. the empty-state "Reset Filters" button); run the same reset as the Clear link
  useEffect(() => {
    if (resetSignal) resetFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const typeActive = !!filters.listingType;
  const datesActive = !!(filters.startDate || filters.endDate);
  const priceActive = filters.priceRange[0] !== 0 || filters.priceRange[1] !== 3000;
  const roommatesActive = filters.roommates !== -1;
  const amenitiesActive = Object.values(filters.amenities).some(v => v);
  const semesterActive = !!semesterFilter;

  // Toggle dropdown — only one open at a time
  const toggleDropdown = (dropdown) => {
    triggerRef.current = document.activeElement;
    setOpenDropdown(prev => prev === dropdown ? null : dropdown);
  };

  // Escape closes the open menu and hands focus back to the chip that opened it
  useEffect(() => {
    if (!openDropdown) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpenDropdown(null);
      triggerRef.current?.focus?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Notify parent component when filters change
  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  // Get display text for each filter
  const getTypeText = () => {
    const labels = { HOUSING: 'Housing', PARKING: 'Parking', BOTH: 'Both' };
    return labels[filters.listingType] || 'Type';
  };

  const getDatesText = () => {
    if (!filters.startDate && !filters.endDate) return 'Dates';
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = new Date(filters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${start} – ${end}`;
    }
    if (filters.startDate) {
      return `From ${new Date(filters.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return `Until ${new Date(filters.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const getPriceText = () => {
    if (filters.priceRange[0] === 0 && filters.priceRange[1] === 3000) {
      return 'Price';
    }
    return `$${filters.priceRange[0]} - $${filters.priceRange[1]}`;
  };

  const getRoommatesText = () => {
    if (filters.roommates === -1) return 'Roommates';
    if (filters.roommates === 0) return '0 Roommates';
    if (filters.roommates === 1) return '1 Roommate';
    return `${filters.roommates} Roommates`;
  };

  const getAmenitiesText = () => {
    const selectedAmenities = Object.entries(filters.amenities)
      .filter(([_, selected]) => selected)
      .map(([amenity]) => amenity);
    
    if (selectedAmenities.length === 0) return 'Amenities';
    if (selectedAmenities.length === 1) {
      return selectedAmenities[0];
    }
    return `${selectedAmenities.length} selected`;
  };

  const getSemesterText = () => {
    if (!semesterFilter) return 'Semester';
    return SEMESTER_OPTIONS.find(o => o.value === semesterFilter)?.label || 'Semester';
  };

  const getSortText = () => {
    if (!sortOption) return 'Sort';
    return sortOptions?.find(o => o.value === sortOption)?.label || 'Sort';
  };

  const buttonStyle = (active = false) => ({
    padding: isModal ? '0.6rem 1rem' : (isMobile ? '4px 6px' : '0 9px 0 8px'),
    height: isModal ? 'auto' : (isMobile ? 'auto' : '32px'),
    boxSizing: 'border-box',
    borderRadius: isModal ? '8px' : '999px',
    border: active
      ? `1px solid rgba(197,5,12,0.4)`
      : `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    backgroundColor: active
      ? (darkMode ? 'rgba(197,5,12,0.1)' : 'rgba(197,5,12,0.06)')
      : (darkMode ? '#171514' : '#ffffff'),
    color: active ? (darkMode ? '#f0f0f0' : '#1d1d1f') : (darkMode ? '#a39b97' : '#6e6e73'),
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: isModal ? '0.5rem' : '6px',
    fontSize: isModal ? '1rem' : (isMobile ? '10px' : '13px'),
    width: '100%',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.03)',
    transition: 'border-color 0.15s, background-color 0.15s',
    outline: 'none',
  });

  // Option rows are divs; Enter and Space activate them, arrow keys move between them
  const handleOptionKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const options = Array.from(e.currentTarget.parentElement.querySelectorAll('.hm-option'));
      const step = e.key === 'ArrowDown' ? 1 : -1;
      options[options.indexOf(e.currentTarget) + step]?.focus();
    }
  };

  const dropdownStyle = isModal ? {
    position: 'relative',
    paddingTop: '0.5rem',
    width: '100%'
  } : {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    paddingTop: '8px',
    zIndex: 1001
  };

  const dropdownContentStyle = {
    backgroundColor: darkMode ? (isModal ? '#333' : '#171514') : (isModal ? '#f5f5f5' : '#ffffff'),
    border: isModal ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '12px',
    padding: '0.5rem',
    boxShadow: isModal ? 'none' : (darkMode ? '0 16px 40px -12px rgba(0,0,0,0.65)' : '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)'),
    minWidth: isMobile ? '100%' : '150px',
    whiteSpace: 'nowrap',
    colorScheme: darkMode ? 'dark' : 'light',
    color: darkMode ? 'white' : 'black'
  };

  return (
    <div
      ref={filtersRef}
      onKeyDown={(e) => {
        // From an open chip, ArrowDown moves into its menu
        if (e.key !== 'ArrowDown' || !openDropdown || e.target.tagName !== 'BUTTON') return;
        const firstOption = filtersRef.current?.querySelector('.hm-option');
        if (firstOption) { e.preventDefault(); firstOption.focus(); }
      }}
      style={{
        display: isModal ? 'grid' : 'flex',
        gridTemplateColumns: isModal ? '1fr 1fr' : undefined,
        gap: isModal ? '0.75rem' : (isMobile ? '0.5rem' : '6px'),
        alignItems: 'center',
        // Desktop: span the map column edge to edge, with the chips spaced evenly across it
        position: isModal || isMobile ? undefined : 'relative',
        width: '100%',
        justifyContent: isModal ? 'flex-start' : 'space-between',
        minWidth: isMobile ? '100%' : 'auto',
        maxWidth: isMobile ? '100%' : 'none'
      }}
    >
      {/* Type Filter */}
      <div style={{ position: 'relative', width: isModal ? '100%' : (isMobile ? '19%' : 'auto') }}>
        <button
          onClick={() => toggleDropdown('type')}
          className="hm-press hm-chip" data-active={!!(typeActive)} style={buttonStyle(typeActive)}
        >
          {getTypeText()}
          <Chevron />
        </button>

        {openDropdown === 'type' && (
          <div style={dropdownStyle}>
            <div className="hm-menu-in" style={dropdownContentStyle}>
              {[
                { value: '', label: 'All types' },
                { value: 'HOUSING', label: 'Housing' },
                { value: 'BOTH', label: 'Housing + Parking' },
                { value: 'PARKING', label: 'Parking' },
              ].map(({ value, label }) => (
                <div
                  key={value}
                  className="hm-option" tabIndex={0} onKeyDown={handleOptionKey}
                  onClick={() => handleListingTypeChange(value)}
                  style={optionRowStyle(filters.listingType === value, darkMode)}
                >
                  {label}
                  {filters.listingType === value && <CheckMark />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Date Filter */}
      <div style={{ position: 'relative', width: isModal ? '100%' : (isMobile ? '19%' : 'auto') }}>
        <button
          onClick={() => toggleDropdown('dates')}
          className="hm-press hm-chip" data-active={!!(datesActive)} style={buttonStyle(datesActive)}
        >
          {getDatesText()}
          <Chevron />
        </button>

        {openDropdown === 'dates' && (
          <div style={{
            ...dropdownStyle,
            ...(isModal ? {} : { left: isMobile ? '0' : '50%', transform: isMobile ? 'none' : 'translateX(-50%)' })
          }}>
            <div style={{
              ...dropdownContentStyle,
              minWidth: isModal ? '100%' : (isMobile ? '160px' : '200px'),
              padding: '0.75rem'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '12px', color: darkMode ? '#999' : '#666', marginBottom: '0.25rem' }}>
                  From
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
                    backgroundColor: darkMode ? '#333' : 'white',
                    color: darkMode ? 'white' : 'black',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '12px', color: darkMode ? '#999' : '#666', marginBottom: '0.25rem' }}>
                  To
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  min={filters.startDate || undefined}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    border: `1px solid ${darkMode ? '#555' : '#ccc'}`,
                    backgroundColor: darkMode ? '#333' : 'white',
                    color: darkMode ? 'white' : 'black',
                    fontSize: '14px'
                  }}
                />
              </div>
              {(filters.startDate || filters.endDate) && (
                <button
                  onClick={clearDates}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: darkMode ? '#444' : '#f0f0f0',
                    color: darkMode ? 'white' : 'black',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Price Filter */}
      <div style={{ position: 'relative', width: isModal ? '100%' : (isMobile ? '19%' : 'auto') }}>
        <button
          onClick={() => toggleDropdown('price')}
          className="hm-press hm-chip"
          data-active={priceActive}
          style={{
            ...buttonStyle(priceActive),
            ...(isMobile || isModal ? {} : { padding: '6px 8px 6px 8px' }),
          }}
        >
          {isPriceDragging ? frozenPriceLabelRef.current : getPriceText()}
          <Chevron />
        </button>
        
        {openDropdown === 'price' && (
          <div style={{
            ...dropdownStyle,
            ...(isModal ? {} : { left: isMobile ? '0' : '50%', transform: isMobile ? 'none' : 'translateX(-50%)' })
          }}>
            <div style={{
              ...dropdownContentStyle,
              padding: 0,
              minWidth: isModal ? '100%' : (isMobile ? '240px' : '280px')
            }}>
              <PriceRangeSlider
                value={filters.priceRange}
                onChange={handlePriceChange}
                min={0}
                max={3000}
                step={50}
                darkMode={darkMode}
                isMobile={isMobile}
                onDragStart={() => {
                  hadActiveFiltersBeforeDrag.current = hasActiveFilters();
                  frozenPriceLabelRef.current = getPriceText();
                  setIsPriceDragging(true);
                }}
                onDragEnd={() => setIsPriceDragging(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Roommates Filter */}
      <div style={{ position: 'relative', width: isModal ? '100%' : (isMobile ? '19%' : 'auto') }}>
        <button
          onClick={() => toggleDropdown('roommates')}
          className="hm-press hm-chip" data-active={!!(roommatesActive)} style={buttonStyle(roommatesActive)}
        >
          {getRoommatesText()}
          <Chevron />
        </button>
        
        {openDropdown === 'roommates' && (
          <div style={dropdownStyle}>
            <div className="hm-menu-in" style={dropdownContentStyle}>
              {[
                { value: -1, label: 'Any number' },
                { value: 0, label: '0 roommates' },
                { value: 1, label: '1 roommate' },
                { value: 2, label: '2 roommates' },
                { value: 3, label: '3 roommates' },
                { value: 4, label: '4+ roommates' },
              ].map(({ value, label }) => (
                <div
                  key={value}
                  className="hm-option" tabIndex={0} onKeyDown={handleOptionKey}
                  onClick={() => handleRoommatesChange(value)}
                  style={optionRowStyle(filters.roommates === value, darkMode)}
                >
                  {label}
                  {filters.roommates === value && <CheckMark />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Amenities Filter */}
      <div style={{ position: 'relative', width: isModal ? '100%' : (isMobile ? '19%' : 'auto') }}>
        <button
          onClick={() => toggleDropdown('amenities')}
          className="hm-press hm-chip" data-active={!!(amenitiesActive)} style={buttonStyle(amenitiesActive)}
        >
          {getAmenitiesText()}
          <Chevron />
        </button>
        
        {openDropdown === 'amenities' && (
          <div style={dropdownStyle}>
            <div className="hm-menu-in" style={dropdownContentStyle}>
              {commonAmenities.map(amenity => {
                const active = !!filters.amenities[amenity];
                return (
                  <div
                    key={amenity}
                    className="hm-option" tabIndex={0} onKeyDown={handleOptionKey}
                    onClick={() => handleAmenityChange(amenity)}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: active ? (darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                    }}
                  >
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      flexShrink: 0,
                      border: active ? '1.5px solid var(--badger-red)' : `1.5px solid ${darkMode ? 'rgba(255,255,255,0.25)' : '#bbb'}`,
                      backgroundColor: active ? 'var(--badger-red)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.12s, background-color 0.12s',
                    }}>
                      {active && (
                        <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                          <polyline points="1,3.5 2.8,5.5 6,1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {amenity}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Semester Filter */}
      {onSemesterChange && (
        <div style={{ position: 'relative', width: isModal ? '100%' : (isMobile ? '19%' : 'auto') }}>
          <button onClick={() => toggleDropdown('semester')} className="hm-press hm-chip" data-active={!!(semesterActive)} style={buttonStyle(semesterActive)}>
            {getSemesterText()}
            <Chevron />
          </button>

          {openDropdown === 'semester' && (
            <div style={dropdownStyle}>
              <div className="hm-menu-in" style={dropdownContentStyle}>
                {SEMESTER_OPTIONS.map(({ value, label }) => (
                  <div
                    key={value}
                    className="hm-option" tabIndex={0} onKeyDown={handleOptionKey}
                    onClick={() => {
                      onSemesterChange(semesterFilter === value ? '' : value);
                      setOpenDropdown(null);
                    }}
                    style={optionRowStyle(semesterFilter === value, darkMode)}
                  >
                    {label}
                    {semesterFilter === value && <CheckMark />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sort Filter — only on desktop, when sortOptions provided */}
      {!isModal && sortOptions && (
        <div style={{ position: 'relative', width: isMobile ? '19%' : 'auto' }}>
          <button
            onClick={() => toggleDropdown('sort')}
            className="hm-press hm-chip" data-active={!!sortOption} style={buttonStyle(!!sortOption)}
          >
            <SortIcon
              sortOption={sortOption}
              color={sortOption ? (darkMode ? '#f0f0f0' : '#1d1d1f') : (darkMode ? '#888' : '#6e6e73')}
            />
            {sortOption ? (SORT_SHORT_LABELS[sortOption] || 'Sort') : 'Sort'}
            <Chevron />
          </button>

          {openDropdown === 'sort' && (
            <div style={{
              ...dropdownStyle,
              left: 'auto',
              right: 0,
              transform: 'none',
            }}>
              <div className="hm-menu-in" style={{ ...dropdownContentStyle, minWidth: '175px' }}>
                {sortOptions.map(({ value, label }) => (
                  <div
                    key={value}
                    className="hm-option" tabIndex={0} onKeyDown={handleOptionKey}
                    onClick={() => {
                      onSortChange(value);
                      setOpenDropdown(null);
                    }}
                    style={optionRowStyle(sortOption === value, darkMode)}
                  >
                    {label}
                    {sortOption === value && <CheckMark />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset - frozen during price drag to prevent layout shifts */}
      {!isModal && !isMobile ? (
        // Desktop: a text link in the gutter left of the chips. It is absolutely positioned,
        // so showing or hiding it never moves the chips.
        (() => {
          const showReset = isPriceDragging ? hadActiveFiltersBeforeDrag.current : hasActiveFilters();
          return (
            <button
              type="button"
              onClick={resetFilters}
              disabled={!showReset}
              tabIndex={showReset ? 0 : -1}
              aria-hidden={!showReset}
              style={{
                position: 'absolute',
                right: 'calc(100% + 12px)',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0 4px',
                border: 'none',
                background: 'none',
                color: 'var(--badger-red)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                visibility: showReset ? 'visible' : 'hidden',
              }}
            >
              Clear
            </button>
          );
        })()
      ) : (isPriceDragging ? hadActiveFiltersBeforeDrag.current : hasActiveFilters()) && (
        <button
          onClick={resetFilters}
          style={{
            padding: isModal ? '0.6rem 1rem' : (isMobile ? '4px 8px' : '5px 10px'),
            borderRadius: '20px',
            border: 'none',
            backgroundColor: 'var(--badger-red)',
            color: 'white',
            cursor: 'pointer',
            fontSize: isModal ? '1rem' : (isMobile ? '10px' : '12px'),
            whiteSpace: 'nowrap',
            fontWeight: '500',
            transition: 'background-color 0.2s',
            gridColumn: isModal ? 'span 2' : undefined
          }}
        >
          Reset Filters
        </button>
      )}
    </div>
  );
} 