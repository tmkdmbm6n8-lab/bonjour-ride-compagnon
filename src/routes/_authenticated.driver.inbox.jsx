import SwipeInboxItem from "@/components/driver/SwipeInboxItem";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Plus, Send, ShieldCheck, ChevronRight } from "lucide-react";
import DriverLayout from "@/components/DriverLayout";
import useDriverData from "@/hooks/useDriverData";
import { apiFetch } from "@/lib/archive-fetch";
import { useSession } from "@/lib/archive-auth";
import Modal from "@/components/ui/Modal";
import { Loading } from "@/components/ui/bits";


function InboxPage() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const hidden = useRef(new Map());
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectCategory, setSubjectCategory] = useState("");
  const [compose, setCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [read, setRead] = useState({});
  const [warningOpen, setWarningOpen] = useState(false);

  const { data: session } = useSession();
  const readKey = `strasdrive:inbox-read:${session?.user?.id || "account"}`;
  const { data, error, reload } = useDriverData(`/api/drivers/me/inbox?page=${page}`, 15000);
  const { data: driverData } = useDriverData('/api/drivers/me', 15000);
  const activeWarnings = driverData?.driver?.activeWarningsCount || 0;
  const requestSubject = subjectCategory === "other" ? subject.trim() : subjectCategory;

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
    ];
    setEntries((previous) =>
      [...new Map([...(page === 1 ? [] : previous), ...next].map((item) => [item.id, item])).values()].filter(item => hidden.current.get(item.id) !== item.updatedAt).sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    );
  }, [data, page]);

  const selected = entries.find((entry) => entry.id === selectedId);
  const historyRef = useRef(null), followTail = useRef(true), openedThread = useRef(null);
  useEffect(() => {
    const isNewThread = openedThread.current !== selectedId;
    openedThread.current = selectedId;
    if (!selectedId) return;
    if (isNewThread) followTail.current = true;
    if (followTail.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [selectedId, selected?.messages?.length]);

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
    if (compose && !requestSubject) { setSendError("Choisissez un objet ou précisez votre demande dans Autre."); return; }
    setSending(true);
    setSendError("");
    try {
      const path =
        compose || selected?.kind === "support"
          ? "/api/drivers/me/inbox/support"
          : `/api/rides/${selected.targetId}/messages`;
      const response = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify({ text, ...(compose ? { subject: requestSubject } : { id: selected.targetId }) }),
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
      followTail.current = true;
      setText("");
      setCompose(false);
      reload();
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }

  const visible = entries;
  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError('');
    try {
      const response = await apiFetch('/api/drivers/me/inbox/support', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteTarget.targetId, expectedUpdatedAt: deleteTarget.updatedAt }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Suppression impossible');
      hidden.current.set(deleteTarget.id, deleteTarget.updatedAt);
      setEntries(old => old.filter(item => item.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null); reload();
    } catch (error) { setDeleteError(error.message); }
    finally { setDeleting(false); }
  }

  return (
    <div className="driver-tab-page inbox-page drv-cockpit-page">
      {/* ── En-tête ── */}
      <div className="driver-tab-title">
        <div>
          <h1>Inbox</h1>
        </div>
        <button
          className="driver-icon-button"
          onClick={() => {
            setCompose(true);
            setSelectedId(null);
            setText("");
            setSubject("");
            setSubjectCategory("");
            setSendError("");
          }}
          aria-label="Nouvelle demande d'assistance"
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="drv-inbox-filters"><span className="drv-inbox-pill active">Administration</span></div>

      {activeWarnings > 0 && <button type="button" className="driver-warning-summary" onClick={() => setWarningOpen(true)}>
        <ShieldCheck size={20} /> <span><strong>{activeWarnings} avertissement{activeWarnings > 1 ? 's' : ''} actif{activeWarnings > 1 ? 's' : ''}</strong><small>Appuyez pour voir les informations</small></span><ChevronRight size={18} />
      </button>}
      <Modal open={warningOpen} onClose={() => setWarningOpen(false)} title="Vos avertissements" portal keyboardSafe sheetOnMobile={false}>
        <p>Vous avez {activeWarnings} avertissement{activeWarnings > 1 ? 's' : ''} actif{activeWarnings > 1 ? 's' : ''}.</p>
        <p className="mt-3">À trois avertissements actifs, votre compte chauffeur sera suspendu définitivement. Contactez l’assistance si vous avez besoin de précisions.</p>
        <button type="button" className="btn btn-secondary btn-full mt-4" onClick={() => setWarningOpen(false)}>Fermer</button>
      </Modal>

      {error && (
        <p className="driver-notice" role="alert">
          {error}
          <button className="driver-chip" onClick={reload}>
            Réessayer
          </button>
        </p>
      )}

      {!data && !entries.length && !error && <Loading label="Chargement des conversations…" />}

      {data && !visible.length && activeWarnings === 0 && (
        <div className="drv-inbox-empty">
          <MessagesSquare size={36} />
          <p>Aucun message dans cette section.</p>
          <button
            className="drv-action-pill"
            onClick={() => {
              setCompose(true);
              setSelectedId(null);
              setSubjectCategory(""); setSubject(""); setSendError("");
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
            <SwipeInboxItem key={entry.id} label={entry.subject} onDelete={() => { setDeleteTarget(entry); setDeleteError(''); }}>
            <button className={`drv-inbox-card ${isUnread ? "unread" : ""}`} onClick={() => open(entry)}>
              <div className="drv-inbox-card-header">
                <div className="drv-inbox-source">
                  <span className="drv-badge-support"><ShieldCheck size={13} /> Administration</span>
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
            </SwipeInboxItem>
          );
        })}
      </div>

      {data?.hasMore && (
        <button className="drv-load-more-btn" onClick={() => setPage((n) => n + 1)}>
          Charger les échanges plus anciens
        </button>
      )}

      <Modal open={Boolean(deleteTarget)} onClose={() => { if (!deleting) setDeleteTarget(null); }} title="Supprimer cette conversation ?" portal keyboardSafe sheetOnMobile={false} closable={!deleting}>
        <p>Êtes-vous sûr de vouloir retirer cette conversation de votre Inbox ?</p>
        <p className="small muted mt-2">L’administration conserve sa copie. Une nouvelle réponse fera réapparaître la conversation.</p>
        {deleteError && <p role="alert" className="driver-notice mt-3">{deleteError}</p>}
        <div className="flex gap-2 mt-4">
          <button className="btn btn-secondary flex-1" disabled={deleting} onClick={() => setDeleteTarget(null)}>Annuler</button>
          <button className="btn btn-primary flex-1" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Suppression…' : 'Supprimer'}</button>
        </div>
      </Modal>

      {/* ── Volet de conversation ── */}
      <Modal
        open={Boolean(selected || compose)}
        onClose={() => {
          setSelectedId(null);
          setCompose(false);
        }}
        title={compose ? "Nouvel échange avec l'administration" : selected?.subject}
        maxWidth={620}
        fullScreen={Boolean(selected) && !compose}
        portal
        keyboardSafe
      >
        <div
          className={`inbox-conversation ${compose ? 'inbox-new-request' : 'admin-inbox-conversation'}`}
        >
          {compose && <div className="inbox-request-subject">
            <label htmlFor="support-subject">Objet de la demande</label>
            <select id="support-subject" className="input drv-input" value={subjectCategory} onChange={event => { setSubjectCategory(event.target.value); setSendError(''); }} required>
              <option value="" disabled>Choisissez un objet</option>
              {['Course et prise en charge','Annulation de course','Paiement d’une course','Portefeuille et virement','Documents professionnels','Véhicule et gamme','Comportement d’un passager','Objet oublié','Problème de GPS ou d’application','Compte et accès'].map(option => <option value={option} key={option}>{option}</option>)}
              <option value="other">Autre</option>
            </select>
            {subjectCategory === 'other' && <input className="input drv-input" aria-label="Précisez l’objet" placeholder="Précisez l’objet de votre demande…" value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} required />}
          </div>}

          {!compose && <div className="inbox-messages drv-chat-box" ref={historyRef} onScroll={event => { const list = event.currentTarget; followTail.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48; }} tabIndex={0} aria-label="Messages de la conversation">
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
          </div>}

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
                rows={2}
                required
                maxLength={selected?.kind === "ride" ? 500 : 4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="drv-cta-btn" aria-label={sending ? "Envoi en cours" : "Envoyer"} disabled={sending || !text.trim() || (compose && !requestSubject)}>
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
