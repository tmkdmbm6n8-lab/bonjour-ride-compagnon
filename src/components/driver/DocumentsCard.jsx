import { useCallback, useEffect, useState } from 'react';
import { FileCheck2, Upload, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { apiFetch as fetch } from '@/lib/archive-fetch';
import { useToast } from '@/components/ui/Toast';
import {
  DRIVER_DOCUMENTS, DOCUMENTS_BUCKET, MAX_DOCUMENT_BYTES, ACCEPTED_DOCUMENT_TYPES,
  dateLabel, documentState,
} from '@/lib/vtc-documents';

export const STATE_BADGES = {
  missing: ['badge-neutral', 'À fournir'],
  pending: ['badge-info', 'En vérification'],
  approved: ['badge-success', 'Validé'],
  expiring: ['badge-warning', 'Expire bientôt'],
  rejected: ['badge-danger', 'Refusé'],
  expired: ['badge-danger', 'Expiré'],
};

export const frDate = (iso) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : '');

function DocumentRow({ spec, doc, onSaved }) {
  const toast = useToast();
  const state = documentState(doc);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [date, setDate] = useState('');
  const [number, setNumber] = useState(doc?.number || '');
  const [busy, setBusy] = useState(false);
  const [badge, badgeLabel] = STATE_BADGES[state];

  async function submit(e) {
    e.preventDefault();
    if (!file) return toast('Choisissez un fichier', 'error');
    if (file.size > MAX_DOCUMENT_BYTES) return toast('Fichier trop lourd (10 Mo maximum)', 'error');
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) return toast('Format accepté : PDF, JPG, PNG ou WebP', 'error');
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
      const path = `${user.id}/${spec.type}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw new Error('Envoi du fichier impossible');
      const res = await fetch('/api/drivers/me/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: spec.type, path, fileName: file.name, date, number }),
      });
      const data = await res.json();
      if (!res.ok) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        throw new Error(data.error || 'Document refusé');
      }
      toast('Document envoyé : il sera vérifié par StrasDrive', 'success');
      setOpen(false); setFile(null); setDate('');
      onSaved(data);
    } catch (err) {
      toast(err.message || 'Envoi impossible', 'error', 6000);
    } finally {
      setBusy(false);
    }
  }

  const label = dateLabel(spec);
  return (
    <li style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div className="small" style={{ fontWeight: 600 }}>
            {spec.label}{!spec.required && <span className="muted tiny"> · facultatif</span>}
          </div>
          <div className="tiny muted mt-1">{spec.hint}</div>
          {doc && (
            <div className="tiny muted mt-1">
              {doc.fileName}{doc.number ? ` · ${doc.number}` : ''}{doc.validUntil ? ` · valable jusqu’au ${frDate(doc.validUntil)}` : ''}
            </div>
          )}
          {state === 'rejected' && doc.rejectionReason && (
            <div className="tiny mt-1" style={{ color: 'var(--danger)' }}>Motif : {doc.rejectionReason}</div>
          )}
        </div>
        <div className="flex-col gap-2" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <span className={`badge ${badge} badge-dot`}>{badgeLabel}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)}>
            <Upload size={14} /> {doc ? 'Remplacer' : 'Ajouter'}
          </button>
        </div>
      </div>
      {open && (
        <form onSubmit={submit} className="flex-col gap-3 mt-3">
          <div className="grid-2">
            {label && (
              <div className="field">
                <label htmlFor={`d-${spec.type}-date`}>{label}</label>
                <input id={`d-${spec.type}-date`} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            )}
            {spec.numberLabel && (
              <div className="field">
                <label htmlFor={`d-${spec.type}-num`}>{spec.numberLabel}</label>
                <input id={`d-${spec.type}-num`} className="input" value={number} onChange={(e) => setNumber(e.target.value)} required />
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor={`d-${spec.type}-file`}>Fichier (PDF ou photo, 10 Mo max.)</label>
            <input id={`d-${spec.type}-file`} className="input" type="file" accept={ACCEPTED_DOCUMENT_TYPES.join(',')} onChange={(e) => setFile(e.target.files?.[0] || null)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? <span className="spinner" /> : <><FileCheck2 size={15} /> Envoyer le document</>}
          </button>
        </form>
      )}
    </li>
  );
}

export default function DocumentsCard() {
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers/me/documents');
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byType = Object.fromEntries((data?.documents || []).map((d) => [d.type, d]));
  const c = data?.compliance;
  return (
    <div className="card card-pad mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="flex items-center gap-2" style={{ fontSize: '1.05rem' }}>
          <ShieldCheck size={19} /> Documents obligatoires
        </h3>
        {c && <span className={`badge ${c.canBeApproved ? 'badge-success' : 'badge-gold'}`}>{c.approved} / {c.required} validés</span>}
      </div>
      <p className="tiny muted">
        Documents exigés pour exercer comme chauffeur VTC en France. Ils sont vérifiés par StrasDrive avant votre première course,
        puis à chaque renouvellement. Ils ne sont visibles que par vous et l’équipe StrasDrive.
      </p>
      {c?.problem && <p className="tiny mt-2" style={{ color: 'var(--warning)', fontWeight: 600 }}>{c.problem}</p>}
      <ul className="mt-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {DRIVER_DOCUMENTS.map((spec) => (
          <DocumentRow key={spec.type} spec={spec} doc={byType[spec.type]} onSaved={setData} />
        ))}
      </ul>
    </div>
  );
}
