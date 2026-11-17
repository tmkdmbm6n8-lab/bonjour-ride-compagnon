import { useState } from "react";
import { apiFetch } from "@/lib/archive-fetch";

export default function PersonalSupport() {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [subject, setSubject] = useState(""),
    [text, setText] = useState(""),
    [selected, setSelected] = useState("");
  async function load(next = 0) {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`/api/users/me/support?page=${next}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demandes indisponibles");
      setRows((previous) =>
        next
          ? [...new Map([...previous, ...data.requests].map((row) => [row.id, row])).values()]
          : data.requests,
      );
      setPage(next);
      setMore(data.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/users/me/support", {
        method: "POST",
        body: JSON.stringify({ id: selected || undefined, subject, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Envoi impossible");
      setText("");
      setSubject("");
      setSelected("");
      await load(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mb-4">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) load(0);
        }}
      >
        Mes demandes et réclamations
      </button>
      {open && (
        <div className="mt-3">
          <p className="tiny muted mb-3">
            Suivez vos demandes et les réponses de l’assistance. Pour une urgence, appelez les
            secours.
          </p>
          {rows.map((row) => (
            <details key={row.id} className="mb-3">
              <summary style={{ cursor: "pointer" }}>
                {row.subject} · {row.status === "resolved" ? "Clôturée" : "En cours"}
              </summary>
              <p className="tiny muted mt-2">Référence : {row.id}</p>
              {row.messages.map((message, index) => (
                <p
                  key={message.id || index}
                  className="small mt-2"
                  style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  <strong>{message.from === "admin" ? "Assistance" : "Vous"} : </strong>
                  {message.text}
                </p>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2"
                onClick={() => setSelected(row.id)}
              >
                Répondre
              </button>
            </details>
          ))}
          {!busy && !rows.length && <p className="small muted">Aucune demande pour ce compte.</p>}
          {more && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => load(page + 1)}
            >
              Afficher les demandes précédentes
            </button>
          )}
          <form onSubmit={submit} className="flex-col gap-3 mt-3">
            {selected ? (
              <div className="small">
                Répondre à la demande {selected}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelected("")}
                >
                  Nouvelle demande
                </button>
              </div>
            ) : (
              <label className="field">
                Objet
                <input
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={160}
                  required
                />
              </label>
            )}
            <label className="field">
              Votre message
              <textarea
                className="input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                minLength={1}
                maxLength={4000}
                rows={4}
                required
              />
            </label>
            <button className="btn btn-secondary btn-sm" disabled={busy}>
              {busy ? "Veuillez patienter…" : "Envoyer à l’assistance"}
            </button>
          </form>
          {error && (
            <p role="alert" className="input-error-msg mt-2">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
