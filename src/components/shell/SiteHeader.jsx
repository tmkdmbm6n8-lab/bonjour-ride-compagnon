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
        zIndex: 30,
        background: "color-mix(in srgb, var(--bg) 90%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <nav
        className="flex items-center justify-between"
        style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 24px" }}
        aria-label="Navigation principale"
      >
        <Link href={user ? homeHref : "/"} aria-label="Accueil StrasDrive">
          <KovaLogo size={32} />
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href={homeHref} className="btn btn-primary btn-sm">
              Mon espace
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">
                {" "}
                Se connecter{" "}
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                {" "}
                Commencer{" "}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
