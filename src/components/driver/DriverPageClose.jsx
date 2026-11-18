import { X } from 'lucide-react';
import Link from '@/lib/archive-navigation';
export default function DriverPageClose({ label = 'Fermer et revenir au menu chauffeur' }) {
  return <Link href="/driver/menu" className="driver-page-close" aria-label={label} title="Revenir au menu"><X size={21} aria-hidden="true" /></Link>;
}
