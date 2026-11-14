import { useState } from 'react';
import { BellRing } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { VEHICLE_LABELS } from '@/components/ui/bits';
import { apiFetch as fetch } from '@/lib/archive-fetch';

/** Envoie une demande de course fictive à un chauffeur choisi, pour tester la notification. */
export default function TestRideButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState(null);
  const [driverId, setDriverId] = useState('');
  const [sending, setSending] = useState(false);

  async function openModal() {
    setOpen(true);
    try {
      const res = await fetch('/api/admin/drivers');
      const list = (await res.json()).drivers || [];
      setDrivers(list);
      if (!list.some((d) => d._id === driverId)) setDriverId(list[0]?._id || '');
    } catch {
      setDrivers([]);
    }
  }

  async function send() {
    setSending(true);
    try {
      const res = await fetch('/api/admin/test-ride', { method: 'POST', body: JSON.stringify({ driverId }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Envoi impossible');
      toast(`Demande test envoyée : visible ${j.expiresInSeconds} s sur l’écran du chauffeur`, 'success', 5000);
      setOpen(false);
    } catch (e) {
      toast(e.message || 'Envoi impossible', 'error', 5000);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary btn-sm" onClick={openModal}>
        <BellRing size={15} /> Envoyer une demande test
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Demande de course test">
        <p className="small muted mb-4">
          Le chauffeur choisi reçoit une fausse demande sur son écran, même hors ligne. Aucun paiement ni statistique :
          il peut l’accepter et faire tout le parcours (code PIN 0000).
        </p>
        {drivers === null && <p className="small muted">Chargement des chauffeurs…</p>}
        {drivers && drivers.length === 0 && <p className="small muted">Aucun chauffeur inscrit pour le moment.</p>}
        {drivers && drivers.length > 0 && (
          <>
            <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }} htmlFor="test-ride-driver">
              Chauffeur
            </label>
            <select id="test-ride-driver" className="input mb-4" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
              {drivers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.userId?.name || 'Chauffeur'}
                  {d.userId?.username ? ` (@${d.userId.username})` : ''} · {VEHICLE_LABELS[d.vehicleClass] || d.vehicleClass}
                  {d.isOnline ? ' · en ligne' : ' · hors ligne'}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-lg btn-full" disabled={!driverId || sending} onClick={send}>
              {sending ? <span className="spinner" /> : <><BellRing size={17} /> Envoyer la demande</>}
            </button>
          </>
        )}
      </Modal>
    </>
  );
}
