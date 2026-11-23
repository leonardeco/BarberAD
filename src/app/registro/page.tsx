import { googleEnabled } from "@/server/google";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return <RegisterForm google={googleEnabled()} />;
}
