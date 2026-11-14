import {createFileRoute} from '@tanstack/react-router';
import DriverLayout from '@/components/DriverLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { Car, Check, Layers } from 'lucide-react';
import ProfileCard from '@/components/profile/ProfileCard';
import DocumentsCard from '@/components/driver/DocumentsCard';
import { useToast } from '@/components/ui/Toast';
import { VEHICLE_LABELS } from '@/components/ui/bits';

const EMPTY_VEHICLE = { make: '', model: '', year: '', color: '', plate: '', type: 'economy' };

function LowerClassesCard({ driver, onSaved }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  if (!driver) return null;
  const own = driver.vehicleClass || 'economy';
  const options = driver.lowerClasses || [];
  const accepted = driver.acceptsClasses || [];

  async function toggle(cls) {
    const next = accepted.includes(cls) ? accepted.filter((c) => c !== cls) : [...accepted, cls];
    setBusy(cls);
    try {
      const res = await fetch('/api/drivers/me/classes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptsClasses: next }),
      });
      const data = await res.json();
      if (!res.ok) toast(data.error || 'Impossible d’enregistrer', 'error');
      else {
        onSaved(data.driver);
        toast(next.includes(cls) ? `Vous recevrez aussi les courses ${VEHICLE_LABELS[cls]}, au tarif ${VEHICLE_LABELS[cls]}` : `Vous ne recevrez plus les courses ${VEHICLE_LABELS[cls]}`, 'success');
      }
    } catch {
      toast('Impossible d’enregistrer', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card card-pad mt-4">
      <h3 className="flex items-center gap-2 mb-2" style={{ fontSize: '1.05rem' }}>
        <Layers size={19} /> Courses de gamme inférieure
      </h3>
      {options.length === 0 ? (
        <p className="tiny muted">Votre gamme ({VEHICLE_LABELS[own]}) reçoit uniquement ses propres courses.</p>
      ) : (
        <>
          <p className="tiny muted mb-3">
            Votre gamme : {VEHICLE_LABELS[own]}. Cochez les gammes inférieures que vous acceptez aussi. Une course d’une gamme inférieure est payée au tarif de cette gamme.
          </p>
          <div className="flex-col gap-2">
            {options.map((cls) => (
              <label key={cls} className="flex items-center gap-3 small" style={{ cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={accepted.includes(cls)}
                  disabled={busy !== null}
                  onChange={() => toggle(cls)}
                />
                Accepter les courses {VEHICLE_LABELS[cls]} (tarif {VEHICLE_LABELS[cls]})
                {busy === cls && <span className="spinner" />}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DriverProfilePage() {
  const toast = useToast();
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(EMPTY_VEHICLE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/drivers/me');
        if (res.ok) {
          const { driver: d } = await res.json();
          if (!ignore) {
            setDriver(d);
            if (d.vehicle?.plate) {
              setVehicle({ ...d.vehicle, year: String(d.vehicle.year || '') });
            }
          }
        }
      } catch { /* ignore */ }
    })();
    return () => { ignore = true; };
  }, []);

  const set = (key) => (e) => setVehicle((v) => ({ ...v, [key]: e.target.value }));

  async function saveVehicle(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/drivers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: { ...vehicle, year: parseInt(vehicle.year, 10) },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Impossible d’enregistrer le véhicule', 'error', 5000);
      } else {
        setDriver(data.driver);
        toast('Véhicule enregistré — vous pouvez maintenant passer en ligne', 'success');
      }
    } catch {
      toast('Impossible d’enregistrer le véhicule', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="content-pad" style={{ maxWidth: 640 }}>
      <h1 className="page-title">Profil</h1>
      <p className="page-sub mb-6">Votre compte, votre véhicule et vos documents</p>

      <ProfileCard>
        <div className="card card-pad mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2" style={{ fontSize: '1.05rem' }}>
              <Car size={19} /> Véhicule </h3>
            {driver?.isApproved ? (
              <span className="badge badge-success badge-dot">Approuvé</span>
            ) : driver ? (
              <span className="badge badge-warning badge-dot">En attente d’approbation</span>
            ) : null}
          </div>

          <form onSubmit={saveVehicle} className="flex-col gap-4">
            <div className="grid-2">
              <div className="field">
                <label htmlFor="v-make">Marque</label>
                <input id="v-make" className="input" value={vehicle.make} onChange={set('make')} placeholder="Toyota" required />
              </div>
              <div className="field">
                <label htmlFor="v-model">Modèle</label>
                <input id="v-model" className="input" value={vehicle.model} onChange={set('model')} placeholder="Camry" required />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="v-year">Année</label>
                <input id="v-year" className="input" type="number" min={1990} max={2030} value={vehicle.year} onChange={set('year')} placeholder="2022" required />
              </div>
              <div className="field">
                <label htmlFor="v-color">Couleur</label>
                <input id="v-color" className="input" value={vehicle.color} onChange={set('color')} placeholder="Argenté" required />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="v-plate">Plaque d’immatriculation</label>
                <input id="v-plate" className="input" value={vehicle.plate} onChange={(e) => setVehicle((v) => ({ ...v, plate: e.target.value.toUpperCase() }))} placeholder="ABC 1234" required />
              </div>
              <div className="field">
                <label htmlFor="v-type">Gamme de service</label>
                <input id="v-type" className="input" value={VEHICLE_LABELS[driver?.vehicleClass || 'economy']} readOnly disabled />
                <span className="tiny muted">Attribuée par StrasDrive</span>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : <><Check size={17} /> Enregistrer le véhicule</>}
            </button>
          </form>
        </div>
        <LowerClassesCard driver={driver} onSaved={setDriver} />
        <DocumentsCard />
      </ProfileCard>
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/driver/profile')({head:()=>({meta:[{title:"Profil chauffeur · StrasDrive"},{name:'description',content:"StrasDrive — profil chauffeur, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Profil chauffeur · StrasDrive"},{property:'og:description',content:"StrasDrive — profil chauffeur, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <DriverLayout><DriverProfilePage/></DriverLayout>});
