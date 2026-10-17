import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { registrationService } from "@/services/auth.service";
import { useAuth } from "@/lib/auth/auth-context";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { MIN_PASSWORD_LENGTH } from "@/api/types/registration";
import { AuthCard, AuthShell } from "./auth-shell";

/** The backend does no format validation on email/mobile, so the website validates them. */
const schema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(100),
    lastName: z.string().trim().min(1, "Enter your last name.").max(100),
    email: z.string().trim().email("Enter a valid email address.").max(255),
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,20}$/, "Enter a valid mobile number, e.g. +971 50 123 4567.")
      .max(50),
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirm: z.string(),
    terms: z.literal(true, { message: "Please accept the terms to continue." }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

type Values = z.infer<typeof schema>;

function normaliseMobile(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits.replace(/^0+/, "")}`;
}

export default function RegisterPage() {
  const [params] = useSearchParams();
  const [pending, setPending] = React.useState<{ userId: string; email: string } | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", mobile: "", password: "", confirm: "", terms: false as unknown as true },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await registrationService.register({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        displayName: `${v.firstName.trim()} ${v.lastName.trim()}`,
        email: v.email.trim().toLowerCase(),
        mobile: normaliseMobile(v.mobile),
        password: v.password,
      });
      setPending({ userId: res.userId, email: res.email });
    } catch (error) {
      const detail = isApiError(error) && typeof (error.body as { detail?: unknown })?.detail === "string" ? (error.body as { detail: string }).detail : "";
      if (isApiError(error) && error.status === 409 && /email/i.test(detail)) form.setError("email", { message: "An account with this email already exists. Try logging in." });
      else if (isApiError(error) && error.status === 409 && /mobile/i.test(detail)) form.setError("mobile", { message: "This mobile number is already registered." });
      else setFormError(getErrorMessage(error));
    }
  });

  if (pending) return <VerifyStep userId={pending.userId} email={pending.email} next={params.get("next")} />;

  const err = form.formState.errors;
  return (
    <AuthShell>
      <AuthCard title="Create your account" subtitle="Buy surplus materials and sell what you don't need">
        <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[440px] space-y-5">
          <FormError message={formError} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="First name" htmlFor="firstName" required error={err.firstName?.message}>
              <Input autoComplete="given-name" {...form.register("firstName")} />
            </FormField>
            <FormField label="Last name" htmlFor="lastName" required error={err.lastName?.message}>
              <Input autoComplete="family-name" {...form.register("lastName")} />
            </FormField>
          </div>
          <FormField label="Email" htmlFor="email" required error={err.email?.message}>
            <Input type="email" autoComplete="email" {...form.register("email")} />
          </FormField>
          <FormField label="Mobile number" htmlFor="mobile" required hint="Include the country code, e.g. +971." error={err.mobile?.message}>
            <Input type="tel" autoComplete="tel" placeholder="+971 50 123 4567" {...form.register("mobile")} />
          </FormField>
          <FormField label="Password" htmlFor="password" required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} error={err.password?.message}>
            <PasswordInput autoComplete="new-password" {...form.register("password")} />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirm" required error={err.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
          </FormField>
          <div>
            <label className="flex items-start gap-2 text-sm text-body">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--action-border)]" {...form.register("terms")} />
              <span>I agree to the StockOut terms of use and privacy policy.</span>
            </label>
            {err.terms && <p className="mt-1 text-xs text-danger-soft-foreground" role="alert">{err.terms.message}</p>}
          </div>
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to={params.get("next") ? `/login?next=${encodeURIComponent(params.get("next") ?? "")}` : "/login"} className="text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

function VerifyStep({ userId, email, next }: { userId: string; email: string; next: string | null }) {
  const { signInWithTokens } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await registrationService.confirm(userId, code);
      await signInWithTokens(tokens);
      navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : "/", { replace: true });
    } catch (err) {
      setError(isApiError(err) && err.status === 400 ? "That code is incorrect or has expired. Request a new one below." : getErrorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await registrationService.resendEmail(email);
      setInfo("If your account still needs verifying, a new code is on its way.");
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthShell>
      <AuthCard title="Verify your email" subtitle={<>We sent a 6-digit code to {email}.</>}>
        <form onSubmit={submit} noValidate className="mx-auto w-full max-w-[440px] space-y-8">
          <FormError message={error} />
          {info && !error && (
            <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
              {info}
            </p>
          )}
          <FormField label="Verification code" htmlFor="code" hint="The code expires after 10 minutes.">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 text-center font-heading text-2xl tracking-[0.5em]"
              autoFocus
            />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Verify and continue
          </Button>
          <div className="text-center text-sm">
            <button type="button" onClick={resend} disabled={cooldown > 0} className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
