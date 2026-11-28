'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X, ScanLine } from 'lucide-react';

function invitationUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.origin !== window.location.origin || url.pathname.replace(/\/$/, '') !== '/join') {
      throw new Error('Ce QR code ne provient pas de StrasDrive.');
    }
    const token = new URLSearchParams(url.hash.slice(1)).get('invite');
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invitation invalide.');
    return '/join#invite=' + encodeURIComponent(token);
  } catch (error) {
    throw new Error(error.message?.includes('StrasDrive') ? error.message : 'Ce QR code ne contient pas une invitation chauffeur valide.');
  }
}

export default function FavoriteQrScanner({ onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const activeRef = useRef(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    activeRef.current = true;
    let timer;
    let detector;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('La caméra nécessite un navigateur sécurisé (HTTPS).');
        if (!('BarcodeDetector' in window)) throw new Error('Le scanner intégré n’est pas disponible sur ce navigateur. Vous pouvez scanner le QR code avec l’appareil photo de votre téléphone.');
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!activeRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStarting(false);
        const scan = async () => {
          if (!activeRef.current || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length) {
              const destination = invitationUrl(codes[0].rawValue);
              activeRef.current = false;
              stream.getTracks().forEach(track => track.stop());
              window.location.assign(destination);
              return;
            }
          } catch (err) {
            if (err.message?.includes('QR code') || err.message?.includes('invitation') || err.message?.includes('StrasDrive')) setError(err.message);
          }
          if (activeRef.current) timer = window.setTimeout(scan, 220);
        };
        scan();
      } catch (err) {
        if (activeRef.current) { setError(err.message || 'Impossible d’ouvrir la caméra.'); setStarting(false); }
      }
    }
    start();
    return () => {
      activeRef.current = false;
      window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scanner le QR code du chauffeur"
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#090b10', color: '#fff', display: 'flex', flexDirection: 'column', padding: 'max(env(safe-area-inset-top), 24px) 20px max(env(safe-area-inset-bottom), 24px)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Scanner un chauffeur</h2>
        <button type="button" onClick={onClose} aria-label="Fermer le scanner" style={{ border: 0, background: '#252932', borderRadius: 12, color: '#fff', padding: 10 }}><X size={22} /></button>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 0 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '1', border: '2px solid #eab308', borderRadius: 24, overflow: 'hidden', background: '#151922' }}>
          <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {starting && <ScanLine size={46} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.7 }} />}
        </div>
      </div>
      <p style={{ textAlign: 'center', margin: '20px auto 8px', maxWidth: 340 }}>Placez le QR code affiché par le chauffeur dans le cadre.</p>
      {error && <p role="alert" style={{ textAlign: 'center', color: '#fda4af', margin: '0 auto 14px', maxWidth: 350 }}>{error}</p>}
      <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>Vous confirmerez votre choix avant tout changement de favori.</p>
    </div>
  );
}
