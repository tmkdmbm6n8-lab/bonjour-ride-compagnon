import SupportConversation from "@/components/admin/SupportConversation";
import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox, CheckCircle2, RotateCcw, Mail } from 'lucide-react';
import { Avatar, Loading, Empty } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { formatRelativeTime } from '@/lib/utils/geo';
import Link, { useSearchParams } from '@/lib/archive-navigation';
import CloseControl from '@/components/ui/CloseControl';

const TOPIC_LABEL = {
  general: 'Général',
  ride_issue: 'Problème de course',
  driver_support: 'Assistance chauffeurs',
  fleet_application: 'Inscription société VTC',
  driver_conversation: 'Conversation chauffeur',
  payments: 'Paiements',
  safety: 'Sécurité',
  data_request: 'Demande concernant les données',
};

const TOPIC_TONE = {
  safety: 'badge-danger',
  ride_issue: 'badge-warning',
  payments: 'badge-info',
  driver_support: 'badge-gold',
  fleet_application: 'badge-gold',
  data_request: 'badge-neutral',
  general: 'badge-neutral',
};

function AdminSupportPage() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const archiveView = useSearchParams().get('archive') === '1';
  const displayedStatus = archiveView ? 'archive' : status;
  const [messages, setMessages] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setMessages(null);
    try {
      const res = await fetch(`/api/admin/support?status=${displayedStatus}`);
      const data = await res.json();
      setMessages(res.ok ? data.messages : []);
    } catch {
      setMessages([]);
    }
  }, [displayedStatus]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15000);
    return () => clearInterval(timer);
  }, [load]);

  async function setMessageStatus(id, next) {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data.error || 'Échec de la mise à jour', 'error');
      } else {
        toast(next === 'resolved' ? 'Marqué comme résolu' : 'Rouvert', 'success');
        load();
      }
    } catch {
      toast('Échec de la mise à jour', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function archiveMessage(row) {
    if (!window.confirm('Archiver cette conversation ? Elle restera consultable dans Archives.')) return;
    setBusyId(row._id);
    try {
      const res = await fetch('/api/admin/support', { method: 'POST', body: JSON.stringify({ id: row._id, expectedMessage: row.message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Archivage impossible');
      toast('Conversation archivée', 'success');
      await load();
    } catch (error) { toast(error.message || 'Archivage impossible', 'error'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="content-pad" style={{ maxWidth: 860 }}>
      <div className="flex items-center justify-between mb-6 wrap gap-3">
        <div>
          <h1 className="page-title">{archiveView ? 'Archives' : 'Boîte de réception de l’assistance'}</h1>
          <p className="page-sub">{archiveView ? 'Conversations d’assistance archivées' : 'Messages du formulaire de contact'}</p>
        </div>
        {!archiveView && <div className="segmented">
          <button className={status === 'open' ? 'active' : ''} onClick={() => setStatus('open')}> Ouverts </button>
          <button className={status === 'resolved' ? 'active' : ''} onClick={() => setStatus('resolved')}> Résolus </button>
        </div>}
      </div>
      {archiveView && <div className="flex gap-2 wrap mb-4"><Link className="btn btn-secondary" href="/admin/rides">Dossiers de courses</Link><Link className="btn btn-secondary" href="/admin/chat-evidence">Échanges signalés</Link></div>}

      {messages === null && <Loading label="Chargement des messages…" />}
      {messages?.length === 0 && (
        <Empty
          icon={Inbox}
          title={archiveView ? 'Aucune conversation archivée' : status === 'open' ? 'Aucun message en attente' : 'Aucun message résolu pour le moment'}
          hint={status === 'open' ? 'Les nouveaux messages du formulaire de contact apparaîtront ici.' : undefined}
        />
      )}

      <div className="flex-col gap-3">
        {messages?.map((m) => ( <div key={m._id} className="card card-pad">
            <div className="flex items-center gap-3 mb-3 wrap">
              <Avatar name={m.name} size="sm" />
              <div className="flex-1" style={{ minWidth: 140 }}>
                <div className="small" style={{ fontWeight: 700 }}>
                  {m.name}
                  {m.userId && (
                    <span className="tiny muted" style={{ fontWeight: 500 }}>
                      {' '}· @{m.userId.username} ({m.userId.role})
                    </span>
                  )}
                </div>
                <a href={`mailto:${m.email}`} className="tiny muted flex items-center gap-1">
                  <Mail size={11} /> {m.email}
                </a>
              </div>
              <span className={`badge ${TOPIC_TONE[m.topic] || 'badge-neutral'}`}>
                {TOPIC_LABEL[m.topic] || m.topic}
              </span>
              <span className="tiny muted">{formatRelativeTime(m.createdAt)}</span>
              {!archiveView && <CloseControl label={`Archiver la conversation de ${m.name}`} title="Archiver" disabled={busyId === m._id} onClick={() => archiveMessage(m)} />}
            </div>

            <SupportConversation row={m} onSent={() => load(true)} />

            <div className="flex justify-between items-center mt-3" style={{ borderTop: '1px solid var(--ink-100)', paddingTop: 10 }}>
              <span className="tiny muted">
                {m.status === 'resolved' && m.resolvedAt
                  ? `Résolu ${formatRelativeTime(m.resolvedAt)}`
                  : ''}
              </span>
              {m.status === 'open' ? (
                <button
                  className="btn btn-success btn-sm"
                  disabled={busyId === m._id}
                  onClick={() => setMessageStatus(m._id, 'resolved')}
                >
                  <CheckCircle2 size={14} /> Marquer comme résolu </button>
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={busyId === m._id}
                  onClick={() => setMessageStatus(m._id, 'open')}
                >
                  <RotateCcw size={14} /> Rouvrir </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/admin/support')({head:()=>({meta:[{title:"Assistance · StrasDrive"},{name:'description',content:"StrasDrive — assistance, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Assistance · StrasDrive"},{property:'og:description',content:"StrasDrive — assistance, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminSupportPage/></AdminLayout>});
