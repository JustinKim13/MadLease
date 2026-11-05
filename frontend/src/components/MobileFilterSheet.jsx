import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const RED = '#ff2d3a';
const RED_GLOW = 'rgba(255, 45, 58, 0.18)';
const RED_DEEP = '#c81824';

function getTokens(darkMode) {
  return darkMode ? {
    panel: '#131316',
    panel2: '#1a1a1f',
    panel3: '#22222a',
    line: '#2a2a32',
    line2: '#3a3a44',
    ink: '#f4f4f6',
    inkMid: '#b8b8c2',
    inkDim: '#7c7c88',
    inkFaint: '#56565f',
  } : {
    panel: '#ffffff',
    panel2: '#f5f5f5',
    panel3: '#ebebeb',
    line: '#e0e0e0',
    line2: '#d0d0d0',
    ink: '#111111',
    inkMid: '#555555',
    inkDim: '#888888',
    inkFaint: '#aaaaaa',
  };
}

const FONT = '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';

const commonAmenities = [
  'In-unit laundry', 'Central A/C', 'Balcony', 'Dishwasher',
  'Wifi', 'Furnished', 'Parking available', 'Gym',
];

const SEMESTER_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'entire_year', label: 'Entire year' },
];

const TYPE_OPTIONS = [
  { value: 'HOUSING', label: 'Housing' },
  { value: 'BOTH', label: 'Housing + Parking' },
  { value: 'PARKING', label: 'Parking only' },
  { value: '', label: 'All' },
];

// Same logic as Listings.jsx — duplicated to avoid circular import
function getListingSemesters(listing) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!listing.startDate) return [];
  const listingStart = new Date(listing.startDate);
  const listingEnd = listing.endDate ? new Date(listing.endDate) : null;
  const effectiveEnd = listingEnd ?? new Date(9999, 11, 31);
  if (effectiveEnd < today) return [];
  const startMonth = listingStart.getMonth() + 1;
  const effectiveEndMonth = !listingEnd
    ? 99
    : listingEnd.getMonth() + 1 + (listingEnd.getFullYear() - listingStart.getFullYear()) * 12;
  const offset = startMonth === 12 ? 12 : 0;
  let primary;
  if (startMonth <= 3 || startMonth === 12) primary = 'spring';
  else if (startMonth <= 5) primary = effectiveEndMonth <= 5 ? 'spring' : 'summer';
  else if (startMonth <= 7) primary = 'summer';
  else if (startMonth === 8) primary = effectiveEndMonth <= 8 ? 'summer' : 'fall';
  else primary = 'fall';
  const semesters = new Set([primary]);
  if (primary === 'spring' && effectiveEndMonth > (5 + offset) && effectiveEndMonth <= (8 + offset)) semesters.add('summer');
  if (primary === 'summer' && effectiveEndMonth > 8 && effectiveEndMonth <= 13) semesters.add('fall');
  if (primary === 'fall' && effectiveEndMonth > 15) { semesters.add('entire_year'); semesters.delete('fall'); }
  if (primary === 'spring' && effectiveEndMonth > (11 + offset)) { semesters.add('entire_year'); semesters.delete('spring'); }
  return [...semesters];
}

// ─── Chip ────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onToggle, darkMode }) {
  const t = getTokens(darkMode);
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 9px', borderRadius: 999, border: 'none',
        backgroundColor: selected ? RED : 'transparent',
        boxShadow: selected ? `0 4px 14px -4px ${RED_GLOW}` : `inset 0 0 0 1px ${t.line}`,
        color: selected ? '#fff' : t.inkMid,
        fontSize: 12, fontWeight: 500, fontFamily: FONT,
        lineHeight: 1, whiteSpace: 'nowrap', minHeight: 26,
        cursor: 'pointer', transition: 'all 120ms',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {selected && <span style={{ fontSize: 11, fontWeight: 600 }}>✓</span>}
      {label}
    </button>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ label, summary, darkMode }) {
  const t = getTokens(darkMode);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.inkDim, fontFamily: FONT }}>{label}</span>
      {summary && <span style={{ fontSize: 11, fontWeight: 600, color: t.ink, fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}>{summary}</span>}
    </div>
  );
}

// ─── InlineCalendar ───────────────────────────────────────────────────────────
function InlineCalendar({ startDate, endDate, hoverDate, calendarView, setCalendarView, onDateClick, onHover, onClear, onDone, darkMode }) {
  const t = getTokens(darkMode);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { year, month } = calendarView; // month: 0-based

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const toYMD = (d) => d || null;
  const startYMD = toYMD(startDate);
  const endYMD = toYMD(endDate);
  const hoverYMD = toYMD(hoverDate);

  const nightsText = useMemo(() => {
    if (!startYMD || !endYMD) return null;
    const s = new Date(startYMD), e = new Date(endYMD);
    const diff = Math.round((e - s) / 86400000);
    if (diff <= 0) return null;
    const m = s.getMonth() + 1;
    const season = m >= 3 && m <= 5 ? 'Spring' : m >= 6 && m <= 8 ? 'Summer' : m >= 9 && m <= 11 ? 'Fall' : 'Winter';
    return `${diff} night${diff !== 1 ? 's' : ''} · ${season} move-in`;
  }, [startYMD, endYMD]);

  const prevMonth = () => {
    let m = month - 1, y = year;
    if (m < 0) { m = 11; y--; }
    setCalendarView({ year: y, month: m });
  };
  const nextMonth = () => {
    let m = month + 1, y = year;
    if (m > 11) { m = 0; y++; }
    setCalendarView({ year: y, month: m });
  };

  const atOrBeforeToday = (y, mo, d) => {
    const dt = new Date(y, mo, d);
    dt.setHours(0,0,0,0);
    return dt < today;
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getDayYMD = (d) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const isStart = (d) => getDayYMD(d) === startYMD;
  const isEnd = (d) => getDayYMD(d) === endYMD;
  const isInRange = (d) => {
    const ymd = getDayYMD(d);
    const lo = startYMD, hi = endYMD || hoverYMD;
    if (!lo) return false;
    const [a, b] = lo <= (hi || lo) ? [lo, hi] : [hi, lo];
    return ymd > a && ymd < b;
  };
  const isPreview = (d) => {
    const ymd = getDayYMD(d);
    if (!startYMD || endYMD) return false;
    const lo = startYMD, hi = hoverYMD;
    if (!hi) return false;
    const [a, b] = lo < hi ? [lo, hi] : [hi, lo];
    return ymd > a && ymd < b;
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Nav row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button
          onClick={prevMonth}
          disabled={year === today.getFullYear() && month <= today.getMonth()}
          style={{
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: t.panel3, border: `1px solid ${t.line}`, borderRadius: 7,
            color: t.inkMid, fontSize: 15, cursor: 'pointer', fontFamily: FONT,
            opacity: (year === today.getFullYear() && month <= today.getMonth()) ? 0.3 : 1,
          }}
        >‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: FONT }}>{MONTHS[month]} {year}</span>
        <button
          onClick={nextMonth}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.panel3, border: `1px solid ${t.line}`, borderRadius: 7, color: t.inkMid, fontSize: 15, cursor: 'pointer', fontFamily: FONT }}
        >›</button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: t.inkFaint, padding: '3px 0', fontFamily: FONT }}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 1 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const past = atOrBeforeToday(year, month, d);
          const start = isStart(d), end = isEnd(d), inRange = isInRange(d), preview = isPreview(d);
          const endpoint = start || end;
          return (
            <div
              key={d}
              role="gridcell"
              aria-disabled={past}
              onClick={() => !past && onDateClick(getDayYMD(d))}
              onMouseEnter={() => !past && onHover(getDayYMD(d))}
              onMouseLeave={() => onHover(null)}
              style={{
                position: 'relative', height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: past ? 'default' : 'pointer', userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* In-range tint */}
              {(inRange || preview) && (
                <div style={{
                  position: 'absolute', top: 2, bottom: 2, left: 0, right: 0,
                  backgroundColor: inRange ? 'rgba(255,45,58,0.16)' : 'rgba(255,45,58,0.08)',
                  pointerEvents: 'none',
                }} />
              )}
              {/* Endpoint half-tint */}
              {(start && endYMD && endYMD > startYMD) && (
                <div style={{ position: 'absolute', top: 2, bottom: 2, left: '50%', right: 0, backgroundColor: 'rgba(255,45,58,0.16)', pointerEvents: 'none' }} />
              )}
              {(end && startYMD && startYMD < endYMD) && (
                <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: '50%', backgroundColor: 'rgba(255,45,58,0.16)', pointerEvents: 'none' }} />
              )}
              {/* Circle for endpoints */}
              {endpoint && (
                <div style={{
                  position: 'absolute', width: 24, height: 24, borderRadius: '50%',
                  backgroundColor: RED, zIndex: 1,
                }} />
              )}
              <span style={{
                position: 'relative', zIndex: 2,
                fontSize: 12, fontWeight: endpoint ? 700 : 500,
                fontVariantNumeric: 'tabular-nums', fontFamily: FONT,
                color: endpoint ? '#fff' : past ? t.inkFaint : t.inkMid,
              }}>{d}</span>
            </div>
          );
        })}
      </div>

      {/* Nights summary */}
      {nightsText && (
        <div style={{ marginTop: 6, fontSize: 11, color: t.inkDim, fontFamily: FONT }}>{nightsText}</div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.line}` }}>
        <button onClick={onClear} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: t.inkDim, cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
          Clear dates
        </button>
        <button onClick={onDone} style={{ background: RED, border: 'none', borderRadius: 7, padding: '0 14px', height: 28, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: FONT }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── PriceHistogramSlider ─────────────────────────────────────────────────────
function PriceHistogramSlider({ value, onChange, min = 0, max = 3000, step = 25, listings, darkMode, onDragStart, onDragEnd }) {
  const t = getTokens(darkMode);
  const [isDragging, setIsDragging] = useState(null);
  const sliderRef = useRef(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const STUB = [3,5,8,11,14,16,14,12,9,7,5,4,3,2,1,1];
  const histogram = useMemo(() => {
    if (!listings || listings.length === 0) return STUB;
    const buckets = Array(16).fill(0);
    listings.forEach(l => {
      // `price` falls back to parking.price for PARKING-only listings, which have no rent
      if (l.price == null) return;
      const idx = Math.min(15, Math.floor(l.price / 125));
      buckets[idx]++;
    });
    return buckets;
  }, [listings]);
  const maxBar = Math.max(...histogram, 1);

  const minPct = ((value[0] - min) / (max - min)) * 100;
  const maxPct = ((value[1] - min) / (max - min)) * 100;

  const getX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

  const handleStart = (handle) => (e) => {
    e.preventDefault();
    setIsDragging(handle);
    onDragStart?.();
  };

  useEffect(() => {
    if (!isDragging) return;
    const move = (e) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (getX(e) - rect.left) / rect.width));
      const raw = Math.round((pct * (max - min) + min) / step) * step;
      const cur = valueRef.current;
      if (isDragging === 'min') {
        const v = Math.max(min, Math.min(raw, cur[1] - step));
        if (v !== cur[0]) onChange([v, cur[1]]);
      } else {
        const v = Math.min(max, Math.max(raw, cur[0] + step));
        if (v !== cur[1]) onChange([cur[0], v]);
      }
    };
    const up = () => { setIsDragging(null); onDragEnd?.(); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
  }, [isDragging, min, max, step, onChange]);

  const handleKeyDown = (handle) => (e) => {
    const cur = valueRef.current;
    const delta = e.shiftKey ? step * 10 : step;
    if (handle === 'min') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange([Math.max(min, cur[0] - delta), cur[1]]);
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange([Math.min(cur[1] - step, cur[0] + delta), cur[1]]);
    } else {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange([cur[0], Math.max(cur[0] + step, cur[1] - delta)]);
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange([cur[0], Math.min(max, cur[1] + delta)]);
    }
  };

  return (
    <div>
      {/* Histogram */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24, marginBottom: 6, padding: '0 22px' }}>
        {histogram.map((count, i) => {
          const bucketMin = i * 125, bucketMax = (i + 1) * 125;
          const inRange = bucketMax > value[0] && bucketMin < value[1];
          return (
            <div key={i} style={{
              flex: 1, borderRadius: 1,
              height: `${(count / maxBar) * 100}%`,
              backgroundColor: inRange ? RED : t.line2,
              opacity: inRange ? 0.9 : 0.6,
              transition: 'background-color 120ms',
            }} />
          );
        })}
      </div>

      {/* Slider track */}
      <div style={{ padding: '10px 22px', position: 'relative' }}>
        <div ref={sliderRef} style={{ position: 'relative', height: 3, backgroundColor: t.line2, borderRadius: 2 }}>
          {/* Active fill */}
          <div style={{
            position: 'absolute', left: `${minPct}%`, width: `${maxPct - minPct}%`,
            height: 3, backgroundColor: RED, borderRadius: 2,
          }} />
          {/* Min handle */}
          <div
            role="slider" tabIndex={0}
            aria-label="Minimum price" aria-valuemin={min} aria-valuemax={value[1] - step} aria-valuenow={value[0]}
            onMouseDown={handleStart('min')} onTouchStart={handleStart('min')} onKeyDown={handleKeyDown('min')}
            style={{
              position: 'absolute', left: `${minPct}%`, top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 20, height: 20, borderRadius: '50%',
              backgroundColor: '#fff', border: `2px solid ${RED}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              cursor: 'pointer', touchAction: 'none', zIndex: isDragging === 'min' ? 2 : 1,
              outline: 'none',
            }}
          />
          {/* Max handle */}
          <div
            role="slider" tabIndex={0}
            aria-label="Maximum price" aria-valuemin={value[0] + step} aria-valuemax={max} aria-valuenow={value[1]}
            onMouseDown={handleStart('max')} onTouchStart={handleStart('max')} onKeyDown={handleKeyDown('max')}
            style={{
              position: 'absolute', left: `${maxPct}%`, top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 20, height: 20, borderRadius: '50%',
              backgroundColor: '#fff', border: `2px solid ${RED}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              cursor: 'pointer', touchAction: 'none', zIndex: isDragging === 'max' ? 2 : 1,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Min/Max cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
        {[['MIN', value[0]], ['MAX', value[1]]].map(([label, val]) => (
          <div key={label} style={{ background: t.panel2, border: `1px solid ${t.line}`, borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.inkDim, fontFamily: FONT, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.ink, fontFamily: FONT }}>${val.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RoommatesSegmented ───────────────────────────────────────────────────────
function RoommatesSegmented({ value, onChange, darkMode }) {
  const t = getTokens(darkMode);
  const options = [{ v: -1, l: 'Any' }, { v: 0, l: '0' }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }, { v: 4, l: '4+' }];
  return (
    <div style={{ background: t.panel2, border: `1px solid ${t.line}`, borderRadius: 10, padding: 3, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
      {options.map(({ v, l }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          style={{
            padding: '6px 0', borderRadius: 6, border: 'none',
            background: value === v ? RED : 'transparent',
            color: value === v ? '#fff' : t.inkMid,
            fontSize: 12, fontWeight: 600, fontFamily: FONT,
            cursor: 'pointer', transition: 'all 120ms',
            WebkitTapHighlightColor: 'transparent',
          }}
        >{l}</button>
      ))}
    </div>
  );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────
function AccordionSection({ label, value, isOpen, onToggle, children, isDefault, darkMode }) {
  const t = getTokens(darkMode);
  const bodyRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (isOpen && bodyRef.current) setHeight(bodyRef.current.scrollHeight);
    else setHeight(0);
  }, [isOpen]);

  return (
    <div style={{ borderBottom: `1px solid ${t.line}` }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: FONT }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: isDefault ? t.inkDim : RED, fontFamily: FONT }}>{value}</span>
          <span style={{ fontSize: 11, color: t.inkFaint, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 180ms ease-out', display: 'inline-block' }}>›</span>
        </div>
      </button>
      <div style={{ overflow: 'hidden', maxHeight: height, transition: 'max-height 180ms ease-out' }}>
        <div ref={bodyRef} style={{ paddingBottom: 12 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── MobileFilterSheet ────────────────────────────────────────────────────────
export default function MobileFilterSheet({ isOpen, onDismiss, onCommit, initialFilters, initialSemester, listings, darkMode }) {
  const t = getTokens(darkMode);

  const defaultFilters = {
    listingType: '',
    startDate: '',
    endDate: '',
    priceRange: [0, 3000],
    roommates: -1,
    amenities: commonAmenities.reduce((a, k) => ({ ...a, [k]: false }), {}),
  };

  const [stagedFilters, setStagedFilters] = useState(() => ({
    ...defaultFilters,
    ...(initialFilters || {}),
    amenities: { ...defaultFilters.amenities, ...(initialFilters?.amenities || {}) },
    priceRange: initialFilters?.priceRange || [0, 3000],
  }));
  const [stagedSemester, setStagedSemester] = useState(initialSemester || '');
  const [isClosing, setIsClosing] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(null); // 'start' | 'end' | null
  const [calendarView, setCalendarView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [hoverDate, setHoverDate] = useState(null);
  const [openAccordion, setOpenAccordion] = useState(null); // 'semester' | 'amenities'
  const [isPriceDragging, setIsPriceDragging] = useState(false);
  const sheetRef = useRef(null);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);
  const isTablet = window.innerWidth >= 600 || Math.min(window.innerWidth, window.innerHeight) >= 600;

  // Reset staged state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setStagedFilters({
        ...defaultFilters,
        ...(initialFilters || {}),
        amenities: { ...defaultFilters.amenities, ...(initialFilters?.amenities || {}) },
        priceRange: initialFilters?.priceRange || [0, 3000],
      });
      setStagedSemester(initialSemester || '');
      setIsClosing(false);
      setOpenCalendar(null);
      setOpenAccordion(null);
    }
  }, [isOpen]);

  const close = useCallback((commit = false) => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      if (commit) onCommit(stagedFilters, stagedSemester);
      else onDismiss();
    }, 220);
  }, [isClosing, onCommit, onDismiss, stagedFilters, stagedSemester]);

  // Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close]);

  // Body scroll lock (position:fixed trick works on iOS Safari; overflow:hidden alone does not)
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);



  // Live count
  const liveCount = useMemo(() => {
    if (!listings) return 0;

    // Listing dates come back formatted as "M/D/YY" from the query layer
    const parseListingDate = (str) => {
      if (!str || str === 'TBD') return null;
      const parts = str.split('/');
      if (parts.length !== 3) return null;
      return new Date(+`20${parts[2]}`, +parts[0] - 1, +parts[1]);
    };

    const fStart = stagedFilters.startDate ? new Date(stagedFilters.startDate + 'T00:00:00') : null;
    const fEnd = stagedFilters.endDate ? new Date(stagedFilters.endDate + 'T00:00:00') : null;

    return listings.filter(l => {
      if (stagedFilters.listingType && l.listingType !== stagedFilters.listingType) return false;
      // Use `price` (rent for HOUSING/BOTH, parking.price for PARKING-only), not raw `rent` —
      // parking-only listings have null rent and would otherwise vanish once the range narrows.
      // Full default range means "no price filter", so don't exclude priceless listings then.
      if (stagedFilters.priceRange[0] !== 0 || stagedFilters.priceRange[1] !== 3000) {
        if (l.price == null || l.price < stagedFilters.priceRange[0] || l.price > stagedFilters.priceRange[1]) return false;
      }
      if (stagedFilters.roommates !== -1 && l.roommates !== stagedFilters.roommates) return false;
      const sel = Object.entries(stagedFilters.amenities).filter(([, v]) => v).map(([k]) => k);
      if (sel.length > 0 && !sel.every(a => l.amenities?.includes(a))) return false;
      if (stagedSemester) {
        if (!getListingSemesters(l).includes(stagedSemester)) return false;
      }
      // Mirror backend SQL date logic (NULL dates are excluded, just like PostgreSQL)
      if (fStart || fEnd) {
        const lStart = parseListingDate(l.startDate);
        const lEnd = parseListingDate(l.endDate);
        if (fStart && fEnd) {
          if (!lStart || lStart > fStart) return false;
          if (!lEnd || lEnd < fEnd) return false;
        } else if (fStart) {
          if (!lEnd || lEnd < fStart) return false;
        } else if (fEnd) {
          if (!lStart || lStart > fEnd) return false;
        }
      }
      return true;
    }).length;
  }, [listings, stagedFilters, stagedSemester]);

  const activeCount = [
    !!stagedFilters.listingType,
    !!(stagedFilters.startDate || stagedFilters.endDate),
    stagedFilters.priceRange[0] !== 0 || stagedFilters.priceRange[1] !== 3000,
    stagedFilters.roommates !== -1,
    Object.values(stagedFilters.amenities).some(v => v),
    !!stagedSemester,
  ].filter(Boolean).length;
  const frozenActiveCount = useRef(activeCount);
  if (!isPriceDragging) frozenActiveCount.current = activeCount;
  const displayActiveCount = frozenActiveCount.current;

  const resetAll = () => {
    setStagedFilters(defaultFilters);
    setStagedSemester('');
    setOpenCalendar(null);
  };

  // Date helpers
  const handleDateClick = (ymd) => {
    if (openCalendar === 'start') {
      setStagedFilters(f => ({
        ...f,
        startDate: ymd,
        endDate: f.endDate && ymd >= f.endDate ? '' : f.endDate,
      }));
      setOpenCalendar('end');
    } else {
      const { startDate } = stagedFilters;
      if (startDate && ymd < startDate) {
        setStagedFilters(f => ({ ...f, startDate: ymd, endDate: startDate }));
      } else if (ymd === startDate) {
        setStagedFilters(f => ({ ...f, endDate: '' }));
      } else {
        setStagedFilters(f => ({ ...f, endDate: ymd }));
      }
      setOpenCalendar(null);
    }
  };

  const formatDate = (ymd) => {
    if (!ymd) return null;
    const d = new Date(ymd + 'T00:00:00');
    return {
      main: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      day: d.toLocaleDateString('en-US', { weekday: 'long' }),
    };
  };

  const startFmt = formatDate(stagedFilters.startDate);
  const endFmt = formatDate(stagedFilters.endDate);

  const priceLabel = stagedFilters.priceRange[0] === 0 && stagedFilters.priceRange[1] === 3000
    ? 'Any price'
    : `$${stagedFilters.priceRange[0].toLocaleString()} – $${stagedFilters.priceRange[1].toLocaleString()} / mo`;

  const semLabel = SEMESTER_OPTIONS.find(o => o.value === stagedSemester)?.label ?? 'Any';
  const amenCount = Object.values(stagedFilters.amenities).filter(Boolean).length;

  const nightsText = useMemo(() => {
    if (!stagedFilters.startDate || !stagedFilters.endDate) return null;
    const s = new Date(stagedFilters.startDate + 'T00:00:00');
    const e = new Date(stagedFilters.endDate + 'T00:00:00');
    const diff = Math.round((e - s) / 86400000);
    if (diff <= 0) return null;
    const m = s.getMonth() + 1;
    const season = m >= 3 && m <= 5 ? 'Spring' : m >= 6 && m <= 8 ? 'Summer' : m >= 9 && m <= 11 ? 'Fall' : 'Winter';
    return `${diff} night${diff !== 1 ? 's' : ''} · ${season} move-in`;
  }, [stagedFilters.startDate, stagedFilters.endDate]);

  if (!isOpen) return null;

  const sheetHeight = isTablet ? '680px' : '84dvh';

  return (
    <>
      <style>{`
        @keyframes filterSheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes filterSheetDown {
          from { transform: translateY(0); }
          to { transform: translateY(100%); }
        }
        @keyframes filterBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fs-sheet { animation: none !important; }
          .fs-backdrop { animation: none !important; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fs-backdrop"
        onClick={() => close(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 1400,
          backgroundColor: 'rgba(5,5,8,0.65)',
          backdropFilter: 'blur(2px)',
          animation: isClosing ? 'none' : 'filterBackdropIn 220ms ease forwards',
          opacity: isClosing ? 0 : undefined,
          transition: isClosing ? 'opacity 220ms ease' : undefined,
        }}
      />

      {/* Sheet wrapper — centers on tablet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1401,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-sheet-heading"
          className="fs-sheet"
          style={{
            width: '100%',
            maxWidth: isTablet ? 560 : '100%',
            maxHeight: `calc(100dvh - env(safe-area-inset-top, 0px))`,
            height: sheetHeight,
            backgroundColor: t.panel,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            display: 'flex', flexDirection: 'column',
            animation: isClosing
              ? 'filterSheetDown 220ms cubic-bezier(0.2,0.7,0.2,1) forwards'
              : 'filterSheetUp 220ms cubic-bezier(0.2,0.7,0.2,1) forwards',
            pointerEvents: 'all',
            fontFamily: FONT,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '4px 16px 0',
              borderBottom: `1px solid ${t.line}`,
              backgroundColor: t.panel,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              flexShrink: 0,
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, marginBottom: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.line2 }} />
            </div>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <h2 id="filter-sheet-heading" style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px', color: t.ink, fontFamily: FONT }}>Filters</h2>
                <span style={{ fontSize: 12, fontWeight: 500, color: t.inkDim, fontFamily: FONT, visibility: displayActiveCount > 0 ? 'visible' : 'hidden' }}>{displayActiveCount} active</span>
              </div>
              <button
                onClick={resetAll}
                style={{
                  background: 'none', border: 'none', fontSize: 13, fontWeight: 500,
                  color: activeCount === 0 ? t.inkFaint : t.inkDim,
                  cursor: activeCount === 0 ? 'default' : 'pointer',
                  fontFamily: FONT, padding: 0,
                }}
              >Reset</button>
            </div>
          </div>

          {/* Body */}
          <div
            style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 6px', WebkitOverflowScrolling: 'touch' }}
          >

            {/* Section 1 — When */}
            <div style={{ marginBottom: 12 }}>
              <SectionLabel
                label="When"
                summary={stagedFilters.startDate && stagedFilters.endDate ? `${startFmt?.main} – ${endFmt?.main}` : undefined}
                darkMode={darkMode}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { key: 'start', label: 'MOVE IN', fmt: startFmt, placeholder: 'Any date' },
                  { key: 'end', label: 'MOVE OUT', fmt: endFmt, placeholder: 'Any date' },
                ].map(({ key, label, fmt, placeholder }) => (
                  <button
                    key={key}
                    onClick={() => setOpenCalendar(prev => prev === key ? null : key)}
                    style={{
                      background: t.panel2, border: `1px solid ${openCalendar === key ? RED : t.line}`,
                      borderRadius: 8, padding: '6px 10px', textAlign: 'left', cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: t.inkDim, fontFamily: FONT, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.2px', color: fmt ? t.ink : t.inkFaint, fontFamily: FONT }}>
                      {fmt?.main ?? placeholder}
                    </div>
                    {fmt && <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: FONT, marginTop: 1 }}>{fmt.day}</div>}
                  </button>
                ))}
              </div>

              {nightsText && !openCalendar && (
                <div style={{ marginTop: 8, fontSize: 12, color: t.inkDim, fontFamily: FONT }}>{nightsText}</div>
              )}

              {openCalendar && (
                <InlineCalendar
                  startDate={stagedFilters.startDate}
                  endDate={stagedFilters.endDate}
                  hoverDate={hoverDate}
                  calendarView={calendarView}
                  setCalendarView={setCalendarView}
                  onDateClick={handleDateClick}
                  onHover={setHoverDate}
                  onClear={() => { setStagedFilters(f => ({ ...f, startDate: '', endDate: '' })); setOpenCalendar(null); }}
                  onDone={() => setOpenCalendar(null)}
                  darkMode={darkMode}
                />
              )}
            </div>

            {/* Section 2 — Type */}
            <div style={{ marginBottom: 12 }}>
              <SectionLabel label="Type" darkMode={darkMode} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TYPE_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value || 'all'}
                    label={label}
                    selected={stagedFilters.listingType === value}
                    onToggle={() => setStagedFilters(f => ({ ...f, listingType: value }))}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </div>

            {/* Section 3 — Price */}
            <div style={{ marginBottom: 12 }}>
              <SectionLabel label="Price / month" darkMode={darkMode} />
              <PriceHistogramSlider
                value={stagedFilters.priceRange}
                onChange={(v) => setStagedFilters(f => ({ ...f, priceRange: v }))}
                listings={listings}
                darkMode={darkMode}
                onDragStart={() => setIsPriceDragging(true)}
                onDragEnd={() => setIsPriceDragging(false)}
              />
            </div>

            {/* Section 4 — Roommates */}
            <div style={{ marginBottom: 12 }}>
              <SectionLabel label="Roommates" darkMode={darkMode} />
              <RoommatesSegmented
                value={stagedFilters.roommates}
                onChange={(v) => setStagedFilters(f => ({ ...f, roommates: v }))}
                darkMode={darkMode}
              />
            </div>

            {/* Section 5 — Semester (accordion) */}
            <AccordionSection
              label="Semester"
              value={semLabel}
              isOpen={openAccordion === 'semester'}
              onToggle={() => setOpenAccordion(prev => prev === 'semester' ? null : 'semester')}
              isDefault={!stagedSemester}
              darkMode={darkMode}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SEMESTER_OPTIONS.map(({ value, label }) => (
                  <Chip
                    key={value || 'any'}
                    label={label}
                    selected={stagedSemester === value}
                    onToggle={() => setStagedSemester(prev => prev === value ? '' : value)}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </AccordionSection>

            {/* Section 6 — Amenities (accordion) */}
            <AccordionSection
              label="Amenities"
              value={amenCount > 0 ? `${amenCount} / 8` : 'None'}
              isOpen={openAccordion === 'amenities'}
              onToggle={() => setOpenAccordion(prev => prev === 'amenities' ? null : 'amenities')}
              isDefault={amenCount === 0}
              darkMode={darkMode}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {commonAmenities.map(amenity => (
                  <Chip
                    key={amenity}
                    label={amenity}
                    selected={!!stagedFilters.amenities[amenity]}
                    onToggle={() => setStagedFilters(f => ({ ...f, amenities: { ...f.amenities, [amenity]: !f.amenities[amenity] } }))}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </AccordionSection>

            {/* Bottom spacer so last section isn't right against footer */}
            <div style={{ height: 16 }} />
          </div>

          {/* Footer CTA */}
          <div style={{
            padding: `10px 16px`,
            paddingBottom: `max(10px, calc(env(safe-area-inset-bottom, 0px) + 10px))`,
            borderTop: `1px solid ${t.line}`,
            backgroundColor: t.panel,
            flexShrink: 0,
          }}>
            <button
              onClick={() => close(true)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 10, border: 'none',
                backgroundColor: liveCount === 0 ? RED_DEEP : RED,
                opacity: liveCount === 0 ? 0.7 : 1,
                color: '#fff',
                fontSize: 14, fontWeight: 700, fontFamily: FONT,
                boxShadow: `0 8px 22px -8px ${RED_GLOW}`,
                cursor: 'pointer',
                transition: 'background-color 150ms, opacity 150ms',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {liveCount === 0 ? 'No matches — adjust filters' : `Show ${liveCount} place${liveCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
