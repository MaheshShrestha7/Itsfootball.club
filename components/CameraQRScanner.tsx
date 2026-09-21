'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface CameraQRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onError?: (errorMessage: string) => void;
  isActive?: boolean;
  scannerId?: string;
  fps?: number;
  qrboxSize?: number;
}

export default function CameraQRScanner({
  onScanSuccess,
  onError,
  isActive = true,
  scannerId = 'itsfootball-qr-reader',
  fps = 10,
  qrboxSize = 250,
}: CameraQRScannerProps) {
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'scanning' | 'error' | 'permission_denied'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const containerIdRef = useRef<string>(`${scannerId}-${Math.random().toString(36).substring(2, 7)}`);
  const lastScannedTextRef = useRef<string>('');
  const scanCooldownRef = useRef<boolean>(false);

  // Play a turnstile chime on scan success
  const playScanBeep = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(1046.5, now); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Graceful fallback
    }
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    if (scanCooldownRef.current) return;
    if (decodedText === lastScannedTextRef.current) return;

    scanCooldownRef.current = true;
    lastScannedTextRef.current = decodedText;
    playScanBeep();
    onScanSuccess(decodedText);

    // Cooldown 2 seconds before allowing the exact same code
    setTimeout(() => {
      scanCooldownRef.current = false;
      lastScannedTextRef.current = '';
    }, 2000);
  }, [onScanSuccess, playScanBeep]);

  // Start scanner helper
  const startScanner = useCallback(async (cameraIdOrConfig: any) => {
    const element = document.getElementById(containerIdRef.current);
    if (!element) return;

    try {
      setCameraState('starting');
      setErrorMessage('');

      // Stop existing instance if running
      if (scannerRef.current && isScanningRef.current) {
        try {
          await scannerRef.current.stop();
          isScanningRef.current = false;
        } catch {
          // Ignore stop errors during transition
        }
      }

      const html5QrCode = scannerRef.current || new Html5Qrcode(containerIdRef.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: fps,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const boxSize = Math.max(180, Math.min(qrboxSize, Math.floor(minEdge * 0.75)));
          return { width: boxSize, height: boxSize };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        cameraIdOrConfig,
        config,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Ignore regular non-detection frames
        }
      );

      isScanningRef.current = true;
      setCameraState('scanning');
    } catch (err: any) {
      console.warn('QR Camera initialization error:', err);
      isScanningRef.current = false;
      const errStr = String(err?.message || err || '');
      if (errStr.toLowerCase().includes('permission') || errStr.toLowerCase().includes('notallowed')) {
        setCameraState('permission_denied');
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser settings.');
      } else {
        setCameraState('error');
        setErrorMessage(err?.message || 'Unable to access device camera.');
      }
      if (onError) onError(errStr);
    }
  }, [fps, qrboxSize, handleScanSuccess, onError]);

  // Stop scanner helper
  const stopScanner = useCallback(async () => {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop();
        isScanningRef.current = false;
      } catch (err) {
        console.warn('Error stopping QR scanner:', err);
      }
    }
    setCameraState('idle');
  }, []);

  // Discover cameras on mount
  useEffect(() => {
    let isMounted = true;

    Html5Qrcode.getCameras()
      .then(devices => {
        if (isMounted && devices && devices.length) {
          setCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0, 4)}` })));
          // Choose back/environment camera by default if available
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch(err => {
        console.warn('Could not enumerate cameras:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Manage scanner lifecycle based on isActive and selected camera
  useEffect(() => {
    if (!isActive) {
      stopScanner();
      return;
    }

    // Prefer environment facing mode if no specific camera selected yet
    const camConfig = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: 'environment' };
    startScanner(camConfig);

    return () => {
      if (scannerRef.current && isScanningRef.current) {
        scannerRef.current.stop().then(() => {
          isScanningRef.current = false;
        }).catch(() => {});
      }
    };
  }, [isActive, selectedCameraId, startScanner, stopScanner]);

  const handleRetry = () => {
    const camConfig = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: 'environment' };
    startScanner(camConfig);
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Viewport Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '380px',
          aspectRatio: '1/1',
          background: '#040609',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '2px solid rgba(16, 185, 129, 0.4)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(16, 185, 129, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* HTML5 QR Scanner DOM Container */}
        <div
          id={containerIdRef.current}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Optical Scanning HUD Overlay */}
        {cameraState === 'scanning' && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
            {/* 4 Optical Corner Brackets */}
            <div className="turnstile-corner turnstile-corner-tl" />
            <div className="turnstile-corner turnstile-corner-tr" />
            <div className="turnstile-corner turnstile-corner-bl" />
            <div className="turnstile-corner turnstile-corner-br" />

            {/* Matrix Optical Grid */}
            <div className="scanner-optical-grid" />

            {/* Animated Laser Beam */}
            <div className="scanner-laser-line" />
            <div className="scanner-laser-glow" />

            {/* Target indicator text */}
            <div style={{
              position: 'absolute',
              bottom: '14px',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#FFFFFF',
              textShadow: '0 2px 8px rgba(0,0,0,0.9)',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}>
              <span className="pulse-dot" style={{ background: '#10B981', width: '7px', height: '7px' }} />
              <span>POINT CAMERA AT QR CODE OR BARCODE</span>
            </div>
          </div>
        )}

        {/* Starting / Loading Overlay */}
        {cameraState === 'starting' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(4, 6, 9, 0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            zIndex: 12,
            padding: '1.5rem',
            textAlign: 'center',
          }}>
            <RefreshCw size={32} color="#10B981" className="animate-spin" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF' }}>
              Initializing Stadium Camera Stream...
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Requesting hardware optical sensor
            </span>
          </div>
        )}

        {/* Error / Permission Denied Overlay */}
        {(cameraState === 'error' || cameraState === 'permission_denied') && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(10, 15, 23, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            zIndex: 15,
            padding: '1.5rem',
            textAlign: 'center',
          }}>
            <AlertCircle size={36} color="#EF4444" />
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#FFFFFF' }}>
              {cameraState === 'permission_denied' ? 'Camera Access Denied' : 'Optical Sensor Unavailable'}
            </span>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {errorMessage || 'Unable to access device camera. Please check browser permissions or enter pass token manually.'}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem' }}
            >
              <RefreshCw size={13} />
              <span>Retry Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* Camera Selection Dropdown (if multiple cameras available) */}
      {cameras.length > 1 && cameraState === 'scanning' && (
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Camera size={14} color="var(--text-muted)" />
          <select
            value={selectedCameraId}
            onChange={e => setSelectedCameraId(e.target.value)}
            className="form-select"
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', width: 'auto' }}
          >
            {cameras.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
