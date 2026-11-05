import { useState } from 'react';
import { ApiService } from '../services/apiService';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function ReportModal({ onClose, listingId, firebaseId, darkMode }) {
  useBodyScrollLock(true);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason for reporting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await ApiService.post('/report', {
        firebaseId,
        listingId,
        reason,
        reportMessage: details.trim()
      });
      setSuccess(true);
    } catch {
      setError('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2100
    }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        backgroundColor: darkMode ? '#171514' : 'white',
        padding: '2rem',
        borderRadius: '12px',
        maxWidth: '480px',
        width: '90%',
        margin: '1rem',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
      }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
              &#10003;
            </div>
            <h3 style={{
              margin: '0 0 0.75rem 0',
              color: darkMode ? 'white' : 'black',
              fontSize: '1.3rem'
            }}>
              Report Submitted
            </h3>
            <p style={{
              margin: '0 0 1.5rem 0',
              color: darkMode ? '#ccc' : '#666',
              lineHeight: '1.5'
            }}>
              Thank you for helping keep our community safe. We'll review your report shortly.
            </p>
            <button
              onClick={handleClose}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--badger-red)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{
                margin: 0,
                color: darkMode ? 'white' : 'black',
                fontSize: '1.3rem'
              }}>
                Report Listing
              </h3>
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: darkMode ? '#999' : '#666',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0 0.25rem',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <p style={{
              margin: '0 0 1rem 0',
              color: darkMode ? '#ccc' : '#666',
              fontSize: '0.9rem',
              lineHeight: '1.5'
            }}>
              Let us know why you're reporting this listing. Our team will review it.
            </p>

            {/* Reason selector */}
            <label style={{
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: '600',
              fontSize: '0.9rem',
              color: darkMode ? '#ddd' : '#333'
            }}>
              Reason <span style={{ color: '#c5050c' }}>*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '8px',
                border: `1px solid ${darkMode ? '#444' : '#ccc'}`,
                backgroundColor: darkMode ? '#2a2d32' : '#fff',
                color: darkMode ? '#fff' : '#333',
                fontSize: '0.95rem',
                marginBottom: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
                appearance: 'auto',
              }}
            >
              <option value="">Select a reason...</option>
              <option value="Fraudulent or scam listing">Fraudulent or scam listing</option>
              <option value="Inaccurate or misleading information">Inaccurate or misleading information</option>
              <option value="Duplicate listing">Duplicate listing</option>
              <option value="Inappropriate content">Inappropriate content</option>
              <option value="Listing no longer available">Listing no longer available</option>
              <option value="Suspected unauthorized sublease">Suspected unauthorized sublease</option>
              <option value="Other">Other</option>
            </select>

            {/* Details textarea */}
            <label style={{
              display: 'block',
              marginBottom: '0.4rem',
              fontWeight: '600',
              fontSize: '0.9rem',
              color: darkMode ? '#ddd' : '#333'
            }}>
              Additional Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context that may help us review this report..."
              rows={4}
              maxLength={1000}
              style={{
                width: '100%',
                padding: '0.7rem',
                borderRadius: '8px',
                border: `1px solid ${darkMode ? '#444' : '#ccc'}`,
                backgroundColor: darkMode ? '#2a2d32' : '#fff',
                color: darkMode ? '#fff' : '#333',
                fontSize: '0.95rem',
                marginBottom: '0.25rem',
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              textAlign: 'right',
              fontSize: '0.75rem',
              color: darkMode ? '#777' : '#999',
              marginBottom: '1rem',
            }}>
              {details.length}/1000
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                backgroundColor: darkMode ? 'rgba(244, 67, 54, 0.1)' : '#ffebee',
                color: darkMode ? '#ff6b6b' : '#c62828',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                border: `1px solid ${darkMode ? 'rgba(244, 67, 54, 0.3)' : '#ffcdd2'}`,
              }}>
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderRadius: '8px',
                  border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
                  backgroundColor: darkMode ? '#333' : '#f5f5f5',
                  color: darkMode ? '#ccc' : '#555',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: submitting ? (darkMode ? '#555' : '#ccc') : '#c5050c',
                  color: 'white',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
