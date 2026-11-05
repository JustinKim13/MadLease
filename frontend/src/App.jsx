import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { QueryClient} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { listingKeys, fetchListings, getBrowseSeed } from './services/listingQueries';
import ErrorBoundary from './components/ErrorBoundary';
import FeedbackPopup from './components/FeedbackPopup';

// Lazy-loaded route components for code splitting
const Listings = lazy(() => import('./pages/Listings'));
const ListingDetails = lazy(() => import('./pages/ListingDetails'));
const CreateListing = lazy(() => import('./pages/CreateListing'));
const EditListings = lazy(() => import('./pages/EditListings'));
const Profile = lazy(() => import('./pages/Profile'));
const NotFound = lazy(() => import('./pages/NotFound'));
const LegalPrivacy = lazy(() => import('./pages/LegalPrivacy'));
const LegalTerms = lazy(() => import('./pages/LegalTerms'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const ConversationList = lazy(() => import('./components/ConversationList'));
const ConversationView = lazy(() => import('./components/ConversationView'));
const BlockedUsers = lazy(() => import('./pages/BlockedUsers'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      // /listings handles its own scroll restoration via sessionStorage
      if (pathname !== '/listings') window.scrollTo(0, 0);
    } else {
      document.querySelector('main')?.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

// Lazy-load devtools only in development
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then(mod => ({ default: mod.ReactQueryDevtools }))
);

// create a client -- manages our data
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 90 * 60 * 1000,   // 90 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});
// make it persistent(refresh wont clear it)
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
});

// prefetch using the standalone query function
// Include the per-session seed so the cache key matches what useListingsQuery uses —
// otherwise the prefetch lands under a different key and gets refetched immediately.
const prefetchFilters = { seed: getBrowseSeed() };
queryClient.prefetchQuery({ // built in Tanstack Query function
  queryKey: listingKeys.list(prefetchFilters),
  queryFn: () => fetchListings(prefetchFilters)
});

function App() {
  return (
    <ErrorBoundary>
    <HelmetProvider>
    <AuthProvider>
      <PersistQueryClientProvider client={queryClient}
       persistOptions={{persister: localStoragePersister}}
       maxAge={1000 * 60 * 60 * 24}>
        <ThemeProvider>
          <Router>
            <ScrollToTop />
            <div className="app-shell">
              <Navbar />
              <main className="app-main">
                <Suspense fallback={null}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/listings" element={<Listings />} />
                    <Route path="/listings/new" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                    <Route path="/listings/:id" element={<ListingDetails />} />
                    <Route path="/listings/:id/edit" element={<ProtectedRoute><EditListings /></ProtectedRoute>} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/profile/blocked" element={<ProtectedRoute><BlockedUsers /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><ConversationList /></ProtectedRoute>} />
                    <Route path="/messages/:conversationId" element={<ProtectedRoute><ConversationView /></ProtectedRoute>} />
                    <Route path="/privacy" element={<LegalPrivacy />} />
                    <Route path="/terms" element={<LegalTerms />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
              <FeedbackPopup />
              {import.meta.env.PROD && <Analytics />}
              {import.meta.env.PROD && <SpeedInsights />}
            </div>
          </Router>
        </ThemeProvider>
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        )}
      </PersistQueryClientProvider>
    </AuthProvider>
    </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;
