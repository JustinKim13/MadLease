import { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Check if user has a preference stored in localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    // If user has a preference, use it, otherwise check system preference
    if (savedMode !== null) {
      return savedMode === 'true';
    } else {
      return true;
    }
  });

  // Toggle between dark and light mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Save preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);

    // Drive the [data-theme="dark"] CSS rules in index.css. This swaps
    // --background-color (used by html bg), so the bottom iOS safe-area
    // region paints with the correct dark/light page bg.
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // theme-color tints the iOS status-bar overlay. Match Navbar.jsx
    // colorDark / colorLight so the chrome blends with the navbar.
    const themeColor = darkMode ? '#0f0e0e' : '#ffffff';
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = themeColor;
    document.head.appendChild(meta);
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}; 