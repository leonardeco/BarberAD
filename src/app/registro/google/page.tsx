import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readPending } from "@/server/google";
import { GoogleSignupForm } from "./google-signup-form";

export const metadata = { title: "Termina tu registro" };

export default async function GoogleSignupPage() {
  const pending = readPending((await cookies()).get("barberad_google_signup")?.value);
  if (!pending) redirect("/registro");
  return <GoogleSignupForm email={pending.email} name={pending.name} />;
}
