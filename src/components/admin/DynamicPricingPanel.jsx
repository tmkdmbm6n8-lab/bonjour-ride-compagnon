"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";
import { Loading, money, VEHICLE_LABELS } from "@/components/ui/bits";
import { useToast } from "@/components/ui/Toast";
import {
  CATEGORY_IDS,
  DAYS,
  LEVELS,
  emptySchedule,
  parisSlot,
  slotAdjustment,
  simulateDynamicPrice,
  validateDynamicConfig,
} from "@/lib/dynamic-pricing";
import "@/styles/dynamic-pricing.css";
const clone = (value) => JSON.parse(JSON.stringify(value));
const percent = (value) => `${value > 0 ? "+" : ""}${value} %`;
const number = (value) => (value === "" ? NaN : Number(value));
const inputValue = (value) => (Number.isFinite(value) ? value : "");
export default function DynamicPricingPanel() {
  const toast = useToast();
  const [draft, setDraft] = useState(null),
    [saved, setSaved] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [zoneId, setZoneId] = useState("strasbourg-centre"),
    [day, setDay] = useState(0),
    [hour, setHour] = useState(12),
    [category, setCategory] = useState("economy");
  const [now, setNow] = useState(new Date());
  const [initialPrice, setInitialPrice] = useState(17.77),
    [simZone, setSimZone] = useState("strasbourg-centre"),
    [simDay, setSimDay] = useState(0),
    [simHour, setSimHour] = useState(12),
    [simEnabled, setSimEnabled] = useState(true);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/dynamic-pricing");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chargement impossible");
      setDraft(data.config);
      setSaved(data.config);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function request(method, body) {
    const response = await apiFetch("/api/admin/dynamic-pricing", {
      method,
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Enregistrement impossible");
    return data.config;
  }
  async function save() {
    try {
      validateDynamicConfig(draft);
      setBusy(true);
      setError("");
      const config = await request("PUT", { config: draft, expectedRevision: saved.revision });
      setDraft(config);
      setSaved(config);
      toast("Tarification dynamique enregistrée", "success");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(enabled) {
    setBusy(true);
    setError("");
    try {
      const config = await request("PATCH", { enabled, expectedRevision: saved.revision });
      setSaved(config);
      setDraft((current) => ({ ...current, enabled: config.enabled, revision: config.revision }));
      toast(
        enabled ? "Tarification dynamique activée" : "Tarification dynamique désactivée",
        "success",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function updateZone(changes) {
    setDraft((current) => ({
      ...current,
      zones: current.zones.map((zone) =>
        zone.id === (current.zones.find((item) => item.id === zoneId) || current.zones[0])?.id
          ? { ...zone, ...changes }
          : zone,
      ),
    }));
  }
  function setLevel(level) {
    setDraft((current) => ({
      ...current,
      zones: current.zones.map((zone) => {
        if (zone.id !== (current.zones.find((item) => item.id === zoneId) || current.zones[0])?.id)
          return zone;
        const schedule = clone(zone.schedule);
        schedule[day][hour] = level;
        return { ...zone, schedule };
      }),
    }));
  }
  function updatePercent(id, value, type) {
    setDraft((current) => ({
      ...current,
      levels: current.levels.map((level) => {
        if (level.id !== id) return level;
        if (!type) return { ...level, percent: number(value) };
        const byCategory = { ...level.byCategory };
        if (value === "") delete byCategory[type];
        else byCategory[type] = Number(value);
        return { ...level, byCategory };
      }),
    }));
  }
  function addZone() {
    const id = crypto.randomUUID();
    setDraft((current) => ({
      ...current,
      zones: [
        ...current.zones,
        {
          id,
          name: "Nouvelle zone",
          lat: 48.5839,
          lng: 7.7455,
          radiusKm: 3,
          enabled: false,
          schedule: emptySchedule(),
        },
      ],
    }));
    setZoneId(id);
  }
  function removeZone() {
    const zones = draft.zones.filter(
      (zone) => zone.id !== (draft.zones.find((item) => item.id === zoneId) || draft.zones[0])?.id,
    );
    setDraft((current) => ({ ...current, zones }));
    setZoneId(zones[0]?.id || "");
  }
  if (!draft)
    return (
      <div>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="btn btn-secondary" onClick={load}>
              Réessayer
            </button>
          </>
        ) : (
          <Loading />
        )}
      </div>
    );
  const zone = draft.zones.find((item) => item.id === zoneId) || draft.zones[0];
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const slot = parisSlot(now);
  const known = draft.zones.reduce(
    (sum, item) => sum + item.schedule.flat().filter((value) => value !== null).length,
    0,
  );
  const configured = { ...draft, enabled: true };
  let simulation = null;
  try {
    simulation = simulateDynamicPrice(
      { ...draft, enabled: simEnabled },
      { initialPrice, zoneId: simZone, day: simDay, hour: simHour, category },
    );
  } catch {
    /* show invalid input below */
  }
  return (
    <div className="dynamic-pricing">
      <div className="dynamic-toolbar card card-pad">
        <div>
          <h2>Tarification dynamique</h2>
          <p className="small muted">
            {saved.enabled
              ? "Active pour les prochains devis."
              : "Désactivée : seul le barème classique est appliqué."}
          </p>
        </div>
        <label className="dynamic-toggle">
          <input
            type="checkbox"
            role="switch"
            aria-label="Activer la tarification dynamique"
            checked={saved.enabled}
            disabled={busy}
            onChange={(event) => toggle(event.target.checked)}
          />
          <span>{saved.enabled ? "Activée" : "Désactivée"}</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="input-error-msg">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="dynamic-fieldset">
        <section className="card card-pad">
          <h3>Niveaux et pourcentages</h3>
          <p className="small muted">
            Une case de catégorie vide reprend le pourcentage général. Les valeurs négatives
            réduisent le prix, les positives le majorent.
          </p>
          <div className="dynamic-table-wrap">
            <table className="dynamic-table">
              <thead>
                <tr>
                  <th>Niveau de demande</th>
                  <th>Général</th>
                  {CATEGORY_IDS.map((type) => (
                    <th key={type}>{VEHICLE_LABELS[type]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.levels.map((level) => (
                  <tr key={level.id}>
                    <th>
                      <span className="dynamic-dot" style={{ background: level.color }} />
                      {level.label}
                    </th>
                    <td>
                      <input
                        aria-label={`Pourcentage général ${level.label}`}
                        type="number"
                        min="-100"
                        max="10000"
                        step="0.1"
                        value={inputValue(level.percent)}
                        onChange={(event) => updatePercent(level.id, event.target.value)}
                      />
                    </td>
                    {CATEGORY_IDS.map((type) => (
                      <td key={type}>
                        <input
                          aria-label={`${VEHICLE_LABELS[type]} ${level.label}`}
                          type="number"
                          min="-100"
                          max="10000"
                          step="0.1"
                          placeholder={String(level.percent)}
                          value={level.byCategory[type] ?? ""}
                          onChange={(event) => updatePercent(level.id, event.target.value, type)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card card-pad">
          <h3>Planning hebdomadaire</h3>
          <p className="small muted">
            {known} créneaux renseignés sur {draft.zones.length * 168}. Les créneaux « Non renseigné
            » restent à 0 %.
          </p>
          <div className="dynamic-controls">
            <label>
              Zone
              <select
                aria-label="Zone du planning"
                className="input"
                value={zone?.id || ""}
                onChange={(event) => setZoneId(event.target.value)}
              >
                {draft.zones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Catégorie affichée
              <select
                aria-label="Catégorie affichée"
                className="input"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORY_IDS.map((type) => (
                  <option key={type} value={type}>
                    {VEHICLE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="dynamic-days" role="tablist" aria-label="Jour du planning">
            {DAYS.map((name, index) => (
              <button
                type="button"
                key={name}
                role="tab"
                aria-selected={day === index}
                onClick={() => setDay(index)}
              >
                {name}
              </button>
            ))}
          </div>
          {zone ? (
            <>
              <div className="dynamic-chart" aria-label={`Demande ${zone.name}, ${DAYS[day]}`}>
                {zone.schedule[day].map((levelId, index) => {
                  const level = draft.levels.find((item) => item.id === levelId);
                  const adjustment = slotAdjustment(configured, zone, day, index, category);
                  const label = `${String(index).padStart(2, "0")} h : ${level?.label || "Non renseigné"}, ${percent(adjustment.percent)}`;
                  return (
                    <button
                      type="button"
                      key={index}
                      aria-label={label}
                      aria-pressed={hour === index}
                      title={label}
                      onClick={() => setHour(index)}
                    >
                      <span
                        className={`dynamic-bar ${!level ? "is-unknown" : ""}`}
                        style={{
                          height: level
                            ? `${24 + LEVELS.findIndex((item) => item.id === levelId) * 22}px`
                            : "12px",
                          background: level?.color || "transparent",
                        }}
                      />
                      <span>{String(index).padStart(2, "0")}</span>
                    </button>
                  );
                })}
              </div>
              <div className="dynamic-slot-editor">
                <strong>
                  {DAYS[day]} · {String(hour).padStart(2, "0")} h –{" "}
                  {String(hour + 1).padStart(2, "0")} h
                </strong>
                <label>
                  Niveau de demande
                  <select
                    aria-label="Niveau du créneau"
                    className="input"
                    value={zone.schedule[day][hour] ?? ""}
                    onChange={(event) => setLevel(event.target.value || null)}
                  >
                    <option value="">Non renseigné · 0 %</option>
                    {draft.levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.label} · {percent(level.byCategory[category] ?? level.percent)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <p>Aucune zone configurée. Ajoutez une zone pour définir son planning.</p>
          )}
          <p className="tiny muted">
            Heure de Paris. Les captures historiques couvrent mardi 4 h à dimanche 3 h ; leurs
            barres après minuit ont été affectées au jour civil suivant. Les hauteurs sont
            transcrites en cinq niveaux relatifs, sans inventer de volumes de courses.
          </p>
        </section>
        <section className="card card-pad">
          <div className="dynamic-section-title">
            <h3>Zones géographiques</h3>
            <button className="btn btn-secondary" type="button" onClick={addZone}>
              Ajouter une zone
            </button>
          </div>
          {zone && (
            <>
              <p className="small muted">
                Zone sélectionnée : {zone.name}. Les périmètres sont circulaires et modifiables. En
                cas de chevauchement, la zone dont le départ est proportionnellement le plus proche
                du centre est utilisée.
              </p>
              <div className="dynamic-controls">
                <label>
                  Nom
                  <input
                    className="input"
                    aria-label="Nom de zone"
                    value={zone.name}
                    maxLength={100}
                    onChange={(event) => updateZone({ name: event.target.value })}
                  />
                </label>
                <label>
                  Latitude
                  <input
                    className="input"
                    aria-label="Latitude de zone"
                    type="number"
                    min="-90"
                    max="90"
                    step="0.0001"
                    value={inputValue(zone.lat)}
                    onChange={(event) => updateZone({ lat: number(event.target.value) })}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    className="input"
                    aria-label="Longitude de zone"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.0001"
                    value={inputValue(zone.lng)}
                    onChange={(event) => updateZone({ lng: number(event.target.value) })}
                  />
                </label>
                <label>
                  Rayon en km
                  <input
                    className="input"
                    aria-label="Rayon de zone"
                    type="number"
                    min="0.1"
                    max="200"
                    step="0.1"
                    value={inputValue(zone.radiusKm)}
                    onChange={(event) => updateZone({ radiusKm: number(event.target.value) })}
                  />
                </label>
              </div>
              <div className="dynamic-section-title">
                <label>
                  <input
                    type="checkbox"
                    checked={zone.enabled}
                    onChange={(event) => updateZone({ enabled: event.target.checked })}
                  />{" "}
                  Zone active
                </label>
                <button type="button" className="btn btn-secondary" onClick={removeZone}>
                  Supprimer cette zone
                </button>
              </div>
            </>
          )}
        </section>
        <section className="card card-pad">
          <h3>Coefficients actuels enregistrés</h3>
          <p className="small muted">
            {DAYS[slot.day]} · {slot.hour} h · Europe/Paris
          </p>
          <div className="dynamic-zone-statuses">
            {saved.zones.map((item) => (
              <article key={item.id} className="dynamic-zone-status">
                <strong>{item.name}</strong>
                <div>
                  {CATEGORY_IDS.map((type) => (
                    <span key={type}>
                      {VEHICLE_LABELS[type]} :{" "}
                      <b>
                        {percent(slotAdjustment(saved, item, slot.day, slot.hour, type).percent)}
                      </b>
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="card card-pad">
          <h3>Simulateur de prix</h3>
          <label className="small">
            <input
              type="checkbox"
              checked={simEnabled}
              onChange={(event) => setSimEnabled(event.target.checked)}
            />{" "}
            Simuler l’activation sans activer les prix
          </label>
          <div className="dynamic-controls">
            <label>
              Catégorie
              <select
                className="input"
                aria-label="Catégorie du simulateur"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {CATEGORY_IDS.map((type) => (
                  <option key={type} value={type}>
                    {VEHICLE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prix initial (€)
              <input
                className="input"
                aria-label="Prix initial du simulateur"
                type="number"
                min="0"
                step="0.01"
                value={inputValue(initialPrice)}
                onChange={(event) => setInitialPrice(number(event.target.value))}
              />
            </label>
            <label>
              Zone de départ
              <select
                className="input"
                aria-label="Zone du simulateur"
                value={simZone}
                onChange={(event) => setSimZone(event.target.value)}
              >
                <option value="">En dehors des zones</option>
                {draft.zones.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jour
              <select
                className="input"
                aria-label="Jour du simulateur"
                value={simDay}
                onChange={(event) => setSimDay(Number(event.target.value))}
              >
                {DAYS.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Heure
              <select
                className="input"
                aria-label="Heure du simulateur"
                value={simHour}
                onChange={(event) => setSimHour(Number(event.target.value))}
              >
                {Array.from({ length: 24 }, (_, index) => (
                  <option key={index} value={index}>
                    {String(index).padStart(2, "0")} h
                  </option>
                ))}
              </select>
            </label>
          </div>
          {simulation ? (
            <div className="dynamic-simulation" aria-live="polite">
              <span>
                Prix initial<strong>{money(simulation.initialPrice)}</strong>
              </span>
              <span>
                Pourcentage<strong>{percent(simulation.percent)}</strong>
              </span>
              <span>
                {simulation.amount > 0 ? "Majoration" : "Réduction"}
                <strong>{money(Math.abs(simulation.amount))}</strong>
              </span>
              <span>
                Prix final simulé<strong>{money(simulation.finalPrice)}</strong>
              </span>
            </div>
          ) : (
            <p role="alert">Renseignez un prix initial valide.</p>
          )}
          <p className="tiny muted">
            Cette simulation montre l’effet du coefficient. Lors du devis réel, le serveur vérifie
            aussi les minimums de rémunération avec la distance du trajet et peut limiter la
            réduction.
          </p>
        </section>
      </fieldset>
      <div className="dynamic-save-bar">
        <span>{dirty ? "Modifications non enregistrées" : "Paramètres enregistrés"}</span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => {
            if (!dirty || window.confirm("Abandonner les modifications non enregistrées ?"))
              void load();
          }}
        >
          Recharger
        </button>
        <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}>
          {busy ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
      </div>
    </div>
  );
}
