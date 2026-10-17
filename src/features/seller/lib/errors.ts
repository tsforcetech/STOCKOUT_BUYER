import { getErrorMessage, isApiError } from "@/lib/api/errors";

/**
 * Readable messages for seller-portal error codes. catalog-listing returns { error: CODE, message } and the
 * message is often just the code, so we always branch on the code (docs/contracts/seller-listings.md §1.4).
 * user-organization (seller account) errors carry no code (E2) — those are mapped by status in `sellerAccountErrorMessage`.
 */
const MESSAGES: Record<string, string> = {
  // access (§1.2, D14)
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  MARKETPLACE_SELLER_ACCESS_DENIED:
    "Only the owner of an active seller account can manage listings. If your seller account is suspended, contact support.",
  MARKETPLACE_SELLER_NOT_AUTHORIZED: "This seller account can't perform that action right now. Only the owner of an active seller account can manage listings.",
  MARKETPLACE_LISTING_ACCESS_DENIED: "This listing belongs to a different seller account.",
  MARKETPLACE_LISTING_DEPENDENCY_UNAVAILABLE: "A service the listing depends on is unavailable. Please try again shortly.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again shortly.",
  // validation
  INVALID_DATA: "Some details are missing or invalid. Check the form and try again.",
  INVALID_ROW_VERSION: "This listing changed since you opened it. Refresh and try again.",
  MARKETPLACE_LISTING_ROW_VERSION_INVALID: "This listing changed since you opened it. Refresh and try again.",
  MARKETPLACE_LISTING_CURRENCY_INVALID: "Enter a 3-letter currency code, for example AED.",
  MARKETPLACE_LISTING_PRICE_INVALID: "The price or pricing mode is invalid. The price can't be negative.",
  MARKETPLACE_LISTING_LOCATION_INVALID: "Enter country, emirate/state and city together, or leave all three empty.",
  MARKETPLACE_LISTING_CATEGORY_INVALID: "The selected category doesn't exist any more. Choose another category.",
  MARKETPLACE_LISTING_BRAND_INVALID: "The selected brand isn't valid. Choose another brand.",
  MARKETPLACE_LISTING_CONDITION_INVALID: "The selected condition isn't valid. Choose another condition.",
  MARKETPLACE_LISTING_GRADE_INVALID: "The selected grade isn't valid. Choose another grade.",
  MARKETPLACE_LISTING_UNIT_INVALID: "The selected unit isn't valid. Choose another unit.",
  // lifecycle
  MARKETPLACE_LISTING_NOT_FOUND: "This listing (or its editable draft) was not found.",
  MARKETPLACE_LISTING_VERSION_NOT_FOUND: "The draft version was not found. Refresh and try again.",
  MARKETPLACE_LISTING_IDEMPOTENCY_CONFLICT: "A different listing was already created with this request. Reload the page and try again.",
  MARKETPLACE_LISTING_VERSION_CONFLICT: "Someone (or another tab) changed this listing. We refreshed it — review and try again.",
  MARKETPLACE_LISTING_VERSION_OWNERSHIP_INVALID: "This listing or version doesn't belong to this seller account, or the draft has changed. Refresh and try again.",
  MARKETPLACE_LISTING_TRANSITION_INVALID: "That action isn't allowed in the listing's current state (for example it is under review, published or archived).",
  MARKETPLACE_LISTING_NOT_READY_FOR_SUBMISSION: "Not ready to submit: set a price above 0 and attach at least one image.",
  MARKETPLACE_LISTING_NOT_READY_FOR_PUBLICATION:
    "Not ready to go live: the seller must be verified, the listing needs stock above 0 and a primary image.",
  MARKETPLACE_LISTING_INSPECTION_NOT_PASSED: "This listing needs a passed inspection before it can go live.",
  MARKETPLACE_LISTING_NOT_PUBLISHED: "Only live (published) listings can be paused.",
  MARKETPLACE_LISTING_RESERVATION_ACTIVE: "This listing has active buyer reservations and can't be archived yet.",
  MARKETPLACE_SELLER_RESUME_BLOCKED: "This listing was suspended by the marketplace team, so you can't resume it. Contact support.",
  MARKETPLACE_INVENTORY_UNIT_CHANGE_BLOCKED: "You can't change the unit while the listing has stock. Set stock to 0 first.",
  MARKETPLACE_LISTING_INTERNAL_ERROR: "The listing service hit an error. Please try again later.",
  MARKETPLACE_LISTING_BAD_REQUEST: "The request was rejected. Check the values and try again.",
  MARKETPLACE_LISTING_CONFLICT: "The listing changed. Refresh and try again.",
  MARKETPLACE_LISTING_FORBIDDEN: "You can't change this listing.",
  // attributes
  MARKETPLACE_LISTING_SCHEMA_NOT_FOUND: "The attribute schema for this category couldn't be loaded (the category may be inactive).",
  MARKETPLACE_LISTING_ATTRIBUTE_DUPLICATE: "An attribute or option was entered twice.",
  MARKETPLACE_LISTING_ATTRIBUTE_NOT_ALLOWED: "One of the attributes isn't allowed for this category. Refresh the page.",
  MARKETPLACE_LISTING_ATTRIBUTE_CARDINALITY_INVALID: "Only multi-select attributes accept more than one value.",
  MARKETPLACE_LISTING_ATTRIBUTE_OPTION_INVALID: "One of the selected options is no longer available.",
  MARKETPLACE_LISTING_ATTRIBUTE_VALUE_INVALID: "One of the attribute values has the wrong format.",
  // media
  MARKETPLACE_LISTING_MEDIA_TYPE_INVALID: "Media must be an image or a document.",
  MARKETPLACE_LISTING_PRIMARY_IMAGE_INVALID: "Only images can be the primary photo.",
  MARKETPLACE_LISTING_MEDIA_ORDER_INVALID: "The image order is out of date. Refresh and try again.",
  MARKETPLACE_LISTING_MEDIA_NOT_FOUND: "That file is no longer attached to this listing.",
  MARKETPLACE_LISTING_MEDIA_INVALID: "The file isn't ready, has the wrong type, or wasn't uploaded by you. Upload it again.",
  MARKETPLACE_LISTING_MEDIA_ALREADY_ATTACHED: "That file is already attached.",
  MARKETPLACE_LISTING_MAX_IMAGES_EXCEEDED: "You've reached the maximum number of images for a listing.",
  MARKETPLACE_LISTING_MAX_DOCUMENTS_EXCEEDED: "You've reached the maximum number of documents for a listing.",
  // inventory
  MARKETPLACE_INVENTORY_ROW_VERSION_INVALID: "Stock changed since you loaded it. We refreshed it — try again.",
  MARKETPLACE_INVENTORY_QUANTITY_INVALID: "Quantity can't be negative.",
  MARKETPLACE_INVENTORY_ADJUSTMENT_INVALID: "The adjustment must not be zero.",
  MARKETPLACE_INVENTORY_NOT_FOUND: "Set the initial stock before making adjustments.",
  MARKETPLACE_INVENTORY_VERSION_CONFLICT: "Stock changed (for example a buyer reserved some). We refreshed it — try again.",
  MARKETPLACE_INVENTORY_QUANTITY_BELOW_RESERVED: "On-hand stock can't go below the quantity buyers have reserved.",
  // inspections
  MARKETPLACE_INSPECTION_REQUEST_INVALID: "Describe what you fixed before requesting a re-inspection.",
  MARKETPLACE_INSPECTION_ACCESS_DENIED: "This inspection belongs to a different listing or seller.",
  MARKETPLACE_INSPECTION_NOT_FOUND: "The inspection was not found.",
  MARKETPLACE_INSPECTION_REINSPECTION_INVALID: "Re-inspection can only be requested after a failed inspection.",
  // files
  FILE_SIZE_EXCEEDED: "The file is too large.",
  FILE_CONTENT_TYPE_INVALID: "This file type isn't allowed.",
  FILE_ACCESS_DENIED: "You can't access this file.",
  FILE_NOT_FOUND: "The file was not found.",
  STORAGE_UNAVAILABLE: "File storage is temporarily unavailable. Please try again.",
};

export function errorCode(error: unknown): string | undefined {
  return isApiError(error) ? error.code : undefined;
}

export function hasErrorCode(error: unknown, ...codes: string[]): boolean {
  const code = errorCode(error);
  return !!code && codes.includes(code);
}

/** Row-version conflicts that should trigger a refetch of the listing / inventory. */
export function isVersionConflict(error: unknown): boolean {
  return hasErrorCode(error, "MARKETPLACE_LISTING_VERSION_CONFLICT", "INVALID_ROW_VERSION", "MARKETPLACE_LISTING_ROW_VERSION_INVALID", "MARKETPLACE_LISTING_CONFLICT");
}
export function isInventoryConflict(error: unknown): boolean {
  return hasErrorCode(error, "MARKETPLACE_INVENTORY_VERSION_CONFLICT", "MARKETPLACE_INVENTORY_ROW_VERSION_INVALID");
}

/** Message for catalog-listing / files errors. */
export function sellerErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return getErrorMessage(error);
}

/**
 * user-organization seller-account errors: ProblemDetails with no code and empty detail (E2), or { code } 403 (E4).
 * Map by status; `conflict` lets the caller describe what a 409 means for that action.
 */
export function sellerAccountErrorMessage(error: unknown, conflict = "This record changed. Refresh and try again."): string {
  if (!isApiError(error)) return getErrorMessage(error);
  if (error.code === "MARKETPLACE_SELLER_ACCESS_DENIED") return "You're not an active member of this seller account.";
  switch (error.status) {
    case 400:
      return error.hasFieldErrors ? "Some fields are missing or invalid. Check the form and try again." : "The details were rejected. Check every required field and try again.";
    case 403:
      return "Only the owner of an active seller account can do this.";
    case 404:
      return "The seller record was not found.";
    case 409:
      return conflict;
    default:
      return sellerErrorMessage(error);
  }
}
