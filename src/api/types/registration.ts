/**
 * Identity self-service (registration + verification) types for the public website.
 * Service: services/identity-access, gateway route /api/v1/auth/* (PublicPolicy, LoginOtpPolicy = 10 req/min per IP+path).
 * Responses are NOT enveloped. JSON = System.Text.Json web defaults (camelCase, nulls written).
 * See docs/contracts/registration.md.
 */

/** GUID string. User ids created by /register are 32-hex "N" format (no hyphens); treat as opaque. */
export type UserId = string;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** C# Domain.Enums.AccountStatus (string names). */
export type AccountStatus = 'PendingVerification' | 'Active' | 'Locked' | 'Suspended' | 'Closed';

/** Verification channel for /verification/registration/confirm (input case-insensitive). Only 'Email' is deliverable. */
export type VerificationChannel = 'Email' | 'Mobile';

// ---------------------------------------------------------------------------
// Error shapes
// ---------------------------------------------------------------------------

/**
 * ASP.NET ProblemDetails from BaseApiController.MapResult (handler failures). No machine-readable code:
 * switch on status + title (+ detail text where noted in registration.md).
 */
export interface IdentityProblemDetails {
  /** "https://emcore.platform/errors/{status}" */
  type: string;
  title: RegistrationErrorTitle | string;
  status: number;
  detail: string;
  traceId?: string;
}

/** Known `title` values produced by the register/verification handlers. */
export type RegistrationErrorTitle =
  | 'Validation Error'
  | 'Invalid Password'
  | 'Conflict'
  | 'Server Error'
  | 'Invalid Verification Code'
  | 'Verification Failed';

/** Known 409 `detail` values of POST /register (IdentityRepository.RegisterUserAsync return codes -1/-2). */
export type RegisterConflictDetail = 'Email already registered.' | 'Mobile already registered.';

/** C# Api/Middleware/ExceptionHandlingMiddleware anonymous problem (unhandled exceptions). */
export interface IdentityExceptionProblem {
  type: string;
  title: 'Invalid Request' | 'Unauthorized' | 'An unexpected server error occurred.';
  status: 400 | 401 | 500;
  detail: string;
  instance: string;
  traceId: string;
}

/** ASP.NET ValidationProblemDetails ([ApiController] automatic 400). `errors` keys are not stable (PascalCase or "$.path"). */
export interface AspNetValidationProblemDetails {
  type: string;
  title: string;
  status: 400;
  errors: Record<string, string[]>;
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Requests / responses
// ---------------------------------------------------------------------------

/**
 * C# Application.DTOs.RegisterRequest — POST /api/v1/auth/register (anonymous).
 * All six fields must be sent as NON-EMPTY strings (non-nullable record params => implicit [Required], which rejects "").
 * No server-side email/mobile format validation; email is trimmed+lower-cased for uniqueness, mobile only trimmed.
 */
export interface RegisterRequest {
  /** unique (case-insensitive); <= 255 (SQL VARCHAR) */
  email: string;
  /** unique (exact string after trim); <= 50 (SQL VARCHAR). Recommend E.164, e.g. "+9715XXXXXXXX" */
  mobile: string;
  /** >= 12 characters (Identity:MinimumPasswordLength); no complexity rules */
  password: string;
  /** required, trimmed, <= 100 */
  firstName: string;
  /** required, trimmed, <= 100 */
  lastName: string;
  /** required, trimmed, <= 100 */
  displayName: string;
}

/** C# RegisterResponse (HTTP 201). A 6-digit code has been EMAILED (no link). */
export interface RegisterResponse {
  userId: UserId;
  email: string;
  mobile: string;
  status: 'PendingVerification';
  /** "Registration successful. Please verify your email or mobile number." */
  message: string;
}

/** C# VerifyRegistrationRequest — POST /api/v1/auth/verification/registration/confirm. */
export interface VerifyRegistrationRequest {
  /** RegisterResponse.userId (or LoginResponse.userId) */
  userId: UserId;
  /** use 'Email' */
  channel: VerificationChannel;
  /** the 6-digit code from the email (trimmed server-side) */
  token: string;
}

/** C# VerifyRegistrationResponse — tokens for an auto-login session (amr "pwd"). */
export interface VerifyRegistrationResponse {
  accessToken: string;
  refreshToken: string;
  /** seconds (900 with default config) */
  expiresIn: number;
  tokenType: 'Bearer';
  userId: UserId | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

/** C# SendEmailVerificationRequest — POST /api/v1/auth/verification/email/send (resend code). */
export interface SendEmailVerificationRequest {
  email: string;
}

/** C# ConfirmEmailVerificationRequest — POST /api/v1/auth/verification/email/confirm (no tokens returned). */
export interface ConfirmEmailVerificationRequest {
  email: string;
  token: string;
}

/** C# SendMobileVerificationRequest. NOTE: no SMS is ever delivered (delivery service supports Email only). */
export interface SendMobileVerificationRequest {
  mobile: string;
}

/** C# ConfirmMobileVerificationRequest. */
export interface ConfirmMobileVerificationRequest {
  mobile: string;
  token: string;
}

/** C# StandardSuccessResponse ({ message }). */
export interface StandardSuccessResponse {
  message: string;
}

/** Exact `message` strings returned by the verification endpoints. */
export const VERIFICATION_MESSAGES = {
  emailSend: 'If an account exists and requires verification, a verification code has been sent.',
  emailConfirm: 'Email verified successfully.',
  mobileSendUnknown: 'If an account exists with this mobile number, a verification code has been sent.',
  mobileSendKnown: 'Verification code sent successfully.',
  mobileConfirm: 'Mobile number verified successfully.',
} as const;

/** Password rule mirrored from Identity:MinimumPasswordLength (appsettings.json). */
export const MIN_PASSWORD_LENGTH = 12;
/** Verification code lifetime (Identity:VerificationLifetimeMinutes). */
export const VERIFICATION_CODE_LIFETIME_MINUTES = 10;
/** Max wrong attempts per issued code before it is expired (PR_IDENTITY_VERIFY_ACCOUNT). */
export const VERIFICATION_MAX_ATTEMPTS = 5;
