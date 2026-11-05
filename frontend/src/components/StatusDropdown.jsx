import { useState, useContext } from 'react';
import { CircleCheck, Check } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'AVAILABLE', label: 'Available', bg: '#ecfdf5', text: '#57BC6C' },
  { value: 'PENDING',   label: 'Pending',   bg: '#fff7ed', text: '#EAA65D' },
];

export default function StatusDropdown({ currentStatus, onSelect, style }) {
  const [hovered, setHovered] = useState(null);
  const { darkMode } = useContext(ThemeContext);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        zIndex: 100,
        background: darkMode ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        minWidth: 170,
        boxShadow: darkMode
          ? '0 4px 24px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.05)'
          : '0 4px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
        padding: '3px',
        ...style,
      }}
    >
      {OPTIONS.map(({ value, label }) => {
        const isCurrent = currentStatus === value;
        const isHovered = hovered === value;
        return (
          <button
            key={value}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              textAlign: 'left',
              padding: '7px 10px',
              background: isHovered
                ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: isCurrent
                ? (darkMode ? '#f5f5f7' : '#1a1a1a')
                : (darkMode ? '#98989d' : '#666'),
              fontFamily: 'Outfit, sans-serif',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: isCurrent ? 600 : 400,
              letterSpacing: '0.01em',
              transition: 'background 0.12s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {label}
            {isCurrent && (
              <Check size={12} style={{ marginLeft: 'auto', color: darkMode ? '#f5f5f7' : '#1a1a1a' }} strokeWidth={2} />
            )}
          </button>
        );
      })}

      <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '3px 6px' }} />

      <button
        onMouseEnter={() => setHovered('COMPLETED')}
        onMouseLeave={() => setHovered(null)}
        onClick={() => onSelect('COMPLETED')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          padding: '7px 10px',
          background: hovered === 'COMPLETED'
            ? (darkMode ? 'rgba(255,69,58,0.08)' : 'rgba(255,69,58,0.06)')
            : 'transparent',
          border: 'none',
          borderRadius: 8,
          color: hovered === 'COMPLETED'
            ? '#D57463'
            : (darkMode ? '#636366' : '#999'),
          fontFamily: 'Outfit, sans-serif',
          fontSize: 13,
          cursor: 'pointer',
          fontWeight: 400,
          letterSpacing: '0.01em',
          transition: 'background 0.12s ease, color 0.12s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <CircleCheck size={13} strokeWidth={2} style={{ opacity: 0.5 }} />
        Mark as Completed
      </button>
    </div>
  );
}
