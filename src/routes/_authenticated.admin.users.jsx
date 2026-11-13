import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { Users, Search } from 'lucide-react';
import { Avatar, Loading, Empty, money } from '@/components/ui/bits';
import { formatRelativeTime } from '@/lib/utils/geo';

const ROLE_BADGE = { rider: 'badge-info', driver: 'badge-gold', admin: 'badge-danger' };

function AdminUsersPage() {
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/admin/users')({head:()=>({meta:[{title:"Utilisateurs · StrasDrive"},{name:'description',content:"StrasDrive — utilisateurs, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Utilisateurs · StrasDrive"},{property:'og:description',content:"StrasDrive — utilisateurs, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminUsersPage/></AdminLayout>});
