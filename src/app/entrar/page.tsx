import { googleEnabled } from "@/server/google";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  error: "No pudimos entrar con Google. Inténtalo otra vez.",
  inactivo: "Tu acceso a la barbería está inactivo.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  return <SignInForm google={googleEnabled()} notice={google ? notices[google] : undefined} />;
}
