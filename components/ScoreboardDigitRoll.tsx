'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ScoreboardDigitRollProps {
  value: number;
  isGoal?: boolean;
  accentColor?: string;
}

export default function ScoreboardDigitRoll({
  value,
  isGoal = false,
  accentColor = '#10B981',
}: ScoreboardDigitRollProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [isAnimating, setIsAnimating] = useState(false);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (value !== displayValue) {
      setPrevValue(displayValue);
      setDirection(value > displayValue ? 'up' : 'down');
      setIsAnimating(true);
      setDisplayValue(value);

      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPrevValue(null);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [value, displayValue]);

  return (
    <div
      style={{
        position: 'relative',
        width: '68px',
        height: '84px',
        background: 'linear-gradient(180deg, #0c121d 0%, #040609 100%)',
        borderRadius: '12px',
        border: `1.5px solid ${isGoal ? '#F59E0B' : 'rgba(255, 255, 255, 0.14)'}`,
        boxShadow: isGoal
          ? `inset 0 0 20px rgba(245, 158, 11, 0.4), 0 0 25px rgba(245, 158, 11, 0.35)`
          : 'inset 0 2px 10px rgba(0, 0, 0, 0.8), 0 4px 12px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
      }}
    >
      {/* Stadium LED Scanline Filter Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0, 0, 0, 0.4) 3px, rgba(0, 0, 0, 0.4) 5px)',
          pointerEvents: 'none',
          zIndex: 4,
          opacity: 0.6,
        }}
      />

      {/* Horizontal Divider Slot (Mechanical Split-Flap Appearance) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.08)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
          zIndex: 5,
        }}
      />

      {/* Outgoing Digit (When Score Updates) */}
      {isAnimating && prevValue !== null && (
        <div
          className="digit-roll-item"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-heading)',
            fontSize: '3.6rem',
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1,
            animation:
              direction === 'up'
                ? 'digitRollOutUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                : 'digitRollOutDown 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            zIndex: 1,
          }}
        >
          {prevValue}
        </div>
      )}

      {/* Incoming / Current Digit */}
      <div
        className="digit-roll-item"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-heading)',
          fontSize: '3.6rem',
          fontWeight: 900,
          color: isGoal ? '#F59E0B' : '#FFFFFF',
          textShadow: isGoal
            ? '0 0 25px #F59E0B, 0 0 10px #FFFFFF'
            : '0 0 15px rgba(255, 255, 255, 0.25)',
          lineHeight: 1,
          animation: isAnimating
            ? direction === 'up'
              ? 'digitRollInUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
              : 'digitRollInDown 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            : 'none',
          zIndex: 2,
          transition: 'color 0.3s ease, text-shadow 0.3s ease',
        }}
      >
        {displayValue}
      </div>
    </div>
  );
}
