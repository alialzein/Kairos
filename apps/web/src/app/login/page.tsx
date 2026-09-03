import { sendMagicLink } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "missing-email": "Enter your email address.",
  "invalid-link": "That sign-in link is invalid or expired. Request a new one.",
  "signup-disabled": "Sign-ups are closed. Ask the owner for access.",
  "otp-failed": "Could not send the magic link. Try again in a minute.",
};

function errorMessageFor(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return ERROR_MESSAGES[code] ?? "Something went wrong. Try again.";
}

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const sent = params.sent === "1";
  const denied = params.denied === "1";
  const error = errorMessageFor(typeof params.error === "string" ? params.error : undefined);
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
