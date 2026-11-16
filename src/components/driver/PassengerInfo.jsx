import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/bits';
import { passengerDisplayName } from '@/lib/passenger-name';

export default function PassengerInfo({ ride }) {
  const [open, setOpen] = useState(false);
  const rider = ride.rider || {};
  const name = passengerDisplayName(rider.name);
  const rating = Number.isFinite(rider.rating) ? rider.rating.toFixed(1) : '—';
  return <>
    <button type="button" className="drv-client-meta drv-passenger-info-button" onClick={() => setOpen(true)} aria-label={`Informations du passager ${name}`}>
      <span className="drv-client-avatar"><Avatar name={name} src={rider.avatar} /></span>
      <span><span className="drv-client-name">{name}</span><span className="drv-client-rating">★ {rating}</span></span>
    </button>
    <Modal open={open} onClose={() => setOpen(false)} title="Informations du passager">
      <div className="passenger-info-profile"><Avatar name={name} src={rider.avatar} size="lg" /><strong>{name}</strong><span>★ {rating}</span></div>
      <dl className="passenger-info-details">
        <dt>Téléphone</dt><dd>{rider.phone ? <a href={`tel:${rider.phone}`}>{rider.phone}</a> : 'Non renseigné'}</dd>
        <dt>Prise en charge</dt><dd>{ride.pickup?.address || 'Non renseignée'}</dd>
        <dt>Destination</dt><dd>{ride.dropoff?.address || 'Non renseignée'}</dd>
      </dl>
    </Modal>
  </>;
}
