'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CloseControl from './CloseControl';
import useVisualViewport from '@/hooks/useVisualViewport';

export default function Modal({
  open,
  onClose,
  title,
  children,
  sheetOnMobile = true,
  closable = true,
  maxWidth = 440,
  fullScreen = false,
  className = '',
  portal = false, // escape map/sheet stacking contexts for critical confirmations
  keyboardSafe = false, // keep the dialog inside the area above the phone keyboard
}) {
  const vv = useVisualViewport(open && keyboardSafe);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && closable) closeRef.current?.();
    };
    document.addEventListener('keydown', onKey);
    const body = document.body;
    const previous = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    const scrollY = window.scrollY;
    body.style.overflow = 'hidden';
    if (portal) {
      body.style.position = 'fixed';
      body.style.top = `-${scrollY}px`;
      body.style.width = '100%';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      Object.assign(body.style, previous);
      if (portal) window.scrollTo(0, scrollY);
    };
  }, [open, closable, portal]);

  if (!open) return null;

  const dialog = (
    <div
      className={`overlay ${portal ? 'modal-portal-overlay' : ''} ${sheetOnMobile && !keyboardSafe && !fullScreen ? 'sheet-on-mobile' : ''} ${fullScreen ? 'modal-fullscreen-overlay' : ''}`}
      style={{ ...(vv ? { top: vv.top, height: vv.height, bottom: 'auto', alignItems: portal ? 'center' : 'flex-start', paddingTop: 16 } : {}), ...(fullScreen ? { padding: 0, alignItems: 'stretch' } : {}) }}
      onClick={closable ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Boîte de dialogue'}
    >
      <div
        className={`modal modal-pad ${fullScreen ? 'modal-fullscreen' : ''} ${className}`}
        style={{ maxWidth: fullScreen ? '100%' : maxWidth, ...(fullScreen ? { height: '100%', maxHeight: '100%' } : vv ? { maxHeight: vv.height - 32 } : {}) }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || closable) && (
          <div className="modal-header flex items-center justify-between mb-4">
            {title ? <h3 style={{ fontSize: '1.15rem' }}>{title}</h3> : <span />}
            {closable && (
              <CloseControl onClick={onClose} label="Fermer la boîte de dialogue" />
            )}
          </div>
        )}
        {portal ? <div className="modal-body">{children}</div> : children}
      </div>
    </div>
  );
  return portal && typeof document !== 'undefined'
    ? createPortal(<div className="shell-dark modal-portal-root">{dialog}</div>, document.body)
    : dialog;
}
