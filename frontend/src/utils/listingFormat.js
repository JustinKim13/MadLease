// "2 bd · 1 ba" for housing; parking spots have no bed/bath count
export const formatSpecs = (listing) => {
  if (listing.listingType === 'PARKING') return null;
  const parts = [];
  if (listing.bedrooms) parts.push(`${listing.bedrooms} bd`);
  if (listing.bathrooms) parts.push(`${listing.bathrooms} ba`);
  return parts.length ? parts.join(' · ') : null;
};

// Parses a date-only string ("2026-08-01") as local midnight instead of UTC midnight,
// so it doesn't render as the previous day in US time zones.
export const toLocalDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d));

// "Aug 1 – May 1" or "Starting Aug 1, 2026".
export const formatAvailability = (listing) => {
  const fmt = (d, withYear) => toLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  if (listing.startDate && listing.endDate) return `${fmt(listing.startDate)} – ${fmt(listing.endDate, true)}`;
  if (listing.startDate) return `Starting ${fmt(listing.startDate, true)}`;
  return null;
};
