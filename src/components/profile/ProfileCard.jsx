import CloseControl from "@/components/ui/CloseControl";
import PersonalSupport from '@/components/profile/PersonalSupport';
import { downloadPersonalData } from '@/lib/personal-data-export';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut, useSession } from '@/lib/archive-auth';
import { LogOut, Pencil, Check, Camera, Download, Trash2 } from 'lucide-react';
import { Avatar, Stars, Loading, money } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

function prepareAvatar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        if (!size) throw new Error();
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        if (!context) throw new Error();
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 256, 256);
        context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch { reject(new Error('Impossible de préparer cette image.')); }
      finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire cette image.')); };
    image.src = url;
  });
}

/** Shared profile editor for riders and drivers. */
export default function ProfileCard({ children, mode = 'rider' }) {
  const toast = useToast();
  const { update } = useSession();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || uploading) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('L’image doit faire moins de 5 Mo', 'error');
      return;
    }
    setUploading(true);
    try {
      const avatar = await prepareAvatar(file);
      const res = await fetch('/api/users/me/avatar', { method: 'POST', body: JSON.stringify({ avatar }) });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Échec de l’envoi', 'error');
      } else {
        setUser((u) => ({ ...u, avatar: data.avatar }));
        await update({ avatar: data.avatar }); // refresh sidebar avatar
        toast('Photo de profil mise à jour', 'success');
      }
    } catch (error) {
      toast(error.message || 'Échec de l’envoi — vérifiez votre connexion', 'error');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/users/me?view=${mode}`);
        if (res.ok) {
          const { user: u } = await res.json();
          if (!ignore) {
            setUser(u);
            setForm({ name: u.name, phone: u.phone, email: u.email });
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { ignore = true; };
  }, [mode]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/me?view=${mode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Échec de l’enregistrement', 'error');
      } else {
        setUser((u) => ({ ...u, ...data.user }));
        setEditing(false);
        toast('Profil mis à jour', 'success');
        // Refresh the session so the sidebar name updates
        await update({ name: data.user.name });
      }
    } catch {
      toast('Échec de l’enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <Loading label="Chargement du profil…" />;

  return (
    <>
      <div className="card card-pad">
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Modifier la photo de profil"
            title="Modifier la photo de profil"
            style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
            disabled={uploading}
          >
            <Avatar name={user.name} src={user.avatar} size="lg" />
            <span
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--gold-600)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--surface)',
              }}
            >
              {uploading ? (
                <span className="spinner" style={{ width: 11, height: 11, borderWidth: 2 }} />
              ) : (
                <Camera size={12} />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadAvatar}
            style={{ display: 'none' }}
          />
          <div className="flex-1">
            <h2 style={{ fontSize: '1.2rem' }}>{user.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="tiny muted">@{user.username}</span>
              {user.rating?.count > 0 ? <><Stars value={user.rating.average} /><span className="tiny muted">{user.rating.count} avis</span></> : <span className="tiny muted">0 avis</span>}
            </div>
          </div>
          {!editing ? (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Modifier </button>
          ) : (
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : <><Check size={14} /> Enregistrer</>}
              </button>
              <CloseControl
                label="Annuler la modification du profil"
                onClick={() => {
                  setEditing(false);
                  setForm({ name: user.name, phone: user.phone, email: user.email });
                }}
              />
            </div>
          )}
        </div>

        <div className="flex-col gap-4">
          <FieldRow label="Nom complet" editing={editing}>
            {editing ? (
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            ) : (
              user.name
            )}
          </FieldRow>
          <FieldRow label="Téléphone" editing={editing}>
            {editing ? (
              <input className="input" value={form.phone} placeholder="+33 6 12 34 56 78" onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            ) : (
              user.phone || <span className="muted">Non renseigné</span>
            )}
          </FieldRow>
          <FieldRow label="E-mail" editing={editing}>
            {editing ? (
              <input className="input" type="email" value={form.email} placeholder="you@example.com" onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            ) : (
              user.email || <span className="muted">Non renseigné</span>
            )}
          </FieldRow>
          <FieldRow label="Portefeuille">
            <span className="mono-nums" style={{ fontWeight: 700 }}>{money(user.wallet?.balance)}</span>
          </FieldRow>
          <FieldRow label="Membre depuis">
            {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </FieldRow>
        </div>
      </div>

      {children}

      <PersonalDataCard />

      <button
        className="btn btn-danger btn-full mt-4"
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        <LogOut size={17} /> Se déconnecter </button>
    </>
  );
}

function FieldRow({ label, children }) {
  return (
    <div className="flex-col gap-1">
      <span className="tiny muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <div className="small">{children}</div>
    </div>
  );
}

/** Droits RGPD : accès / portabilité (export) et effacement (demande traitée sous un mois). */
function PersonalDataCard() {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const data = await downloadPersonalData(fetch);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strasdrive-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      toast('Vos données ont été téléchargées', 'success');
    } catch {
      toast('Le téléchargement a échoué — réessayez', 'error');
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    if (!window.confirm('Supprimer définitivement votre compte et vos données ? Cette action est immédiate et irréversible. Les données de facturation restent archivées 10 ans conformément aux obligations légales.')) return;
    setRequesting(true);
    try {
      const res = await fetch('/api/users/me/deletion-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression');
      toast('Votre compte a été supprimé avec succès', 'success');
      await signOut();
      window.location.href = '/';
    } catch (err) {
      toast(err.message || 'La suppression du compte a échoué', 'error');
      setRequesting(false);
    }
  }

  return (
    <div className="card card-pad mt-4">
      <PersonalSupport/>
      <h3 className="small mb-1" style={{ fontWeight: 700 }}>Mes données personnelles</h3>
      <p className="tiny muted mb-4" style={{ lineHeight: 1.6 }}>
        Téléchargez une copie de vos données ou supprimez définitivement votre compte. Détails dans la{' '}
        <a href="/privacy" style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline' }}>politique de confidentialité</a>.
      </p>
      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={exportData} disabled={exporting}>
          {exporting ? <span className="spinner" /> : <><Download size={14} /> Télécharger mes données</>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={requestDeletion} disabled={requesting || requested}>
          {requesting ? <span className="spinner" /> : <><Trash2 size={14} /> {requested ? 'Suppression demandée' : 'Supprimer mon compte'}</>}
        </button>
      </div>
    </div>
  );
}
