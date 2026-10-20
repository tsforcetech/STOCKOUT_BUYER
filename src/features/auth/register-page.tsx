import { useNavigate, useSearchParams } from "react-router";
import { RegisterForm } from "./auth-forms";
import { PageFrame } from "./auth-shell";
import { safeNext } from "./safe-next";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  return (
    <RegisterForm
      Frame={PageFrame}
      onDone={() => navigate(safeNext(next), { replace: true })}
      login={{ to: next ? `/login?next=${encodeURIComponent(next)}` : "/login" }}
    />
  );
}
