import { identity } from "@twin/config";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-4xl font-semibold tracking-tight text-twin-particle">
        {identity.twin_name}
      </h1>
      <p className="text-sm opacity-70">
        say “{identity.wake_phrase.en}” · {identity.wake_phrase.ar}
      </p>
    </main>
  );
}
