/**
 * Stage 8A.2 buyer commerce (bidding-deal). Shapes copied from
 * services/bidding-deal/src/Emcore.BiddingDeal.Contracts/Cart/BuyerCartDtos.cs and Wishlist/BuyerWishlistDtos.cs
 * at tsforcetech/STOCKOUT 52a0078. Success bodies are the DTO itself (no envelope); errors are
 * ProblemDetails with a `code` extension (BaseApiController.MapResult).
 */
type Guid = string;
type IsoDateTime = string;

export interface AddCartItemRequest {
  listingId: Guid;
  sellerId: Guid;
  /** Whole units (C# int). */
  quantity: number;
}

export interface UpdateCartItemQuantityRequest {
  quantity: number;
}

export interface GuestCartItemDto {
  listingId: Guid;
  sellerId: Guid;
  quantity: number;
  /** Untrusted snapshot; the server re-reads the listing. */
  addedPrice: number;
  addedCurrency: string;
}

export interface MergeGuestCartRequest {
  items: GuestCartItemDto[];
}

export type CartItemState = "ACTIVE" | string;

export interface BuyerCartItemResponse {
  cartItemId: Guid;
  listingId: Guid;
  sellerId: Guid;
  title: string;
  thumbnailUrl: string | null;
  quantity: number;
  addedPrice: number;
  currentPrice: number;
  addedCurrency: string;
  currentCurrency: string;
  hasPriceChanged: boolean;
  priceDifference: number;
  stockAvailable: number;
  hasSufficientStock: boolean;
  isActive: boolean;
  isPurchasable: boolean;
  itemState: CartItemState;
  statusMessage: string | null;
  lineSubtotal: number;
}

export interface CartSellerGroupDto {
  sellerId: Guid;
  sellerDisplayName: string | null;
  groupSubtotal: number;
  items: BuyerCartItemResponse[];
}

/** Stable decision input is `code`; `message` is backend display text. */
export type CheckoutBlockerCode =
  | "BUYER_IDENTITY_VERIFICATION_REQUIRED"
  | "MULTIPLE_ORGANIZATIONS"
  | "LISTING_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "COMMERCE_WHOLE_LOT_REQUIRED"
  | "COMMERCE_MIN_ORDER_QTY_NOT_MET"
  | "MIXED_CURRENCY_NOT_SUPPORTED"
  | "TAX_RATE_UNAVAILABLE"
  | "CART_EMPTY";

export interface CheckoutBlockerDto {
  code: CheckoutBlockerCode | string;
  message: string;
  listingId: Guid | null;
}

export interface CheckoutReadinessDto {
  canProceed: boolean;
  blockers: CheckoutBlockerDto[];
}

export interface BuyerCartResponse {
  cartId: Guid;
  buyerId: Guid;
  itemCount: number;
  totalQuantity: number;
  totalSubtotal: number;
  estimatedVatRatePercent: number;
  estimatedVatAmount: number;
  estimatedTotal: number;
  currency: string;
  sellerGroups: CartSellerGroupDto[];
  checkoutReadiness: CheckoutReadinessDto;
  /** Base64 rowversion; send back quoted in If-Match. */
  rowVersion: string;
  updatedAt: IsoDateTime;
}

export interface SavedItemDto {
  cartItemId: Guid;
  listingId: Guid;
  sellerId: Guid;
  title: string;
  thumbnailUrl: string | null;
  quantity: number;
  savedPrice: number;
  currentPrice: number;
  currency: string;
  stockAvailable: number;
  isPurchasable: boolean;
  savedAt: IsoDateTime;
}

export interface SavedItemsResponse {
  items: SavedItemDto[];
  totalCount: number;
}

export interface AddWishlistItemRequest {
  listingId: Guid;
  sellerId: Guid;
}

export interface MoveWishlistToCartRequest {
  listingId: Guid;
  quantity: number;
}

export interface MoveToCartResponse {
  success: boolean;
  listingId: Guid;
  cartId: Guid;
  quantity: number;
}

export interface BuyerWishlistItemDto {
  wishlistItemId: Guid;
  listingId: Guid;
  sellerId: Guid;
  title: string;
  thumbnailUrl: string | null;
  currentPrice: number;
  currency: string;
  stockAvailable: number;
  isPurchasable: boolean;
  addedAt: IsoDateTime;
}

export interface BuyerWishlistResponse {
  wishlistId: Guid;
  buyerId: Guid;
  totalItems: number;
  pageNumber: number;
  pageSize: number;
  items: BuyerWishlistItemDto[];
}

export interface WishlistCheckResponse {
  isSaved: boolean;
  listingId: Guid;
}

/** Backend limit on active cart lines (saved-for-later and wishlist are separate). */
export const CART_LINE_LIMIT = 50;
