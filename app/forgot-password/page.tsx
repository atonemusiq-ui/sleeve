import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { message?: string };
}) {
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-4">Reset your password</h1>
      <p className="text-paper/70 text-sm mb-8">
        Enter the email on your account and we&apos;ll send you a link to set a new password.
      </p>

      {searchParams.message && (
        <p className="font-mono text-sm text-forest mb-6">{searchParams.message}</p>
      )}

      <form action={requestPasswordReset} className="flex flex-col gap-4">
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          Send reset link
        </button>
      </form>

      <p className="font-mono text-xs text-paper/50 mt-6">
        <a href="/login" className="text-gold">
          Back to log in
        </a>
      </p>
    </main>
  );
}
