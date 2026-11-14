import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { Users, Search, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/lib/archive-auth';
import { Avatar, Loading, Empty, money } from '@/components/ui/bits';
import { formatRelativeTime } from '@/lib/utils/geo';

const ROLE_BADGE = { rider: 'badge-info', driver: 'badge-gold', admin: 'badge-danger' };

function DeleteAccountModal({ user, onClose, onDeleted }) {
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmWord = 'SUPPRIMER';

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', { method: 'DELETE', body: JSON.stringify({ userId: user._id }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || 'Suppression impossible');
      toast(`Compte de ${user.name || '@' + user.username} supprimé définitivement`, 'success', 5000);
      onDeleted(user._id);
    } catch (e) {
      toast(e.message || 'Suppression impossible', 'error', 6000);
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Supprimer ce compte ?">
      <p className="small mb-3">
        <strong>{user.name || 'Utilisateur'}</strong> (@{user.username}) sera effacé <strong>définitivement</strong> :
      </p>
      <ul className="small muted mb-3" style={{ paddingLeft: 18, listStyle: 'disc' }}>
        <li>le compte et la connexion</li>
        <li>les documents chauffeur et leurs fichiers</li>
        <li>toutes ses courses (côté passager et côté chauffeur)</li>
        <li>le portefeuille, les factures et l’historique des paiements</li>
        <li>ses messages à l’assistance</li>
      </ul>
      <p className="small mb-3" style={{ color: 'var(--danger)', fontWeight: 600 }}>Cette action est irréversible.</p>
      <label className="small" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }} htmlFor="confirm-delete">
        Tapez {confirmWord} pour confirmer
      </label>
      <input id="confirm-delete" className="input mb-4" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary flex-1" onClick={onClose} disabled={busy}>Annuler</button>
        <button type="button" className="btn btn-danger flex-1" disabled={typed.trim().toUpperCase() !== confirmWord || busy} onClick={remove}>
          {busy ? <span className="spinner" /> : <><Trash2 size={16} /> Supprimer définitivement</>}
        </button>
      </div>
    </Modal>
  );
}

function AdminUsersPage() {
  const { data: session } = useSession();
  const [toDelete, setToDelete] = useState(null);
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '30' });
        if (q.trim()) params.set('q', q.trim());
        if (role) params.set('role', role);
        const res = await fetch(`/api/admin/users?${params}`);
        const data = await res.json();
        if (!ignore && res.ok) setUsers(data.users);
      } catch {
        if (!ignore) setUsers([]);
      }
    }, 300);
    return () => { ignore = true; clearTimeout(timer); };
  }, [q, role]);

  return (
    <div className="content-pad">
      <h1 className="page-title">Utilisateurs</h1>
      <p className="page-sub mb-6">Tous les utilisateurs de la plateforme</p>

      <div className="flex gap-3 mb-4 wrap">
        <div className="input-wrap flex-1" style={{ maxWidth: 340 }}>
          <Search size={16} />
          <input className="input" placeholder="Rechercher par nom ou nom d’utilisateur…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="segmented">
          {['', 'rider', 'driver', 'admin'].map((r) => ( <button key={r || 'all'} className={role === r ? 'active' : ''} onClick={() => setRole(r)}>
              {r === '' ? 'Tous' : r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {users === null && <Loading label="Chargement des utilisateurs…" />}
      {users?.length === 0 && <Empty icon={Users} title="Aucun utilisateur trouvé" />}

      {users?.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Note</th>
                <th>Portefeuille</th>
                <th>Inscription</th>
                <th>Dernière activité</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => ( <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="sm" />
                      <div>
                        <div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
                        <div className="tiny muted">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-neutral'}`}>{u.role}</span></td>
                  <td className="small mono-nums">{(u.rating?.average ?? 5).toFixed(1)}</td>
                  <td className="small mono-nums">{money(u.wallet?.balance || 0)}</td>
                  <td className="tiny muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="tiny muted">{u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : '—'}</td>
                  <td>
                    {u._id !== session?.user?.id && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(u)} aria-label={`Supprimer le compte de ${u.name || u.username}`}>
                        <Trash2 size={14} /> Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toDelete && (
        <DeleteAccountModal
          user={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={(id) => { setToDelete(null); setUsers((list) => (list || []).filter((x) => x._id !== id)); }}
        />
      )}
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/admin/users')({head:()=>({meta:[{title:"Utilisateurs · StrasDrive"},{name:'description',content:"StrasDrive — utilisateurs, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Utilisateurs · StrasDrive"},{property:'og:description',content:"StrasDrive — utilisateurs, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminUsersPage/></AdminLayout>});
