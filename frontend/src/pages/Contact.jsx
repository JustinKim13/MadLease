import React, { useState, useContext, useEffect } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { ApiService } from '../services/apiService';
import Seo from '../components/Seo';

export default function Contact() {
  // Access dark mode state from theme context
  const { darkMode } = useContext(ThemeContext);
  const [error, setError] = useState('');
  // State for responsive design
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);

  // State for form data and submission status
  const MESSAGE_MAX = 1000;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    inquiryType: 'help',
    message: '',
  });
  const [status, setStatus] = useState('idle'); // Can be 'idle', 'submitting', 'success', 'error'

  // Effect to handle window resizing for responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generic handler to update form state on input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      setError('Please fill out all fields!');
      return;
    }

    setStatus('submitting');
    setError('');

    try {
        await ApiService.post("/email", {
            name: formData.name,
            email: formData.email,
            inquiryType: formData.inquiryType,
            message: formData.message,
        });
        setStatus('success');
    } catch(e) {
        setError(e.message || 'Something went wrong. Please try again.');
        setStatus('idle');
    }
  };

  // --- Style Definitions ---

  const pageStyle = {
    padding: isMobile ? '2rem 1.5rem 3rem' : '1.75rem 2rem 2rem',
    maxWidth: '760px',
    margin: '0 auto',
    animation: 'fadeIn 0.8s ease-out',
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: isMobile ? '2rem' : '1.75rem',
  };

  const h1Style = {
    color: darkMode ? 'white' : 'var(--text-color, #111)',
    marginBottom: '0.6rem',
    marginTop: 0,
    fontSize: isMobile ? '2.1rem' : '2.5rem',
    fontWeight: '800',
  };

  const pStyle = {
    fontSize: '1rem',
    color: darkMode ? '#ccc' : '#666',
    lineHeight: '1.55',
    margin: 0,
  };

  const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  };

  const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
  };

  const labelStyle = {
    color: darkMode ? '#ccc' : '#444',
    marginBottom: '0.4rem',
    fontSize: '0.92rem',
    fontWeight: '600',
  };

  const inputBaseStyle = {
    backgroundColor: darkMode ? '#171514' : '#f8f9fa',
    color: darkMode ? '#eee' : '#333',
    border: `1px solid ${darkMode ? '#404040' : '#e0e0e0'}`,
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    fontSize: '0.98rem',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  };

  const inputFocusStyle = {
    outline: 'none',
    borderColor: 'var(--badger-red, #cc0000)',
    boxShadow: `0 0 0 3px rgba(204, 0, 0, 0.2)`,
  };

  const buttonStyle = {
    backgroundColor: 'var(--badger-red, #cc0000)',
    color: 'white',
    padding: '0.9rem 2rem',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '1.05rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(204, 0, 0, 0.3)',
    border: 'none',
    cursor: 'pointer',
    marginTop: '0.5rem',
  };

  const buttonHoverStyle = {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 20px rgba(204, 0, 0, 0.4)',
  };

  const messageBoxStyle = {
    textAlign: 'center',
    padding: '2rem',
    backgroundColor: darkMode ? '#171514' : '#f8f9fa',
    border: `1px solid ${darkMode ? '#404040' : '#e0e0e0'}`,
    borderRadius: '12px',
  };

  return (
    <div style={pageStyle}>
      <Seo
        title="Contact Us"
        description="Get in touch with the MadLease team. Questions, bug reports, and feedback from UW-Madison students welcome."
        path="/contact"
      />
      <div style={headerStyle}>
        <h1 style={h1Style}>Contact Us</h1>
        <p style={pStyle}>
          Have a question, bug report, or feedback? We'd love to hear from you.
        </p>
      </div>

      {status === 'success' ? (
        <div style={messageBoxStyle}>
          <h2 style={{...h1Style, fontSize: '1.8rem', color: 'var(--badger-red, #cc0000)'}}>Message Sent!</h2>
          <p style={pStyle}>Thank you for reaching out. We'll get back to you as soon as possible.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={formStyle} noValidate>
          <div style={formGroupStyle}>
            <label htmlFor="name" style={labelStyle}>Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={inputBaseStyle}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.target.style, {borderColor: darkMode ? '#404040' : '#e0e0e0', boxShadow: 'none'})}
              required
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="email" style={labelStyle}>Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={inputBaseStyle}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.target.style, {borderColor: darkMode ? '#404040' : '#e0e0e0', boxShadow: 'none'})}
              required
            />
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="inquiryType" style={labelStyle}>Reason for Contact</label>
            <select
              id="inquiryType"
              name="inquiryType"
              value={formData.inquiryType}
              onChange={handleChange}
              style={inputBaseStyle}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.target.style, {borderColor: darkMode ? '#404040' : '#e0e0e0', boxShadow: 'none'})}
              required
            >
              <option value="help">General Help</option>
              <option value="bug">Bug Report</option>
              <option value="user">User Report</option>
              <option value="feature">Feature Request</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={formGroupStyle}>
            <label htmlFor="message" style={labelStyle}>Message</label>
            <textarea
              id="message"
              name="message"
              rows="5"
              maxLength={MESSAGE_MAX}
              value={formData.message}
              onChange={handleChange}
              style={{...inputBaseStyle, resize: 'vertical'}}
              onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={(e) => Object.assign(e.target.style, {borderColor: darkMode ? '#404040' : '#e0e0e0', boxShadow: 'none'})}
              required
            ></textarea>
            <div style={{
              textAlign: 'right',
              marginTop: '0.35rem',
              fontSize: '0.8rem',
              color: formData.message.length >= MESSAGE_MAX
                ? 'var(--badger-red)'
                : (darkMode ? '#666' : '#999')
            }}>
              {formData.message.length}/{MESSAGE_MAX}
            </div>
          </div>

          {error && (
            <p style={{ color: '#ff4d4d', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            style={buttonStyle}
            onMouseEnter={(e) => Object.assign(e.target.style, buttonHoverStyle)}
            onMouseLeave={(e) => Object.assign(e.target.style, {transform: 'none', boxShadow: '0 4px 15px rgba(204, 0, 0, 0.3)'})}
          >
            {status === 'submitting' ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}

      {/* Keyframes for animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
}
