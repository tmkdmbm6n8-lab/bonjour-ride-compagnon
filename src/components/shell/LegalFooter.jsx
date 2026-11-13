import Link from '@/lib/archive-navigation';

/**
 * Compact legal footer for auth screens and other minimal pages.
 */
export default function LegalFooter({ className = '' }) {
  return (
    <div
      className={`flex items-center justify-center gap-4 tiny muted ${className}`}
      style={{ flexWrap: 'wrap' }}
    >
      <Link href="/terms" style={{ textDecoration: 'underline' }}> Conditions </Link>
      <Link href="/privacy" style={{ textDecoration: 'underline' }}> Confidentialité </Link>
      <Link href="/contact" style={{ textDecoration: 'underline' }}> Contact </Link>
      <span>© {new Date().getFullYear()} Kova</span>
    </div>
  );
}
