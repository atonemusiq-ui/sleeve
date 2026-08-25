import { signup } from "@/app/actions/auth";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl text-gold mb-8">Create your account</h1>

      {searchParams.error && (
        <p className="font-mono text-sm text-rust mb-6">{searchParams.error}</p>
      )}

      <form action={signup} className="flex flex-col gap-4">
        <div>
          <label className="block font-mono text-xs text-paper/60 mb-1">Display name</label>
          <input
            name="displayName"
            required
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

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
            minLength={6}
            className="w-full bg-paper/5 border border-paper/20 rounded px-3 py-2 text-paper"
          />
        </div>

        <fieldset>
          <legend className="block font-mono text-xs text-paper/60 mb-2">I am a...</legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 font-body">
              <input type="radio" name="role" value="artist" defaultChecked />
              Artist
            </label>
            <label className="flex items-center gap-2 font-body">
              <input type="radio" name="role" value="fan" />
              Fan
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-4 bg-gold text-ink font-mono text-sm font-medium rounded px-4 py-2.5 hover:opacity-90"
        >
          Sign up
        </button>
      </form>

      <p className="font-mono text-xs text-paper/50 mt-6">
        Already have an account?{" "}
        <a href="/login" className="text-gold">
          Log in
        </a>
      </p>
    </main>
  );
}
