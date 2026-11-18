import CloseControl from "@/components/ui/CloseControl";
import { MessageCircle } from 'lucide-react';

/**
 * Large, high-contrast banner shown at the top of the screen when a chat message
 * arrives while the chat is closed. Tapping it opens the conversation.
 */
export default function MessageAlert({ message, fromLabel, count = 1, onOpen, onDismiss }) {
  if (!message) return null;
  return (
    <div className="msg-alert" role="alert" aria-live="assertive">
      <button type="button" className="msg-alert-main" onClick={onOpen}>
        <span className="msg-alert-icon">
          <MessageCircle size={22} />
          {count > 1 && <span className="msg-alert-count mono-nums">{count}</span>}
        </span>
        <span className="msg-alert-body">
          <span className="msg-alert-title">
            {count > 1 ? `${count} nouveaux messages` : 'Nouveau message'} · {fromLabel}
          </span>
          <span className="msg-alert-text">{message.text}</span>
          <span className="msg-alert-cta">Touchez pour répondre</span>
        </span>
      </button>
      <CloseControl className="msg-alert-close" onClick={onDismiss} label="Fermer l’alerte" />
    </div>
  );
}
