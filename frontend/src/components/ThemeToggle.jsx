import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ darkMode, onToggle }) {
  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '64px',
        height: '32px',
        padding: '4px',
        borderRadius: '9999px',
        cursor: 'pointer',
        transition: 'background-color 0.3s, border-color 0.3s',
        backgroundColor: darkMode ? '#09090b' : '#ffffff',
        border: `1px solid ${darkMode ? '#27272a' : '#e4e4e7'}`,
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        {/* Left icon slot — active in dark mode */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            transition: 'transform 0.3s, background-color 0.3s',
            backgroundColor: darkMode ? '#3f3f46' : 'transparent',
            transform: darkMode ? 'translateX(0)' : 'translateX(32px)',
            flexShrink: 0,
          }}
        >
          {darkMode ? (
            <Moon size={14} strokeWidth={1.5} color="#ffffff" />
          ) : (
            <Sun size={14} strokeWidth={1.5} color="#71717a" />
          )}
        </div>

        {/* Right icon slot — active in light mode */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            transition: 'transform 0.3s, background-color 0.3s',
            backgroundColor: darkMode ? 'transparent' : '#e4e4e7',
            transform: darkMode ? 'translateX(0)' : 'translateX(-32px)',
            flexShrink: 0,
          }}
        >
          {darkMode ? (
            <Sun size={14} strokeWidth={1.5} color="#71717a" />
          ) : (
            <Moon size={14} strokeWidth={1.5} color="#18181b" />
          )}
        </div>
      </div>
    </div>
  );
}
