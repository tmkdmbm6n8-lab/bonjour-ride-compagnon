import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/archive-fetch';
import { money } from '@/components/ui/bits';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const LABELS = { pending: 'À valider', processing: 'Virement en cours', paid: 'Versé', rejected: 'Refusé', failed: 'Échec — recrédité' };
export default function WithdrawalRequests() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [selected, setSelected] = useState(null);
  const toast = useToast();
  async function load() {
    try {
      const response = await apiFetch('/api/admin/withdrawals');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chargement impossible');
      setData(result); setError('');
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, []);
  async function act() {
    if (busy || !selected) return;
    setBusy(true);
    try {
      const response = await apiFetch('/api/admin/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Traitement impossible');
      setSelected(null); toast('Demande traitée', 'success'); await load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  }
  return <section id="withdrawals" className="card card-pad mb-6 payout-card">
    <h2>Demandes de retrait</h2>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p className="muted">Chargement…</p>}
    {data && !data.available && <p className="muted">Le circuit de validation des retraits doit être activé dans Lovable.</p>}
    {data?.available && !data.requests.length && <p className="muted">Aucune demande.</p>}
    {data?.requests.map((row) => <article key={row.id} className="payout-request-row">
      <div><strong>{row.driver_name || 'Chauffeur'}</strong><p className="tiny muted">{new Intl.DateTimeFormat('fr-FR', {dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(row.created_at))} · {LABELS[row.status] || row.status}</p></div>
      <p>Débit à validation : <strong>{money(row.debit)}</strong> · Net versé : {money(row.amount)} · Frais : {money(row.fee)}</p>
      {['pending','processing'].includes(row.status) && <div className="flex gap-2 wrap">
        <button className="btn btn-primary" disabled={busy} onClick={() => setSelected({id: row.id, action: 'approve', debit: row.debit})}>{row.status === 'processing' ? 'Reprendre le virement' : 'Valider le retrait'}</button>
        {row.status === 'pending' && <button className="btn btn-secondary" disabled={busy} onClick={() => setSelected({id: row.id, action:'reject'})}>Refuser</button>}
      </div>}
    </article>)}
    <Modal open={Boolean(selected)} onClose={() => { if (!busy) setSelected(null); }} title="Confirmer le traitement" portal keyboardSafe sheetOnMobile={false} closable={!busy}>
      <p>{selected?.action === 'approve' ? `Valider le débit de ${money(selected.debit)} et lancer le virement ?` : 'Refuser cette demande sans débiter le chauffeur ?'}</p>
      <button className="btn btn-primary btn-full mt-3" disabled={busy} onClick={act}>{busy ? 'Traitement…' : 'Confirmer'}</button>
    </Modal>
  </section>;
}
