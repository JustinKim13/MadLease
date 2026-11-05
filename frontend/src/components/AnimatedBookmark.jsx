// eslint-disable-next-line no-unused-vars -- `motion` is used via JSX member expressions (<motion.div>), which this repo's bare no-unused-vars config (no eslint-plugin-react) doesn't recognize as a usage
import { motion, AnimatePresence } from 'framer-motion';

// Stable particle config — computed once at module level
const PARTICLE_CONFIG = [...Array(5)].map((_, i) => {
  const angle = (i / 5) * (2 * Math.PI);
  const radius = 18 + Math.random() * 8;
  const scale = 0.8 + Math.random() * 0.4;
  const duration = 0.6 + Math.random() * 0.1;
  return {
    key: i,
    width: `${4 + Math.random() * 2}px`,
    height: `${4 + Math.random() * 2}px`,
    initial: { scale: 0, opacity: 0.3, x: 0, y: 0 },
    animate: {
      scale: [0, scale, 0],
      opacity: [0.3, 0.8, 0],
      x: [0, Math.cos(angle) * radius],
      y: [0, Math.sin(angle) * radius * 0.75],
    },
    transition: { duration, delay: i * 0.04, ease: 'easeOut' },
  };
});

export default function AnimatedBookmark({ isSaved, darkMode, size = 22 }) {
  const savedFill = darkMode ? 'white' : '#1d1d1f';
  const savedStroke = darkMode ? 'white' : '#1d1d1f';
  const unsavedStroke = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const burstColor = darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)';

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}>
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: isSaved ? 1.1 : 1 }}
        whileTap={isSaved ? { scale: 1, rotate: 0 } : { scale: 0.85, rotate: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Base unfilled bookmark */}
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={unsavedStroke} strokeWidth="2" style={{ display: 'block' }}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>

        {/* Filled bookmark overlaid */}
        <svg
          width={size} height={size} viewBox="0 0 24 24"
          fill={savedFill} stroke={savedStroke} strokeWidth="2"
          style={{ position: 'absolute', inset: 0, display: 'block', opacity: isSaved ? 1 : 0, transition: 'opacity 0.25s' }}
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>

        {/* Burst radial gradient */}
        <AnimatePresence>
          {isSaved && (
            <motion.div
              style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: `radial-gradient(circle, ${burstColor} 0%, rgba(0,0,0,0) 80%)`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1], opacity: [0, 0.4, 0] }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Particles */}
      <AnimatePresence>
        {isSaved && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {PARTICLE_CONFIG.map((p) => (
              <motion.div
                key={p.key}
                style={{
                  position: 'absolute',
                  width: p.width, height: p.height,
                  borderRadius: '50%',
                  background: darkMode ? 'white' : '#1d1d1f',
                  filter: 'blur(1px)',
                  transform: 'translate(-50%, -50%)',
                }}
                initial={p.initial}
                animate={p.animate}
                transition={p.transition}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
