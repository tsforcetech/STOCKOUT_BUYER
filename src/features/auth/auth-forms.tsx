import * as React from "react";
import { Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useAuth, type MfaChallenge } from "@/lib/auth/auth-context";
import { authService, registrationService } from "@/services/auth.service";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { MIN_PASSWORD_LENGTH } from "@/api/types/registration";
import { appliesTo } from "@/features/legal/policy-gate";
import { usePolicies } from "@/features/legal/queries";
import { saveSignupConsent } from "@/features/legal/signup-consent";

/**
 * Login, registration and forgot-password forms shared by the full pages (/login, /register, /forgot-password)
 * and the sign-in popup. Each step renders through `Frame`, so the page shows it in AuthCard and the popup in its
 * own header. Links between forms are either routes (`to`) or popup mode switches (`onClick`).
 */
export type AuthFrame = (props: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
export type AuthLink = { to: string } | { onClick: () => void };

function SwitchLink({ link, className, children }: { link: AuthLink; className?: string; children: React.ReactNode }) {
  if ("to" in link) {
    return (
      <Link to={link.to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={link.onClick} className={`cursor-pointer ${className ?? ""}`}>
      {children}
    </button>
  );
}

const linkClass = "text-foreground underline underline-offset-4";

function useCooldown(start: number) {
  const [cooldown, setCooldown] = React.useState(start);
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  return [cooldown, setCooldown] as const;
}

function CodeInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="h-12 text-center font-heading text-2xl tracking-[0.5em]"
      autoFocus
    />
  );
}

function Info({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-foreground">
      {message}
    </p>
  );
}

/* ---------------------------------------------------------------- login */

const credentialsSchema = z.object({
  emailOrMobile: z.string().trim().min(1, "Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});
type Credentials = z.infer<typeof credentialsSchema>;

/** Identity returns ProblemDetails without an error code; map by status + title (see contract). */
/**
 * The account exists but its email was never verified. Today's backend still lets these sign in (see
 * STOCKOUT_BACKEND_FIX_UNVERIFIED_LOGIN.md); with the fix it answers 403 "Account Not Verified" / ACCOUNT_NOT_VERIFIED.
 */
export function isUnverifiedLogin(error: unknown): boolean {
  if (!isApiError(error) || error.status !== 403) return false;
  const title = typeof (error.body as { title?: unknown } | undefined)?.title === "string" ? (error.body as { title: string }).title : "";
  return error.code === "ACCOUNT_NOT_VERIFIED" || /not verified|pending ?verification/i.test(`${title} ${error.message}`);
}

export function loginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return getErrorMessage(error);
  const title = typeof (error.body as { title?: unknown } | undefined)?.title === "string" ? (error.body as { title: string }).title : "";
  if (error.status === 401) return "The email or password is incorrect.";
  if (error.status === 403 && title === "Account Locked") return "This account is temporarily locked after too many failed attempts. Try again in 15 minutes.";
  if (error.status === 403 && title === "Account Disabled") return "This account is not active. Contact a platform administrator.";
  if (error.status === 429) return error.retryAfterSeconds ? `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.` : "Too many attempts. Please wait a minute and try again.";
  return getErrorMessage(error);
}

export function LoginForm({
  Frame,
  title = "Welcome to StockOut",
  subtitle = "Log in to buy surplus stock or manage your listings.",
  notice,
  onDone,
  forgot,
  register,
  defaultEmail = "",
}: {
  Frame: AuthFrame;
  title?: string;
  subtitle?: React.ReactNode;
  /** Shown above the form until the first error (e.g. "your session expired"). */
  notice?: React.ReactNode;
  onDone: () => void;
  forgot: AuthLink;
  register: AuthLink;
  defaultEmail?: string;
}) {
  const { signIn } = useAuth();
  const [challenge, setChallenge] = React.useState<MfaChallenge | null>(null);
  const [unverified, setUnverified] = React.useState<{ email: string; password: string } | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<Credentials>({ resolver: zodResolver(credentialsSchema), defaultValues: { emailOrMobile: defaultEmail, password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await signIn(values.emailOrMobile.trim(), values.password);
      if (result.kind === "mfa-required") setChallenge(result.challenge);
      else onDone();
    } catch (error) {
      if (isUnverifiedLogin(error) && values.emailOrMobile.includes("@")) {
        setUnverified({ email: values.emailOrMobile.trim().toLowerCase(), password: values.password });
        return;
      }
      setFormError(loginErrorMessage(error));
      form.setValue("password", "");
    }
  });

  if (challenge) return <MfaStep Frame={Frame} challenge={challenge} onBack={() => setChallenge(null)} onDone={onDone} />;
  if (unverified) return <VerifyStep Frame={Frame} email={unverified.email} password={unverified.password} sendFirst onDone={onDone} onBack={() => setUnverified(null)} />;

  return (
    <Frame title={title} subtitle={subtitle}>
      <form onSubmit={onSubmit} noValidate className="w-full space-y-6">
        {!formError && notice}
        <FormError message={formError} />
        <FormField label="Email" htmlFor="emailOrMobile" error={form.formState.errors.emailOrMobile?.message}>
          <Input type="text" inputMode="email" autoComplete="username" placeholder="Enter your email address" autoFocus {...form.register("emailOrMobile")} />
        </FormField>
        <div className="space-y-2">
          <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder="Enter your password" {...form.register("password")} />
          </FormField>
          <div className="text-right">
            <SwitchLink link={forgot} className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
              Forgot password?
            </SwitchLink>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Continue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          New to StockOut?{" "}
          <SwitchLink link={register} className={linkClass}>
            Create an account
          </SwitchLink>
        </p>
      </form>
    </Frame>
  );
}

function MfaStep({ Frame, challenge: initial, onBack, onDone }: { Frame: AuthFrame; challenge: MfaChallenge; onBack: () => void; onDone: () => void }) {
  const { verifyMfa, resendMfa } = useAuth();
  const [challenge, setChallenge] = React.useState(initial);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = useCooldown(60);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfa(challenge, code);
      onDone();
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? "That code is incorrect or has expired." : getErrorMessage(err));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      setChallenge(await resendMfa(challenge));
      setInfo("A new code has been sent. Earlier codes no longer work.");
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <Frame title="Verify it's you" subtitle={<>We emailed a 6-digit code for {challenge.emailOrMobile}.</>}>
      <form onSubmit={submit} noValidate className="w-full space-y-6">
        <FormError message={error} />
        {!error && <Info message={info} />}
        <FormField label="Verification code" htmlFor="otp" hint="The code expires after 5 minutes.">
          <CodeInput id="otp" value={code} onChange={setCode} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Verify and continue
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onBack} className="cursor-pointer text-muted-foreground hover:text-foreground">
            ← Use a different account
          </button>
          <button type="button" onClick={resend} disabled={cooldown > 0 || resending} className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </form>
    </Frame>
  );
}

/* ---------------------------------------------------------------- register */

/** The backend does no format validation on email/mobile, so the website validates them. */
const registerSchema = z
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

type RegisterValues = z.infer<typeof registerSchema>;

function normaliseMobile(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits.replace(/^0+/, "")}`;
}

export function RegisterForm({
  Frame,
  subtitle = "Buy surplus materials and sell what you don't need",
  onDone,
  login,
}: {
  Frame: AuthFrame;
  subtitle?: React.ReactNode;
  onDone: () => void;
  login: AuthLink;
}) {
  const [pending, setPending] = React.useState<{ userId?: string; email: string; password?: string; resume?: boolean } | null>(null);
  const [emailTaken, setEmailTaken] = React.useState<{ email: string; password: string } | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  // Mandatory policies every user must accept (buyer + seller audience "ALL"); the sign-up box covers exactly these.
  const policies = usePolicies();
  const signupPolicies = (policies.data ?? []).filter((p) => appliesTo(p, false));
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", mobile: "", password: "", confirm: "", terms: false as unknown as true },
  });

  const onSubmit = form.handleSubmit(async (v) => {
    setFormError(null);
    try {
      const res = await registrationService.register({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        // The server rejects any profile field over 100 chars (Handlers.cs:98-101); first+last can exceed that.
        displayName: `${v.firstName.trim()} ${v.lastName.trim()}`.slice(0, 100).trim(),
        email: v.email.trim().toLowerCase(),
        mobile: normaliseMobile(v.mobile),
        password: v.password,
      });
      // Remembered so the first sign-in records this agreement instead of asking again (see signup-consent.ts).
      saveSignupConsent(res.userId, signupPolicies);
      setPending({ userId: res.userId, email: res.email });
    } catch (error) {
      const detail = isApiError(error) && typeof (error.body as { detail?: unknown })?.detail === "string" ? (error.body as { detail: string }).detail : "";
      if (isApiError(error) && error.status === 409 && /email/i.test(detail)) {
        form.setError("email", { message: "An account with this email already exists. Try logging in." });
        // It may be this person's own sign-up whose code screen was closed: let them finish verifying it.
        setEmailTaken({ email: v.email.trim().toLowerCase(), password: v.password });
      }
      else if (isApiError(error) && error.status === 409 && /mobile/i.test(detail)) form.setError("mobile", { message: "This mobile number is already registered." });
      else setFormError(getErrorMessage(error));
    }
  });

  if (pending)
    return (
      <VerifyStep
        Frame={Frame}
        userId={pending.userId}
        email={pending.email}
        password={pending.password}
        sendFirst={pending.resume}
        onDone={onDone}
        onBack={pending.resume ? () => setPending(null) : undefined}
        login={login}
      />
    );

  const err = form.formState.errors;
  return (
    <Frame title="Create your account" subtitle={subtitle}>
      <form onSubmit={onSubmit} noValidate className="w-full space-y-5">
        <FormError message={formError} />
        {emailTaken && (
          <p role="status" className="rounded-md bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">
            Started signing up with {emailTaken.email} but didn&apos;t enter the code?{" "}
            <button type="button" className="cursor-pointer font-medium underline underline-offset-4" onClick={() => setPending({ email: emailTaken.email, password: emailTaken.password, resume: true })}>
              Verify this email
            </button>
          </p>
        )}
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
            <span>
              I have read and agree to the StockOut{" "}
              {/* One link to /legal, which lists every policy; the agreement covers all mandatory ones (signupPolicies). */}
              <Link to="/legal" target="_blank" rel="noopener" className={linkClass}>
                Terms &amp; Policies
              </Link>
              .
            </span>
          </label>
          {err.terms && (
            <p className="mt-1 text-xs text-danger-soft-foreground" role="alert">
              {err.terms.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <SwitchLink link={login} className={linkClass}>
            Log in
          </SwitchLink>
        </p>
      </form>
    </Frame>
  );
}

/**
 * Email code step. Right after sign-up (userId known) the code goes to registration/confirm, which also signs the user
 * in. When resuming an unfinished sign-up (code screen closed, or login refused as unverified) only the email is known:
 * a new code is sent, confirmed via email/confirm (activates the account), then the user is signed in with the
 * password they just typed, or sent to log in.
 */
function VerifyStep({
  Frame,
  userId,
  email,
  password,
  sendFirst,
  onDone,
  onBack,
  login,
}: {
  Frame: AuthFrame;
  /** Where "Go to log in" leads after verifying without signing in; defaults to onBack. */
  login?: AuthLink;
  userId?: string;
  email: string;
  password?: string;
  sendFirst?: boolean;
  onDone: () => void;
  onBack?: () => void;
}) {
  const { signInWithTokens, signIn } = useAuth();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [verifiedNoLogin, setVerifiedNoLogin] = React.useState(false);
  const [cooldown, setCooldown] = useCooldown(sendFirst ? 0 : 60);
  const sent = React.useRef(false);

  const resend = React.useCallback(async () => {
    setError(null);
    try {
      await registrationService.resendEmail(email);
      setInfo("If this account still needs verifying, a new code is on its way.");
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [email, setCooldown]);

  React.useEffect(() => {
    if (sendFirst && !sent.current) {
      sent.current = true;
      void resend();
    }
  }, [sendFirst, resend]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (userId) {
        await signInWithTokens(await registrationService.confirm(userId, code));
        onDone();
        return;
      }
      await registrationService.confirmEmail(email, code);
      if (!password) {
        setVerifiedNoLogin(true);
        return;
      }
      try {
        const result = await signIn(email, password);
        if (result.kind === "signed-in") onDone();
        else setVerifiedNoLogin(true);
      } catch {
        // Verified, but the password typed here isn't the account's (e.g. a second sign-up attempt): log in normally.
        setVerifiedNoLogin(true);
      }
    } catch (err) {
      setError(isApiError(err) && err.status === 400 ? "That code is incorrect or has expired. Request a new one below." : getErrorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (verifiedNoLogin) {
    return (
      <Frame title="Email verified" subtitle={<>{email} is verified. Log in with the password you chose when you signed up.</>}>
        {login ? (
          <SwitchLink link={login} className={buttonVariants({ size: "lg", className: "w-full" })}>
            Go to log in
          </SwitchLink>
        ) : (
          <Button size="lg" className="w-full" onClick={onBack ?? onDone}>
            Go to log in
          </Button>
        )}
      </Frame>
    );
  }

  return (
    <Frame title="Verify your email" subtitle={<>{sendFirst ? "We've sent" : "We sent"} a 6-digit code to {email}.</>}>
      <form onSubmit={submit} noValidate className="w-full space-y-6">
        <FormError message={error} />
        {!error && <Info message={info} />}
        <FormField label="Verification code" htmlFor="code" hint="The code expires after 10 minutes.">
          <CodeInput id="code" value={code} onChange={setCode} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Verify and continue
        </Button>
        <div className="flex justify-center gap-4 text-sm">
          <button type="button" onClick={() => void resend()} disabled={cooldown > 0} className="cursor-pointer text-foreground underline underline-offset-4 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          {onBack && (
            <button type="button" onClick={onBack} className="cursor-pointer text-muted-foreground underline underline-offset-4">
              Back
            </button>
          )}
        </div>
      </form>
    </Frame>
  );
}

/* ---------------------------------------------------------------- forgot password */

const forgotSchema = z.object({ emailOrMobile: z.string().trim().min(1, "Enter your email address.") });

export function ForgotPasswordForm({ Frame, back, onResetCode }: { Frame: AuthFrame; back: AuthLink; onResetCode?: () => void }) {
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { emailOrMobile: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authService.forgotPassword(values.emailOrMobile.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <Frame title="Reset your password" subtitle={sent ? "Check your inbox" : "We'll email you a reset link"}>
      {sent ? (
        <div className="w-full space-y-6">
          <p className="text-sm text-body">If an account exists for that address, password reset instructions have been sent. The link expires in 15 minutes.</p>
          <div className="flex flex-col items-center gap-3">
            <Button asChild size="lg" className="w-full">
              <Link to="/reset-password" onClick={onResetCode}>
                I have a reset code
              </Link>
            </Button>
            <SwitchLink link={back} className="text-sm text-muted-foreground hover:text-foreground">
              Back to log in
            </SwitchLink>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="w-full space-y-6">
          <FormError message={error} />
          <FormField label="Email" htmlFor="emailOrMobile" error={form.formState.errors.emailOrMobile?.message}>
            <Input autoComplete="username" placeholder="Enter your email address" autoFocus {...form.register("emailOrMobile")} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            Send reset instructions
          </Button>
          <p className="text-center text-sm">
            <SwitchLink link={back} className="text-muted-foreground hover:text-foreground">
              Back to log in
            </SwitchLink>
          </p>
        </form>
      )}
    </Frame>
  );
}
