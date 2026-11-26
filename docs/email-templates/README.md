# StockOut email templates (for NotificationIntegration and IdentityAccess)

Premium HTML emails in the StockOut brand, one file per notification type. Generated 26 Nov 2026 by the frontend team; the backend stores and sends them.

## Format

- `CODE.html` = BodyHtml, `CODE.txt` = plain-text BodyText (send both, multipart/alternative). `templates.json` lists every code with its subject and placeholders.
- The file name is the template code. It matches the in-app `notificationType` where one exists (e.g. `BUYER_ORDER_PLACED`, `PLATFORM_ADMIN_NEW_ORDER`, `SELLER_NEW_ORDER_RECEIVED`).
- Placeholders are `{{PascalCase}}` and are filled by plain string replacement, as `OrderPlacedNotificationConsumerWorker` already does. HTML-encode every value, **except** placeholders ending in `Html` (`ItemsRowsHtml`, `DeliveryAddressHtml`, `SellerNamesHtml`, `ChangesHtml`, `MissingDocumentsHtml`, `ListingsRowsHtml`): the server builds those from encoded parts (row markup in `BUYER_ORDER_PLACED.html` shows the style).
- Every template also uses `{{RecipientEmail}}` and `{{Year}}` in the footer.
- Values: money `AED 3,005.47`; dates `27 Nov 2026, 7:01 PM` in Asia/Dubai; links absolute `https://www.stockoutme.com/...` (buyer `/account/orders/{orderId}`, seller `/seller/orders/{subOrderId}`, admin `https://admin.stockoutme.com/orders/{orderId}`).
- Layout: 600 px, table-based, inline CSS, no web fonts required, no scripts; tested in a browser render. Logo: `https://www.stockoutme.com/email/stockout-logo-white.png` (hosted on the website, 153x32 at 2x).
- Never put a password, card number or token in an email. Codes (`{{Code}}`, `{{ResetCode}}`) expire and are single-use.
- IdentityAccess `VerificationDeliveryService` builds the code and password emails inline today; switch it to `AUTH_EMAIL_VERIFICATION_CODE` and `AUTH_PASSWORD_RESET`.

## Placeholders the backend must start supplying

Already filled somewhere today: `AdminReviewDeadlineUtc`, `ConfirmationDeadlineUtc`, `DaysRemaining`, `Decision`, `DecisionReason`, `DocumentExpiresAtUtc`, `DocumentType`, `OccurredAtUtc`, `OrderNumber`, `Reason`, `RecipientName`, `RejectedAtUtc`, `ReminderType`, `SellerName`, `SubOrderNumber`, `SubOrderTotal`, `SubmittedAtUtc`, `TargetBusinessDays`, `VerifiedAtUtc`.

New (backend to add per template; see `templates.json` for which template uses which): `AcceptByDateTime`, `AdminClaimsUrl`, `AdminEscalationUrl`, `AdminOrderUrl`, `AdminUrl`, `Amount`, `BankLast4`, `BuyerEmirate`, `BuyerName`, `CancelledBy`, `ChangeSummary`, `ChangedAtDateTime`, `ChangesHtml`, `ChargedAmount`, `CloseDate`, `Code`, `CollectionAddress`, `CollectionWindow`, `CompanyName`, `CreatedCount`, `DaysLeft`, `DeemedNote`, `DeliveryAddressHtml`, `DeliveryAmount`, `DeliveryContact`, `DeliveryReference`, `DeliveryWindow`, `Device`, `EffectiveDate`, `Emirate`, `ErrorCount`, `ExpiryDateTime`, `ExpiryMinutes`, `FeeAmount`, `FileName`, `FinanceUrl`, `GrossAmount`, `HoursLeft`, `ImportUrl`, `InvitationUrl`, `InviterName`, `InvoiceNumber`, `InvoiceUrl`, `ItemsRowsHtml`, `ListingNumber`, `ListingTitle`, `ListingsRowsHtml`, `Location`, `MatchCount`, `MaterialsAmount`, `MissingDocuments`, `MissingDocumentsHtml`, `MissingItems`, `NetPayout`, `NewEmail`, `OldEmail`, `OldestSubmittedAt`, `OrderNumbers`, `OrderUrl`, `PayoutSetupUrl`, `PayoutsUrl`, `PendingCount`, `PolicyName`, `PolicyUrl`, `Price`, `PublicListingUrl`, `Quantity`, `QuoteAmount`, `RecipientEmail`, `ReconciliationType`, `ReplyPreview`, `RequestNumber`, `RequestTitle`, `RequestUrl`, `ResetCode`, `ResetUrl`, `Role`, `SearchName`, `SearchUrl`, `SellerCount`, `SellerListingUrl`, `SellerNamesHtml`, `SellerOrderUrl`, `SignInDateTime`, `TicketNumber`, `TicketUrl`, `TotalAmount`, `UnlockDateTime`, `ValidUntil`, `VatAmount`, `Year`.

## Templates

### Account

| Code | To | Subject |
| --- | --- | --- |
| `AUTH_EMAIL_VERIFICATION_CODE` | Any user | Your StockOut code: {{Code}} |
| `AUTH_PASSWORD_RESET` | Any user | Reset your StockOut password |
| `AUTH_WELCOME` | New user | Welcome to StockOut |
| `COMPANY_INVITATION` | Invitee | {{InviterName}} invited you to {{CompanyName}} on StockOut |

### Security

| Code | To | Subject |
| --- | --- | --- |
| `AUTH_PASSWORD_CHANGED` | Any user | Your StockOut password was changed |
| `AUTH_NEW_SIGN_IN` | Any user | New sign-in to your StockOut account |
| `AUTH_EMAIL_CHANGED` | Any user (old and new address) | Your StockOut email address was changed |
| `AUTH_ACCOUNT_LOCKED` | Any user | Your StockOut account is temporarily locked |

### Legal

| Code | To | Subject |
| --- | --- | --- |
| `POLICY_UPDATED` | All users | We've updated StockOut's {{PolicyName}} |

### Verification

| Code | To | Subject |
| --- | --- | --- |
| `BUYER_IDENTITY_SUBMITTED` | Buyer | We received your verification |
| `BUYER_IDENTITY_APPROVED` | Buyer | You're verified: you can now buy on StockOut |
| `BUYER_IDENTITY_REJECTED` | Buyer | Action needed: your verification wasn't approved |
| `SELLER_VERIFICATION_SUBMITTED` | Seller | We received {{CompanyName}}'s seller application |
| `SELLER_VERIFICATION_APPROVED` | Seller | {{CompanyName}} is verified: start selling |
| `SELLER_VERIFICATION_DOCUMENTS_NEEDED` | Seller | Action needed: more documents for {{CompanyName}} |
| `SELLER_VERIFICATION_REJECTED` | Seller | {{CompanyName}}'s seller application wasn't approved |
| `ADMIN_VERIFICATION_PENDING` | Admin | {{PendingCount}} verifications waiting for review |

### Listings

| Code | To | Subject |
| --- | --- | --- |
| `SELLER_LISTING_SUBMITTED` | Seller | Listing submitted: {{ListingTitle}} |
| `SELLER_LISTING_PUBLISHED` | Seller | Live now: {{ListingTitle}} |
| `SELLER_LISTING_CHANGES_REQUESTED` | Seller | Changes needed: {{ListingTitle}} |
| `SELLER_LISTING_REJECTED` | Seller | Not approved: {{ListingTitle}} |
| `SELLER_IMPORT_COMPLETED` | Seller | Your import is done: {{CreatedCount}} listings created |
| `SELLER_LISTING_SOLD_OUT` | Seller | Sold out: {{ListingTitle}} |
| `ADMIN_LISTINGS_PENDING_REVIEW` | Admin | {{PendingCount}} listings waiting for review |

### Buying

| Code | To | Subject |
| --- | --- | --- |
| `SEARCH_ALERT_MATCHED` | Buyer | New matches for “{{SearchName}}” |
| `BUYER_QUOTE_RECEIVED` | Buyer | New quote for your request {{RequestNumber}} |

### Selling

| Code | To | Subject |
| --- | --- | --- |
| `SELLER_NEW_BUYER_REQUEST` | Seller | New buyer request: {{RequestTitle}} |

### Orders

| Code | To | Subject |
| --- | --- | --- |
| `BUYER_ORDER_PLACED` | Buyer | Order {{OrderNumber}} placed |
| `SELLER_NEW_ORDER_RECEIVED` | Seller | New order {{SubOrderNumber}}: confirm by {{ConfirmationDeadlineUtc}} |
| `PLATFORM_ADMIN_NEW_ORDER` | Admin | New order {{OrderNumber}} · {{TotalAmount}} |
| `SELLER_CONFIRMATION_REMINDER` | Seller | Reminder: confirm order {{SubOrderNumber}} by {{ConfirmationDeadlineUtc}} |
| `BUYER_ORDER_CONFIRMATION_DELAYED` | Buyer | Update on order {{OrderNumber}} |
| `ADMIN_SELLER_CONFIRMATION_ESCALATED` | Admin | Escalated: {{SellerName}} missed confirmation on {{SubOrderNumber}} |
| `BUYER_ORDER_SELLER_CONFIRMED` | Buyer | {{SellerName}} confirmed your order {{OrderNumber}} |
| `BUYER_ORDER_SELLER_REJECTED` | Buyer | {{SellerName}} couldn't supply part of order {{OrderNumber}} |
| `ADMIN_ORDER_SELLER_REJECTED` | Admin | Seller rejected {{SubOrderNumber}} |
| `BUYER_ORDER_ACCEPTED` | Buyer | Order {{OrderNumber}} completed |
| `SELLER_ORDER_ACCEPTED` | Seller | Accepted: {{SubOrderNumber}}. Payout process started |
| `BUYER_ORDER_CANCELLED` | Buyer | Order {{OrderNumber}} cancelled |
| `SELLER_ORDER_CANCELLED` | Seller | Cancelled: {{SubOrderNumber}} |

### Payments

| Code | To | Subject |
| --- | --- | --- |
| `FINANCE_RECONCILIATION_APPROVAL_REQUIRED` | Finance | Approval needed: payment reconciliation for {{OrderNumber}} |
| `BUYER_PAYMENT_CHARGED` | Buyer | Payment taken for order {{OrderNumber}}: {{ChargedAmount}} |
| `BUYER_PAYMENT_HOLD_RELEASED` | Buyer | Card hold released: {{Amount}} |
| `BUYER_REFUND_ISSUED` | Buyer | Refund of {{Amount}} for order {{OrderNumber}} |
| `INVOICE_READY` | Buyer / Seller | Your tax invoice {{InvoiceNumber}} is ready |

### Delivery

| Code | To | Subject |
| --- | --- | --- |
| `BUYER_DELIVERY_SCHEDULED` | Buyer | Delivery booked for order {{OrderNumber}} |
| `SELLER_COLLECTION_SCHEDULED` | Seller | Collection booked for {{SubOrderNumber}} |
| `BUYER_ORDER_DISPATCHED` | Buyer | On the way: order {{OrderNumber}} |
| `BUYER_ORDER_DELIVERED` | Buyer | Delivered: order {{OrderNumber}}. Please check the goods |
| `SELLER_ORDER_DELIVERED` | Seller | Delivered: {{SubOrderNumber}} |
| `BUYER_ACCEPTANCE_REMINDER` | Buyer | Reminder: check order {{OrderNumber}} by {{AcceptByDateTime}} |
| `BUYER_DELIVERY_ADDRESS_CHANGED` | Buyer | Delivery address updated for order {{OrderNumber}} |
| `SELLER_DELIVERY_ADDRESS_CHANGED` | Seller | Address changed for {{SubOrderNumber}} |

### Claims

| Code | To | Subject |
| --- | --- | --- |
| `BUYER_ORDER_CLAIM_SUBMITTED` | Buyer | We received your report for order {{OrderNumber}} |
| `SELLER_ORDER_CLAIM_SUBMITTED` | Seller | Problem reported on {{SubOrderNumber}} |
| `ADMIN_ORDER_CLAIM_AWAITING_REVIEW` | Admin | Claim to review: {{SubOrderNumber}} |
| `BUYER_CLAIM_DECIDED` | Buyer | Decision on your report for order {{OrderNumber}} |
| `SELLER_CLAIM_DECIDED` | Seller | Decision on the claim for {{SubOrderNumber}} |

### Payouts

| Code | To | Subject |
| --- | --- | --- |
| `SELLER_PAYOUT_SENT` | Seller | Payout sent: {{NetPayout}} |
| `SELLER_PAYOUT_SETUP_INCOMPLETE` | Seller | Action needed: finish your payout setup |

### Support

| Code | To | Subject |
| --- | --- | --- |
| `SUPPORT_REPLY` | Buyer / Seller | Reply to your request {{TicketNumber}} |
