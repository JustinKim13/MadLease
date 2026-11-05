import { useState, useContext, useRef, useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Map from '../components/Map';
import { geocodeAddress } from '../services/geocoding';
import { useQueryClient } from '@tanstack/react-query';
import { listingKeys } from '../services/listingQueries';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';
import AmbientBlobs from '../components/AmbientBlobs';
import { ApiService, API_BASE_URL } from '../services/apiService';
import { Filter } from 'bad-words'; // Import the bad-words filter
import SortableImageGrid from '../components/SortableImageGrid';
import { AmenitiesSelector } from '../components/AmenitiesSelector';
import { resizeImage } from '../utils/resizeImage';
import { toLocalDate } from '../utils/listingFormat';
import { processImageFiles } from '../utils/processImages';
import Seo from '../components/Seo';
import SuccessModal from '../components/SuccessModal';

// Instantiate the filter
const filter = new Filter();

const getLocalTodayIsoDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function CreateListing() {
  const { darkMode } = useContext(ThemeContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
  const [activeImage, setActiveImage] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  
  const { currentUser } = useAuth();
  const userId = currentUser?.uid;
  const localTodayIsoDate = getLocalTodayIsoDate();
  
  // Listing type — read from URL query param (set on Profile page)
  const [searchParams] = useSearchParams();
  const urlType = searchParams.get('type');
  const listingType = ['HOUSING', 'PARKING', 'BOTH'].includes(urlType) ? urlType : 'HOUSING';

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    startDate: '',
    endDate: '',
    images: [],
    coords: [43.0755, -89.4100], // Default to Madison
    amenities: [],
    bedrooms: '',
    bathrooms: '',
    squareFeet: '',
    roommates: '',
    // split address into components:
    street: '',
    aptNumber: '',
    city: 'Madison',
    state: 'WI',
    zipcode: '',
    parking: {
      included: false,
      type: '',
      spots: '',
      priceIncluded: true,
      price: '',
      notes: '',
      image: null, // { file: File, preview: string } or null
    },
  });

  // Add validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [geocodeError, setGeocodeError] = useState(''); // store geocode error
  const [fileInputKey, setFileInputKey] = useState(0); // Key to force file input reset
  const fileInputRef = useRef(null); // Ref for file input to ensure proper reset
  const [parkingTypeOpen, setParkingTypeOpen] = useState(false);
  const parkingTypeRef = useRef(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [imageError, setImageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdListing, setCreatedListing] = useState(null);

  // Persist draft to localStorage (images excluded — File objects can't be serialized)
  const DRAFT_KEY = `create-listing-draft${userId ? `-${userId}` : ''}`;

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved);
      // listingType is read from URL params, not draft
      setFormData(prev => ({
        ...prev,
        ...draft,
        images: [],
        parking: { ...prev.parking, ...draft.parking, image: null },
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  useEffect(() => {
    const { images, parking, ...rest } = formData;
    const { image: _parkingImage, ...parkingRest } = parking;
    const draft = { ...rest, parking: parkingRest, listingType };
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, DRAFT_KEY]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Debounced geocoding for map preview
  const mapGeoDebounceRef = useRef(null);
  useEffect(() => {
    const { street, city, state } = formData;
    if (!street || !city || !state) return;
    if (mapGeoDebounceRef.current) clearTimeout(mapGeoDebounceRef.current);
    mapGeoDebounceRef.current = setTimeout(async () => {
      const address = `${street}, ${city}, ${state}`;
      const coords = await geocodeAddress(address);
      if (coords) {
        setFormData(prev => ({ ...prev, coords: [coords.lat, coords.lng] }));
      }
    }, 800);
    return () => clearTimeout(mapGeoDebounceRef.current);
  }, [formData.street, formData.city, formData.state]);

  // Close parking type dropdown on outside click
  useEffect(() => {
    if (!parkingTypeOpen) return;
    const handler = (e) => {
      if (parkingTypeRef.current && !parkingTypeRef.current.contains(e.target)) {
        setParkingTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [parkingTypeOpen]);

  // Validation rules
  const validateField = (name, value) => {
    switch (name) {
      case 'title':
        if (value.trim().length < 5) return 'Title must be at least 5 characters';
        if (value.trim().length > 50) return 'Title must be no more than 50 characters';
        return '';
      case 'description':
        if (value.trim().length < 20) return 'Description must be at least 20 characters';
        if (value.trim().length > 750) return 'Description must be no more than 750 characters';
        return '';
      case 'price':
        if (!value || isNaN(value) || Number(value) <= 0) return 'Please enter a valid price';
        if (!Number.isInteger(Number(value))) return 'Price must be a whole dollar amount (e.g. 850)';
        return '';
      case 'startDate': {
        if (!value) return 'Start date is required';
        const [y, m, d] = value.split('-').map(Number);
        const selected = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selected < today) return 'Start date cannot be in the past';
        return '';
      }
      case 'endDate':
        return !value ? 'End date is required' :
               new Date(value) <= new Date(formData.startDate) ? 'End date must be after start date' : '';
      case 'bedrooms':
        if (!value || isNaN(value) || Number(value) <= 0) return 'Please enter a valid number of bedrooms';
        if (!Number.isInteger(Number(value))) return 'Bedrooms must be a whole number';
        return '';
      case 'bathrooms':
        if (!value || isNaN(value) || Number(value) <= 0) return 'Please enter a valid number of bathrooms';
        if (!Number.isInteger(Number(value))) return 'Bathrooms must be a whole number';
        return '';
      case 'squareFeet':
        if (!value || isNaN(value) || Number(value) <= 0) return 'Please enter a valid square footage';
        if (!Number.isInteger(Number(value))) return 'Square footage must be a whole number';
        return '';
      case 'roommates':
        if (value === '' || value === null || value === undefined) return 'Please enter a valid number of roommates (0 or more)';
        if (isNaN(value) || Number(value) < 0) return 'Please enter a valid number of roommates (0 or more)';
        if (!Number.isInteger(Number(value))) return 'Roommates must be a whole number';
        return '';
      case 'street':
        if (!value.trim()) return 'Street address is required';
        if (value.trim().length > 255) return 'Street address must be no more than 255 characters';
        return '';
      case 'city':
        if (!value.trim()) return 'City is required';
        if (value.trim().length > 100) return 'City must be no more than 100 characters';
        return '';
      case 'state':
        if (!value.trim()) return 'State is required';
        if (value.trim().length > 100) return 'State must be no more than 100 characters';
        return '';
      case 'zipcode':
        if (!value || !/^\d{5}$/.test(value)) return 'Please enter a 5-digit ZIP code (e.g. 53715)';
        return '';
      case 'aptNumber':
        if (value && (!/^\d+$/.test(value) || parseInt(value) < 0)) return 'Unit number must be a positive number (e.g. 602)';
        return '';
      case 'images':
        return value.length === 0 ? 'At least one image is required' : '';
      default:
        return '';
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setHasUnsavedChanges(true);

    // Validate on change if field has been touched
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const housingFields = ['price', 'bedrooms', 'bathrooms', 'squareFeet', 'roommates'];

  const validateForm = () => {
    const newErrors = {};
    const needsHousing = listingType === 'HOUSING' || listingType === 'BOTH';
    const needsParking = listingType === 'PARKING' || listingType === 'BOTH';

    Object.keys(formData).forEach(key => {
      // Skip housing-only fields for parking-only listings
      if (!needsHousing && housingFields.includes(key)) return;
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
      }
    });
    // Parking validation
    if (needsParking) {
      if (!formData.parking.type) newErrors['parking.type'] = 'Parking type is required';
      if (!formData.parking.spots || !Number.isInteger(Number(formData.parking.spots)) || Number(formData.parking.spots) < 1) {
        newErrors['parking.spots'] = 'Spots must be a whole number \u2265 1';
      }
      if (listingType === 'PARKING') {
        if (formData.parking.price === '' || !Number.isInteger(Number(formData.parking.price)) || Number(formData.parking.price) < 0) {
          newErrors['parking.price'] = 'Price must be a whole number \u2265 0';
        }
      } else if (!formData.parking.priceIncluded && (formData.parking.price === '' || !Number.isInteger(Number(formData.parking.price)) || Number(formData.parking.price) < 0)) {
        newErrors['parking.price'] = 'Price must be a whole number \u2265 0';
      }
      if (formData.parking.notes && formData.parking.notes.length > 250) {
        newErrors['parking.notes'] = 'Notes cannot exceed 250 characters';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const errorStyle = {
    color: 'var(--badger-red)',
    fontSize: '0.875rem',
    marginTop: '0.25rem'
  };

  const Status = {
    Available: 'AVAILABLE',
    Pending: 'PENDING',
    Taken: 'TAKEN'
  };
  // Helper for full address
  const formattedAddress = [
    formData.street,
    formData.city,
    formData.state && formData.zipcode ? `${formData.state} ${formData.zipcode}` : formData.state || formData.zipcode,
  ]
    .filter(Boolean)
    .join(', ');

  // Preview listing object
  const previewListing = {
    ...formData,
    // Clean the title and description for the preview
    title: filter.clean(formData.title),
    description: filter.clean(formData.description),
    id: 'preview',
    poster: {
      name: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Your Name',
      email: currentUser?.email || 'your.email@example.com',
      joinDate: `Member since ${new Date(currentUser?.metadata?.creationTime || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      firebaseUid: currentUser?.uid,
      profilePictureUrl: currentUser?.photoURL,
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    borderRadius: '14px',
    border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
    backgroundColor: darkMode ? '#272422' : '#ffffff',
    color: darkMode ? '#f0ebe5' : '#333',
    fontSize: '16px',
  };

  const handleAmenityToggle = (amenity) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
    setHasUnsavedChanges(true);
  };

  const MAX_IMAGES = 20;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    const { validFiles, errors } = await processImageFiles(files, MAX_FILE_SIZE);

    if (errors.length > 0) {
      setImageError(errors.join(' | '));
      setTimeout(() => setImageError(''), 5000);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    const fileObjects = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setFormData(prev => {
      const currentCount = prev.images.length;
      const availableSlots = MAX_IMAGES - currentCount;
      const imagesToAdd = fileObjects.slice(0, availableSlots);
      return {
        ...prev,
        images: [...prev.images, ...imagesToAdd]
      };
    });
    setHasUnsavedChanges(true);
    // Reset the input value so the same file can be re-selected after removal
    e.target.value = '';
  };

  // Add function to handle image removal
  const handleImageRemove = (index) => {
    setFormData(prev => {
      // Create a copy of the current images array
      const newImages = [...prev.images];
      // Revoke the URL for the removed image
      URL.revokeObjectURL(newImages[index].preview);
      // Remove the image at the specified index
      newImages.splice(index, 1);
      // Reset activeImage if necessary
      if (activeImage >= newImages.length) {
        setActiveImage(Math.max(0, newImages.length - 1));
      }
      return {
        ...prev,
        images: newImages
      };
    });
    setHasUnsavedChanges(true);
    // Increment key to force file input to reset (allows re-adding same file)
    setFileInputKey(prev => prev + 1);
  };

  // Handle image reordering from drag-and-drop
  const handleImageReorder = (newImages) => {
    setFormData(prev => ({
      ...prev,
      images: newImages
    }));
    setHasUnsavedChanges(true);
    // Reset active image to first when reordering
    setActiveImage(0);
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!currentUser) {
      setSubmitError('You must be signed in to create a listing.');
      setTimeout(() => setSubmitError(''), 5000);
      return;
    }
    
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    setGeocodeError(''); // Reset geocode error
    
    // Validate all fields
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.error-message');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Geocode the composed address
      const coordsResult = await geocodeAddress(formattedAddress);
      
      if (!coordsResult) {
        setGeocodeError('Could not find coordinates for the provided address. Please check and try again.');
        // Scroll to address section
        const addressSection = document.getElementById('address-section');
        if (addressSection) {
          addressSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      
      // Update the form data with geocoded coordinates for map display
      setFormData(prev => ({
        ...prev,
        coords: [coordsResult.lat, coordsResult.lng]
      }));
      
      // Create the listing object with correct field names to match backend model
      const needsHousing = listingType === 'HOUSING' || listingType === 'BOTH';
      const requestData = {
        listingType,
        // Censor the title and description before sending to the backend
        title: filter.clean(formData.title),
        description: filter.clean(formData.description),
        startDate: formData.startDate,
        endDate: formData.endDate,
        street: formData.street,
        aptnumber: formData.aptNumber ? parseInt(formData.aptNumber) : 0, // backend expects 'aptnumber', not 'aptNumber'
        city: formData.city,
        state: formData.state,
        zipcode: parseInt(formData.zipcode),
        lat: parseFloat(coordsResult.lat), // Use geocoded coordinates, backend expects 'lat'
        lon: parseFloat(coordsResult.lng), // Use geocoded coordinates, backend expects 'lon'
        // Housing-only fields
        ...(needsHousing ? {
          rent: parseInt(formData.price), // backend expects 'rent', not 'price'; must be int
          bedrooms: parseInt(formData.bedrooms),
          bathrooms: parseInt(formData.bathrooms),
          squareFeet: parseInt(formData.squareFeet),
          roommates: parseInt(formData.roommates),
          amenities: formData.amenities,
        } : {
          amenities: [],
        }),
      };

      const listing = JSON.stringify(requestData);
      const blob = new Blob([listing], { type: 'application/json' });

      const imageNames = formData.images.map(img => img.file.name);
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('listing', blob, 'listing.json');
      imageNames.forEach(name => formDataToSubmit.append('images', name));

      // Parking
      const needsParking = listingType === 'PARKING' || listingType === 'BOTH';
      if (needsParking) {
        const parkingObj = {
          parkingType: formData.parking.type,
          spots: parseInt(formData.parking.spots),
          price: listingType === 'PARKING'
            ? (parseInt(formData.parking.price) || 0)
            : (formData.parking.priceIncluded ? 0 : (parseInt(formData.parking.price) || 0)),
          notes: listingType === 'BOTH' ? (formData.parking.notes || null) : null,
          imageKey: null,
        };
        formDataToSubmit.append('parking', new Blob([JSON.stringify(parkingObj)], { type: 'application/json' }));
        if (listingType === 'BOTH' && formData.parking.image) {
          formDataToSubmit.append('parkingImageName', formData.parking.image.file.name);
        }
      }
      
      // Get the auth token for the request
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`${API_BASE_URL}/listing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSubmit
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const err = new Error(`Failed to create listing: ${response.status}`);
        // Show the server's validation message on a 400; keep the generic text otherwise
        if (response.status === 400) err.userMessage = body.error;
        throw err;
      }

      const result = await response.json(); // { publicId, presignedUrls, parkingImagePresignedUrl }
      const presignedUrls = result.presignedUrls || result; // Handle both new and old format
      const listingPublicId = result.publicId;

      // Upload parking image if provided
      if (formData.parking.included && formData.parking.image && result.parkingImagePresignedUrl) {
        await fetch(result.parkingImagePresignedUrl, {
          method: 'PUT',
          body: formData.parking.image.file,
          headers: { 'Content-Type': formData.parking.image.file.type },
        });
      }

      // Helper function to upload with retries
      const uploadWithRetry = async (file, url, maxRetries = 2) => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const uploadResponse = await fetch(url, {
              method: 'PUT',
              body: file
            });
            if (!uploadResponse.ok) {
              throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }
            return { success: true };
          } catch (error) {
            if (attempt === maxRetries) {
              return { success: false, error: error.message };
            }
            // Wait briefly before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      };

      // Resize images to max 1080px before uploading (reduces S3 storage and CDN delivery size)
      const resizedFiles = await Promise.all(formData.images.map((imgObj) => resizeImage(imgObj.file)));

      // Upload all images with retry logic
      const uploadResults = await Promise.all(
        resizedFiles.map((file, idx) => uploadWithRetry(file, presignedUrls[idx]))
      );

      const failedUploads = uploadResults.filter(r => !r.success);

      if (failedUploads.length > 0) {
        // Some uploads failed - delete the listing and show error
        if (listingPublicId) {
          try {
            await ApiService.delete(`/listings/${listingPublicId}`);
          } catch (deleteError) {
            // Ignore delete error - listing may be orphaned but we'll show user the upload error
          }
        }
        const failedCount = failedUploads.length;
        const totalCount = formData.images.length;
        setSubmitError(`Failed to upload ${failedCount} of ${totalCount} images. Please check your connection and try again.`);
        setTimeout(() => setSubmitError(''), 5000);
        return; // Stay on page with form data intact
      }

      // All uploads successful - proceed with cache invalidation
      
      // Invalidate all listing-related queries to force fresh fetches
      await queryClient.invalidateQueries({ queryKey: listingKeys.all });
      await queryClient.invalidateQueries({ queryKey: listingKeys.list() });
      await queryClient.invalidateQueries({ queryKey: listingKeys.userListings(userId) });
      await queryClient.invalidateQueries({ queryKey: listingKeys.saved(userId) });
      
      // Also invalidate any queries that might contain "listings" in their key
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = JSON.stringify(query.queryKey);
          return key.includes('listings') || key.includes('userListings') || key.includes('savedListings');
        }
      });
      
      // Force refetch of the main listings data to ensure immediate updates everywhere
      await queryClient.refetchQueries({ queryKey: listingKeys.list() });

      // Clear unsaved changes flag and draft
      setHasUnsavedChanges(false);
      localStorage.removeItem(DRAFT_KEY);

      // Show success modal instead of navigating immediately
      const needsHousingForSuccess = listingType === 'HOUSING' || listingType === 'BOTH';
      const needsParkingForSuccess = listingType === 'PARKING' || listingType === 'BOTH';
      const parkingPriceForSuccess = needsParkingForSuccess
        ? (parseInt(formData.parking.price) || 0)
        : null;
      setCreatedListing({
        id: listingPublicId,
        title: filter.clean(formData.title),
        listingType,
        rent: needsHousingForSuccess ? (parseInt(formData.price) || null) : null,
        // SuccessModal falls back to `price` when `rent` is null (for parking-only listings)
        price: needsHousingForSuccess ? (parseInt(formData.price) || null) : parkingPriceForSuccess,
        startDate: formData.startDate,
        endDate: formData.endDate,
        preSignedGetUrls: formData.images.map((img) => img.preview).filter(Boolean),
      });
      setShowSuccessModal(true);
    } catch (error) {
      setSubmitError(error.userMessage || 'Something went wrong. Check all fields are filled in correctly and try again.');
      setTimeout(() => setSubmitError(''), 7000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Seo title="Create a Listing" description="Post your UW-Madison sublease or parking spot on MadLease." path="/listings/new" noindex />
    <div style={{
      position: 'relative',
      zIndex: 103,
      padding: '1rem',
      maxWidth: '1400px',
      margin: '0 auto',
      color: darkMode ? '#fff' : '#333'
    }}>
      <AmbientBlobs darkMode={darkMode} isMobile={isMobile} layer={-1} />
      <h1 className="form-page-title" style={{ marginBottom: '2rem', color: darkMode ? '#fff' : '#333' }}>
        {listingType === 'PARKING' ? 'List Your Parking Spot' : listingType === 'BOTH' ? 'List Your Property + Parking' : 'List Your Property'}
      </h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '2rem'
      }}>

        {/* Form Section */}
        <div style={{
          backgroundColor: isMobile ? 'transparent' : 'var(--card-background)',
          padding: isMobile ? '0' : '1.5rem',
          borderRadius: isMobile ? '0' : '8px',
          boxShadow: isMobile ? 'none' : (darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px var(--shadow-color)'),
          minWidth: 0,
        }}>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {{ HOUSING: 'Housing', PARKING: 'Parking', BOTH: 'Housing + Parking' }[listingType]} Details
          </h2>
          <form onSubmit={handleSubmit}>

            {/* Basic Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label>Title <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                <span style={{ 
                  fontSize: '0.875rem', 
                  color: formData.title.length > 50 ? 'var(--badger-red)' : (darkMode ? '#aaa' : '#666')
                }}>
                  {formData.title.length}/50
                </span>
              </div>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder={listingType === 'PARKING' ? "e.g. Covered Garage Spot near Camp Randall" : "e.g. Spacious 1BR near Library Mall"}
                style={{
                  ...inputStyle,
                  borderColor: errors.title ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                }}
              />
              {errors.title && <div className="error-message" style={errorStyle}>{errors.title}</div>}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label>Description <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                <span style={{ 
                  fontSize: '0.875rem', 
                  color: formData.description.length > 750 ? 'var(--badger-red)' : (darkMode ? '#aaa' : '#666')
                }}>
                  {formData.description.length}/750
                </span>
              </div>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                onBlur={handleBlur}
                rows={4}
                placeholder={listingType === 'PARKING'
                  ? "Describe your parking spot — location details, spot number, access instructions, any restrictions, etc."
                  : "Describe your property — highlights, nearby amenities, what's included in rent, etc."}
                style={{
                  ...inputStyle,
                  borderColor: errors.description ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                }}
              />
              {errors.description && <div className="error-message" style={errorStyle}>{errors.description}</div>}
            </div>

            {/* Parking inline fields — PARKING only (clean, no card wrapper) */}
            {listingType === 'PARKING' && (
            <>
              {isMobile ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  {/* Parking Type — full width on mobile */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Parking Type <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                    <div ref={parkingTypeRef} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setParkingTypeOpen(o => !o)}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                          borderColor: errors['parking.type'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7'),
                        }}
                      >
                        <span style={{ color: formData.parking.type ? (darkMode ? '#fff' : '#333') : (darkMode ? '#8a8280' : '#aaa') }}>
                          {{ COVERED_GARAGE: 'Covered Garage', SURFACE_LOT: 'Surface Lot', STREET: 'Street', DRIVEWAY: 'Driveway' }[formData.parking.type] || 'Select type'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginLeft: '0.5rem', transition: 'transform 0.15s', transform: parkingTypeOpen ? 'rotate(180deg)' : 'none' }}>
                          <path d="M2 4L6 8L10 4" stroke={darkMode ? '#8a8280' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {parkingTypeOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                          background: darkMode ? '#272422' : '#fff',
                          border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                          borderRadius: 8, overflow: 'hidden',
                          boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                        }}>
                          {[
                            { value: 'COVERED_GARAGE', label: 'Covered Garage' },
                            { value: 'SURFACE_LOT', label: 'Surface Lot' },
                            { value: 'STREET', label: 'Street' },
                            { value: 'DRIVEWAY', label: 'Driveway' },
                          ].map(({ value, label }) => {
                            const isCurrent = formData.parking.type === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, parking: { ...prev.parking, type: value } }));
                                  setErrors(prev => ({ ...prev, 'parking.type': '' }));
                                  setParkingTypeOpen(false);
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  width: '100%', textAlign: 'left', padding: '9px 14px',
                                  background: 'transparent', border: 'none',
                                  color: isCurrent ? (darkMode ? '#f0ebe5' : '#111') : (darkMode ? '#8a8280' : '#555'),
                                  fontFamily: 'Outfit, sans-serif', fontSize: 14,
                                  cursor: 'pointer', fontWeight: isCurrent ? 600 : 400,
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#33302e' : '#f5f5f5'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {label}
                                {isCurrent && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="var(--badger-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {errors['parking.type'] && <p style={errorStyle}>{errors['parking.type']}</p>}
                  </div>
                  {/* Spots + Price — side by side on mobile */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Spots <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                      <input
                        type="number" min="1"
                        value={formData.parking.spots}
                        onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, spots: e.target.value } }))}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (!val || !Number.isInteger(Number(val)) || Number(val) < 1) {
                            setErrors(prev => ({ ...prev, 'parking.spots': 'Must be a whole number' }));
                          } else {
                            setErrors(prev => ({ ...prev, 'parking.spots': '' }));
                          }
                        }}
                        placeholder="e.g. 1"
                        style={{
                          ...inputStyle,
                          borderColor: errors['parking.spots'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7'),
                        }}
                      />
                      {errors['parking.spots'] && <p style={errorStyle}>{errors['parking.spots']}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Price/month <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                      <div style={{ position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                          color: darkMode ? '#8a8280' : '#888', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem',
                          pointerEvents: 'none',
                        }}>$</span>
                        <input
                          type="number" min="0"
                          value={formData.parking.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, price: e.target.value, priceIncluded: false } }))}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || !Number.isInteger(Number(val)) || Number(val) < 0) {
                              setErrors(prev => ({ ...prev, 'parking.price': 'Must be a whole number' }));
                            } else {
                              setErrors(prev => ({ ...prev, 'parking.price': '' }));
                            }
                          }}
                          placeholder="e.g. 75"
                          style={{ ...inputStyle, paddingLeft: '1.75rem', borderColor: errors['parking.price'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7') }}
                        />
                      </div>
                      {errors['parking.price'] && <p style={errorStyle}>{errors['parking.price']}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Parking Type */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Parking Type <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                    <div ref={parkingTypeRef} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setParkingTypeOpen(o => !o)}
                        style={{
                          ...inputStyle,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left',
                          borderColor: errors['parking.type'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7'),
                        }}
                      >
                        <span style={{ color: formData.parking.type ? (darkMode ? '#fff' : '#333') : (darkMode ? '#8a8280' : '#aaa') }}>
                          {{ COVERED_GARAGE: 'Covered Garage', SURFACE_LOT: 'Surface Lot', STREET: 'Street', DRIVEWAY: 'Driveway' }[formData.parking.type] || 'Select type'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginLeft: '0.5rem', transition: 'transform 0.15s', transform: parkingTypeOpen ? 'rotate(180deg)' : 'none' }}>
                          <path d="M2 4L6 8L10 4" stroke={darkMode ? '#8a8280' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {parkingTypeOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                          background: darkMode ? '#272422' : '#fff',
                          border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                          borderRadius: 8, overflow: 'hidden',
                          boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                        }}>
                          {[
                            { value: 'COVERED_GARAGE', label: 'Covered Garage' },
                            { value: 'SURFACE_LOT', label: 'Surface Lot' },
                            { value: 'STREET', label: 'Street' },
                            { value: 'DRIVEWAY', label: 'Driveway' },
                          ].map(({ value, label }) => {
                            const isCurrent = formData.parking.type === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, parking: { ...prev.parking, type: value } }));
                                  setErrors(prev => ({ ...prev, 'parking.type': '' }));
                                  setParkingTypeOpen(false);
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  width: '100%', textAlign: 'left', padding: '9px 14px',
                                  background: 'transparent', border: 'none',
                                  color: isCurrent ? (darkMode ? '#f0ebe5' : '#111') : (darkMode ? '#8a8280' : '#555'),
                                  fontFamily: 'Outfit, sans-serif', fontSize: 14,
                                  cursor: 'pointer', fontWeight: isCurrent ? 600 : 400,
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#33302e' : '#f5f5f5'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {label}
                                {isCurrent && (
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="var(--badger-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {errors['parking.type'] && <p style={errorStyle}>{errors['parking.type']}</p>}
                  </div>
                  {/* Spots */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Spots <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                    <input
                      type="number" min="1"
                      value={formData.parking.spots}
                      onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, spots: e.target.value } }))}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (!val || !Number.isInteger(Number(val)) || Number(val) < 1) {
                          setErrors(prev => ({ ...prev, 'parking.spots': 'Must be a whole number' }));
                        } else {
                          setErrors(prev => ({ ...prev, 'parking.spots': '' }));
                        }
                      }}
                      placeholder="e.g. 1"
                      style={{
                        ...inputStyle,
                        borderColor: errors['parking.spots'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7'),
                      }}
                    />
                    {errors['parking.spots'] && <p style={errorStyle}>{errors['parking.spots']}</p>}
                  </div>
                  {/* Price */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Price/month <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                        color: darkMode ? '#8a8280' : '#888', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem',
                        pointerEvents: 'none',
                      }}>$</span>
                      <input
                        type="number" min="0"
                        value={formData.parking.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, price: e.target.value, priceIncluded: false } }))}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val === '' || !Number.isInteger(Number(val)) || Number(val) < 0) {
                            setErrors(prev => ({ ...prev, 'parking.price': 'Must be a whole number' }));
                          } else {
                            setErrors(prev => ({ ...prev, 'parking.price': '' }));
                          }
                        }}
                        placeholder="e.g. 75"
                        style={{ ...inputStyle, paddingLeft: '1.75rem', borderColor: errors['parking.price'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7') }}
                      />
                    </div>
                    {errors['parking.price'] && <p style={errorStyle}>{errors['parking.price']}</p>}
                  </div>
                </div>
              )}
            </>
            )}

            {/* Price — housing only */}
            {(listingType === 'HOUSING' || listingType === 'BOTH') && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Rent per month <span style={{ color: 'var(--badger-red)' }}>*</span></label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                onBlur={handleBlur}
                step="1"
                min="1"
                placeholder="e.g. 850"
                style={{
                  ...inputStyle,
                  maxWidth: '200px',
                  borderColor: errors.price ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                }}
              />
              {errors.price && <div className="error-message" style={errorStyle}>{errors.price}</div>}
            </div>
            )}

            {/* Availability Dates */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500' }}>
                When is this available? <span style={{ color: 'var(--badger-red)' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: '1rem' }}>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: darkMode ? '#aaa' : '#666' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    min={localTodayIsoDate}
                    style={{
                      ...inputStyle,
                      width: '100%',
                      minWidth: 0,
                      WebkitAppearance: 'none',
                      borderColor: errors.startDate ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                    }}
                  />
                  {errors.startDate && <div className="error-message" style={errorStyle}>{errors.startDate}</div>}
                </div>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: darkMode ? '#aaa' : '#666' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    style={{
                      ...inputStyle,
                      width: '100%',
                      minWidth: 0,
                      WebkitAppearance: 'none',
                      borderColor: errors.endDate ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                    }}
                  />
                  {errors.endDate && <div className="error-message" style={errorStyle}>{errors.endDate}</div>}
                </div>
              </div>
            </div>

            {/* Property Details — housing only */}
            {(listingType === 'HOUSING' || listingType === 'BOTH') && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bedrooms <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                  <input
                    type="number"
                    name="bedrooms"
                    value={formData.bedrooms}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    step="1"
                    min="1"
                    placeholder="e.g. 2"
                    style={{
                      ...inputStyle,
                      borderColor: errors.bedrooms ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                    }}
                  />
                  {errors.bedrooms && <div className="error-message" style={errorStyle}>{errors.bedrooms}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Bathrooms <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                  <input
                    type="number"
                    name="bathrooms"
                    value={formData.bathrooms}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    step="1"
                    min="1"
                    placeholder="e.g. 1"
                    style={{
                      ...inputStyle,
                      borderColor: errors.bathrooms ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                    }}
                  />
                  {errors.bathrooms && <div className="error-message" style={errorStyle}>{errors.bathrooms}</div>}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Square Feet <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                  <input
                    type="number"
                    name="squareFeet"
                    value={formData.squareFeet}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    step="1"
                    min="1"
                    placeholder="e.g. 700"
                    style={{
                      ...inputStyle,
                      borderColor: errors.squareFeet ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                    }}
                  />
                  {errors.squareFeet && <div className="error-message" style={errorStyle}>{errors.squareFeet}</div>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Roommates (during sublease) <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                  <input
                    type="number"
                    name="roommates"
                    value={formData.roommates}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    min="0"
                    step="1"
                    placeholder="e.g. 1"
                    style={{
                      ...inputStyle,
                      borderColor: errors.roommates ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                    }}
                  />
                  {errors.roommates && <div className="error-message" style={errorStyle}>{errors.roommates}</div>}
                </div>
              </div>
            </div>
            )}

            {/* Address Fields */}
            <div id="address-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {geocodeError && (
                <div className="error-message" style={errorStyle}>{geocodeError}</div>
              )}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Street <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g. 123 N Park St"
                  style={{
                    ...inputStyle,
                    borderColor: errors.street || geocodeError ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                  }}
                />
                {errors.street && <div className="error-message" style={errorStyle}>{errors.street}</div>}
              </div>
              {listingType !== 'PARKING' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Unit Number</label>
                <input
                  type="number"
                  name="aptNumber"
                  value={formData.aptNumber}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g. 602"
                  min="0"
                  style={{
                    ...inputStyle,
                    borderColor: errors.aptNumber ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                  }}
                />
                {errors.aptNumber && <div className="error-message" style={errorStyle}>{errors.aptNumber}</div>}
              </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>City <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Madison"
                  style={{
                    ...inputStyle,
                    borderColor: errors.city || geocodeError ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                  }}
                />
                {errors.city && <div className="error-message" style={errorStyle}>{errors.city}</div>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>State <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g. WI"
                  style={{
                    ...inputStyle,
                    borderColor: errors.state || geocodeError ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                  }}
                />
                {errors.state && <div className="error-message" style={errorStyle}>{errors.state}</div>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Zip Code <span style={{ color: 'var(--badger-red)' }}>*</span></label>
                <input
                  type="text"
                  name="zipcode"
                  value={formData.zipcode}
                  onChange={handleInputChange}
                  onBlur={handleBlur}
                  placeholder="e.g. 53703"
                  style={{
                    ...inputStyle,
                    borderColor: errors.zipcode || geocodeError ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')
                  }}
                />
                {errors.zipcode && <div className="error-message" style={errorStyle}>{errors.zipcode}</div>}
              </div>
            </div>

            {/* Amenities — housing only */}
            {(listingType === 'HOUSING' || listingType === 'BOTH') && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Amenities</label>
              <AmenitiesSelector
                options={commonAmenities}
                selected={formData.amenities}
                onChange={(newAmenities) => {
                  setFormData(prev => ({ ...prev, amenities: newAmenities }));
                  setHasUnsavedChanges(true);
                }}
                darkMode={darkMode}
              />
            </div>
            )}

            {/* Parking section — BOTH only (PARKING uses inline fields above) */}
            {listingType === 'BOTH' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.875rem 1rem',
                borderRadius: '14px 14px 0 0',
                border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                borderBottom: 'none',
                backgroundColor: 'transparent',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--badger-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
                </svg>
                <span style={{ fontSize: '0.95rem', fontWeight: 500, color: darkMode ? '#f0ebe5' : '#333', fontFamily: 'Outfit, sans-serif' }}>
                  Parking Details
                </span>
              </div>
                <div style={{
                  border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                  borderTop: 'none',
                  borderRadius: '0 0 14px 14px',
                  backgroundColor: 'transparent',
                  padding: '1.25rem',
                  display: 'flex', flexDirection: 'column', gap: '1rem',
                }}>
                  {/* Type + Spots row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Type *</label>
                      <div ref={parkingTypeRef} style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setParkingTypeOpen(o => !o)}
                          style={{
                            ...inputStyle,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', textAlign: 'left',
                            borderColor: errors['parking.type'] ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7'),
                          }}
                        >
                          <span style={{ color: formData.parking.type ? (darkMode ? '#fff' : '#333') : (darkMode ? '#8a8280' : '#aaa') }}>
                            {{ COVERED_GARAGE: 'Covered Garage', SURFACE_LOT: 'Surface Lot', STREET: 'Street', DRIVEWAY: 'Driveway' }[formData.parking.type] || 'Select type'}
                          </span>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginLeft: '0.5rem', transition: 'transform 0.15s', transform: parkingTypeOpen ? 'rotate(180deg)' : 'none' }}>
                            <path d="M2 4L6 8L10 4" stroke={darkMode ? '#8a8280' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {parkingTypeOpen && (
                          <div style={{
                            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
                            background: darkMode ? '#272422' : '#fff',
                            border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
                            borderRadius: 8, overflow: 'hidden',
                            boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                          }}>
                            {[
                              { value: 'COVERED_GARAGE', label: 'Covered Garage' },
                              { value: 'SURFACE_LOT', label: 'Surface Lot' },
                              { value: 'STREET', label: 'Street' },
                              { value: 'DRIVEWAY', label: 'Driveway' },
                            ].map(({ value, label }) => {
                              const isCurrent = formData.parking.type === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, parking: { ...prev.parking, type: value } }));
                                    setErrors(prev => ({ ...prev, 'parking.type': '' }));
                                    setParkingTypeOpen(false);
                                  }}
                                  style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    width: '100%', textAlign: 'left', padding: '9px 14px',
                                    background: 'transparent', border: 'none',
                                    color: isCurrent ? (darkMode ? '#f0ebe5' : '#111') : (darkMode ? '#8a8280' : '#555'),
                                    fontFamily: 'Outfit, sans-serif', fontSize: 14,
                                    cursor: 'pointer', fontWeight: isCurrent ? 600 : 400,
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = darkMode ? '#33302e' : '#f5f5f5'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  {label}
                                  {isCurrent && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6L5 9L10 3" stroke="var(--badger-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {errors['parking.type'] && <p style={errorStyle}>{errors['parking.type']}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Spots *</label>
                      <input
                        type="number" min="1"
                        value={formData.parking.spots}
                        onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, spots: e.target.value } }))}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (!val || !Number.isInteger(Number(val)) || Number(val) < 1) {
                            setErrors(prev => ({ ...prev, 'parking.spots': 'Spots must be a whole number ≥ 1' }));
                          } else {
                            setErrors(prev => ({ ...prev, 'parking.spots': '' }));
                          }
                        }}
                        placeholder="e.g. 1"
                        style={inputStyle}
                      />
                      {errors['parking.spots'] && <p style={errorStyle}>{errors['parking.spots']}</p>}
                    </div>
                  </div>

                  {/* Monthly fee row */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Monthly fee *</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {[
                        { value: true, title: 'Included in rent', desc: 'No extra charge' },
                        { value: false, title: 'Custom price', desc: 'Additional monthly fee' },
                      ].map(({ value, title, desc }) => {
                        const active = formData.parking.priceIncluded === value;
                        return (
                          <div key={title}
                            onClick={() => setFormData(prev => ({ ...prev, parking: { ...prev.parking, priceIncluded: value, price: '' } }))}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.75rem 0.875rem', borderRadius: 8, cursor: 'pointer',
                              border: `1px solid ${active ? 'var(--badger-red)' : (darkMode ? '#3a3633' : '#e4e4e7')}`,
                              backgroundColor: active ? 'rgba(197,5,12,0.07)' : 'transparent',
                              transition: 'border-color 0.15s, background-color 0.15s',
                              userSelect: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{
                                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                                color: active ? (darkMode ? '#f0ebe5' : '#111') : (darkMode ? '#8a8280' : '#999'),
                              }}>{title}</span>
                              <span style={{
                                fontSize: '0.75rem', fontFamily: 'Outfit, sans-serif',
                                color: active ? (darkMode ? '#8a8280' : '#666') : (darkMode ? '#3a3633' : '#bbb'),
                              }}>{desc}</span>
                            </div>
                            {/* Radio dot */}
                            <div style={{
                              width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginLeft: '0.5rem',
                              border: `2px solid ${active ? 'var(--badger-red)' : (darkMode ? 'white' : '#ccc')}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'border-color 0.15s',
                            }}>
                              {active && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--badger-red)' }} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!formData.parking.priceIncluded && (
                      <div style={{ marginTop: '0.75rem', position: 'relative' }}>
                        <span style={{
                          position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                          color: darkMode ? '#8a8280' : '#888', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem',
                          pointerEvents: 'none',
                        }}>$</span>
                        <input
                          type="number" min="0"
                          value={formData.parking.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, price: e.target.value } }))}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || !Number.isInteger(Number(val)) || Number(val) < 0) {
                              setErrors(prev => ({ ...prev, 'parking.price': 'Price must be a whole number ≥ 0' }));
                            } else {
                              setErrors(prev => ({ ...prev, 'parking.price': '' }));
                            }
                          }}
                          placeholder="e.g. 50"
                          style={{ ...inputStyle, paddingLeft: '1.75rem' }}
                        />
                      </div>
                    )}
                    {errors['parking.price'] && <p style={errorStyle}>{errors['parking.price']}</p>}
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Notes <span style={{ color: darkMode ? '#524e4c' : '#aaa', fontWeight: 400 }}>(optional)</span></label>
                    <textarea
                      value={formData.parking.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, parking: { ...prev.parking, notes: e.target.value } }))}
                      placeholder="e.g. Spot #12, east side of building"
                      maxLength={250}
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      {errors['parking.notes'] ? <p style={{ ...errorStyle, margin: 0 }}>{errors['parking.notes']}</p> : <span />}
                      <span style={{ fontSize: '0.75rem', color: (formData.parking.notes?.length || 0) >= 200 ? 'var(--badger-red)' : (darkMode ? '#524e4c' : '#bbb'), fontFamily: 'Outfit, sans-serif' }}>
                        {formData.parking.notes?.length || 0}/250
                      </span>
                    </div>
                  </div>

                  {/* Photo */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Photo <span style={{ color: darkMode ? '#524e4c' : '#aaa', fontWeight: 400 }}>(optional)</span></label>
                    {formData.parking.image ? (
                      <div style={{
                        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                        alignItems: isMobile ? 'stretch' : 'center', gap: '0.75rem',
                        padding: '0.5rem', borderRadius: 6,
                        border: `1px solid ${darkMode ? '#2a2826' : '#e0e0e0'}`,
                        backgroundColor: darkMode ? '#211f1e' : '#f5f5f5',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', color: darkMode ? '#8a8280' : '#666', fontFamily: 'Outfit, sans-serif' }}>{formData.parking.image.file.name}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, parking: { ...prev.parking, image: null } }))}
                            style={{ background: 'none', border: 'none', color: darkMode ? '#524e4c' : '#aaa', cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: '0.8rem', fontFamily: 'Outfit, sans-serif' }}
                            onMouseOver={e => e.currentTarget.style.color = '#c5050c'}
                            onMouseOut={e => e.currentTarget.style.color = darkMode ? '#524e4c' : '#aaa'}
                          >
                            Remove
                          </button>
                        </div>
                        <img src={formData.parking.image.preview} alt="Parking preview" style={{ width: isMobile ? '100%' : 160, height: 100, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                      </div>
                    ) : (
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.6rem 0.875rem', borderRadius: 6, cursor: 'pointer',
                        border: `1px dashed ${darkMode ? '#3a3633' : '#ccc'}`,
                        backgroundColor: 'transparent', color: darkMode ? '#8a8280' : '#888',
                        fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif',
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--badger-red)'; e.currentTarget.style.color = 'var(--badger-red)'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = darkMode ? '#3a3633' : '#ccc'; e.currentTarget.style.color = darkMode ? '#8a8280' : '#888'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                        </svg>
                        Add parking photo
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) { alert('Parking image must be under 5MB'); return; }
                            setFormData(prev => ({ ...prev, parking: { ...prev.parking, image: { file, preview: URL.createObjectURL(file) } } }));
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
            </div>
            )}

            {/* Image Upload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>{listingType === 'PARKING' ? 'Parking Photos' : 'Listing Photos'} <span style={{ color: 'var(--badger-red)' }}>*</span></label>
              <div
                style={{
                  border: `2px dashed ${errors.images ? 'var(--badger-red)' : (darkMode ? '#555' : '#ddd')}`,
                  borderRadius: '8px',
                  padding: '2rem',
                  textAlign: 'center',
                  backgroundColor: darkMode ? '#333' : '#f9f9f9',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = 'var(--badger-red)';
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = darkMode ? '#555' : '#ddd';
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = darkMode ? '#555' : '#ddd';
                  const allFiles = Array.from(e.dataTransfer.files);
                  const { validFiles, errors } = await processImageFiles(allFiles, MAX_FILE_SIZE);
                  if (errors.length > 0) {
                    setImageError(errors.join(' | '));
                    setTimeout(() => setImageError(''), 5000);
                  }
                  if (validFiles.length === 0) return;
                  const fileObjects = validFiles.map(file => ({
                    file,
                    preview: URL.createObjectURL(file)
                  }));
                  setFormData(prev => {
                    const currentCount = prev.images.length;
                    const availableSlots = MAX_IMAGES - currentCount;
                    const imagesToAdd = fileObjects.slice(0, availableSlots);
                    return {
                      ...prev,
                      images: [...prev.images, ...imagesToAdd]
                    };
                  });
                  setHasUnsavedChanges(true);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  key={fileInputKey}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ marginBottom: '1rem' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#fff' : '#666'} strokeWidth="2">
                    <path d="M21 19H3V5h18v14zm-9-3l-4-4-3 3v3h14l-4-4-3 2z"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                  </svg>
                </div>
                <p style={{ margin: '0', color: darkMode ? '#fff' : '#666' }}>
                  {formData.images.length >= MAX_IMAGES 
                    ? 'Maximum images reached' 
                    : 'Drag and drop images here or click to browse'}
                </p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: darkMode ? '#aaa' : '#888' }}>
                  {formData.images.length}/{MAX_IMAGES} images • JPG, PNG, WEBP, HEIC (max 10MB each)
                </p>
              </div>
              {errors.images && <div className="error-message" style={errorStyle}>{errors.images}</div>}
              {imageError && <div style={{ ...errorStyle, marginTop: '0.5rem' }}>{imageError}</div>}

              {/* Uploaded Images Preview - Drag to reorder */}
              <SortableImageGrid
                images={formData.images}
                onReorder={handleImageReorder}
                onRemove={handleImageRemove}
              />
            </div>

            {/* Submit Error */}
            {submitError && (
              <div style={{
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                backgroundColor: 'rgba(197, 5, 12, 0.1)',
                border: '1px solid var(--badger-red)',
                borderRadius: '4px',
                color: 'var(--badger-red)',
                fontSize: '0.9rem'
              }}>
                {submitError}
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" disabled={isSubmitting} style={{ backgroundColor: 'var(--badger-red)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.75rem 1.5rem', width: '100%', fontSize: '1rem', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}>
              {isSubmitting ? 'Creating...' : 'Create Listing'}
            </button>
          </form>
        </div>

        {/* Preview Section */}
        <div style={{ backgroundColor: 'var(--card-background)', padding: '1.5rem', borderRadius: '8px', boxShadow: darkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px var(--shadow-color)' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Preview</h2>
          <div style={{ position: 'relative', height: '400px', backgroundColor: darkMode ? '#333' : '#f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
            {formData.images.length > 0 ? (
              <>
                <img
                  src={formData.images[activeImage].preview}
                  alt={`Preview ${activeImage + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transform: 'scale(1.16)'
                  }}
                />
                {formData.images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveImage((prev) => (prev - 1 + formData.images.length) % formData.images.length);
                      }}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: 'transparent',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '2rem',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                        padding: '10px',
                        outline: 'none'
                      }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveImage((prev) => (prev + 1) % formData.images.length);
                      }}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: 'transparent',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '2rem',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                        padding: '10px',
                        outline: 'none'
                      }}
                    >
                      ›
                    </button>
                  </>
                )}
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}>
                  {activeImage + 1} / {formData.images.length}
                </div>
              </>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: darkMode ? '#fff' : '#333'
              }}>
                No images uploaded
              </div>
            )}
          </div>

          {/* Listing Details Preview */}
          <div style={{ padding: '1rem 0' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', color: darkMode ? '#fff' : '#333' }}>
              {previewListing.title || 'Listing Title'}
            </h3>
            <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}><strong>{(listingType === 'HOUSING' || listingType === 'BOTH') ? `$${formData.price || '0'}/month` : `$${formData.parking.price || '0'}/month`}</strong></p>
            <p style={{ color: darkMode ? '#ccc' : '#666' }}>
              {formData.startDate && formData.endDate
                ? `${toLocalDate(formData.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${toLocalDate(formData.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Select dates'}
            </p>
            <p style={{ marginTop: '0.5rem' }}>{formattedAddress || 'Address'}</p>

            <hr style={{ margin: '2rem 0', border: 'none', borderTop: `1px solid ${darkMode ? '#444' : 'var(--border-color)'}` }} />

            {/* Property Details Preview — housing only */}
            {(listingType === 'HOUSING' || listingType === 'BOTH') && (
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Property Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Bedrooms', value: formData.bedrooms || '–', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/><path d="M2 11v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6"/><path d="M7 11v-1a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1"/></svg>
                  )},
                  { label: 'Bathrooms', value: formData.bathrooms || '–', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" y1="5" x2="8" y2="7"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                  )},
                  { label: 'Sq Ft', value: formData.squareFeet || '–', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  )},
                  { label: 'Roommates', value: formData.roommates !== '' ? formData.roommates : '–', icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  )},
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{
                    backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                    border: `1px solid ${darkMode ? '#444' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ color: darkMode ? '#888' : '#999' }}>{icon}</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '700', color: darkMode ? '#fff' : '#111', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '0.75rem', color: darkMode ? '#888' : '#888', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Description Preview */}
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Description</h4>
              <p style={{ lineHeight: '1.6' }}>{previewListing.description || 'No description provided.'}</p>
            </div>

            {/* Amenities Preview */}
            {formData.amenities.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Amenities</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.amenities.map((amenity, index) => (
                    <div key={index} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '20px',
                      backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                      border: `1px solid ${darkMode ? '#444' : '#e0e0e0'}`,
                      fontSize: '0.85rem',
                      color: darkMode ? '#ccc' : '#555',
                      fontWeight: '400'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--badger-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parking Preview — PARKING: simple details row; BOTH: full card with notes/photo */}
            {listingType === 'PARKING' && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Parking Details</h4>
                <div style={{
                  backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                  border: `1px solid ${darkMode ? '#444' : '#e0e0e0'}`,
                  borderRadius: '10px', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex' }}>
                    {[
                      { label: 'Type', value: { COVERED_GARAGE: 'Covered Garage', SURFACE_LOT: 'Surface Lot', STREET: 'Street', DRIVEWAY: 'Driveway' }[formData.parking.type] || '–' },
                      { label: 'Spots', value: formData.parking.spots || '–' },
                      { label: 'Price/mo', value: formData.parking.price !== '' ? `$${formData.parking.price}` : '–' },
                    ].map(({ label, value }, i, arr) => (
                      <div key={label} style={{
                        flex: 1, padding: '0.875rem 1.25rem',
                        borderRight: i < arr.length - 1 ? `1px solid ${darkMode ? '#444' : '#e0e0e0'}` : 'none',
                      }}>
                        <div style={{ fontSize: '0.7rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: darkMode ? '#524e4c' : '#999', marginBottom: '0.35rem' }}>{label}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#111', fontFamily: 'Outfit, sans-serif' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {listingType === 'BOTH' && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Parking Spot</h4>
                <div style={{
                  backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
                  border: `1px solid ${darkMode ? '#444' : '#e0e0e0'}`,
                  borderRadius: '10px', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', borderBottom: formData.parking.notes || formData.parking.image ? `1px solid ${darkMode ? '#444' : '#e0e0e0'}` : 'none' }}>
                    {[
                      { label: 'Type', value: { COVERED_GARAGE: 'Covered Garage', SURFACE_LOT: 'Surface Lot', STREET: 'Street', DRIVEWAY: 'Driveway' }[formData.parking.type] || formData.parking.type || '–' },
                      { label: 'Spots', value: formData.parking.spots || '–' },
                      { label: 'Price/mo', value: (formData.parking.priceIncluded || Number(formData.parking.price) === 0) ? 'Included' : (formData.parking.price !== '' ? `$${formData.parking.price}` : '–') },
                    ].map(({ label, value }, i, arr) => (
                      <div key={label} style={{
                        flex: 1, padding: '0.875rem 1.25rem',
                        borderRight: i < arr.length - 1 ? `1px solid ${darkMode ? '#444' : '#e0e0e0'}` : 'none',
                      }}>
                        <div style={{ fontSize: '0.7rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: darkMode ? '#524e4c' : '#999', marginBottom: '0.35rem' }}>{label}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: darkMode ? '#f0ebe5' : '#111', fontFamily: 'Outfit, sans-serif' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {formData.parking.notes && (
                    <div style={{ padding: '0.875rem 1.25rem', borderBottom: formData.parking.image ? `1px solid ${darkMode ? '#444' : '#e0e0e0'}` : 'none' }}>
                      <div style={{ fontSize: '0.7rem', fontFamily: 'Outfit, sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: darkMode ? '#524e4c' : '#999', marginBottom: '0.35rem' }}>Notes</div>
                      <p style={{ fontSize: '0.9rem', color: darkMode ? '#8a8280' : '#555', margin: 0, lineHeight: 1.5, fontFamily: 'Outfit, sans-serif' }}>{formData.parking.notes}</p>
                    </div>
                  )}
                  {formData.parking.image && (
                    <div style={{ padding: '1rem 1.25rem 1.25rem', display: 'flex', justifyContent: 'center' }}>
                      <img src={formData.parking.image.preview} alt="Parking photo" style={{ width: isMobile ? '100%' : '50%', display: 'block', borderRadius: '6px' }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Map Preview */}
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Location</h4>
              <div style={{ height: '300px', position: 'relative', borderRadius: '8px', overflow: 'hidden', border: darkMode ? '1px solid #444' : 'none' }}>
                <Map listings={[]} singleListing={previewListing} showRecenter={false} />
              </div>
            </div>

            {/* About the Lister Preview */}
            <div>
              <h4 style={{ marginBottom: '1rem' }}>About the Lister</h4>
              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'center' : 'flex-start',
                textAlign: isMobile ? 'center' : 'left',
                backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'var(--background-color)',
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
                  {(currentUser && currentUser.photoURL) ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={`${previewListing.poster.name}'s profile`} 
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
                    (previewListing.poster.name.includes(' ') ? previewListing.poster.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : previewListing.poster.name.substring(0, 2).toUpperCase())
                  )}
                </div>
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>
                    {previewListing.poster.name}
                  </h3>
                  <p style={{ marginBottom: '0.25rem' }}>{previewListing.poster.email}</p>
                  <p style={{ marginBottom: '0.25rem' }}>
                    {previewListing.poster.joinDate}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <SuccessModal
      isOpen={showSuccessModal}
      onClose={() => {
        setShowSuccessModal(false);
        navigate(`/listings/${createdListing?.id}`);
      }}
      listing={createdListing}
    />
    </>
  );
}
