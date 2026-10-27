import { getErrorMessage, isApiError } from "@/lib/api/errors";

/** PA-1B.2 error codes (OrganizationMemberService / InvitationService / BusinessChangeService). */
const MESSAGES: Record<string, string> = {
  FORBIDDEN: "You don't have permission to do this for this company.",
  DUPLICATE_INVITATION: "There's already an active invitation for this email.",
  ALREADY_ACTIVE_MEMBER: "This person is already a member of the company.",
  INVALID_ROLE: "Choose Admin, Manager or Staff. Owner can only be given by transferring ownership.",
  INVALID_ROLE_CODE: "Choose Admin, Manager or Staff. Owner can only be given by transferring ownership.",
  CANNOT_DEMOTE_LAST_OWNER: "The company needs at least one owner. Transfer ownership first.",
  CANNOT_SUSPEND_OR_REMOVE_LAST_OWNER: "The company needs at least one owner. Transfer ownership first.",
  INVITATION_EXPIRED: "This invitation has expired. Ask the company to send a new one.",
  INVITATION_NOT_FOUND: "This invitation link isn't valid.",
  INVITATION_ALREADY_ACCEPTED: "This invitation has already been used.",
  INVITATION_REVOKED: "This invitation was cancelled by the company.",
  INVITATION_EMAIL_MISMATCH: "This invitation was sent to a different email address. Sign in with that email to accept it.",
  USER_EMAIL_REQUIRED: "We couldn't read the email address on your account. Sign out and in again.",
  UAE_CALENDAR_COVERAGE_MISSING:
    "Official UAE public holidays haven't been confirmed for that period yet, so the reporting deadline can't be calculated. Choose an effective date within the approved calendar or contact StockOut support.",
  INVALID_CHANGE_CATEGORY: "Choose what changed.",
  REASON_REQUIRED: "Explain what changed and why.",
  CATEGORY_REQUIRED: "Choose what changed.",
  CANNOT_ATTACH_TO_SUBMITTED_REQUEST: "Documents can only be added before the request is submitted.",
  ONLY_DRAFT_CAN_BE_SUBMITTED: "This request was already submitted.",
  INVALID_DOCUMENT: "The document couldn't be attached. Upload it again.",
  CHANGE_REQUEST_NOT_FOUND: "This change request no longer exists.",
  VERSION_CONFLICT: "This changed since you opened it. Refresh and try again.",
};

export function orgErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  return getErrorMessage(error);
}
