import Link from "@/lib/archive-navigation";
import { KovaLogo } from "@/components/brand/KovaLogo";
import { useSession } from "@/lib/archive-auth";

export default function SiteHeader() {
  const { data: session } = useSession();
  const user = session?.user;
  const homeHref =
    user?.role === "driver" ? "/driver/dashboard" : user?.role === "admin" ? "/admin/dashboard" : "/dashboard";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        // Keep navigation below the iPhone status bar in the native WebView.
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        zIndex: 30,
        background: "color-mix(in srgb, var(--bg) 90%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <nav
        className="site-header-nav flex items-center justify-between"
        aria-label="Navigation principale"
      >
        <Link href={user ? homeHref : "/"} className="site-header-brand" aria-label="Accueil StrasDrive">
          <KovaLogo size={32} />
        </Link>
        <div className="site-header-actions flex items-center gap-3">
          {user ? (
            <Link href={homeHref} className="btn btn-primary btn-sm">
              Mon espace
            </Link>
          ) : (
            <>
              <Link href="/signup" className="btn btn-secondary btn-sm site-start-btn">
                {" "}
                Commencer{" "}
              </Link>
              <Link href="/login" className="btn btn-gold btn-sm" style={{ color: '#0b0c10' }}>
                {" "}
                Se connecter{" "}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
