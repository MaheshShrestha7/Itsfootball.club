'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import './HeroTopBinsBackdrop.css';

interface BallShot {
  id: number;
  target: 'left' | 'right';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startTime: number;
}

interface FloatingScore {
  id: number;
  text: string;
  x: number;
  y: number;
  target: 'left' | 'right';
}

interface HeroTopBinsBackdropProps {
  shotNonce?: number;
  primaryColor?: string;
  accentColor?: string;
  onGoalScored?: (target: 'left' | 'right', streak: number) => void;
}

export default function HeroTopBinsBackdrop({
  shotNonce = 0,
  primaryColor,
  accentColor,
  onGoalScored,
}: HeroTopBinsBackdropProps) {
  const [shots, setShots] = useState<BallShot[]>([]);
  const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
  const [netRipple, setNetRipple] = useState<'left' | 'right' | null>(null);
  const [postRattle, setPostRattle] = useState(false);
  const [streak, setStreak] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const lastNonce = useRef(shotNonce);

  // Target coordinates within the SVG viewBox 0 0 1000 500
  const TARGET_COORDS = {
    left: { x: 340, y: 145 },
    right: { x: 860, y: 145 },
  };

  const fireShot = useCallback((target: 'left' | 'right' = 'right', customStart?: { x: number; y: number }) => {
    const id = nextId.current++;
    const coords = TARGET_COORDS[target];
    const startX = customStart ? customStart.x : (target === 'left' ? 440 : 660);
    const startY = customStart ? customStart.y : 480;

    setHasInteracted(true);
    setShots(prev => [...prev, {
      id,
      target,
      startX,
      startY,
      targetX: coords.x,
      targetY: coords.y,
      startTime: Date.now(),
    }]);

    // Ball flight takes 520ms to hit top bins
    setTimeout(() => {
      // Impact physics
      setNetRipple(target);
      setPostRattle(true);

      // Score particle & streak
      setStreak(s => {
        const nextStreak = s + 1;
        const text = nextStreak > 3 ? `🔥 TOP BINS x${nextStreak}!` : nextStreak > 1 ? `TOP BINS x${nextStreak}!` : '+50 TOP BINS!';
        setFloatingScores(scores => [
          ...scores,
          { id, text, x: coords.x, y: coords.y, target },
        ]);
        if (onGoalScored) onGoalScored(target, nextStreak);
        return nextStreak;
      });

      // Haptic bump if supported on mobile
      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        try { navigator.vibrate([20, 30, 20]); } catch { /* ignore */ }
      }

      // Settle net and post
      setTimeout(() => setPostRattle(false), 140);
      setTimeout(() => setNetRipple(null), 360);

      // Remove ball after animation completes (950ms total)
      setTimeout(() => {
        setShots(prev => prev.filter(s => s.id !== id));
      }, 430);

      // Remove floating score
      setTimeout(() => {
        setFloatingScores(prev => prev.filter(s => s.id !== id));
      }, 1200);
    }, 520);
  }, [onGoalScored]);

  // Trigger from parent prop (e.g. touchline "Goal!" button)
  useEffect(() => {
    if (shotNonce > lastNonce.current) {
      lastNonce.current = shotNonce;
      const target: 'left' | 'right' = shotNonce % 2 === 0 ? 'left' : 'right';
      fireShot(target);
    }
  }, [shotNonce, fireShot]);

  // Initial ambient demonstration shot on first load after 900ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        fireShot('right');
      }
    }, 950);
    return () => clearTimeout(timer);
  }, [hasInteracted, fireShot]);

  return (
    <div
      ref={containerRef}
      className={`hero-top-bins-canvas ${postRattle ? 'is-rattling' : ''}`}
      aria-hidden="true"
      style={{
        '--goal-p': primaryColor || 'var(--lp-p, #10B981)',
        '--goal-a': accentColor || 'var(--lp-a, #F59E0B)',
      } as React.CSSProperties}
    >
      {/* Stadium atmospheric lighting */}
      <div className="goal-floodlights" />
      <div className="goal-turf-gradient" />

      {/* SVG Goal Post and Net */}
      <svg
        className="goal-svg"
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Radial floodlight beams */}
          <radialGradient id="floodlight-beam" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="var(--goal-p)" stopOpacity="0.22" />
            <stop offset="50%" stopColor="var(--goal-p)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>

          {/* Hex net pattern */}
          <pattern id="hex-net" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
            <path
              d="M 14 0 L 28 8 L 28 20 L 14 28 L 0 20 L 0 8 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeOpacity="0.28"
            />
          </pattern>

          {/* Target pulsing glow filter */}
          <filter id="neon-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Metallic goal post gradient */}
          <linearGradient id="post-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8A99AD" />
            <stop offset="35%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          <linearGradient id="crossbar-sheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8A99AD" />
            <stop offset="35%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          {/* Ball Soccer 3D Sphere */}
          <radialGradient id="ball-lighting" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="55%" stopColor="#E2E8F0" />
            <stop offset="85%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
        </defs>

        {/* Ambient spotlight cone */}
        <polygon points="150,-40 1050,-40 920,440 280,440" fill="url(#floodlight-beam)" />

        {/* --- GOAL NET STRUCTURE --- */}
        <g className="goal-net-mesh" style={{ color: 'var(--goal-p)' }}>
          {/* Back Netting Plane */}
          <polygon
            points="340,95 860,95 820,380 380,380"
            fill="url(#hex-net)"
            className="net-plane net-back"
          />
          {/* Roof Netting Plane */}
          <polygon
            points="300,120 900,120 860,95 340,95"
            fill="url(#hex-net)"
            className="net-plane net-roof"
          />
          {/* Left Net Side */}
          <polygon
            points="300,120 340,95 380,380 300,420"
            fill="url(#hex-net)"
            className={`net-plane net-left ${netRipple === 'left' ? 'is-rippling-left' : ''}`}
          />
          {/* Right Net Side */}
          <polygon
            points="900,120 860,95 820,380 900,420"
            fill="url(#hex-net)"
            className={`net-plane net-right ${netRipple === 'right' ? 'is-rippling-right' : ''}`}
          />
        </g>

        {/* Back Stanchion Support Posts */}
        <path
          d="M 300 120 L 340 95 L 380 380 L 300 420
             M 900 120 L 860 95 L 820 380 L 900 420
             M 340 95 L 860 95
             M 380 380 L 820 380"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* --- MAIN GOAL FRAME (High Realism Metal) --- */}
        <g className="goal-frame">
          {/* Ground Pitch Line */}
          <line x1="180" y1="420" x2="1020" y2="420" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          <line x1="300" y1="420" x2="900" y2="420" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />

          {/* Left Upright Post */}
          <rect
            x="294"
            y="114"
            width="12"
            height="306"
            rx="5"
            fill="url(#post-sheen)"
            filter="drop-shadow(0 4px 8px rgba(0,0,0,0.7))"
          />

          {/* Right Upright Post */}
          <rect
            x="894"
            y="114"
            width="12"
            height="306"
            rx="5"
            fill="url(#post-sheen)"
            filter="drop-shadow(0 4px 8px rgba(0,0,0,0.7))"
          />

          {/* Crossbar */}
          <rect
            x="294"
            y="114"
            width="612"
            height="12"
            rx="5"
            fill="url(#crossbar-sheen)"
            filter="drop-shadow(0 4px 8px rgba(0,0,0,0.7))"
          />

          {/* Corner Welding Elbow Brackets */}
          <circle cx="300" cy="120" r="7" fill="#CBD5E1" />
          <circle cx="900" cy="120" r="7" fill="#CBD5E1" />
        </g>

        {/* --- INTERACTIVE TOP BINS TARGETS --- */}
        {/* Left Top Bin Target */}
        <g
          className="top-bin-target target-left"
          onClick={() => fireShot('left')}
          role="button"
          tabIndex={0}
          aria-label="Shoot soccer ball into Left Top Bin"
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fireShot('left')}
        >
          <circle cx="340" cy="150" r="34" className="target-ring-outer" stroke="var(--goal-a)" />
          <circle cx="340" cy="150" r="22" className="target-ring-inner" stroke="var(--goal-a)" />
          <circle cx="340" cy="150" r="6" fill="var(--goal-a)" filter="url(#neon-glow)" />
          <text x="340" y="196" textAnchor="middle" className="target-label">
            TOP BIN 90°
          </text>
        </g>

        {/* Right Top Bin Target */}
        <g
          className="top-bin-target target-right"
          onClick={() => fireShot('right')}
          role="button"
          tabIndex={0}
          aria-label="Shoot soccer ball into Right Top Bin"
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && fireShot('right')}
        >
          <circle cx="860" cy="150" r="34" className="target-ring-outer" stroke="var(--goal-a)" />
          <circle cx="860" cy="150" r="22" className="target-ring-inner" stroke="var(--goal-a)" />
          <circle cx="860" cy="150" r="6" fill="var(--goal-a)" filter="url(#neon-glow)" />
          <text x="860" y="196" textAnchor="middle" className="target-label">
            TOP BIN 90°
          </text>
        </g>

        {/* --- DYNAMIC BALLS IN FLIGHT --- */}
        {shots.map(shot => {
          const deltaX = shot.targetX - shot.startX;
          const deltaY = shot.targetY - shot.startY;
          return (
            <g
              key={shot.id}
              className={`ball-flight-group ${shot.target === 'left' ? 'is-left-arc' : 'is-right-arc'}`}
              style={{
                '--start-x': `${shot.startX}px`,
                '--start-y': `${shot.startY}px`,
                '--delta-x': `${deltaX}px`,
                '--delta-y': `${deltaY}px`,
              } as React.CSSProperties}
            >
              {/* Ball luminous tail */}
              <ellipse cx="0" cy="0" rx="20" ry="10" className="ball-trail-flare" fill="var(--goal-p)" />

              {/* Realistic Soccer Ball */}
              <g className="soccer-ball-mesh">
                {/* 3D Sphere Body */}
                <circle cx="0" cy="0" r="20" fill="url(#ball-lighting)" stroke="#FFFFFF" strokeWidth="0.8" />

                {/* Classic Soccer Ball Pentagon Panels */}
                {/* Center Pentagon */}
                <polygon points="0,-7 6,-2 4,6 -4,6 -6,-2" fill="#1E293B" />

                {/* Surrounding Radiating Panels */}
                <line x1="0" y1="-7" x2="0" y2="-17" stroke="#334155" strokeWidth="1.6" />
                <polygon points="-5,-18 5,-18 0,-14" fill="#0F172A" />

                <line x1="6" y1="-2" x2="16" y2="-5" stroke="#334155" strokeWidth="1.6" />
                <polygon points="16,-5 19,3 13,0" fill="#0F172A" />

                <line x1="4" y1="6" x2="12" y2="15" stroke="#334155" strokeWidth="1.6" />
                <polygon points="12,15 5,18 8,11" fill="#0F172A" />

                <line x1="-4" y1="6" x2="-12" y2="15" stroke="#334155" strokeWidth="1.6" />
                <polygon points="-12,15 -5,18 -8,11" fill="#0F172A" />

                <line x1="-6" y1="-2" x2="-16" y2="-5" stroke="#334155" strokeWidth="1.6" />
                <polygon points="-16,-5 -19,3 -13,0" fill="#0F172A" />

                {/* Specular light glint */}
                <circle cx="-6" cy="-8" r="3.5" fill="#FFFFFF" opacity="0.8" />
              </g>
            </g>
          );
        })}
      </svg>

      {/* Floating score & streak celebratory tags */}
      {floatingScores.map(score => (
        <div
          key={score.id}
          className={`floating-top-bin-score ${score.target === 'left' ? 'is-left' : 'is-right'}`}
        >
          <span className="score-badge">{score.text}</span>
        </div>
      ))}

      {/* On-screen quick interactive trigger chip for mobile/desktop */}
      <div className="hero-top-bins-controls" aria-label="Interactive soccer shoot controls">
        <button
          type="button"
          className="hero-shoot-btn"
          onClick={() => fireShot('left')}
          title="Shoot top-bins in top left corner"
        >
          <span className="shoot-ball">⚽</span> Shoot Top Bin (L)
        </button>
        <button
          type="button"
          className="hero-shoot-btn"
          onClick={() => fireShot('right')}
          title="Shoot top-bins in top right corner"
        >
          <span className="shoot-ball">⚽</span> Shoot Top Bin (R)
        </button>
        {streak > 1 && (
          <span className="hero-streak-indicator">
            🔥 {streak} in a row
          </span>
        )}
      </div>
    </div>
  );
}
