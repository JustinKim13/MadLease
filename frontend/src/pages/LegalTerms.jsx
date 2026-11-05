import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import Seo from '../components/Seo';

export default function LegalTerms() {
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
        title="Terms of Service"
        description="The rules and agreements for using MadLease, the UW-Madison sublease and parking marketplace."
        path="/terms"
      />
      <h1 style={headingStyle}>Terms of Service</h1>
      <p style={{ fontSize: '0.9rem', color: darkMode ? '#999' : '#666', marginBottom: '2rem' }}>
        Last updated: January 1, 2026
      </p>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Acceptance of Terms</h2>
        <p>
          By accessing and using MadLease, you accept and agree to be bound by the terms
          and provision of this agreement.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Service Description</h2>
        <p>
          MadLease is a platform that connects people looking to sublet their housing
          with those seeking temporary accommodation. We facilitate communication but are not
          party to any rental agreements.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>User Responsibilities</h2>
        <p><strong>As a user, you agree to:</strong></p>
        <ul>
          <li>Provide accurate and truthful information in listings</li>
          <li>Respect other users and maintain appropriate communication</li>
          <li>Comply with all applicable laws and regulations</li>
          <li>Not use the platform for illegal or fraudulent activities</li>
          <li>Ensure you have proper authorization to sublet any property</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Prohibited Uses</h2>
        <p><strong>You may not use MadLease to:</strong></p>
        <ul>
          <li>Post false, misleading, or fraudulent listings</li>
          <li>Harass, threaten, or harm other users</li>
          <li>Upload illegal or inappropriate content</li>
          <li>Attempt to circumvent platform security measures</li>
          <li>Violate any local, state, or federal laws</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Limitation of Liability</h2>
        <p>
          <strong>MadLease serves as a platform to connect users. We are not responsible for:</strong>
        </p>
        <ul>
          <li>The accuracy of listings or user-provided information</li>
          <li>Disputes between users regarding rental agreements</li>
          <li>Property conditions, damages, or safety issues</li>
          <li>Financial transactions between users</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Account Termination</h2>
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms
          or engage in prohibited activities.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Changes to Terms</h2>
        <p>
          We may update these terms periodically. Continued use of the platform constitutes
          acceptance of any changes.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>Contact Information</h2>
        <p>
          For questions about these Terms of Service, please contact us through our platform
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