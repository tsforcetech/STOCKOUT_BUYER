import { ForgotPasswordForm } from "./auth-forms";
import { PageFrame } from "./auth-shell";

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm Frame={PageFrame} back={{ to: "/login" }} />;
}
