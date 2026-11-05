import { useContext } from 'react';
import { Clock5 } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';

const STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    lightBg: '#ecfdf5',
    darkBg: 'rgba(52,199,89,0.10)',
    lightBorder: 'rgba(87,188,108,0.35)',
    darkBorder: 'rgba(87,188,108,0.25)',
    text: '#57BC6C',
  },
  PENDING: {
    label: 'Pending',
    lightBg: '#fff7ed',
    darkBg: 'rgba(234,166,93,0.10)',
    lightBorder: 'rgba(234,166,93,0.35)',
    darkBorder: 'rgba(234,166,93,0.25)',
    text: '#EAA65D',
  },
  COMPLETED: {
    label: 'Completed',
    lightBg: '#f4f4f5',
    darkBg: 'rgba(255,255,255,0.05)',
    lightBorder: 'rgba(0,0,0,0.12)',
    darkBorder: 'rgba(255,255,255,0.10)',
    text: '#777777',
    icon: Clock5,
  },
  EXPIRED: {
    label: 'Expired',
    lightBg: '#fef2f2',
    darkBg: 'rgba(255,107,107,0.10)',
    lightBorder: 'rgba(239,68,68,0.25)',
    darkBorder: 'rgba(239,68,68,0.20)',
    text: '#D96A6A',
    icon: Clock5,
  },
};

export default function StatusBadge({ status, onClick, style }) {
  const { darkMode } = useContext(ThemeContext);
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.AVAILABLE;
  const Tag = onClick ? 'button' : 'span';
  const showStatusIcon = status === 'COMPLETED' || status === 'EXPIRED';

  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 8,
        background: darkMode ? cfg.darkBg : cfg.lightBg,
        border: `1px solid ${darkMode ? cfg.darkBorder : cfg.lightBorder}`,
        color: cfg.text,
        fontSize: 11,
        fontFamily: 'Outfit, sans-serif',
        fontWeight: 600,
        letterSpacing: '0.02em',
        cursor: onClick ? 'pointer' : 'default',
        lineHeight: 1,
        userSelect: 'none',
        transition: 'opacity 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {showStatusIcon && <Clock5 size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
      {cfg.label}
      {onClick && (
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" style={{ marginLeft: 1, opacity: 0.35 }}>
          <path d="M1.5 2.75L4 5.25L6.5 2.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Tag>
  );
}
