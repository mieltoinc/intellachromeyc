/**
 * Halloween Theme Component - Optional seasonal decoration
 */

import React, { useState, useEffect } from 'react';

interface HalloweenThemeProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const HalloweenTheme: React.FC<HalloweenThemeProps> = ({ enabled, onToggle }) => {
  const [spiderWebVisible, setSpiderWebVisible] = useState(false);
  const [ghostPosition, setGhostPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;

    // Show spider webs gradually
    const webTimer = setTimeout(() => setSpiderWebVisible(true), 1000);

    // Gentle ghost movement (not scary!)
    const ghostInterval = setInterval(() => {
      setGhostPosition({
        x: Math.random() * (window.innerWidth - 100),
        y: Math.random() * (window.innerHeight - 100),
      });
    }, 5000);

    return () => {
      clearTimeout(webTimer);
      clearInterval(ghostInterval);
      setSpiderWebVisible(false);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* Halloween Theme Toggle */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '10px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '12px',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          🎃 Halloween Theme
        </label>
      </div>

      {/* Top Left Spider Web */}
      {spiderWebVisible && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          width: '150px',
          height: '150px',
          zIndex: 9999,
          opacity: 0.6,
          pointerEvents: 'none',
          transition: 'opacity 1s ease-in',
        }}>
          <svg width="150" height="150" viewBox="0 0 100 125" style={{ width: '100%', height: '100%' }}>
            <path
              d="M68.613,23.714H31.404c-0.002,0-0.002,0.001-0.002,0.001h-0.015l0,0l0,0c-0.006,0-0.012,0.002-0.017,0.003..."
              fill="rgba(100, 100, 100, 0.8)"
            />
          </svg>
        </div>
      )}

      {/* Top Right Spider Web */}
      {spiderWebVisible && (
        <div style={{
          position: 'fixed',
          top: '0',
          right: '0',
          width: '150px',
          height: '150px',
          zIndex: 9999,
          opacity: 0.6,
          pointerEvents: 'none',
          transition: 'opacity 1s ease-in',
          transform: 'scaleX(-1)', // Mirror the web
        }}>
          <svg width="150" height="150" viewBox="-5.0 -10.0 110.0 135.0" style={{ width: '100%', height: '100%' }}>
            <path
              d="m61.801 22.258 12.652 0.17969-11.887 4.5078 0.070313-0.30469c0.003906-0.015625..."
              fill="rgba(100, 100, 100, 0.8)"
            />
          </svg>
        </div>
      )}

      {/* Gentle Floating Ghost */}
      <div style={{
        position: 'fixed',
        left: `${ghostPosition.x}px`,
        top: `${ghostPosition.y}px`,
        width: '60px',
        height: '60px',
        zIndex: 9998,
        opacity: 0.7,
        pointerEvents: 'none',
        transition: 'all 3s ease-in-out',
        filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.5))',
      }}>
        <svg width="60" height="60" viewBox="-5.0 -10.0 110.0 135.0" style={{ width: '100%', height: '100%' }}>
          <path
            d="m45.16 40.871c0.33984-0.44922 0.53125-0.85938 0.69922-1.2891..."
            fill="rgba(255, 255, 255, 0.9)"
          />
        </svg>
      </div>

      {/* Halloween Particles */}
      <div style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: 9997,
        pointerEvents: 'none',
        background: `
          radial-gradient(2px 2px at 20px 30px, orange, transparent),
          radial-gradient(2px 2px at 40px 70px, orange, transparent),
          radial-gradient(1px 1px at 90px 40px, orange, transparent),
          radial-gradient(1px 1px at 130px 80px, orange, transparent),
          radial-gradient(2px 2px at 160px 30px, orange, transparent)
        `,
        backgroundSize: '200px 100px',
        animation: 'halloweenFloat 20s infinite linear',
      }} />

      <style>{`
        @keyframes halloweenFloat {
          0% { transform: translateY(100vh) rotate(0deg); }
          100% { transform: translateY(-100px) rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default HalloweenTheme;