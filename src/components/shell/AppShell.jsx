"use client";

import { useEffect, useRef } from "react";
import Link from "@/lib/archive-navigation";
import { usePathname } from "@/lib/archive-navigation";
import { useSession, signOut } from "@/lib/archive-auth";
import RiderAccountMenu from "@/components/shell/RiderAccountMenu";
import { LogOut } from "lucide-react";
import { KovaLogo } from "@/components/brand/KovaLogo";
import { Avatar } from "@/components/ui/bits";

/**
 * Authenticated app shell: sidebar on desktop, bottom tab bar on mobile.
 * @param {{nav: Array<{href:string,label:string,icon:any}>, children:any}} props
 */
export default function AppShell({ nav, children, variant = "default" }) {
  const shellRef = useRef(null);
  const sidebarRef = useRef(null);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    const update = () => shellRef.current?.style.setProperty("--shell-nav-height", `${sidebar.getBoundingClientRect().height}px`);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (variant !== 'driver') return undefined;
    const viewport = window.visualViewport;
    const update = () => {
      const shell = shellRef.current;
      if (!shell) return;
      shell.style.setProperty('--shell-visible-top', `${viewport?.offsetTop || 0}px`);
      shell.style.setProperty('--shell-visible-height', `${viewport?.height || window.innerHeight}px`);
    };
    update(); viewport?.addEventListener('resize', update); viewport?.addEventListener('scroll', update); window.addEventListener('resize', update);
    return () => { viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [variant]);
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const homeHref =
    variant === "rider" ? "/dashboard" : user?.role === "driver" ? "/driver/dashboard" : user?.role === "admin" ? "/admin/dashboard" : "/dashboard";

  return (
    <div ref={shellRef} className={`shell ${variant === "rider" ? "shell-rider" : variant === "admin" ? "shell-admin" : variant === "driver" ? "shell-driver" : ""} shell-dark`}>
      <aside ref={sidebarRef} className="sidebar">
        <div className="sidebar-brand">
          <Link href={homeHref} aria-label="Accueil StrasDrive">
            <KovaLogo size={30} light={true} />
          </Link>
        </div>

        <nav className="sidebar-nav" aria-label="Navigation principale">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={2} />
                <span>{label}</span>
              </Link>
            );
          })}
          {variant === "admin" && (
            <button type="button" className="nav-item admin-signout" onClick={() => signOut({ callbackUrl: "/" })} aria-label="Se déconnecter">
              <LogOut size={19} />
              <span>Déconnexion</span>
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          {variant === "rider" && <RiderAccountMenu user={user} />}
          <div className={variant === "rider" ? "rider-legacy-user" : undefined}>
            <div className="sidebar-user">
              <Avatar name={user?.name || ""} src={user?.avatar || ""} size="sm" />
              <div className="flex-1 truncate">
                <div className="small truncate" style={{ fontWeight: 600 }}>
                  {user?.name || "—"}
                </div>
                <div className="tiny muted truncate">@{user?.username || ""}</div>
              </div>
              {variant !== "admin" && <button
                className="btn btn-ghost btn-icon"
                style={{ minHeight: 36, width: 36 }}
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <LogOut size={17} />
              </button>}
            </div>
          </div>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
