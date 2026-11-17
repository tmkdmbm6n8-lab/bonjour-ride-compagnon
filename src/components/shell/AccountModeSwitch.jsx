import { useRef, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { apiFetch } from "@/lib/archive-fetch";
import { useRouter } from "@/lib/archive-navigation";

export default function AccountModeSwitch({ mode, className = "btn btn-secondary btn-full" }) {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/users/me/mode", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Changement de mode impossible");
      await router.push(mode === "rider" ? "/dashboard" : "/driver/dashboard");
    } catch (err) {
      setError(err.message || "Changement de mode impossible");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mb-3">
      <button type="button" className={className} disabled={busy} onClick={change}>
        <ArrowLeftRight size={18} />
        {busy
          ? "Veuillez patienter…"
          : mode === "rider"
            ? "Passer en mode Passager"
            : "Espace Chauffeur"}
      </button>
      {error && (
        <p role="alert" className="input-error-msg mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
