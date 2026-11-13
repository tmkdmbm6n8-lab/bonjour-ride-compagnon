import {createFileRoute} from '@tanstack/react-router';
import AdminLayout from '@/components/AdminLayout';
import {apiFetch as fetch} from '@/lib/archive-fetch';
'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Loading, VEHICLE_LABELS } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

// Driver-first defaults: single-digit commission, low rider rates
const DEFAULTS = {
  economy: { baseFare: 2.0, perKmRate: 1.0, perMinRate: 0.15, minimumFare: 4, bookingFee: 0.5, platformCommission: 8, surgeMultiplierCap: 3 },
  comfort: { baseFare: 3.0, perKmRate: 1.5, perMinRate: 0.25, minimumFare: 6.5, bookingFee: 0.75, platformCommission: 8, surgeMultiplierCap: 3 },
  premium: { baseFare: 5.0, perKmRate: 2.5, perMinRate: 0.4, minimumFare: 12, bookingFee: 1.0, platformCommission: 10, surgeMultiplierCap: 3 },
  xl: { baseFare: 4.0, perKmRate: 1.8, perMinRate: 0.3, minimumFare: 8, bookingFee: 0.75, platformCommission: 8, surgeMultiplierCap: 3 },
};

const FIELDS = [
  ['baseFare', 'Prise en charge (€)'],
  ['perKmRate', 'Par km (€)'],
  ['perMinRate', 'Par minute (€)'],
  ['minimumFare', 'Tarif minimum (€)'],
  ['bookingFee', 'Frais de réservation (€)'],
  ['platformCommission', 'Commission (%)'],
  ['surgeMultiplierCap', 'Plafond de majoration (×)'],
];

function AdminPricingPage() {
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [savingType, setSavingType] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/pricing');
        const data = await res.json();
        if (ignore || !res.ok) return;

        // Merge DB rules over defaults for the 'default' city
        const merged = {};
        for (const type of Object.keys(DEFAULTS)) {
          const dbRule = data.rules.find((r) => r.vehicleType === type && r.city === 'default');
          merged[type] = dbRule
            ? { ...DEFAULTS[type], ...dbRule }
            : { ...DEFAULTS[type], _unsaved: true };
        }
        setRules(merged);
      } catch {
        if (!ignore) setRules(null);
      }
    })();
    return () => { ignore = true; };
  }, []);

  const setField = (type, field) => (e) =>
    setRules((r) => ({ ...r, [type]: { ...r[type], [field]: e.target.value } }));

  async function save(type) {
    setSavingType(type);
    try {
      const rule = rules[type];
      const payload = { vehicleType: type, city: 'default', isActive: true };
      for (const [field] of FIELDS) payload[field] = parseFloat(rule[field]);

      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Échec de l’enregistrement', 'error', 5000);
      } else {
        setRules((r) => ({ ...r, [type]: { ...r[type], ...data.rule, _unsaved: false } }));
        toast(`Tarification ${VEHICLE_LABELS[type]} enregistrée`, 'success');
      }
    } catch {
      toast('Échec de l’enregistrement', 'error');
    } finally {
      setSavingType(null);
    }
  }

  if (!rules) return <div className="content-pad"><Loading label="Chargement des tarifs…" /></div>;

  return (
    <div className="content-pad" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Tarification</h1>
      <p className="page-sub mb-6"> Règles tarifaires par gamme de service. Les passagers voient toujours le prix final avant de réserver. </p>

      <div className="grid-2">
        {Object.keys(DEFAULTS).map((type) => ( <div key={type} className="card card-pad">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: '1.05rem' }}>{VEHICLE_LABELS[type]}</h3>
              {rules[type]._unsaved && <span className="badge badge-warning">Valeurs par défaut utilisées</span>}
            </div>
            <div className="grid-2" style={{ gap: 12 }}>
              {FIELDS.map(([field, label]) => ( <div key={field} className="field">
                  <label htmlFor={`${type}-${field}`} className="tiny">{label}</label>
                  <input
                    id={`${type}-${field}`}
                    className="input"
                    style={{ minHeight: 40 }}
                    type="number"
                    step="0.05"
                    min="0"
                    value={rules[type][field]}
                    onChange={setField(type, field)}
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-sm mt-4"
              onClick={() => save(type)}
              disabled={savingType === type}
            >
              {savingType === type ? <span className="spinner" /> : <><Check size={14} /> Enregistrer</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route=createFileRoute('/_authenticated/admin/pricing')({head:()=>({meta:[{title:"Tarification · StrasDrive"},{name:'description',content:"StrasDrive — tarification, service de mise en relation VTC et tarifs en euros."},{property:'og:title',content:"Tarification · StrasDrive"},{property:'og:description',content:"StrasDrive — tarification, service de mise en relation VTC et tarifs en euros."},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),component:() => <AdminLayout><AdminPricingPage/></AdminLayout>});
