import { login } from "@/app/actions/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-8">Log in</h1>

      {searchParams.message && (
        <p className="font-mono text-sm text-forest mb-6">{searchParams.message}</p>
      )}

      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      <form action={login} className="flex flex-col gap-4">
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Password</label>
          <input
            name="password"
            type="password"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          Log in
        </button>
      </form>

      <p className="font-mono text-xs text-paper/50 mt-6">
        Don&apos;t have an account?{" "}
        <a href="/signup" className="text-gold">
          Sign up
        </a>
      </p>
    </main>
  );
}
