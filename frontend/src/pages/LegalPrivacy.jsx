import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Seo from '../components/Seo';

export default function LegalPrivacy() {
  const { darkMode } = useContext(ThemeContext);

  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
    color: darkMode ? '#e0e0e0' : '#333',
    lineHeight: '1.6'
  };

  const headingStyle = {
    color: darkMode ? '#fff' : '#000',
    borderBottom: `2px solid ${darkMode ? '#333' : '#eee'}`,
    paddingBottom: '0.5rem',
    marginBottom: '1.5rem'
  };

  const sectionStyle = {
    marginBottom: '2rem'
  };

  return (
    <div className="legal-scroll" style={containerStyle}>
      <Seo
        title="Privacy Policy"
        description="How MadLease collects, uses, and protects your personal information when using our UW-Madison sublease and parking marketplace."
        path="/privacy"
      />
      <h1 style={headingStyle}>Privacy Policy</h1>
      <p style={{ fontSize: '0.9rem', color: darkMode ? '#999' : '#666', marginBottom: '2rem' }}>
        Last updated: January 1, 2026
      </p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Information We Collect</h2>
        <p><strong>When you use MadLease, we collect:</strong></p>
        <ul>
          <li><strong>Account Information:</strong> Name, email address, and profile picture when you create an account or sign in with Google</li>
          <li><strong>Listing Information:</strong> Property details, photos, location, and rental information you provide</li>
          <li><strong>Messages:</strong> We provide encrypted messaging between users - all messages are encrypted end-to-end, meaning we cannot read or access the content of your conversations</li>
          <li><strong>Usage Data:</strong> How you interact with our service, including saved listings and preferences</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>How We Use Your Information</h2>
        <p><strong>We use your information to:</strong></p>
        <ul>
          <li>Provide and maintain our subletting platform</li>
          <li>Enable communication between renters and subletters</li>
          <li>Improve our services and user experience</li>
          <li>Send important updates about your account or listings</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Data Storage and Security</h2>
        <p>
          Your data is stored securely using industry-standard practices. We use Firebase for authentication,
          AWS S3 for photo storage, and encrypted databases for other information. <strong>All messages between users 
          are encrypted with keys that only you and the recipient possess - MadLease cannot decrypt or read 
          your private conversations.</strong> We do not sell your personal information to third parties.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Third-Party Services</h2>
        <p><strong>We use the following third-party services:</strong></p>
        <ul>
          <li><strong>Google/Firebase:</strong> For authentication and account management</li>
          <li><strong>Amazon Web Services:</strong> For secure photo storage</li>
        </ul>
        <p>These services have their own privacy policies and terms of service.</p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Your Rights</h2>
        <p><strong>You have the right to:</strong></p>
        <ul>
          <li>Access and update your personal information</li>
          <li>Delete your account and associated data</li>
          <li>Request information about how your data is used</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, please contact us through our platform
          or reach out to our support team.
        </p>
      </div>

      {/* Dark, sleek scrollbar styles */}
      <style>{`
        .legal-scroll::-webkit-scrollbar {
          width: 8px !important;
          display: block !important;
        }
        
        .legal-scroll::-webkit-scrollbar-track {
          background: transparent !important;
        }
        
        .legal-scroll::-webkit-scrollbar-thumb {
          background: ${darkMode ? '#555555' : '#888'} !important;
          border-radius: 10px !important;
          transition: background 0.3s ease !important;
        }
        
        .legal-scroll::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? '#666666' : '#555'} !important;
        }
        
        .legal-scroll::-webkit-scrollbar-thumb:active {
          background: ${darkMode ? '#777777' : '#333'} !important;
        }
        
        /* For Firefox */
        .legal-scroll {
          scrollbar-width: thin !important;
          scrollbar-color: ${darkMode ? '#555555' : '#888'} transparent !important;
        }
      `}</style>
    </div>
  );
} 