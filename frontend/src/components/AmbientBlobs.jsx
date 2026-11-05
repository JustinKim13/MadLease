// Slow-drifting red glow behind a page. Fixed to the viewport and desktop-only.
// Pages must sit above it (zIndex 103 on the page root) so content stays on top.
export default function AmbientBlobs({ darkMode, isMobile, layer = 102 }) {
  return (
    <>
      <div className="blob blob-1" style={{
        position: 'fixed', top: '-20%', left: '15%', width: '650px', height: '650px', borderRadius: '50%',
        background: darkMode ? 'rgba(197,5,12,0.09)' : 'rgba(197,5,12,0.10)',
        filter: 'blur(140px)', pointerEvents: 'none', zIndex: layer, willChange: 'transform', display: isMobile ? 'none' : undefined,
      }} />
      <div className="blob blob-2" style={{
        position: 'fixed', top: '0%', left: '-20%', width: '500px', height: '500px', borderRadius: '50%',
        background: darkMode ? 'rgba(197,5,12,0.06)' : 'rgba(197,5,12,0.06)',
        filter: 'blur(120px)', pointerEvents: 'none', zIndex: layer, willChange: 'transform', display: isMobile ? 'none' : undefined,
      }} />
      <div className="blob blob-3" style={{
        position: 'fixed', top: '-10%', right: '-15%', width: '480px', height: '480px', borderRadius: '50%',
        background: darkMode ? 'rgba(197,5,12,0.06)' : 'rgba(197,5,12,0.06)',
        filter: 'blur(125px)', pointerEvents: 'none', zIndex: layer, willChange: 'transform', display: isMobile ? 'none' : undefined,
      }} />
      <style>{`
        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25%      { transform: translate(12%, 18%) scale(1.12); }
          50%      { transform: translate(-8%, 28%) scale(0.94); }
          75%      { transform: translate(18%, 10%) scale(1.07); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(22%, -12%) scale(1.15); }
          66%      { transform: translate(35%, 16%) scale(0.90); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40%      { transform: translate(-20%, 20%) scale(1.18); }
          80%      { transform: translate(-30%, 8%) scale(0.88); }
        }
        .blob-1 { animation: blobFloat1 18s ease-in-out infinite; }
        .blob-2 { animation: blobFloat2 24s ease-in-out infinite 2s; }
        .blob-3 { animation: blobFloat3 20s ease-in-out infinite 5s; }
        @media (prefers-reduced-motion: reduce) {
          .blob-1, .blob-2, .blob-3 { animation: none; }
        }
      `}</style>
    </>
  );
}
