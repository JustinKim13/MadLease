const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

export async function searchAddresses(query) {
  if (!query || query.length < 3) return [];
  try {
    // Use structured query for much better partial address matching
    const params = new URLSearchParams({
      format: 'json',
      street: query,
      city: 'Madison',
      state: 'WI',
      countrycodes: 'us',
      limit: '5',
      addressdetails: '1',
    });
    const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`);
    if (!response.ok) return [];
    const results = await response.json();
    // Fall back to free-form search if structured returns nothing
    if (results.length > 0) return results;
    const fallbackQuery = query.toLowerCase().includes('madison') ? query : `${query}, Madison, WI`;
    const fallback = await fetch(
      `${NOMINATIM_BASE_URL}?format=json&q=${encodeURIComponent(fallbackQuery)}&limit=5&addressdetails=1&countrycodes=us`
    );
    if (!fallback.ok) return [];
    return await fallback.json();
  } catch {
    return [];
  }
}

// In-memory cache that lasts for the browser session
const coordinatesCache = new Map();

export async function geocodeAddress(address) {
  // Check in-memory cache first
  if (coordinatesCache.has(address)) {
    return coordinatesCache.get(address);
  }

  try {
    // Format the address components
    const searchQuery = encodeURIComponent(address);
    
    // Make the geocoding request
    // Note: Browser will use its default User-Agent (custom headers cause CORS preflight issues)
    const response = await fetch(
      `${NOMINATIM_BASE_URL}?q=${searchQuery}&format=json&limit=1`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }

    const data = await response.json();
    
    // Check if we got any results
    if (data && data.length > 0) {
      const coords = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      
      // Cache the result in memory
      coordinatesCache.set(address, coords);
      
      return coords;
    }
    
    throw new Error('No results found for address');
  } catch {
    return null;
  }
}