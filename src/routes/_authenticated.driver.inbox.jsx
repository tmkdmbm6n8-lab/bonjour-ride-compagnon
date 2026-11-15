import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessagesSquare, Plus, Send, ShieldCheck, Car, ChevronRight } from "lucide-react";
import DriverLayout from "@/components/DriverLayout";
import useDriverData from "@/hooks/useDriverData";
import { apiFetch } from "@/lib/archive-fetch";
import { useSession } from "@/lib/archive-auth";
import Modal from "@/components/ui/Modal";
import { Loading } from "@/components/ui/bits";
import useVisualViewport from "@/hooks/useVisualViewport";

function InboxPage() {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [compose, setCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [read, setRead] = useState({});

  const { data: session } = useSession();
  const readKey = `strasdrive:inbox-read:${session?.user?.id || "account"}`;
  const { data, error, reload } = useDriverData(`/api/drivers/me/inbox?page=${page}`, 15000);
  const viewport = useVisualViewport(Boolean(selectedId || compose));

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(readKey) || "{}");
      setRead(stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {});
    } catch {
      setRead({});
    }
  }, [readKey]);

  useEffect(() => {
    if (!data) return;
    const next = [
      ...data.threads.map((thread) => ({
        id: `support:${thread.id}`,
        targetId: thread.id,
        kind: "support",
        category: "support",
        subject: thread.subject,
        messages: thread.messages,
        status: thread.status,
        updatedAt: thread.updatedAt,
      })),
      ...data.rides.map((ride) => ({
        id: `ride:${ride.id}`,
        targetId: ride.id,
        kind: "ride",
        category: "ride",
        subject: `Course · ${ride.dropoff?.address || "Passager"}`,
        messages: (ride.messages || []).map((message, index) => ({
          ...message,
          id: message.id || `${ride.id}:${index}`,
          createdAt: message.at || message.createdAt,
        })),
        status: ride.status,
        updatedAt: ride.messages?.at(-1)?.at || ride.created_at,
      })),
    ];
    setEntries((previous) =>
      [...new Map([...previous, ...next].map((item) => [item.id, item])).values()].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    );
  }, [data]);

  const selected = entries.find((entry) => entry.id === selectedId);

  function open(entry) {
    setSelectedId(entry.id);
    setText("");
    setSendError("");
    const next = { ...read, [entry.id]: entry.updatedAt };
    setRead(next);
    try {
      localStorage.setItem(readKey, JSON.stringify(next));
    } catch {}
  }

  async function send(event) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError("");
    try {
      const path =
        compose || selected?.kind === "support"
          ? "/api/drivers/me/inbox/support"
          : `/api/rides/${selected.targetId}/messages`;
      const response = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ text, ...(compose ? { subject } : { id: selected.targetId }) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Envoi impossible");

      if (payload.thread) {
        const thread = payload.thread;
        const entry = {
          id: `support:${thread.id}`,
          targetId: thread.id,
          kind: "support",
          category: "support",
          subject: thread.subject,
          messages: thread.messages,
          status: thread.status,
          updatedAt: thread.updatedAt,
        };
        setEntries((old) => [entry, ...old.filter((item) => item.id !== entry.id)]);
        setSelectedId(entry.id);
      }
      setText("");
      setCompose(false);
      reload();
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }

  const visible = entries.filter((entry) => filter === "all" || entry.category === filter);

  return (
    <div className="driver-tab-page inbox-page drv-cockpit-page">
      {/* ── En-tête ── */}
      <div className="driver-tab-title">
        <div>
          <p className="drv-eyebrow">Centre de messagerie</p>
          <h1>Inbox</h1>
        </div>
        <button
          className="driver-icon-button"
          onClick={() => {
            setCompose(true);
            setSelectedId(null);
            setText("");
            setSubject("");
            setSendError("");
          }}
          aria-label="Nouvelle demande d'assistance"
        >
          <Plus size={22} />
        </button>
      </div>

      {/* ── Filtres cockpit ── */}
      <div className="drv-inbox-filters">
        <button className={`drv-inbox-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          Tous ({entries.length})
        </button>
        <button
          className={`drv-inbox-pill ${filter === "support" ? "active" : ""}`}
          onClick={() => setFilter("support")}
        >
          Administration
        </button>
        <button className={`drv-inbox-pill ${filter === "ride" ? "active" : ""}`} onClick={() => setFilter("ride")}>
          Passagers
        </button>
      </div>

      {error && (
        <p className="driver-notice" role="alert">
          {error}
          <button className="driver-chip" onClick={reload}>
            Réessayer
          </button>
        </p>
      )}

      {!data && !entries.length && !error && <Loading label="Chargement des conversations…" />}

      {data && !visible.length && (
        <div className="drv-inbox-empty">
          <MessagesSquare size={36} />
          <p>Aucun message dans cette section.</p>
          <button
            className="drv-action-pill"
            onClick={() => {
              setCompose(true);
              setSelectedId(null);
            }}
          >
            Écrire à l'administration
          </button>
        </div>
      )}

      {/* ── Liste des cartes de conversations ── */}
      <div className="drv-inbox-cards">
        {visible.map((entry) => {
          const isUnread = read[entry.id] !== entry.updatedAt;
          const lastMsg = entry.messages?.at(-1);

          return (
            <button key={entry.id} className={`drv-inbox-card ${isUnread ? "unread" : ""}`} onClick={() => open(entry)}>
              <div className="drv-inbox-card-header">
                <div className="drv-inbox-source">
                  {entry.kind === "support" ? (
                    <span className="drv-badge-support">
                      <ShieldCheck size={13} /> Administration
                    </span>
                  ) : (
                    <span className="drv-badge-ride">
                      <Car size={13} /> Course
                    </span>
                  )}
                  {isUnread && <span className="drv-unread-dot" aria-label="Non lu" />}
                </div>
                <time className="drv-inbox-time">
                  {new Intl.DateTimeFormat("fr-FR", {
                    timeZone: "Europe/Paris",
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(entry.updatedAt))}
                </time>
              </div>

              <div className="drv-inbox-card-body">
                <strong>{entry.subject}</strong>
                <p>{lastMsg?.text || "Nouvelle discussion ouverte"}</p>
              </div>

              <div className="drv-inbox-card-footer">
                <span>
                  {entry.messages?.length || 1} message{(entry.messages?.length || 1) > 1 ? "s" : ""}
                </span>
                <ChevronRight size={15} />
              </div>
            </button>
          );
        })}
      </div>

      {data?.hasMore && (
        <button className="drv-load-more-btn" onClick={() => setPage((n) => n + 1)}>
          Charger les échanges plus anciens
        </button>
      )}

      {/* ── Volet de conversation ── */}
      <Modal
        open={Boolean(selected || compose)}
        onClose={() => {
          setSelectedId(null);
          setCompose(false);
        }}
        title={compose ? "Nouvel échange avec l'administration" : selected?.subject}
        maxWidth={620}
        keyboardSafe
      >
        <div
          className="inbox-conversation"
          style={viewport ? { maxHeight: Math.max(160, viewport.height - 160) } : undefined}
        >
          {compose && (
            <input
              className="input drv-input"
              placeholder="Objet de la demande…"
              aria-label="Sujet"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={160}
              required
            />
          )}

          <div className="inbox-messages drv-chat-box">
            {selected?.messages.map((message) => (
              <div key={message.id} className={`drv-chat-bubble ${message.from === "driver" ? "mine" : "theirs"}`}>
                <div className="drv-chat-meta">
                  <span>
                    {message.from === "admin"
                      ? "StrasDrive Régulation"
                      : message.from === "driver"
                        ? "Vous"
                        : "Passager"}
                  </span>
                  {message.createdAt && (
                    <time>
                      {new Intl.DateTimeFormat("fr-FR", {
                        timeZone: "Europe/Paris",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(message.createdAt))}
                    </time>
                  )}
                </div>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          {sendError && (
            <p role="alert" className="driver-notice">
              {sendError}
            </p>
          )}

          {compose ||
          selected?.kind === "support" ||
          ["accepted", "arrived", "in_progress"].includes(selected?.status) ? (
            <form className="inbox-compose drv-chat-compose" onSubmit={send}>
              <textarea
                className="input drv-textarea"
                aria-label="Votre message"
                placeholder="Écrivez votre message…"
                required
                maxLength={selected?.kind === "ride" ? 500 : 4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="drv-cta-btn" disabled={sending || !text.trim()}>
                <Send size={16} />
                <span>{sending ? "Envoi…" : "Envoyer"}</span>
              </button>
            </form>
          ) : (
            <p className="driver-muted text-center" style={{ fontSize: "13px", padding: "10px 0" }}>
              Cette course est clôturée. L’historique des échanges reste sécurisé.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/driver/inbox")({
  head: () => ({ meta: [{ title: "Inbox · StrasDrive" }] }),
  component: () => (
    <DriverLayout>
      <InboxPage />
    </DriverLayout>
  ),
});
