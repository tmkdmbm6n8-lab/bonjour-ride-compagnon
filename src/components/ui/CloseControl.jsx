import { forwardRef } from 'react';
import { playSound } from '@/lib/sounds';
import { X } from 'lucide-react';
import Link from '@/lib/archive-navigation';

/** Shared visual control; preserve each page's own close/return action. */
const CloseControl = forwardRef(function CloseControl({ href = null, label = 'Fermer', className = '', silent = false, onClick, ...props }, ref) {
  const shared = { ...props, onClick: (event) => { if (!silent && !props.disabled) playSound('offer-dismissed'); onClick?.(event); }, ref, className: `sd-close-control ${className}`.trim(), 'aria-label': label };
  return href ? <Link href={href} {...shared}><X size={21} aria-hidden="true" /></Link> : <button type="button" {...shared}><X size={21} aria-hidden="true" /></button>;
});
export default CloseControl;
