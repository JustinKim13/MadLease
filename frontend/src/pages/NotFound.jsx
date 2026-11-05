import { Link } from 'react-router-dom';
import Seo from '../components/Seo';

export default function NotFound() {
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: isMobile ? 'calc(100lvh - 60px)' : 'calc(100dvh - 60px)',
      height: 'auto',
      textAlign: 'center',
      padding: '0 1rem'
    }}>
      <Seo title="Page Not Found" description="The page you're looking for doesn't exist on MadLease." noindex />
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
      <h2 style={{ marginBottom: '2rem' }}>Page Not Found</h2>
      <p style={{ maxWidth: '500px', marginBottom: '2rem' }}>
        The page you are looking for might have been removed, had its name changed,
        or is temporarily unavailable.
      </p>
      <Link 
        to="/" 
        style={{ 
          backgroundColor: 'var(--badger-red)', 
          color: 'white', 
          padding: '0.75rem 1.5rem', 
          borderRadius: '4px', 
          textDecoration: 'none' 
        }}
      >
        Go to Homepage
      </Link>
    </div>
  );
}
