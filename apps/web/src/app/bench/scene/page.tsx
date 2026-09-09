import { BenchScene } from "./BenchScene";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scene bench" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BenchScenePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <BenchScene
      query={{ phase: one(sp.phase), off: one(sp.off), only: one(sp.only) }}
      webgl={one(sp.webgl) === "1"}
      set={one(sp.set)}
      state={one(sp.state)}
      demo={one(sp.demo) === "1"}
      hold={one(sp.hold)}
    />
  );
}
