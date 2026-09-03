import { sendMagicLink } from "./actions";

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const sent = params.sent === "1";
  const denied = params.denied === "1";
  const error = typeof params.error === "string" ? params.error : undefined;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold text-twin-particle">Sign in to Kairos</h1>
      {denied && <p className="text-twin-offline">This account is not the Owner.</p>}
      {error && <p className="text-twin-offline">{error}</p>}
      {sent ? (
        <p>Check your inbox for the magic link.</p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded border border-twin-particle-deep bg-transparent p-2"
          />
          <button type="submit" className="rounded bg-twin-particle p-2 font-medium text-black">
            Send magic link
          </button>
        </form>
      )}
    </main>
  );
}
