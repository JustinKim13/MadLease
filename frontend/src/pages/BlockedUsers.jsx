import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { BlockedUsersPanel } from '../components/ConversationList';
import Seo from '../components/Seo';

export default function BlockedUsers() {
  const { darkMode } = useContext(ThemeContext);
  const navigate = useNavigate();

  return (
    <>
      <Seo title="Blocked Users — MadLease" />
      <div style={{
        minHeight: '100lvh',
        background: darkMode ? '#0f0e0e' : '#f5f6f8',
        fontFamily: '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 18px 12px',
          display: 'flex', alignItems: 'center', gap: '12px',
          borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: 0, background: 'none', border: 'none', cursor: 'pointer',
              color: darkMode ? 'rgba(236,236,238,0.66)' : '#555',
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={darkMode ? 'rgba(236,236,238,0.66)' : '#555'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 style={{
            margin: 0, fontSize: '17px', fontWeight: '600',
            color: darkMode ? '#ECECEE' : '#1a1a1a',
          }}>
            Blocked Users
          </h1>
        </div>

        {/* Blocked users list */}
        <div style={{ padding: '8px 0' }}>
          <BlockedUsersPanel darkMode={darkMode} isMobile={true} />
        </div>
      </div>
    </>
  );
}
