import Link from "next/link";
import { getAdmin } from "@/lib/admin";
import { adminLogout } from "@/app/actions/adminTeam";
import ShieldIcon from "@/app/admin/ShieldIcon";
import AdminNavLinks from "@/app/admin/AdminNavLinks";

export const dynamic = "force-dynamic";

// Every back-office screen gets the same bar: where you are, every section,
// who's signed in, and a sign-out. Hidden on /admin/login (not signed in).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();

  return (
    <>
      {admin && (
        <div data-no-translate className="border-b border-gold/25 bg-gold/5">
          <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link href="/admin" className="inline-flex items-center gap-2 text-gold">
                <ShieldIcon className="h-4 w-4" />
                <span className="font-mono text-xs uppercase tracking-widest">Fyby back office</span>
              </Link>
              <div className="flex items-center gap-3 font-mono text-[11px] text-paper/60">
                <span className="truncate max-w-[180px]">
                  {admin.email} · {admin.role === "owner" ? "Owner" : "Moderator"}
                </span>
                <form action={adminLogout}>
                  <button type="submit" className="px-2.5 py-1 rounded border border-paper/20 hover:border-rust/60 hover:text-rust">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
            <AdminNavLinks />
          </div>
        </div>
      )}
      {/* The back office stays in English (app/AutoTranslate.tsx skips it). */}
      <div data-no-translate>{children}</div>
    </>
  );
}
