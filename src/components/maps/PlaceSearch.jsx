import { apiFetch as fetch } from "@/lib/archive-fetch";
("use client");

import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Loader2, SearchX, WifiOff } from "lucide-react";

/**
 * Debounced place autocomplete backed by /api/geo/search (Photon/OSM).
 *
 * Suggestions render in the page flow, right under the input (like Google),
 * so they never float away when the phone keyboard moves the page. Empty
 * results and network errors render explanatory rows — no silent failures.
 *
 * Props:
 *  - value: current text
 *  - onChangeText(text)
 *  - onSelect({name, address, lat, lng})
 *  - committedValue: the currently selected address — typing it back
 *    (or programmatic prefills) won't re-trigger a search
 *  - placeholder, icon, bias {lat,lng}, autoFocus
 */
export default function PlaceSearch({
  value,
  onChangeText,
  onSelect,
  committedValue,
  placeholder = "Rechercher un lieu…",
  icon: Icon = MapPin,
  bias,
  autoFocus = false,
  onFocusChange,
}) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // 'idle' | 'ok' | 'empty' | 'error' — what the last completed search found
  const [outcome, setOutcome] = useState("idle");
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const selectedRef = useRef(false);
  const listId = useId();

  // Close on click outside both the input and the portaled list
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current = false;
      return undefined;
    }
    // Programmatic prefill or retyping the chosen address — nothing to search
    if (committedValue && value === committedValue) {
      return undefined;
    }
    if (!value || value.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setOutcome("idle");
      return undefined;
    }

    let ignore = false;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        let url = `/api/geo/search?q=${encodeURIComponent(value)}`;
        if (bias) url += `&lat=${bias.lat}&lng=${bias.lng}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (ignore) return;

        if (!res.ok) {
          setResults([]);
          setOutcome("error");
        } else {
          setResults(data.results || []);
          setOutcome((data.results || []).length > 0 ? "ok" : "empty");
        }
        setOpen(true);
        setHighlight(-1);
      } catch {
        if (ignore) return;
        setResults([]);
        setOutcome("error");
        setOpen(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }, 180);

    return () => {
      ignore = true;
      clearTimeout(timerRef.current);
    };
  }, [value, bias?.lat, bias?.lng, committedValue]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(r) {
    selectedRef.current = true;
    onSelect(r);
    setOpen(false);
    setResults([]);
    setOutcome("idle");
    inputRef.current?.blur(); // closes the phone keyboard once a place is chosen
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      choose(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && (results.length > 0 || outcome === "empty" || outcome === "error");

  const dropdown = showDropdown ? (
    <div
      role="listbox"
      id={listId}
      className="card"
      style={{
        marginTop: 6,
        boxShadow: "var(--shadow-md)",
        overflow: "hidden",
        maxHeight: 300,
        overflowY: "auto",
      }}
    >
      {results.map((r, i) => (
        <button
          key={`${r.lat}-${r.lng}-${i}`}
          role="option"
          aria-selected={i === highlight}
          onPointerDown={(e) => e.preventDefault()} // keep focus so the tap lands
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => choose(r)}
          onMouseEnter={() => setHighlight(i)}
          className="w-full"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "11px 14px",
            textAlign: "left",
            background: i === highlight ? "var(--ink-100)" : "transparent",
            transition: "background 120ms",
            borderBottom: "1px solid var(--ink-100)",
          }}
        >
          <MapPin size={15} style={{ marginTop: 3, color: "var(--ink-400)", flexShrink: 0 }} />
          <span className="flex-1" style={{ minWidth: 0 }}>
            <span className="small truncate" style={{ display: "block", fontWeight: 600 }}>
              {r.name}
            </span>
            <span className="tiny muted truncate" style={{ display: "block" }}>
              {r.address}
            </span>
          </span>
        </button>
      ))}

      {results.length === 0 && outcome === "empty" && (
        <div className="flex items-center gap-2" style={{ padding: "13px 14px" }}>
          <SearchX size={15} style={{ color: "var(--ink-400)", flexShrink: 0 }} />
          <span className="tiny muted"> Aucun lieu trouvé — essayez d’ajouter le nom de la rue ou de la ville </span>
        </div>
      )}

      {results.length === 0 && outcome === "error" && (
        <div className="flex items-center gap-2" style={{ padding: "13px 14px" }}>
          <WifiOff size={15} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <span className="tiny" style={{ color: "var(--danger)" }}>
            {" "}
            Impossible de joindre le serveur — vérifiez votre connexion et actualisez la page{" "}
          </span>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className="input-wrap">
        {loading ? <Loader2 size={17} style={{ animation: "spin 700ms linear infinite" }} /> : <Icon size={17} />}
        <input
          ref={inputRef}
          className="input"
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          onFocus={() => {
            onFocusChange?.(true);
            if (results.length > 0 || outcome !== "idle") setOpen(true);
          }}
          onBlur={() => onFocusChange?.(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={Boolean(showDropdown)}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>

      {dropdown}
    </div>
  );
}
