import { http } from "@/lib/api/client";
import type {
  AccountActivityQuery,
  AccountActivityResponse,
  AccountStatusResponse,
  ChangePasswordRequest,
  CurrentIdentityResponse,
  LoginRequest,
  LoginResponse,
  ConfirmMfaRequest,
  MfaLoginVerifyRequest,
  MfaStatusResponse,
  RefreshResponse,
  RegisterMfaResponse,
  ResendMfaResponse,
  SessionDto,
  StandardSuccessResponse,
} from "@/api/types/identity";
import type { RegisterRequest, RegisterResponse, VerifyRegistrationResponse } from "@/api/types/registration";

/**
 * identity-access. Responses are plain DTOs (no envelope); errors are ProblemDetails.
 * Contract: docs/contracts/identity-access.md
 */
export const authService = {
  login: (body: LoginRequest) => http.post<LoginResponse>("/api/v1/auth/login", body, { auth: false }),

  verifyMfa: (body: MfaLoginVerifyRequest) => http.post<LoginResponse>("/api/v1/auth/mfa/verify", body, { auth: false }),

  resendMfa: (userId: string, challengeId: string) =>
    http.post<ResendMfaResponse>("/api/v1/auth/mfa/resend", { userId, challengeId }, { auth: false }),

  refresh: (refreshToken: string) => http.post<RefreshResponse>("/api/v1/auth/token/refresh", { refreshToken }, { auth: false }),

  /** Server-side logout: revokes the session the refresh token belongs to (B3). */
  logout: (refreshToken: string) => http.post<StandardSuccessResponse>("/api/v1/auth/logout", { refreshToken }),

  /** Revokes one session; sign-out falls back to this when /auth/logout fails. */
  revokeSession: (sessionId: string) => http.delete<StandardSuccessResponse>(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`),

  logoutAll: () => http.post<StandardSuccessResponse>("/api/v1/auth/logout-all"),

  sessions: (signal?: AbortSignal) => http.get<SessionDto[]>("/api/v1/auth/sessions", { signal }),

  forgotPassword: (emailOrMobile: string) =>
    http.post<StandardSuccessResponse>("/api/v1/auth/password/forgot", { emailOrMobile }, { auth: false }),

  resetPassword: (token: string, newPassword: string, emailOrMobile: string | null) =>
    http.post<StandardSuccessResponse>("/api/v1/auth/password/reset", { token, newPassword, emailOrMobile, stepUpToken: null }, { auth: false }),

  changePassword: (body: ChangePasswordRequest) => http.post<StandardSuccessResponse>("/api/v1/auth/password/change", body),

  me: (signal?: AbortSignal) => http.get<CurrentIdentityResponse>("/api/v1/identity/me", { signal }),

  accountStatus: (signal?: AbortSignal) => http.get<AccountStatusResponse>("/api/v1/auth/account/status", { signal }),

  accountActivity: (query: AccountActivityQuery, signal?: AbortSignal) =>
    http.get<AccountActivityResponse>("/api/v1/auth/account/activity", { query: { ...query }, signal }),

  mfaStatus: (signal?: AbortSignal) => http.get<MfaStatusResponse>("/api/v1/auth/mfa/status", { signal }),

  mfaRegister: () => http.post<RegisterMfaResponse>("/api/v1/auth/mfa/register", { type: "EMAIL_OTP" }),

  mfaConfirm: (body: ConfirmMfaRequest) => http.post<StandardSuccessResponse>("/api/v1/auth/mfa/confirm", body),
};

/** Self-service registration (identity-access). Contract: docs/contracts/registration.md */
export const registrationService = {
  register: (body: RegisterRequest) => http.post<RegisterResponse>("/api/v1/auth/register", body, { auth: false }),
  /** Confirms the emailed 6-digit code; returns tokens (signs the user in) and activates the account. */
  confirm: (userId: string, token: string) =>
    http.post<VerifyRegistrationResponse>("/api/v1/auth/verification/registration/confirm", { userId, channel: "Email", token }, { auth: false }),
  /**
   * Confirms an emailed code by email address (no userId needed) and activates a PendingVerification account.
   * Used to resume a sign-up whose code screen was closed. Returns no tokens: sign in afterwards.
   */
  confirmEmail: (email: string, token: string) => http.post<{ message: string }>("/api/v1/auth/verification/email/confirm", { email, token }, { auth: false }),
  /** Always 200 (anti-enumeration). Server limits: 1/min, 5 per 15 min. */
  resendEmail: (email: string) => http.post<{ message: string }>("/api/v1/auth/verification/email/send", { email }, { auth: false }),
};
