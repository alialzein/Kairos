import { BenchAvatar } from "./BenchAvatar";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BenchAvatarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <BenchAvatar
      tier={one(sp.tier)}
      webgl={one(sp.webgl) === "1"}
      demo={one(sp.demo) === "1"}
      state={one(sp.state)}
    />
  );
}
