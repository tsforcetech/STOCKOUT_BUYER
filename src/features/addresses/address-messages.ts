import { getErrorMessage, isApiError } from "@/lib/api/errors";

/** COM-ADDR-01 error codes → buyer wording. Field-level codes are shown on the form; PII is never echoed back. */
const MESSAGES: Record<string, string> = {
  BUYER_ADDRESS_FIELD_REQUIRED: "Fill in the required fields.",
  BUYER_ADDRESS_FIELD_TOO_LONG: "One of the fields is too long. Shorten it and try again.",
  BUYER_ADDRESS_FIELD_INVALID: "One of the fields isn't valid. Check the form and try again.",
  BUYER_ADDRESS_PHONE_INVALID: "Enter a valid phone number (7 to 15 digits).",
  BUYER_ADDRESS_COUNTRY_INVALID: "Choose a valid country.",
  BUYER_ADDRESS_EMIRATE_INVALID: "Choose one of the seven emirates.",
  BUYER_ADDRESS_LINE_REQUIRED: "Enter a street or a building.",
  BUYER_ADDRESS_ROWVERSION_REQUIRED: "This address needs reloading. We've refreshed it; try again.",
  BUYER_ADDRESS_IDEMPOTENCY_KEY_INVALID: "Something went wrong saving. Try again.",
  BUYER_ADDRESS_PAGINATION_INVALID: "Couldn't load that page. Try again.",
  BUYER_ADDRESS_ACCESS_DENIED: "You don't have access to these addresses.",
  BUYER_ADDRESS_PERMISSION_DENIED: "Your role can view these addresses but can't change them. Ask your company's owner or an admin.",
  BUYER_ADDRESS_ORG_NOT_ACTIVE: "This company account isn't active, so its addresses can't be changed.",
  BUYER_ADDRESS_NOT_FOUND: "This address no longer exists. We've refreshed the list.",
  BUYER_ADDRESS_INDIVIDUAL_BUYER_NOT_FOUND: "Set up your buyer account first, then add addresses.",
  BUYER_ADDRESS_DUPLICATE: "You already have an address at this location. Edit that one instead.",
  BUYER_ADDRESS_VERSION_CONFLICT: "This address was changed somewhere else. We've loaded the latest version; check it and save again.",
  BUYER_ADDRESS_INACTIVE: "This address has been removed and can't be used.",
  BUYER_ADDRESS_LIMIT_REACHED: "You've reached the maximum number of saved addresses. Remove one to add another.",
  BUYER_ADDRESS_IDEMPOTENCY_KEY_REUSED: "That save didn't go through. Try again.",
  BUYER_ADDRESS_BUSY: "We're still saving your last change. Try again in a moment.",
  // BE-13 map pin
  BUYER_ADDRESS_COORDINATES_INCOMPLETE: "Drop the map pin again: the location was incomplete.",
  BUYER_ADDRESS_COORDINATES_PRECISION_INVALID: "Drop the map pin again: the location was too precise to save.",
  BUYER_ADDRESS_LATITUDE_INVALID: "That map location isn't valid. Drop the pin again.",
  BUYER_ADDRESS_LONGITUDE_INVALID: "That map location isn't valid. Drop the pin again.",
  // Only when the coordinate-enforcement policy is on (RequireDeliveryAddressCoordinates); legacy addresses may have no pin.
  BUYER_ADDRESS_LOCATION_REQUIRED: "This address has no map pin. Add a delivery pin to use it for this order.",
  BUYER_ADDRESS_UNEXPECTED_RESULT: "We couldn't save the address. Your details are still here; try again.",
};

export const addressCode = (e: unknown) => (isApiError(e) ? e.code : undefined);
export const addressMessage = (e: unknown) => {
  const code = addressCode(e);
  return (code && MESSAGES[code]) || getErrorMessage(e);
};
