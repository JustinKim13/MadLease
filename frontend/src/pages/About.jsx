import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import Seo from '../components/Seo';

export default function About() {
  const { darkMode } = useContext(ThemeContext);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const heading = {
    fontSize: isMobile ? '2rem' : '2.75rem',
    fontWeight: '800',
    color: darkMode ? '#f0ebe5' : '#1d1d1f',
    marginBottom: '1rem',
    letterSpacing: '-0.02em',
  };

  const subheading = {
    fontSize: isMobile ? '1.25rem' : '1.5rem',
    fontWeight: '700',
    color: darkMode ? '#f0ebe5' : '#1d1d1f',
    marginTop: '2.5rem',
    marginBottom: '0.75rem',
    letterSpacing: '-0.01em',
  };

  const body = {
    fontSize: '1rem',
    lineHeight: '1.7',
    color: darkMode ? '#8a8280' : '#6e6e73',
    marginBottom: '1rem',
  };

  const card = {
    padding: isMobile ? '1.25rem' : '1.5rem',
    borderRadius: '12px',
    backgroundColor: darkMode ? '#1a1918' : 'white',
    border: darkMode ? '1px solid #2a2826' : '1px solid #eee',
    boxShadow: darkMode
      ? '0 2px 6px rgba(0,0,0,0.25)'
      : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
  };

  return (
    <div style={{
      padding: isMobile ? '2rem 1.5rem' : '2.5rem 2rem',
      paddingBottom: isMobile ? '4rem' : '3rem',
      maxWidth: '780px',
      margin: '0 auto',
    }}>
      <Seo
        title="About MadLease"
        description="MadLease was built by two UW-Madison computer science students to make finding and listing subleases and parking near campus simple, free, and secure."
        path="/about"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          '@id': 'https://www.madlease.net/about',
          name: 'About MadLease',
          description: 'MadLease was built by two UW-Madison computer science students to make finding and listing subleases and parking near campus simple, free, and secure.',
          url: 'https://www.madlease.net/about',
          mainEntity: {
            '@type': 'Organization',
            '@id': 'https://www.madlease.net/#organization',
            name: 'MadLease',
            url: 'https://www.madlease.net/',
            founder: [
              {
                '@type': 'Person',
                name: 'Justin Kim',
                jobTitle: 'Co-Founder',
                alumniOf: {
                  '@type': 'CollegeOrUniversity',
                  name: 'University of Wisconsin-Madison',
                },
              },
              {
                '@type': 'Person',
                name: 'Ben Wiggenhorn',
                jobTitle: 'Co-Founder',
                alumniOf: {
                  '@type': 'CollegeOrUniversity',
                  name: 'University of Wisconsin-Madison',
                },
              },
            ],
          },
        }}
      />

      <h1 style={heading}>About MadLease</h1>
      <p style={body}>
        MadLease is the sublease and parking marketplace built for University of Wisconsin–Madison students.
        We created it because finding a sublease in Madison shouldn't mean scrolling through Snapchat stories,
        digging through Facebook groups, or hoping the right listing pops up in a random WhatsApp group chat.
      </p>

      <h2 style={subheading}>Why we built it</h2>
      <p style={body}>
        As UW-Madison students ourselves, we went through the frustrating process of trying to find
        and list subleases every summer. There was no dedicated place for it — just scattered posts
        across a dozen different platforms with no search filters, no photos, and no way to verify
        who you were actually talking to. We figured Madison students deserved something better, so
        we built MadLease.
      </p>
      <p style={body}>
        Every feature exists because we needed it ourselves: search filters for price, dates, and
        bedrooms; an interactive map so you can see exactly where a place is relative to campus;
        encrypted in-app messaging so you don't have to hand out your phone number; and automatic
        verification for anyone with a @wisc.edu email.
      </p>

      <h2 style={subheading}>Who we are</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '1rem',
        marginTop: '0.5rem',
      }}>
        <div style={card}>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: '700',
            color: darkMode ? '#f0ebe5' : '#1d1d1f',
            marginBottom: '0.3rem',
          }}>
            Justin Kim
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: darkMode ? '#8a8280' : '#6e6e73',
            lineHeight: '1.55',
          }}>
            Co-Founder. Senior at UW-Madison studying Computer Science and Data Science.
          </div>
        </div>
        <div style={card}>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: '700',
            color: darkMode ? '#f0ebe5' : '#1d1d1f',
            marginBottom: '0.3rem',
          }}>
            Ben Wiggenhorn
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: darkMode ? '#8a8280' : '#6e6e73',
            lineHeight: '1.55',
          }}>
            Co-Founder. UW-Madison Computer Science graduate, incoming software engineer at Google.
          </div>
        </div>
      </div>

      <h2 style={subheading}>Our commitment</h2>
      <p style={body}>
        MadLease is completely free — no listing fees, no premium tiers, no ads. We built it to solve a
        real problem for students, not to monetize the experience. If you have feedback, ideas, or just
        want to say hi, reach out on our <Link to="/contact" style={{ color: 'var(--badger-red)', textDecoration: 'none', fontWeight: '600' }}>contact page</Link>.
      </p>
    </div>
  );
}
