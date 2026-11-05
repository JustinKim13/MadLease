import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ApiService } from './apiService.js';

// Stable per-session seed for the backend's deterministic shuffle of the browse feed.
// sessionStorage persists across page reloads in the same tab but not across tabs or
// new sessions, so each fresh visit sees a new ordering while refetches stay stable.
const BROWSE_SEED_KEY = 'browseSeed';

export const getBrowseSeed = () => {
  if (typeof window === 'undefined') return null;
  let seed = sessionStorage.getItem(BROWSE_SEED_KEY);
  if (!seed) {
    seed = String(Math.floor(Math.random() * 1e9));
    sessionStorage.setItem(BROWSE_SEED_KEY, seed);
  }
  return seed;
};

// Helper function to format address without leading/trailing commas
const formatAddress = (street, city, state, zipcode) => {
  const parts = [];
  if (street) parts.push(street);
  if (city) parts.push(city);
  if (state && zipcode) {
    parts.push(`${state} ${zipcode}`);
  } else if (state) {
    parts.push(state);
  } else if (zipcode) {
    parts.push(zipcode);
  }
  return parts.join(', ') || 'Address not provided';
};

// in TanStack Query, every piece of data in the cache needs a unique identifier, called the 'query key'

// here, we're creating our keys for our data
export const listingKeys = {
  all: ['listings'], // query key 'all' serves as a base key, or parent in hierarchy-- could use queryKey as well
  // ^^ not actually tied to a specific query, just serves as a general parent key

  // here's the 'children' keys of our parent key 'listings'
  list: (filters) => [...listingKeys.all, 'list', filters || {}], // returns ['listings', 'list'] for the main listings query -- list of all listings
  details: (listingId) => [...listingKeys.all, 'details', listingId], // returns ['listings', 'details', listingId] for individual listing
  counts: (listingId) => [...listingKeys.all, 'counts', listingId], // returns ['listings', 'counts', listingId] for view/save counts
  saved: (userId) => ['savedListings', userId], // returns ['savedListings', userId] -- get listings saved by specific user
  userListings: (userId) => ['userListings', userId], // returns ['userListings', userId] -- get listings created by specific user
  trending: (limit) => [...listingKeys.all, 'trending', limit], // returns ['listings', 'trending', limit]
};

// standalone query function that can be used for prefetching
export const fetchListings = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.minRent) params.append('minRent', filters.minRent);
  if (filters.maxRent) params.append('maxRent', filters.maxRent);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.roommates !== undefined && filters.roommates !== -1) params.append('roommates', filters.roommates);
  if (filters.bedrooms) params.append('bedrooms', filters.bedrooms);
  if (filters.amenities) params.append('amenities', filters.amenities);
  if (filters.listingType) params.append('listingType', filters.listingType);
  if (filters.seed) params.append('seed', filters.seed);

  const queryString = params.toString();
  const endpoint = queryString ? `/listings?${queryString}` : '/listings';
  const data = await ApiService.get(endpoint, false);
  
  // Process listings to include additional data
  return data.map(listing => ({
    ...listing,
    id: listing.publicId, // Use publicId as the primary identifier for URLs
    listingID: listing.listingID, // Keep internal ID for reference
    publicId: listing.publicId,
    price: listing.rent ?? listing.parking?.price ?? null,
    listingType: listing.listingType || 'HOUSING',
    coords: [listing.lat, listing.lon],
    images: listing.preSignedGetUrls || [],
    roommates: listing.roommates || 0,
    parking: listing.parking || null,
    // Include user information for proper caching
    name: listing.name,
    email: listing.email,
    firebaseUid: listing.firebaseUid,
    profilePictureUrl: listing.profilePictureUrl,
    userCreatedAt: listing.userCreatedAt,
  }));
};


// hook for fetching trending listings by composite score (views * 0.6 + saves * 0.4)
export function useTrendingListingsQuery(limit = 5) {
  return useQuery({
    queryKey: listingKeys.trending(limit),
    queryFn: async () => {
      const data = await ApiService.get(`/listings/trending?limit=${limit}`, false);
      return data.map(listing => ({
        ...listing,
        id: listing.publicId,
        price: listing.rent ?? listing.parking?.price ?? null,
        listingType: listing.listingType || 'HOUSING',
        coords: [listing.lat, listing.lon],
        images: listing.preSignedGetUrls || [],
        roommates: listing.roommates || 0,
        parking: listing.parking || null,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// hook for fetching all listings
export function useListingsQuery(filters = {}) {
  const filtersWithSeed = { ...filters, seed: getBrowseSeed() };
  return useQuery({
    queryKey: listingKeys.list(filtersWithSeed),
    queryFn: () => fetchListings(filtersWithSeed),
    placeholderData: keepPreviousData,  // prevents blank flash when filters change
  });
}

// hook for fetching individual listing details
// userId is optional - when provided, includes isOwner check and caches per-user
export function useListingDetailsQuery(listingId, userId = null) {
  return useQuery({
    // Include userId in cache key so isOwner is cached correctly per user
    queryKey: userId ? [...listingKeys.details(listingId), userId] : listingKeys.details(listingId),
    queryFn: async () => {
      // Check if this listing was already viewed this session (prevents refresh spam)
      const alreadyViewed = !!sessionStorage.getItem(`viewed_${listingId}`);
      const url = alreadyViewed
        ? `/listings/${listingId}/details?track=false`
        : `/listings/${listingId}/details`;
      // Pass auth token if user is logged in (for isOwner check)
      const data = await ApiService.get(url, !!userId);
      // Mark as viewed for this session so refreshes don't inflate the count
      sessionStorage.setItem(`viewed_${listingId}`, 'true');

      // Process the listing data
      return {
        ...data,
        id: data.publicId, // Use publicId as the primary identifier for URLs
        listingID: data.listingID, // Keep internal ID for reference
        publicId: data.publicId,
        price: data.rent ?? data.parking?.price ?? null,
        listingType: data.listingType || 'HOUSING',
        coords: [data.lat, data.lon],
        images: data.preSignedGetUrls || [],
        roommates: data.roommates || 0,
        title: data.title || 'Untitled Listing',
        description: data.description || '',
        bedrooms: data.bedrooms ?? null,
        bathrooms: data.bathrooms ?? null,
        squareFeet: data.squareFeet ?? null,
        distanceToCampus: '0.6 miles',
        address: formatAddress(data.street, data.city, data.state, data.zipcode),
        startDate: formatDate(data.startDate) || 'TBD',
        endDate: formatDate(data.endDate) || 'TBD',
        isOwner: data.isOwner || false,
        poster: {
          name: data.name || 'Unknown User',
          email: data.email || 'No email provided',
          joinDate: data.userCreatedAt
            ? `Member since ${new Date(data.userCreatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
            : 'Member since 2023',
          profilePictureUrl: data.profilePictureUrl || null,
          isVerified: data.isVerified || false,
        },
        amenities: data.amenities || [],
        parking: data.parking || null,
      };
    },
    enabled: !!listingId,
    staleTime: 10 * 60 * 1000, // 10 minutes - don't refetch unless data is actually stale
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

// hook for fetching saved listings
export function useSavedListingsQuery(userId, options = {}) {
  return useQuery({
    queryKey: listingKeys.saved(userId),
    queryFn: async () => {
      const data = await ApiService.get('/user/saved-listings');

      // make the data to match the frontend
      return Promise.all(data.map(async (listing) => {
        return {
          ...listing,
          id: listing.publicId, // Use publicId as the primary identifier for URLs
          listingID: listing.listingID, // Keep internal ID for reference
          publicId: listing.publicId,
          price: listing.rent ?? listing.parking?.price ?? null,
          listingType: listing.listingType || 'HOUSING',
          startDate: formatDate(listing.startDate) || 'TBD',
          address: formatAddress(listing.street, listing.city, listing.state, listing.zipcode),
          images: listing.preSignedGetUrls || [],
          roommates: listing.roommates || 0,
          parking: listing.parking || null,
        };
      }));
    },
    enabled: !!userId, // Only run query when userId is available
    ...options
  });
}

// hook for saving/unsaving mutations with cache updates
export function useSaveListingMutations(userId) {
  const queryClient = useQueryClient();

  // SAVE mutation
  const saveMutation = useMutation({
    mutationFn: ({ listingId }) =>
      ApiService.post(`/saved-listings/${listingId}`, {}),

    // Optimistic update - runs BEFORE the API call
    onMutate: async ({ listingId }) => {
      // Cancel any outgoing refetches — use listingKeys.all for partial matching across all filter variations
      await queryClient.cancelQueries({ queryKey: listingKeys.saved(userId) });
      await queryClient.cancelQueries({ queryKey: listingKeys.all });

      // Snapshot previous values for rollback
      const previousSaved = queryClient.getQueryData(listingKeys.saved(userId));

      // Optimistically update saved listings
      if (userId) {
        queryClient.setQueryData(listingKeys.saved(userId), (oldData) => {
          if (!oldData) return [{ publicId: listingId, id: listingId }];
          if (oldData.some(item => item.publicId === listingId || item.id === listingId)) return oldData;
          return [...oldData, { publicId: listingId, id: listingId }];
        });
      }

      return { previousSaved };
    },

    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousSaved) {
        queryClient.setQueryData(listingKeys.saved(userId), context.previousSaved);
      }
    },

    onSettled: () => {
      // Refetch saved listings to get full data after optimistic update
      queryClient.invalidateQueries({ queryKey: listingKeys.saved(userId) });
    },
  });

  // UNSAVE mutation
  const unsaveMutation = useMutation({
    mutationFn: ({ listingId }) =>
      ApiService.delete(`/saved-listings/${listingId}`),

    // Optimistic update - runs BEFORE the API call
    onMutate: async ({ listingId }) => {
      await queryClient.cancelQueries({ queryKey: listingKeys.saved(userId) });
      await queryClient.cancelQueries({ queryKey: listingKeys.all });

      const previousSaved = queryClient.getQueryData(listingKeys.saved(userId));

      // Optimistically remove from saved listings
      if (userId) {
        queryClient.setQueryData(listingKeys.saved(userId), (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter(item => item.publicId !== listingId && item.id !== listingId);
        });
      }

      return { previousSaved };
    },

    onError: (err, _variables, context) => {
      if (context?.previousSaved) {
        queryClient.setQueryData(listingKeys.saved(userId), context.previousSaved);
      }
    },

    onSettled: () => {
      // Refetch saved listings to ensure data consistency
      queryClient.invalidateQueries({ queryKey: listingKeys.saved(userId) });
    },
  });

  return { saveMutation, unsaveMutation };
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
};

// hook for fetching user's own listings
export function useUserListingsQuery(userId, options = {}) {
  return useQuery({
    queryKey: listingKeys.userListings(userId),
    queryFn: async () => {
      const data = await ApiService.get('/user/listings');

      return Promise.all(data.map(async (listing) => {
        return {
          ...listing,
          id: listing.publicId, // Use publicId as the primary identifier for URLs
          listingID: listing.listingID, // Keep internal ID for reference
          publicId: listing.publicId,
          price: listing.rent ?? listing.parking?.price ?? null,
          listingType: listing.listingType || 'HOUSING',
          startDate: formatDate(listing.startDate) || 'TBD',
          address: formatAddress(listing.street, listing.city, listing.state, listing.zipcode),
          images: listing.preSignedGetUrls || [],
          roommates: listing.roommates || 0,
          parking: listing.parking || null,
        };
      }));
    },
    enabled: !!userId, // Only run query when userId is available
    ...options
  });
}

// hook for fetching live view and save counts for a listing (separate from details to avoid busting the 10-min cache)
export function useListingCountsQuery(listingId) {
  return useQuery({
    queryKey: listingKeys.counts(listingId),
    queryFn: async () => {
      const data = await ApiService.get(`/listings/${listingId}/counts`, false);
      return {
        viewCount: data.viewCount || 0,
        saveCount: data.saveCount || 0,
      };
    },
    enabled: !!listingId,
    staleTime: 0, // always fetch fresh counts
  });
}

// hook for deleting a listing
export function useDeleteListingMutation(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listingId) => {
      await ApiService.delete(`/listings/${listingId}`);
      return listingId;
    },
    onSuccess: () => {
      // Invalidate all listing caches — covers every filter variation
      queryClient.invalidateQueries({ queryKey: listingKeys.all });

      // Remove from user listings cache
      if (userId) {
        queryClient.invalidateQueries({ queryKey: listingKeys.userListings(userId) });
      }
    },
  });
}

// hook for updating a listing's status (active, inactive, rented, etc.)
export function useUpdateListingStatusMutation(userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ publicId, status }) => {
      return ApiService.patch(`/listings/${publicId}/status`, { status });
    },
    onSuccess: (_, { publicId }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.userListings(userId) });
      queryClient.invalidateQueries({ queryKey: listingKeys.details(publicId) });
      queryClient.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}
