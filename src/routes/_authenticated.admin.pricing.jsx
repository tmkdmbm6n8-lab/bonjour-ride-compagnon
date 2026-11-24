import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { apiFetch } from '@/lib/archive-fetch';
import { Loading, VEHICLE_LABELS, money } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_PRICING, TARIFF_VERSION, tariffRuleProblem } from '@/lib/vtc-pricing';

const FIELDS = [
  ['baseFare', 'Prix de base (€)'], ['perKmRate', 'Par kilomètre (€)'],
  ['perMinRate', 'Par minute (€)'], ['minimumFare', 'Prix minimum (€)'],
  ['supplement', 'Supplément après minimum (€)'],
];
function AdminPricingPage() {
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [provider, setProvider] = useState('auto');
  useEffect(() => {
    let active = true;
    Promise.all([apiFetch('/api/admin/pricing'), apiFetch('/api/admin/address-search-provider')])
      .then(async ([pricing, address]) => {
        const data = await pricing.json();
        if (!pricing.ok) throw new Error(data.error || 'Tarification indisponible');
        const addresses = address.ok ? await address.json() : {};
        if (active) { setRules(data.rules); setProvider(addresses.provider || 'auto'); }
      }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function save(rule) {
    const problem = tariffRuleProblem(rule);
    if (problem) { toast(problem, 'error'); return; }
    setSaving(rule.vehicleType);
    try {
      const response = await apiFetch('/api/admin/pricing', { method: 'PUT', body: JSON.stringify({ ...rule, tariffVersion: TARIFF_VERSION }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible');
      toast('Barème enregistré pour les prochains devis', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(null); }
  }
  async function saveProvider(value) {
    setSaving('address');
    try {
      const response = await apiFetch('/api/admin/address-search-provider', { method: 'PUT', body: JSON.stringify({ provider: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible');
      setProvider(data.provider); toast('Recherche d’adresses enregistrée', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(null); }
  }
  if (error) return <p role="alert">{error}</p>;
  if (!rules) return <Loading />;
  return <div className="flex-col gap-6">
    <header><h1>Tarification StrasDrive</h1><p className="muted mt-2">Le prix est calculé à partir de la distance et de la durée du trajet.</p></header>
    <section className="card card-pad">
      <h2>Règle de calcul</h2>
      <p className="mt-3">Maximum entre le minimum et « base + kilomètres × prix/km + minutes × prix/minute », puis ajout du supplément.</p>
      <p className="small muted mt-2">Le supplément Pet de 4 € s’ajoute après le minimum : son minimum de barème est de 16 €, avant l’ajustement éventuel de 0,02 €. Les secondes et les mètres sont conservés jusqu’à l’arrondi final au centime. Un tarif entier reçoit une réduction de 0,02 € si les minimums chauffeurs le permettent : 12,00 € devient 11,98 €. Les tarifs comportant déjà des centimes restent inchangés.</p>
    </section>
    <div className="grid gap-4" style={{gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))'}}>
      {rules.map(rule => <section key={rule.vehicleType} className="card card-pad">
        <h2>{VEHICLE_LABELS[rule.vehicleType]}</h2>
        <form onSubmit={event => { event.preventDefault(); save(rule); }}>
          {FIELDS.map(([key, label]) => <label key={key} className="block mt-3"><span className="small">{label}</span><input className="input mt-1" type="number" min="0" max="10000" step="0.01" required value={Number.isFinite(rule[key]) ? rule[key] : ''} onChange={event => {
            const value = event.target.value === '' ? NaN : Number(event.target.value);
            setRules(current => current.map(item => item.vehicleType === rule.vehicleType ? {...item,[key]:value} : item));
          }} /></label>)}
          <p className="small muted mt-4">Commission standard : {DEFAULT_PRICING[rule.vehicleType].platformCommission} % · Frais de réservation : {money(0)}</p>
          <button type="submit" className="btn btn-primary btn-full mt-4" disabled={saving !== null}>{saving === rule.vehicleType ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>
      </section>)}
    </div>
    <section className="card card-pad">
      <h2>Recherche d’adresses</h2>
      <label className="block mt-3"><span className="small">Service de recherche</span><select className="input mt-1" value={provider} disabled={saving !== null} onChange={event => saveProvider(event.target.value)}>
        <option value="auto">Automatique</option><option value="google">Google</option><option value="osm">OpenStreetMap</option>
      </select></label>
    </section>
  </div>;
}
export const Route = createFileRoute('/_authenticated/admin/pricing')({
  head: () => ({ meta: [{title:'Tarification · StrasDrive'},{name:'description',content:'Barème distance et durée des courses StrasDrive.'}] }),
  component: () => <AdminLayout><AdminPricingPage /></AdminLayout>,
});
