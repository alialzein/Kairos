import { redirect } from "next/navigation";
import { isOwner, ownerIdsFromEnv } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;
  if (!sub) redirect("/login");
  if (!isOwner(sub, ownerIdsFromEnv())) redirect("/login?denied=1");
  return <>{children}</>;
}
