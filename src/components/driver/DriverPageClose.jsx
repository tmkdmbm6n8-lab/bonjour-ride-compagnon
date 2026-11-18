import CloseControl from '@/components/ui/CloseControl';
export default function DriverPageClose({ label = 'Fermer et revenir au menu chauffeur' }) {
  return <CloseControl href="/driver/menu" className="driver-page-close" label={label} title="Revenir au menu" />;
}
