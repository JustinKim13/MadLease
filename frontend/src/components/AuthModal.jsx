import { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

// Helper function to translate Firebase error codes to user-friendly messages
const getFirebaseErrorMessage = (error) => {
  const errorCode = error?.code || '';

  switch (errorCode) {
    // Login errors
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support for assistance.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes before trying again.';

    // Signup errors
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';

    // Google sign-in errors
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked. Please allow popups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';

    // Password reset errors
    case 'auth/expired-action-code':
      return 'This password reset link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This password reset link is invalid. Please request a new one.';

    // Network errors
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';

    // Verification errors
    case 'auth/requires-recent-login':
      return 'Please sign in again to complete this action.';

    // Default fallback
    default:
      // If there's a readable message from Firebase, clean it up
      if (error?.message) {
        // Remove "Firebase: " prefix and error code suffix if present
        let message = error.message
          .replace(/^Firebase:\s*/i, '')
          .replace(/\s*\(auth\/[\w-]+\)\s*\.?$/i, '')
          .trim();

        // If the cleaned message is still technical, use a generic one
        if (message.toLowerCase().includes('error') && message.length > 100) {
          return 'An unexpected error occurred. Please try again.';
        }

        return message || 'An unexpected error occurred. Please try again.';
      }
      return 'An unexpected error occurred. Please try again.';
  }
};

export default function AuthModal({ isOpen, onClose, darkMode, title = "Sign in to continue", initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showVerificationSent, setShowVerificationSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const { login, signup, resetPassword, loginWithGoogle, resendVerificationEmail, checkEmailVerification } = useAuth();

  useBodyScrollLock(isOpen);

  // Reset mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLogin(initialMode !== 'signup');
    }
  }, [isOpen, initialMode]);

  // Start 60s cooldown whenever verification screen appears
  useEffect(() => {
    if (showVerificationSent) {
      setResendCooldown(60);
    }
  }, [showVerificationSent]);

  // Decrement cooldown every second
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // this is essentially our auth popup component, which manages the auth state of the user and applies styling

  if (!isOpen) return null;

  const validateField = (name, value) => {
    switch (name) {
      case 'firstName':
        if (!value.trim()) return 'First name is required';
        if (value.trim().length > 50) return 'First name must be 50 characters or less';
        return '';
      case 'lastName':
        if (!value.trim()) return 'Last name is required';
        if (value.trim().length > 50) return 'Last name must be 50 characters or less';
        return '';
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return '';
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== password) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  };

  const handleBlur = (name, value) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const err = validateField(name, value);
    setFieldErrors(prev => ({ ...prev, [name]: err }));
  };

  const handleChange = (name, value, setter) => {
    setter(value);
    if (touched[name]) {
      const err = validateField(name, value);
      setFieldErrors(prev => ({ ...prev, [name]: err }));
    }
    // Re-validate confirmPassword live when password changes
    if (name === 'password' && touched.confirmPassword) {
      const err = confirmPassword && value !== confirmPassword ? 'Passwords do not match' : '';
      setFieldErrors(prev => ({ ...prev, confirmPassword: err }));
    }
  };

  const validateAllFields = () => {
    const fields = showForgotPassword
      ? { email }
      : isLogin
        ? { email, password }
        : { firstName, lastName, email, password, confirmPassword };

    const newErrors = {};
    Object.entries(fields).forEach(([name, value]) => {
      const err = validateField(name, value);
      if (err) newErrors[name] = err;
    });

    // Mark all fields as touched so errors show
    const allTouched = Object.keys(fields).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(prev => ({ ...prev, ...allTouched }));
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateAllFields()) return;

    setLoading(true);

    try {
      if (showForgotPassword) {
        try {
          await resetPassword(email);
          setSuccess('Password reset email sent! Check your inbox (and spam folder).');
          setEmail('');
        } catch (error) {
          throw new Error(getFirebaseErrorMessage(error));
        }
        setLoading(false);
        return;
      } else if (isLogin) {
        try {
          await login(email, password);
          onClose();
        } catch (error) {
          throw new Error(getFirebaseErrorMessage(error));
        }
      } else {
        try {
          await signup(email, password, `${firstName.trim()} ${lastName.trim()}`);
          setShowVerificationSent(true);
        } catch (error) {
          throw new Error(getFirebaseErrorMessage(error));
        }
      }
    } catch (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
      onClose();
    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setError('');
    setSuccess('');
    setShowForgotPassword(false);
    setShowVerificationSent(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFieldErrors({});
    setTouched({});
  };

  const handleResendVerification = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await resendVerificationEmail(email, password);
      setSuccess('Verification email sent! Check your inbox (and spam folder).');
      setResendCooldown(60);
    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    }
    setLoading(false);
  };

  const handleCheckVerification = async () => {
    setError('');
    setLoading(true);
    try {
      const verified = await checkEmailVerification(email, password);
      if (verified) {
        onClose();
      } else {
        setError("Your email hasn't been verified yet. Check your inbox and click the link.");
      }
    } catch (error) {
      setError(getFirebaseErrorMessage(error));
    }
    setLoading(false);
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  const getInputStyle = (hasError) => ({
    width: '100%',
    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
    borderRadius: '4px',
    border: `1px solid ${hasError ? '#e53e3e' : (darkMode ? '#444' : '#ccc')}`,
    backgroundColor: darkMode ? '#333' : 'white',
    color: darkMode ? 'white' : 'black',
    fontSize: '1rem',
    boxSizing: 'border-box',
    outline: 'none',
  });

  const errorStyle = {
    color: '#e53e3e',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
    marginBottom: '0.75rem',
  };

  const inputWrapperStyle = {
    position: 'relative',
    marginBottom: '1rem',
  };

  const iconStyle = {
    position: 'absolute',
    left: '0.7rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: darkMode ? '#888' : '#9ca3af',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  };

  const eyeButtonStyle = {
    position: 'absolute',
    right: '0.7rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: darkMode ? '#888' : '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    outline: 'none',
  };

  const buttonStyle = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: 'var(--badger-red)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    transition: 'opacity 0.2s',
    outline: 'none'
  };

  const isMobile = window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: '1rem',
      paddingTop: isMobile ? '5rem' : '1rem'
    }}>
      <div style={{
        backgroundColor: darkMode ? '#171514' : 'white',
        padding: '2rem',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '460px',
        position: 'relative',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: darkMode ? '#999' : '#666',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
        >
          ×
        </button>

        <h2 style={{
          marginBottom: '0.5rem',
          color: darkMode ? 'white' : 'black',
          fontSize: '1.5rem'
        }}>
          {showVerificationSent ? 'Verify Your Email' : (showForgotPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Sign Up'))}
        </h2>

        {!showVerificationSent && <p style={{
          marginBottom: '1.5rem',
          color: darkMode ? '#999' : '#666',
          fontSize: '0.9rem'
        }}>
          {showForgotPassword ? 'Enter your email to reset your password' : title}
        </p>}
        
        {error && (
          <div style={{
            color: '#ff4444',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: darkMode ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 68, 68, 0.05)',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            color: '#4CAF50',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: darkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {success}
          </div>
        )}

        {showVerificationSent ? (
          <div style={{ textAlign: 'center' }}>
            {/* Mail icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: darkMode ? '#2a2a2a' : '#f3f4f6',
              margin: '0 auto 1.25rem',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#ccc' : '#374151'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
            </div>

            <h3 style={{ color: darkMode ? 'white' : '#111', fontSize: '1.15rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Check your email
            </h3>
            <p style={{ color: darkMode ? '#999' : '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              We've sent a verification link to
            </p>
            <p style={{ color: darkMode ? '#e0e0e0' : '#111', fontSize: '0.9rem', fontWeight: '600', marginBottom: '1.25rem', wordBreak: 'break-all' }}>
              {email}
            </p>
            <p style={{ color: darkMode ? '#888' : '#6b7280', fontSize: '0.82rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Click the link in your email to verify your account.{' '}
              <strong>If you don't see it, check your spam folder.</strong>
            </p>

            {/* I've verified button */}
            <button
              onClick={handleCheckVerification}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--badger-red)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                marginBottom: '0.75rem',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              {loading ? 'Checking...' : (
                <>
                  I've verified my email
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </>
              )}
            </button>

            {/* Resend button with cooldown */}
            <button
              onClick={handleResendVerification}
              disabled={loading || resendCooldown > 0}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'transparent',
                color: darkMode ? (resendCooldown > 0 ? '#555' : '#ccc') : (resendCooldown > 0 ? '#aaa' : '#374151'),
                border: `1px solid ${darkMode ? (resendCooldown > 0 ? '#333' : '#555') : (resendCooldown > 0 ? '#ddd' : '#d1d5db')}`,
                borderRadius: '4px',
                cursor: (loading || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                marginBottom: '1rem',
                transition: 'all 0.2s',
              }}
            >
              {resendCooldown > 0
                ? `Resend verification email (${resendCooldown}s)`
                : 'Resend verification email'}
            </button>

            <button
              onClick={() => { resetForm(); setIsLogin(true); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--badger-red)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                textDecoration: 'underline',
              }}
            >
              Back to login
            </button>
          </div>
        ) : (
        <>
        <form onSubmit={handleSubmit}>
          {/* First + Last name row (signup only) */}
          {!isLogin && !showForgotPassword && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0' }}>
                <div style={{ ...inputWrapperStyle, flex: 1, marginBottom: fieldErrors.firstName ? '0.25rem' : '1rem' }}>
                  <span style={iconStyle}><User size={16} /></span>
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => handleChange('firstName', e.target.value, setFirstName)}
                    onBlur={(e) => handleBlur('firstName', e.target.value)}
                    style={getInputStyle(!!fieldErrors.firstName)}
                  />
                </div>
                <div style={{ ...inputWrapperStyle, flex: 1, marginBottom: fieldErrors.lastName ? '0.25rem' : '1rem' }}>
                  <span style={iconStyle}><User size={16} /></span>
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => handleChange('lastName', e.target.value, setLastName)}
                    onBlur={(e) => handleBlur('lastName', e.target.value)}
                    style={getInputStyle(!!fieldErrors.lastName)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: (fieldErrors.firstName || fieldErrors.lastName) ? '0.5rem' : '0' }}>
                <div style={{ flex: 1 }}>
                  {fieldErrors.firstName && <p style={errorStyle}>{fieldErrors.firstName}</p>}
                </div>
                <div style={{ flex: 1 }}>
                  {fieldErrors.lastName && <p style={errorStyle}>{fieldErrors.lastName}</p>}
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div style={{ ...inputWrapperStyle, marginBottom: fieldErrors.email ? '0.25rem' : '1rem' }}>
            <span style={iconStyle}><Mail size={16} /></span>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => handleChange('email', e.target.value, setEmail)}
              onBlur={(e) => handleBlur('email', e.target.value)}
              style={getInputStyle(!!fieldErrors.email)}
            />
          </div>
          {fieldErrors.email && <p style={errorStyle}>{fieldErrors.email}</p>}

          {/* Password */}
          {!showForgotPassword && (
            <>
              <div style={{ ...inputWrapperStyle, marginBottom: fieldErrors.password ? '0.25rem' : '1rem' }}>
                <span style={iconStyle}><Lock size={16} /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => handleChange('password', e.target.value, setPassword)}
                  onBlur={(e) => handleBlur('password', e.target.value)}
                  style={{ ...getInputStyle(!!fieldErrors.password), paddingRight: '2.5rem' }}
                />
                <button type="button" style={eyeButtonStyle} onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <p style={errorStyle}>{fieldErrors.password}</p>}
            </>
          )}

          {/* Confirm Password (signup only) */}
          {!isLogin && !showForgotPassword && (
            <>
              <div style={{ ...inputWrapperStyle, marginBottom: fieldErrors.confirmPassword ? '0.25rem' : '1rem' }}>
                <span style={iconStyle}><Lock size={16} /></span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value, setConfirmPassword)}
                  onBlur={(e) => handleBlur('confirmPassword', e.target.value)}
                  style={{ ...getInputStyle(!!fieldErrors.confirmPassword), paddingRight: '2.5rem' }}
                />
                <button type="button" style={eyeButtonStyle} onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p style={errorStyle}>{fieldErrors.confirmPassword}</p>}
            </>
          )}


          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : (
              showForgotPassword ? 'Send Reset Email' : (isLogin ? 'Sign In' : 'Sign Up')
            )}
          </button>
        </form>

        {/* Google Sign-In Button */}
        {!showForgotPassword && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              margin: '1rem 0',
              color: darkMode ? '#999' : '#666'
            }}>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: darkMode ? '#444' : '#ddd'
              }}></div>
              <span style={{ padding: '0 1rem', fontSize: '0.9rem' }}>or</span>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: darkMode ? '#444' : '#ddd'
              }}></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: darkMode ? '#333' : 'white',
                color: darkMode ? 'white' : '#333',
                border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s',
                opacity: loading ? 0.7 : 1,
                outline: 'none'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        {!showForgotPassword && (
          <>
            <p style={{ 
              textAlign: 'center', 
              color: darkMode ? '#999' : '#666',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={switchMode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--badger-red)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  outline: 'none',
                  textDecoration: 'underline'
                }}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>

            {isLogin && (
              <p style={{ 
                textAlign: 'center', 
                color: darkMode ? '#999' : '#666',
                fontSize: '0.9rem'
              }}>
                <button
                  onClick={() => setShowForgotPassword(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--badger-red)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    outline: 'none',
                    textDecoration: 'underline'
                  }}
                >
                  Forgot your password?
                </button>
              </p>
            )}
          </>
        )}

        {showForgotPassword && (
          <p style={{
            textAlign: 'center',
            color: darkMode ? '#999' : '#666',
            fontSize: '0.9rem'
          }}>
            <button
              onClick={() => setShowForgotPassword(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--badger-red)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              Back to Sign In
            </button>
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
} 