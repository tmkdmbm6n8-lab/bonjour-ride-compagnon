import { useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/lib/archive-fetch';
import { DRIVER_REPORT_REASONS } from '@/lib/driver-reports';

export default function ReportDriverButton({ ride }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  async function submit(e) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(`/api/rides/${encodeURIComponent(ride.id)}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Le signalement n’a pas pu être envoyé. Réessayez.');
      setSent(true);
    } catch (err) {
      setError(err.message || 'Vérifiez votre connexion puis réessayez.');
    } finally { pending.current = false; setBusy(false); }
  }
  return <>
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><Flag size={16} />Signaler le chauffeur</button>
    <Modal portal keyboardSafe sheetOnMobile={false} open={open} onClose={() => { if (!pending.current) setOpen(false); }} closable={!busy} title="Signaler le chauffeur">
      {sent ? <div role="status"><p>Votre signalement a été envoyé à l’assistance StrasDrive.</p><button className="btn btn-secondary btn-full mt-4" onClick={() => setOpen(false)}>Fermer</button></div> : <form onSubmit={submit} className="driver-report-form">
        <p className="small">Choisissez le motif qui correspond à la situation.</p>
        <p className="tiny muted">En cas de danger immédiat, appelez le <a href="tel:112">112</a>. Ce formulaire ne prévient pas les secours.</p>
        <fieldset disabled={busy} className="driver-report-reasons">
          <legend>Motif du signalement</legend>
          {DRIVER_REPORT_REASONS.map(([value, label]) => <label key={value} className="driver-report-reason"><input type="radio" name="driver-report-reason" required value={value} checked={reason === value} onChange={() => setReason(value)} /><span>{label}</span></label>)}
        </fieldset>
        <label className="small" htmlFor={`report-details-${ride.id}`}>{reason === 'other' ? 'Précisez votre signalement (obligatoire)' : 'Précisions (facultatif)'}</label>
        <textarea id={`report-details-${ride.id}`} className="input" rows={3} maxLength={2000} required={reason === 'other'} minLength={reason === 'other' ? 10 : undefined} value={details} onChange={e => setDetails(e.target.value)} disabled={busy} />
        {error && <p role="alert" className="small">{error}</p>}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy || !reason || (reason === 'other' && details.trim().length < 10)}>{busy ? 'Envoi…' : 'Envoyer le signalement'}</button>
      </form>}
    </Modal>
  </>;
}
