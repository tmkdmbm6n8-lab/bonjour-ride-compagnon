import AccountModeSwitch from '@/components/shell/AccountModeSwitch';
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LifeBuoy, Wallet, ReceiptText, UserRound, Tag, Info } from "lucide-react";
import Link, { usePathname } from "@/lib/archive-navigation";
import { apiFetch } from "@/lib/archive-fetch";
import { signOut } from "@/lib/archive-auth";
import { Avatar, money } from "@/components/ui/bits";
import Modal from "@/components/ui/Modal";

export default function RiderAccountMenu({ user }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(null);
  const [balance, setBalance] = useState(null);
  const root = useRef(null);
  const trigger = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
    setPanel(null);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiFetch("/api/users/me")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setBalance(data.user?.wallet?.balance ?? null);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    const outside = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const key = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === "Tab") {
        const items = root.current?.querySelectorAll("a, button");
        const first = items?.[0],
          last = items?.[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      cancelled = true;
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const showPanel = (value) => {
    setOpen(false);
    setPanel(value);
  };
  return (
    <div className="rider-account" ref={root}>
      <Link href="/rides" className="rider-activity-button" aria-current={pathname === "/rides" ? "page" : undefined}>
        <ReceiptText size={16} /> Activité
      </Link>
      <button
        ref={trigger}
        className="rider-account-trigger"
        onClick={() => setOpen(!open)}
        aria-label="Ouvrir le menu du compte"
        aria-expanded={open}
        aria-controls="rider-account-popover"
      >
        <Avatar name={user?.name || ""} src={user?.avatar || ""} size="sm" />
        <ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div id="rider-account-popover" className="rider-account-popover" role="region" aria-label="Menu du compte">
          <div className="rider-account-heading">
            <h2>{user?.name || "Mon compte"}</h2>
            <Avatar name={user?.name || ""} src={user?.avatar || ""} size="lg" />
          </div>
          <div className="rider-account-shortcuts">
            <button onClick={() => showPanel("help")}>
              <LifeBuoy size={23} />
              Aide
            </button>
            <Link href="/wallet">
              <Wallet size={23} />
              Wallet
            </Link>
            <Link href="/rides">
              <ReceiptText size={23} />
              Activité
            </Link>
          </div>
          <Link href="/wallet" className="rider-account-balance">
            <span>StrasDrive Cash</span>
            <strong>{balance === null ? "—" : money(balance)}</strong>
          </Link>
          {(user?.role === "driver" || user?.canDrive) && <AccountModeSwitch mode="driver"/>}
          {user?.role === "admin" && <Link href="/admin/dashboard" className="btn btn-secondary btn-full">Administration</Link>}
          <div className="rider-account-links">
            <Link href="/profile">
              <UserRound size={17} />
              Gérer le compte
            </Link>
            <button onClick={() => showPanel("bonus")}>
              <Tag size={17} />
              Bonus
            </button>
            <button onClick={() => showPanel("legal")}>
              <Info size={17} />
              Légal
            </button>
          </div>
          <button className="rider-account-signout" onClick={() => signOut({ callbackUrl: "/" })}>
            Se déconnecter
          </button>
        </div>
      )}
      <Modal
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel === "help" ? "Aide" : panel === "bonus" ? "Bonus" : "Informations légales"}
      >
        {panel === "help" && (
          <div className="flex-col gap-3">
            <p>Retrouvez les informations de votre trajet et ses détails dans votre activité.</p>
            <Link className="btn btn-secondary" href="/rides" onClick={() => setPanel(null)}>
              Aide sur une course
            </Link>
            <Link className="btn btn-secondary" href="/profile" onClick={() => setPanel(null)}>
              Gérer mon compte
            </Link>
          </div>
        )}
        {panel === "bonus" && <p>Aucun bonus n’est disponible pour le moment.</p>}
        {panel === "legal" && (
          <div className="flex-col gap-3">
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/terms">Conditions d’utilisation</Link>
            <Link href="/privacy">Politique de confidentialité</Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
