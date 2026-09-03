"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function errorCodeFor(message: string): "signup-disabled" | "otp-failed" {
  const m = message.toLowerCase();
  if (
    m.includes("signups not allowed") ||
    m.includes("otp_disabled") ||
    m.includes("signup_disabled")
  ) {
    return "signup-disabled";
  }
  return "otp-failed";
}

export async function sendMagicLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/login?error=missing-email");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirm`,
      shouldCreateUser: process.env.ALLOW_SIGNUP === "true",
    },
  });
  if (error) {
    console.error("sendMagicLink failed:", error.message);
    redirect(`/login?error=${errorCodeFor(error.message)}`);
  }
  redirect("/login?sent=1");
}
