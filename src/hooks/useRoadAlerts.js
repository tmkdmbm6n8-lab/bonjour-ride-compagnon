"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch as fetch } from "@/lib/archive-fetch";
import { playRadarBeep } from "@/lib/sounds";
import { beepIntervalMs, nearestAlert, CONFIRM_RADIUS_M } from "@/lib/vtc-road-alerts";

const MUTE_KEY = "strasdrive.alerts.muted";
const POLL_MS = 20000;

/** Signalements police / radar partagés : chargement, bip d'approche, confirmation. */
export default function useRoadAlerts(position, enabled = true) {
  const [alerts, setAlerts] = useState([]);
  const [muted, setMuted] = useState(false);
  const [asked, setAsked] = useState(() => new Set());
  const posRef = useRef(position);
  posRef.current = position;
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const nearRef = useRef(null);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const p = posRef.current;
    if (!p) return;
    try {
      const res = await fetch(`/api/drivers/me/road-alerts?lat=${p.lat}&lng=${p.lng}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.alerts)) setAlerts(data.alerts);
    } catch {}
  }, []);

  const hasPos = Boolean(position);
  useEffect(() => {
    if (!enabled || !hasPos) return undefined;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, hasPos, refresh]);

  const report = useCallback(async (kind) => {
    const p = posRef.current;
    if (!p) throw new Error("Position GPS introuvable");
    const res = await fetch("/api/drivers/me/road-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, lat: p.lat, lng: p.lng }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signalement impossible");
    if (Array.isArray(data.alerts)) setAlerts(data.alerts);
    return data;
  }, []);

  const vote = useCallback(
    async (id, present) => {
      setAsked((s) => new Set(s).add(id));
      try {
        await fetch(`/api/drivers/me/road-alerts/${id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ present }),
        });
      } catch {}
      refresh();
    },
    [refresh],
  );

  const dismiss = useCallback((id) => setAsked((s) => new Set(s).add(id)), []);

  // Distance au repère le plus proche
  const near = enabled ? nearestAlert(alerts, position) : null;
  nearRef.current = near;

  // Bip qui accélère tous les 10 m sous 100 m
  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const n = nearRef.current;
      const every = n ? beepIntervalMs(n.distance) : null;
      if (every && !mutedRef.current) playRadarBeep(n.alert.kind);
      timer = setTimeout(loop, every || 1000);
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  // Question « toujours là ? » pour un repère proche qu'on n'a pas signalé ni encore jugé
  const prompt =
    near &&
    near.distance <= CONFIRM_RADIUS_M &&
    !near.alert.mine &&
    !near.alert.voted &&
    !near.alert.permanent &&
    !asked.has(near.alert.id)
      ? near.alert
      : null;

  return { alerts, muted, toggleMute, report, vote, dismiss, prompt, near, refresh };
}
