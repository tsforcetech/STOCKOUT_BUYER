# Public-website registration & verification — API contract

Verified against current `/home/user/stockout/services/identity-access` on 2026-10-17. It complements `docs/contracts/identity-access.md`, which covers login, refresh, logout, the JWT and `/identity/me`, and is still accurate for those.
TS types: `src/api/types/registration.ts`.

Abbreviations, relative to `services/identity-access/src/`:
- `H` = `Emcore.IdentityAccess.Application/Commands/Handlers.cs`
- `D` = `Emcore.IdentityAccess.Application/DTOs/DTOs.cs`
- `VC` = `Emcore.IdentityAccess.Api/Controllers/VerificationController.cs`
- `AC` = `Emcore.IdentityAccess.Api/Controllers/AuthController.cs`
- `Mig` = `../Emcore.IdentityAccess.Migrator/Migrations/Versioned/`

## 0. Conventions

- **Gateway:** `/api/v1/auth/{**catch-all}` is `PublicPolicy` with `LoginOtpPolicy`, which allows **10 requests per minute per IP and exact path**. The path is forwarded unchanged. Every endpoint here is anonymous: `[AllowAnonymous]` on `register` (`AC:28-37`) and on the whole `VerificationController` (`VC:14`).
- **JSON:** web defaults (camelCase, nulls written). Bodies are **not** enveloped.
- **Errors:** there is no machine-readable code. Branch on `status` + `title`, and on `detail` where noted.
  - Handler failures produce ProblemDetails `{ type:"https://emcore.platform/errors/{status}", title, status, detail, traceId }` (`Api/Controllers/BaseApiController.cs:15-32`).
  - Model-binding failures produce `ValidationProblemDetails` 400.
  - Unhandled exceptions produce `{type,title:"Invalid Request"|..., status, detail, instance, traceId}` (`Api/Middleware/ExceptionHandlingMiddleware.cs`).
- **Implicit required:** `Nullable` is enabled and there is no `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes` (grep). So every non-nullable `string` record parameter is `[Required]`, and **`""` is rejected** with ValidationProblemDetails 400 before the handler runs. **Send every field as a non-empty string.**

## 1. POST /api/v1/auth/register

Source: `AC:28-37` → `H:78-162`.

Request `RegisterRequest` (`D:7`): `{ email, mobile, password, firstName, lastName, displayName }`. All are strings and all are effectively required.

Validation, in order:

| Check | Response |
|---|---|
| Any field null or `""` (implicit required) | 400 ValidationProblemDetails. The handler's "email **or** mobile" rule (`H:80-83`) is therefore unreachable: **both email and mobile are required**. |
| `password.Length < 12` (`Identity:MinimumPasswordLength`, `Api/appsettings.json:33`) | 400 `title:"Invalid Password"`, `detail:"Password must be at least 12 characters long."` (`H:84-87`) |
| firstName, lastName or displayName blank after trim | 400 `title:"Validation Error"`, `detail:"FirstName, LastName, and DisplayName are required."` (`H:93-96`) |
| any of them longer than 100 characters after trim | 400 `title:"Validation Error"`, `detail:"Profile fields cannot exceed 100 characters."` (`H:98-101`) |
| email already used (normalized: trim + lower-case) | **409** `title:"Conflict"`, `detail:"Email already registered."` |
| mobile already used (exact string after trim) | **409** `title:"Conflict"`, `detail:"Mobile already registered."` |
| other DB return code | 500 `title:"Server Error"`, `detail:"Unexpected database error."` |

Duplicate detection: `Mig/018_Add_User_Profile_Fields.sql:30-38` returns -1 for email and -2 for mobile, mapped in `Infrastructure/Persistence/IdentityRepository.cs:117-130` and `H:136-142`. The email check runs first.

- **There is no email-format or mobile-format validation anywhere** (no regex in the handler, repository or procedure). Mobile is stored as typed, only trimmed (`IdentityRepository.cs:61-62`), so `+971501234567` and `0501234567` count as different numbers.
- Mobile number format: none is enforced. Tests use E.164 `+9715XXXXXXXX` (`tests/.../TestIdentityConfiguration.cs:38-42`), which the website should enforce client-side.
- SQL column sizes: email `VARCHAR(255)`, mobile `VARCHAR(50)` (`018…:10-13`). Validate lengths client-side.
- Password rules: minimum 12 characters only. There are no complexity rules.

Response **201** `RegisterResponse` (`D:8`):
```json
{ "userId": "<32-hex GUID, no hyphens>", "email": "...", "mobile": "...", "status": "PendingVerification",
  "message": "Registration successful. Please verify your email or mobile number." }
```

Side effects:
- A user is created with `Status='PendingVerification'`.
- One `ACCOUNT_VERIFICATION` row is created with `Channel="Email"`, because email is always present (`H:106-115`).
- A **6-digit numeric code** is generated (`RandomNumberGenerator.GetInt32(100000, 999999)`, `Infrastructure/Security/SecurityServices.cs:175-180`) and **emailed** (`H:144-148`).
- No tokens are returned, so the user is not logged in yet.

**What the email contains** (`Infrastructure/Integrations/VerificationDeliveryService.cs:27-49`):
- Subject: `"Your STOCKOUT verification code"`.
- Body: `"Your verification code is: <code> … expires in 10 minutes"`.
- **It is a code, not a link.** The template wrongly mentions sign-in and MFA.
- Code lifetime is `Identity:VerificationLifetimeMinutes` = 10 (`Api/appsettings.json:29`).

## 2. POST /api/v1/auth/verification/registration/confirm — recommended next step

Source: `VC:77-84` → `H:455-551`. This is **auto-login**: it returns tokens.

Request `VerifyRegistrationRequest` (`D:10`): `{ "userId": "<RegisterResponse.userId>", "channel": "Email", "token": "<6-digit code>" }`.

Behavior:
- The handler always waits 500 ms (`H:457`).
- `channel` is case-insensitive and must be `Email` or `Mobile`.
- `token` is trimmed and compared by SHA-256 hash against the **newest** `Issued` verification for that user and channel (`Mig/011_Harden_Verification_And_Recovery_Procedures.sql:19-24`).

Response 200 `VerifyRegistrationResponse` (`D:11`):
```json
{ "accessToken": "...", "refreshToken": "...", "expiresIn": 900, "tokenType": "Bearer",
  "userId": "...", "firstName": "...", "lastName": "...", "displayName": "..." }
```

Side effects (`011…:38-45`, `H:509-550`):
- The email is marked verified and the account becomes `Active`.
- A new session and refresh-token family are created.
- The JWT has `email_verified:true` and `amr:["pwd"]`.

Errors (all 400 ProblemDetails):

| title | detail | When |
|---|---|---|
| `Verification Failed` | `Invalid user.` | Unknown `userId`. A non-GUID `userId` may instead surface as exception-middleware 400 `Invalid Request` (repository `Guid.Parse`). |
| `Verification Failed` | `User is not pending verification.` | Account is already `Active`, for example after using `/email/confirm`. |
| `Validation Error` | `INVALID_VERIFICATION_CHANNEL` | Channel is neither `Email` nor `Mobile`. |
| `Invalid Verification Code` | `The verification code is incorrect or has expired.` | Wrong code, expired code, or 5 attempts used. On the 5th wrong attempt the code is expired (`011…:24-35`); request a new one with §3. |

## 3. POST /api/v1/auth/verification/email/send — resend code

Source: `VC:27-35` → `H:340-382`.

Request: `{ "email": string }`.

Response: **always 200** `{ "message": "If an account exists and requires verification, a verification code has been sent." }`.

The endpoint silently does nothing if any of these hold:
- the user is unknown,
- the email is already verified,
- 5 or more codes were sent in the last 15 min,
- the last code is less than 1 min old (`H:344-361`).

When it does send, it issues a fresh 6-digit code by email. The newest code is the one that is checked; older `Issued` codes stay valid but are not selected. Use the new code with §2, or with §4.

## 4. POST /api/v1/auth/verification/email/confirm — verify without login

Source: `VC:40-47` → `H:384-405`.

Request: `{ "email": string, "token": string }`. The handler waits 500 ms.

Response 200: `{ "message": "Email verified successfully." }`. It returns **no tokens**. The account becomes `Active` (same procedure).

Errors: 400 `Invalid Verification Code` / `The verification code is incorrect or has expired.`, both for an unknown email and for a bad code.

Use this when the user has no `userId` at hand, for example when they come back in a later browser session. Then log in normally (`POST /api/v1/auth/login`).

## 5. Mobile endpoints — do NOT use

`POST /verification/mobile/send` (`VC:52-60`, `H:407-432`) and `POST /verification/mobile/confirm` (`VC:65-72`, `H:434-453`) exist:

| Endpoint | Request | Responses |
|---|---|---|
| `mobile/send` | `{mobile}` | 200 `"Verification code sent successfully."` for a known number, or 200 `"If an account exists with this mobile number, a verification code has been sent."` for an unknown one |
| `mobile/confirm` | `{mobile, token}` | 200 `"Mobile number verified successfully."`; 400 `Verification Failed`/`Invalid verification attempt.` (unknown mobile); 400 `Invalid Verification Code` |

**No SMS is ever delivered.** `VerificationDeliveryService.SendVerificationOtpAsync` only handles `Email`, `StepUp`, `TOTP` and `EMAIL_OTP`, and logs "Unsupported delivery channel" for `Mobile` (`VerificationDeliveryService.cs:29-53`). `mobile/send` also has no rate limit or cooldown (`H:407-432`).

## 6. Flow the website should implement

1. `POST /api/v1/auth/register` with all six fields. Validate on the client: email format, mobile in E.164, password at least 12 characters, names 1 to 100 characters.
   - On 201, keep `userId` and `email` (for example in sessionStorage) and show a "Enter the 6-digit code we emailed you" screen.
   - On 409, show "email already registered" or "mobile already registered" based on `detail`.
2. `POST /api/v1/auth/verification/registration/confirm` with `{ userId, channel:"Email", token }`. On 200, store the tokens: the user is logged in and `Active`.
3. "Resend code" calls `POST /verification/email/send {email}`. Disable the button for 60 s, and expect at most 5 sends per 15 min. The response gives no feedback either way.
4. If the user returns later without a `userId`, two paths work:
   - Log in. `PendingVerification` users **can log in**; `LoginResponse.userId` is returned. Then call registration/confirm.
   - Use `/verification/email/confirm`, then log in.

## 7. Can PendingVerification users use the marketplace?

**Yes.** Nothing downstream checks `email_verified` or account status:
- Login accepts both `Active` and `PendingVerification` (see identity-access.md).
- The gateway `AuthenticatedRoutePolicy` checks only that the session is active (`gateways/Emcore.ApiGateway/Extensions/GatewayExtensions.cs:250-289`).
- A grep for `email_verified` / `EmailVerified` across user-organization, catalog-listing, inventory-media, search-discovery, building-blocks and the gateway shows that only `PlatformInvitationsController.cs:134-135` (invitation accept) enforces it. Search saved searches do not check it (`SearchBuyerAuthenticationHandler.cs:840-888`).

So an unverified user can call `actors/me`, create a seller, upload files and save searches. The website should still gate on `email_verified` itself if desired. That flag is in the JWT and in `GET /api/v1/identity/me` → `emailVerified`.

## 8. Known defects

1. The "email or mobile" rule is unreachable: both are required by implicit `[Required]`.
2. There is no email or mobile format validation server-side. Mobile uniqueness is by exact string.
3. Mobile verification never sends an SMS.
4. The verification email text talks about sign-in and MFA, not registration.
5. `/verification/mobile/send` has no rate limit or cooldown, unlike email.
6. `registration/confirm` fails with `User is not pending verification.` if the account was already activated via `/email/confirm`.
7. A user created by register gets a `sub`/`userId` in 32-hex `N` format (no hyphens), while ids loaded from the DB elsewhere use `D` format. Compare ids case- and format-insensitively.
