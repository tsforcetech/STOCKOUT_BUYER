import { getErrorMessage, isApiError } from "@/lib/api/errors";

/** Buyer identity verification error codes (user-organization + inventory-media) → buyer wording. */
const MESSAGES: Record<string, string> = {
  BUYER_IDENTITY_FULL_NAME_REQUIRED: "Enter your full name as on your ID.",
  BUYER_IDENTITY_NATIONALITY_REQUIRED: "Choose a valid nationality.",
  BUYER_IDENTITY_DOCUMENT_TYPE_REQUIRED: "Choose the ID type.",
  BUYER_IDENTITY_DOCUMENT_TYPE_INVALID: "Only an Emirates ID, passport or national ID is accepted.",
  BUYER_IDENTITY_DOCUMENT_NUMBER_REQUIRED: "Enter the ID number.",
  BUYER_IDENTITY_ISSUING_COUNTRY_REQUIRED: "Choose a valid issuing country.",
  BUYER_IDENTITY_DOCUMENT_EXPIRY_REQUIRED: "Enter the ID expiry date.",
  BUYER_IDENTITY_DOCUMENT_EXPIRED: "This ID has expired. Use a valid ID.",
  BUYER_IDENTITY_MOBILE_REQUIRED: "Enter your mobile number.",
  BUYER_IDENTITY_ADDRESS_REQUIRED: "Enter your residential address.",
  BUYER_IDENTITY_DETAILS_INCOMPLETE: "Some of your details are missing. Complete step 1 and try again.",
  BUYER_IDENTITY_DOCUMENT_REQUIRED: "Upload your ID before submitting.",
  INVALID_BUYER_DOCUMENT_TYPE: "The uploaded file isn't an accepted ID. Upload an Emirates ID, passport or national ID.",
  BUYER_MULTIPLE_DOCUMENTS_NOT_PERMITTED: "Only one ID can be submitted. Remove the extra upload and try again.",
  FRESH_DOCUMENT_REQUIRED: "Your previous ID can't be reused. Remove it and upload a current ID.",
  BUYER_REVERIFICATION_SUBMISSION_REQUIRED: "Please submit a new ID to verify again.",
  DOCUMENT_EXPIRED: "This ID has expired. Use a valid ID.",
  DOCUMENT_TYPE_MISMATCH: "The ID type doesn't match your details. Check step 1 and upload the matching ID.",
  DOCUMENT_NUMBER_MISMATCH: "The ID number doesn't match your details. Check step 1.",
  ISSUING_COUNTRY_MISMATCH: "The issuing country doesn't match your details. Check step 1.",
  MARKETPLACE_BUYER_DOCUMENT_FILE_INVALID: "We couldn't confirm your upload. Please upload the file again.",
  FILE_NOT_AVAILABLE: "Your upload hasn't finished. Please upload the file again.",
  ACCOUNT_HOLDER_UPDATE_UNAUTHORIZED: "Only the registered account holder can change these identity details.",
  ACCOUNT_HOLDER_SUBMIT_UNAUTHORIZED: "Only the registered account holder can submit this verification.",
  ORGANIZATION_MEMBER_UNAUTHORIZED: "Only the registered account holder can do this.",
  POLICY_ACCEPTANCE_REQUIRED: "Please accept the latest StockOut terms first, then submit again.",
  POLICY_CONFIGURATION_ERROR: "Verification is temporarily unavailable. Please try again later.",
  MARKETPLACE_BUYER_VERSION_CONFLICT: "Your details changed in another window. We've reloaded them; please try again.",
  INVALID_ROW_VERSION: "Your details were out of date. We've reloaded them; please try again.",
  MARKETPLACE_BUYER_TRANSITION_INVALID: "This can't be done at the current stage of your verification.",
  MARKETPLACE_BUYER_NOT_FOUND: "Save your details first.",
  MARKETPLACE_BUYER_DOCUMENT_NOT_FOUND: "That upload no longer exists. Refresh the page.",
  BUYER_TRN_INVALID: "Enter a valid 15-digit UAE TRN.",
  BUYER_IBAN_INVALID: "Enter a valid UAE IBAN.",
  FILE_SIZE_EXCEEDED: "The file is too large. The limit is 20 MB.",
  FILE_CONTENT_TYPE_INVALID: "Use a PDF, JPG or PNG file.",
};

export function verificationMessage(e: unknown): string {
  if (isApiError(e) && e.code && MESSAGES[e.code]) return MESSAGES[e.code];
  return getErrorMessage(e);
}
