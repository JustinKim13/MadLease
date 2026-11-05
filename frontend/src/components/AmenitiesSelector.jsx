// eslint-disable-next-line no-unused-vars -- `motion` is used via JSX member expressions (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

export function AmenitiesSelector({ options, selected, onChange, darkMode }) {
  const remove = (amenity) => onChange(selected.filter((a) => a !== amenity));
  const add = (amenity) => onChange([...selected, amenity]);

  const unselected = options.filter((o) => !selected.includes(o));

  return (
    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Selected strip */}
      <div
        style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          backgroundColor: darkMode ? '#272422' : '#ffffff',
          border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
          minHeight: '52px',
          padding: '6px',
          borderRadius: '14px',
          boxSizing: 'border-box',
        }}
      >
        {selected.length === 0 && (
          <span style={{ color: darkMode ? '#6b6562' : '#9ca3af', fontSize: '0.875rem', paddingLeft: '4px', whiteSpace: 'nowrap' }}>
            Select amenities below…
          </span>
        )}
        <AnimatePresence initial={false}>
          {selected.map((amenity) => (
            <motion.div
              key={amenity}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                paddingLeft: '10px',
                paddingRight: '4px',
                paddingTop: '4px',
                paddingBottom: '4px',
                backgroundColor: darkMode ? '#33302e' : '#ffffff',
                boxShadow: darkMode ? 'inset 0 0 0 1px #4a4643' : '0 1px 4px rgba(0,0,0,0.12)',
                border: `1px solid ${darkMode ? '#4a4643' : '#e4e4e7'}`,
                borderRadius: '12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                height: '38px',
              }}
            >
              <span style={{ color: darkMode ? '#f0ebe5' : '#374151', fontWeight: '500', fontSize: '0.875rem' }}>
                {amenity}
              </span>
              <button
                type="button"
                onClick={() => remove(amenity)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  borderRadius: '50%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: darkMode ? '#8a8280' : '#6b7280',
                }}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Unselected pool */}
      {unselected.length > 0 && (
        <div
          style={{
            backgroundColor: darkMode ? '#272422' : '#f9f9f9',
            border: `1px solid ${darkMode ? '#3a3633' : '#e4e4e7'}`,
            padding: '10px',
            borderRadius: '14px',
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <AnimatePresence initial={false}>
              {unselected.map((amenity) => (
                <motion.button
                  key={amenity}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.15 }}
                  type="button"
                  onClick={() => add(amenity)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    paddingLeft: '14px',
                    paddingRight: '14px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    backgroundColor: darkMode ? '#33302e' : '#efefef',
                    border: `1px solid ${darkMode ? '#4a4643' : '#e0e0e0'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: darkMode ? '#d4cfc9' : '#374151', fontWeight: '500', fontSize: '0.875rem' }}>
                    {amenity}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
