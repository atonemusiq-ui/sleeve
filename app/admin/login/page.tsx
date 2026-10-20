import Link from "next/link";
import { redirect } from "next/navigation";
import FybyLogo, { FybyWordmark } from "@/app/FybyLogo";
import PasswordInput from "@/app/PasswordInput";
import { adminLogin } from "@/app/actions/adminTeam";
import { getAdmin } from "@/lib/admin";
import ShieldIcon from "@/app/admin/ShieldIcon";

export const dynamic = "force-dynamic";

// The back office's own front door -- separate from the fan/artist login so
// the team has one place to sign in, and nobody off the team gets through.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  if (await getAdmin()) redirect("/admin");

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <Link href="/" className="flex items-center justify-center gap-2.5 mb-6">
        <FybyLogo className="h-9 w-9" />
        <FybyWordmark className="text-3xl" />
      </Link>

      <div className="border border-gold/30 bg-gold/5 rounded-2xl px-6 py-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldIcon className="h-5 w-5 text-gold" />
          <h1 className="font-display text-2xl text-paper">Admin login</h1>
        </div>
        <p className="font-mono text-xs text-paper/50 text-center mb-8">
          Fyby back office · team members only
        </p>

        {searchParams.message && <p className="font-mono text-sm text-forest mb-5">{searchParams.message}</p>}
        {searchParams.error && <p className="font-mono text-sm text-rust mb-5">{searchParams.error}</p>}

        <form action={adminLogin} className="flex flex-col gap-4">
          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1">Admin email</label>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
            />
          </div>
          <div>
            <label className="block font-mono text-xs text-paper/60 mb-1">Password</label>
            <PasswordInput
              name="password"
              autoComplete="current-password"
              required
              className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
            />
          </div>
          <button
            type="submit"
            className="mt-2 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
          >
            Sign in to back office
          </button>
        </form>

        <p className="font-mono text-xs text-paper/50 mt-6">
          <Link href="/forgot-password" className="text-gold">
            Forgot password?
          </Link>
        </p>
      </div>

      <p className="font-mono text-[11px] text-paper/30 text-center mt-6">
        Not on the team?{" "}
        <Link href="/login" className="hover:text-gold underline">
          Go to the regular Fyby login
        </Link>
      </p>
    </main>
  );
}
