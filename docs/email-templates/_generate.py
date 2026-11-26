"""Generates StockOut HTML email templates from one shared layout (table-based, inline CSS, 600px, email-client safe)."""
import os, html
OUT = "/home/user/stockout_buyer/docs/email-templates"
LOGO = "https://www.stockoutme.com/email/stockout-logo-white.png"
INK, LIME, BODY, MUTED, BORDER, CREAM, BG = "#1A1A1A", "#F8FF2C", "#2D2D27", "#74756C", "#EEEEED", "#FDFEF2", "#F4F4F2"
FONT = "'Geist','Segoe UI',Roboto,Helvetica,Arial,sans-serif"
TONES = {"success": ("#E6F6F0", "#047857"), "info": ("#EAF2FD", "#1D4ED8"), "warning": ("#FDF3DC", "#92400E"), "danger": ("#FADFE3", "#B91C1C"), "neutral": ("#F4F4F2", "#2D2D27")}

def kv(rows):
    out = []
    for i, (k, v) in enumerate(rows):
        top = f"border-top:1px solid {BORDER};" if i else ""
        bold = "font-weight:700;color:" + INK + ";" if k.startswith("!") else "color:" + BODY + ";"
        k = k.lstrip("!")
        out.append(f'<tr><td style="padding:10px 0;{top}font-size:14px;color:{MUTED};">{k}</td><td align="right" style="padding:10px 0;{top}font-size:14px;{bold}">{v}</td></tr>')
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">{"".join(out)}</table>'

def steps(items):
    rows = []
    for i, (t, d) in enumerate(items, 1):
        rows.append(f'''<tr><td valign="top" width="36" style="padding:0 0 16px 0;"><div style="width:28px;height:28px;border-radius:14px;background:{INK};color:{LIME};font-size:13px;font-weight:700;line-height:28px;text-align:center;">{i}</div></td>
<td valign="top" style="padding:3px 0 16px 8px;"><div style="font-size:14px;font-weight:700;color:{INK};">{t}</div><div style="font-size:13px;line-height:20px;color:{MUTED};padding-top:2px;">{d}</div></td></tr>''')
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{"".join(rows)}</table>'

def card(inner, title=None, bg="#FFFFFF"):
    t = f'<div style="font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:{MUTED};padding-bottom:10px;">{title}</div>' if title else ""
    return f'<tr><td style="padding:0 32px 20px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid {BORDER};border-radius:14px;background:{bg};"><tr><td style="padding:18px 20px;">{t}{inner}</td></tr></table></td></tr>'

def layout(name, subject, preheader, tone, chip, headline, intro, blocks, cta_text, cta_url, note=""):
    bg, fg = TONES[tone]
    return f'''<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{subject}</title>
<!-- StockOut email template: {name}. Double-brace placeholders are replaced by NotificationIntegration (values HTML-encoded; *Html placeholders are server-built HTML). -->
<style>
  @media (max-width:620px) {{ .container {{ width:100% !important; }} .px {{ padding-left:20px !important; padding-right:20px !important; }} .h1 {{ font-size:24px !important; line-height:30px !important; }} }}
  a {{ color:{INK}; }}
</style>
</head>
<body style="margin:0;padding:0;background:{BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG};">{preheader}&#8202;&#847;&#8202;&#847;&#8202;&#847;&#8202;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden;font-family:{FONT};">
  <tr><td style="background:{INK};padding:26px 32px;" class="px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><a href="https://www.stockoutme.com" style="text-decoration:none;"><img src="{LOGO}" width="153" height="32" alt="StockOut" style="display:block;border:0;width:153px;height:32px;"></a></td>
      <td align="right" style="font-size:12px;color:#BDBDB5;">Verified surplus marketplace</td>
    </tr></table>
  </td></tr>
  <tr><td style="height:4px;background:{LIME};line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td class="px" style="padding:32px 32px 8px 32px;">
    <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:{bg};color:{fg};font-size:12px;font-weight:700;letter-spacing:0.4px;">{chip}</span>
    <h1 class="h1" style="margin:16px 0 8px 0;font-size:28px;line-height:34px;font-weight:800;color:{INK};">{headline}</h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:{BODY};">{intro}</p>
  </td></tr>
  {"".join(blocks)}
  <tr><td class="px" align="left" style="padding:4px 32px 28px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:{INK};">
      <a href="{cta_url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:{LIME};text-decoration:none;border-radius:999px;">{cta_text} &rarr;</a>
    </td></tr></table>
    {f'<p style="margin:14px 0 0 0;font-size:13px;line-height:20px;color:{MUTED};">{note}</p>' if note else ''}
  </td></tr>
  <tr><td style="background:{CREAM};border-top:1px solid {BORDER};padding:22px 32px;" class="px">
    <p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:{BODY};">Questions? Reply to this email or write to <a href="mailto:info@stockoutme.com" style="color:{INK};font-weight:600;">info@stockoutme.com</a>.</p>
    <p style="margin:0;font-size:12px;line-height:18px;color:{MUTED};">You're receiving this because of activity on your StockOut account ({{{{RecipientEmail}}}}). Order and security emails are always sent. <a href="https://www.stockoutme.com/account/notifications" style="color:{MUTED};">Notification settings</a></p>
    <p style="margin:12px 0 0 0;font-size:12px;color:{MUTED};">&copy; {{{{Year}}}} StockOut &middot; Dubai, United Arab Emirates</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>
'''

ITEMS = card('{{ItemsRowsHtml}}', "Items")
T = {}
T["ORDER_PLACED__buyer"] = layout("ORDER_PLACED (buyer)", "Order {{OrderNumber}} placed", "Your order is placed. {{TotalAmount}} is on hold, not charged.", "success", "ORDER PLACED",
  "Thank you, your order is placed", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> is with the sellers. Your card has a hold of <b>{{TotalAmount}}</b>; you're charged only for the items sellers confirm.",
  [ITEMS, card(kv([("Materials", "{{MaterialsAmount}}"), ("VAT", "{{VatAmount}}"), ("Freight delivery (incl. VAT)", "{{DeliveryAmount}}"), ("!Total on hold", "{{TotalAmount}}")]), "Summary"),
   card('<div style="font-size:14px;line-height:21px;color:' + BODY + ';">{{DeliveryAddressHtml}}</div>', "Delivering to"),
   card(steps([("Sellers confirm", "By {{ConfirmationDeadlineUtc}}. We'll tell you as each seller confirms."), ("Your card is charged", "Only for the items sellers confirm."), ("StockOut delivers to your site", "Then you have 5 days to check the goods.")]), "What happens next", CREAM)],
  "View your order", "{{OrderUrl}}")
T["SELLER_NEW_ORDER_RECEIVED__seller"] = layout("SELLER_NEW_ORDER_RECEIVED (seller)", "New order {{SubOrderNumber}}: confirm by {{ConfirmationDeadlineUtc}}", "New order for {{SellerName}}. Confirm by {{ConfirmationDeadlineUtc}}.", "warning", "NEW ORDER · ACTION NEEDED",
  "You have a new order", "Hi {{RecipientName}}, a buyer ordered from <b>{{SellerName}}</b>. Please confirm or reject order <b>{{SubOrderNumber}}</b> by <b>{{ConfirmationDeadlineUtc}}</b>. If you don't respond in time, StockOut follows up and the order may be cancelled.",
  [ITEMS, card(kv([("Order", "{{SubOrderNumber}}"), ("Delivery", "StockOut freight collects from you"), ("Collection area", "{{BuyerEmirate}}"), ("!Order value", "{{SubOrderTotal}}")]), "Order details"),
   card(steps([("Confirm the order", "Check stock and confirm in the seller portal."), ("Pack the goods", "StockOut freight will book a collection time with you."), ("Get paid", "After delivery and the buyer's acceptance, minus the StockOut fee.")]), "Next steps", CREAM)],
  "Confirm or reject", "{{SellerOrderUrl}}", "Can't fulfil it? Reject with a reason so the buyer's card hold is released quickly.")
T["ADMIN_NEW_ORDER_PLACED__admin"] = layout("ADMIN_NEW_ORDER_PLACED (admin)", "New order {{OrderNumber}} · {{TotalAmount}}", "New order {{OrderNumber}} from {{BuyerName}}: {{SellerCount}} seller(s), {{TotalAmount}}.", "info", "NEW ORDER",
  "New order {{OrderNumber}}", "<b>{{BuyerName}}</b> placed an order with <b>{{SellerCount}}</b> seller(s). Sellers must confirm by {{ConfirmationDeadlineUtc}}.",
  [card(kv([("Buyer", "{{BuyerName}}"), ("Sellers", "{{SellerNamesHtml}}"), ("Delivery", "Freight to {{BuyerEmirate}}"), ("Payment", "Card hold (not captured)"), ("!Total", "{{TotalAmount}}")]), "Order"), ITEMS],
  "Open in admin", "{{AdminOrderUrl}}")
T["BUYER_DELIVERY_SCHEDULED__buyer"] = layout("BUYER_DELIVERY_SCHEDULED (buyer)", "Delivery booked for order {{OrderNumber}}", "Your delivery is booked for {{DeliveryWindow}}.", "info", "DELIVERY SCHEDULED",
  "Your delivery is booked", "Hi {{RecipientName}}, StockOut freight will deliver order <b>{{OrderNumber}}</b> on <b>{{DeliveryWindow}}</b>. Please make sure someone can receive and check the goods at site.",
  [card(kv([("Delivery window", "{{DeliveryWindow}}"), ("From", "{{SellerName}}"), ("Driver / contact", "{{DeliveryContact}}"), ("Reference", "{{DeliveryReference}}")]), "Delivery"),
   card('<div style="font-size:14px;line-height:21px;color:' + BODY + ';">{{DeliveryAddressHtml}}</div>', "Delivering to"), ITEMS],
  "Track your order", "{{OrderUrl}}", "Need a different day or site? Change it from the order page before dispatch.")
T["SELLER_COLLECTION_SCHEDULED__seller"] = layout("SELLER_COLLECTION_SCHEDULED (seller)", "Collection booked for {{SubOrderNumber}}", "StockOut freight collects on {{CollectionWindow}}.", "info", "COLLECTION SCHEDULED",
  "Freight collection is booked", "Hi {{RecipientName}}, StockOut freight will collect order <b>{{SubOrderNumber}}</b> on <b>{{CollectionWindow}}</b>. Please have the goods packed and labelled with the order number.",
  [card(kv([("Collection window", "{{CollectionWindow}}"), ("Collect from", "{{CollectionAddress}}"), ("Driver / contact", "{{DeliveryContact}}"), ("Reference", "{{DeliveryReference}}")]), "Collection"), ITEMS],
  "View order", "{{SellerOrderUrl}}")
T["BUYER_ORDER_SELLER_CONFIRMED__buyer"] = layout("BUYER_ORDER_SELLER_CONFIRMED (buyer)", "{{SellerName}} confirmed your order {{OrderNumber}}", "{{SellerName}} confirmed. Delivery is being arranged.", "success", "CONFIRMED",
  "Your order is confirmed", "Hi {{RecipientName}}, <b>{{SellerName}}</b> confirmed their part of order <b>{{OrderNumber}}</b> ({{SubOrderTotal}}). StockOut is arranging freight; we'll email you the delivery date.",
  [ITEMS], "View your order", "{{OrderUrl}}")
T["BUYER_ORDER_DELIVERED__buyer"] = layout("BUYER_ORDER_DELIVERED (buyer)", "Delivered: order {{OrderNumber}}. Please check the goods", "Delivered. You have until {{AcceptByDateTime}} to accept or report a problem.", "success", "DELIVERED",
  "Your order was delivered", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> from {{SellerName}} was delivered. Please check the goods and accept them, or report a problem by <b>{{AcceptByDateTime}}</b>. After that it's accepted automatically.",
  [ITEMS], "Accept or report a problem", "{{OrderUrl}}")

for name, body in T.items():
    open(os.path.join(OUT, f"{name}.html"), "w").write(body)
print(len(T), "templates")

# ---------------- Full set (owner 26 Nov: all emails, not only orders) ----------------
import re, json, shutil
for f in os.listdir(OUT):
    if f.endswith(".html") or f.endswith(".txt") or f.endswith(".json"):
        os.remove(os.path.join(OUT, f))

def code_block(label, ph, expiry):
    return card(f'<div style="font-size:13px;color:{MUTED};padding-bottom:8px;">{label}</div><div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;letter-spacing:8px;font-weight:800;color:{INK};">{ph}</div><div style="font-size:13px;color:{MUTED};padding-top:8px;">Expires in {expiry} minutes. Never share this code; StockOut will never ask for it.</div>', None, CREAM)

def notice(text, tone="warning"):
    bg, fg = TONES[tone]
    return f'<tr><td style="padding:0 32px 20px 32px;"><div style="background:{bg};color:{fg};border-radius:12px;padding:14px 16px;font-size:14px;line-height:21px;">{text}</div></td></tr>'

ADDR = card('<div style="font-size:14px;line-height:21px;color:' + BODY + ';">{{DeliveryAddressHtml}}</div>', "Delivering to")
SEC = "If this wasn't you, reset your password now and contact info@stockoutme.com."

S = []  # (code, audience, category, subject, preheader, tone, chip, headline, intro, blocks, cta, url, note)
def add(*a): S.append(a)

# Account & security (identity-access: today hard-coded plain HTML)
add("AUTH_EMAIL_VERIFICATION_CODE", "Any user", "Account", "Your StockOut code: {{Code}}", "Your verification code is {{Code}}.", "neutral", "VERIFICATION CODE", "Confirm it's you", "Hi {{RecipientName}}, use this code to finish creating your account or to sign in.", [code_block("Your code", "{{Code}}", "{{ExpiryMinutes}}")], "Open StockOut", "https://www.stockoutme.com/login", "Didn't ask for a code? You can ignore this email; your account is safe.")
add("AUTH_PASSWORD_RESET", "Any user", "Account", "Reset your StockOut password", "Use this code to set a new password.", "warning", "PASSWORD RESET", "Reset your password", "Hi {{RecipientName}}, we received a request to reset your password. Use the code below, or the button, to set a new one.", [code_block("Reset code", "{{ResetCode}}", "{{ExpiryMinutes}}")], "Set a new password", "{{ResetUrl}}", "Didn't request this? Ignore this email; your password stays the same.")
add("AUTH_WELCOME", "New user", "Account", "Welcome to StockOut", "Your account is ready. Here's how to get started.", "success", "WELCOME", "Welcome to StockOut, {{RecipientName}}", "Your account is ready. StockOut is the UAE marketplace for verified surplus construction and industrial materials.", [card(steps([("Verify your account", "A quick ID check lets you buy. Usually reviewed within 1 working day."), ("Find what you need", "Search pipes, cables, steel, cement and more from verified sellers."), ("Have surplus to sell?", "Open a seller account and list it in minutes.")]), "Get started", CREAM)], "Start browsing", "https://www.stockoutme.com/")
add("AUTH_PASSWORD_CHANGED", "Any user", "Security", "Your StockOut password was changed", "Your password was changed on {{ChangedAtDateTime}}.", "neutral", "SECURITY", "Your password was changed", "Hi {{RecipientName}}, the password for your StockOut account was changed on <b>{{ChangedAtDateTime}}</b>.", [notice(SEC)], "Review account security", "https://www.stockoutme.com/account/security")
add("AUTH_NEW_SIGN_IN", "Any user", "Security", "New sign-in to your StockOut account", "New sign-in from {{Device}} on {{SignInDateTime}}.", "neutral", "SECURITY", "New sign-in to your account", "Hi {{RecipientName}}, your account was just used to sign in.", [card(kv([("When", "{{SignInDateTime}}"), ("Device", "{{Device}}"), ("Approximate location", "{{Location}}")]), "Sign-in details"), notice(SEC)], "Review sessions", "https://www.stockoutme.com/account/security")
add("AUTH_EMAIL_CHANGED", "Any user (old and new address)", "Security", "Your StockOut email address was changed", "Your sign-in email is now {{NewEmail}}.", "neutral", "SECURITY", "Your email address was changed", "Hi {{RecipientName}}, your StockOut sign-in email changed from {{OldEmail}} to <b>{{NewEmail}}</b>.", [notice(SEC)], "Review account security", "https://www.stockoutme.com/account/security")
add("AUTH_ACCOUNT_LOCKED", "Any user", "Security", "Your StockOut account is temporarily locked", "Too many sign-in attempts. Try again after {{UnlockDateTime}}.", "danger", "SECURITY", "Your account is temporarily locked", "Hi {{RecipientName}}, we locked your account after several failed sign-in attempts. You can try again after <b>{{UnlockDateTime}}</b>, or reset your password now.", [notice(SEC)], "Reset password", "https://www.stockoutme.com/forgot-password")
add("COMPANY_INVITATION", "Invitee", "Account", "{{InviterName}} invited you to {{CompanyName}} on StockOut", "Join {{CompanyName}} on StockOut as {{Role}}.", "info", "INVITATION", "You're invited to {{CompanyName}}", "<b>{{InviterName}}</b> invited you to join <b>{{CompanyName}}</b> on StockOut as <b>{{Role}}</b>. The invitation expires on {{ExpiryDateTime}}.", [], "Accept invitation", "{{InvitationUrl}}", "Not expecting this? You can ignore it.")
add("POLICY_UPDATED", "All users", "Legal", "We've updated StockOut's {{PolicyName}}", "Changes take effect on {{EffectiveDate}}.", "neutral", "POLICY UPDATE", "We've updated our {{PolicyName}}", "Hi {{RecipientName}}, our {{PolicyName}} changes on <b>{{EffectiveDate}}</b>. {{ChangeSummary}}", [], "Read and accept", "{{PolicyUrl}}")

# Verification
add("BUYER_IDENTITY_SUBMITTED", "Buyer", "Verification", "We received your verification", "We're reviewing your {{DocumentType}}. Usually within {{TargetBusinessDays}} working days.", "info", "VERIFICATION", "We received your documents", "Hi {{RecipientName}}, thanks for submitting your <b>{{DocumentType}}</b> on {{SubmittedAtUtc}}. We usually review within <b>{{TargetBusinessDays}}</b> working days and will email you the result.", [], "View verification", "https://www.stockoutme.com/account/verification", "You can keep adding to your cart while we review.")
add("BUYER_IDENTITY_APPROVED", "Buyer", "Verification", "You're verified: you can now buy on StockOut", "Your identity was approved. Checkout is open.", "success", "VERIFIED", "You're verified", "Hi {{RecipientName}}, your identity was approved on {{VerifiedAtUtc}}. You can now check out and place orders.", [], "Go to your cart", "https://www.stockoutme.com/cart")
add("BUYER_IDENTITY_REJECTED", "Buyer", "Verification", "Action needed: your verification wasn't approved", "Please resubmit: {{Reason}}", "danger", "ACTION NEEDED", "We couldn't approve your verification", "Hi {{RecipientName}}, we reviewed your documents on {{RejectedAtUtc}} and couldn't approve them.", [notice("<b>Reason:</b> {{Reason}}", "danger")], "Resubmit documents", "https://www.stockoutme.com/account/verification")
add("SELLER_VERIFICATION_SUBMITTED", "Seller", "Verification", "We received {{CompanyName}}'s seller application", "We're reviewing your documents.", "info", "SELLER VERIFICATION", "Application received", "Hi {{RecipientName}}, we received the seller application for <b>{{CompanyName}}</b>. Our team usually reviews within {{TargetBusinessDays}} working days.", [card(steps([("We check your documents", "Trade licence and owner ID."), ("You get verified", "A verified badge on all your listings."), ("Start selling", "List items one by one or upload a spreadsheet.")]), "What happens next", CREAM)], "View application", "https://www.stockoutme.com/seller/onboarding")
add("SELLER_VERIFICATION_APPROVED", "Seller", "Verification", "{{CompanyName}} is verified: start selling", "Your seller account is approved.", "success", "VERIFIED SELLER", "You're a verified seller", "Hi {{RecipientName}}, <b>{{CompanyName}}</b> is now a verified StockOut seller. Your listings show the verified badge.", [], "List your first item", "https://www.stockoutme.com/seller/listings/new")
add("SELLER_VERIFICATION_DOCUMENTS_NEEDED", "Seller", "Verification", "Action needed: more documents for {{CompanyName}}", "We need: {{MissingDocuments}}", "warning", "ACTION NEEDED", "We need a few more documents", "Hi {{RecipientName}}, to finish verifying <b>{{CompanyName}}</b> we need the following:", [notice("{{MissingDocumentsHtml}}")], "Upload documents", "https://www.stockoutme.com/seller/onboarding")
add("SELLER_VERIFICATION_REJECTED", "Seller", "Verification", "{{CompanyName}}'s seller application wasn't approved", "Reason: {{Reason}}", "danger", "NOT APPROVED", "We couldn't approve your application", "Hi {{RecipientName}}, we couldn't approve the seller application for <b>{{CompanyName}}</b>.", [notice("<b>Reason:</b> {{Reason}}", "danger")], "Review and resubmit", "https://www.stockoutme.com/seller/onboarding")
add("ADMIN_VERIFICATION_PENDING", "Admin", "Verification", "{{PendingCount}} verifications waiting for review", "{{PendingCount}} buyer and seller verifications are waiting.", "info", "REVIEW QUEUE", "Verifications waiting for you", "{{PendingCount}} buyer and seller verifications are waiting. The oldest was submitted on {{OldestSubmittedAt}}.", [], "Open review queue", "{{AdminUrl}}")

# Listings
add("SELLER_LISTING_SUBMITTED", "Seller", "Listings", "Listing submitted: {{ListingTitle}}", "We're reviewing {{ListingTitle}}.", "info", "IN REVIEW", "Your listing is in review", "Hi {{RecipientName}}, <b>{{ListingTitle}}</b> was submitted for review. Most listings are reviewed within 1 working day.", [], "View listing", "{{SellerListingUrl}}")
add("SELLER_LISTING_PUBLISHED", "Seller", "Listings", "Live now: {{ListingTitle}}", "{{ListingTitle}} is approved and visible to buyers.", "success", "PUBLISHED", "Your listing is live", "Hi {{RecipientName}}, <b>{{ListingTitle}}</b> is approved and now visible to buyers across the UAE.", [card(kv([("Price", "{{Price}}"), ("Available", "{{Quantity}}"), ("Listing no.", "{{ListingNumber}}")]), "Listing")], "See it on StockOut", "{{PublicListingUrl}}")
add("SELLER_LISTING_CHANGES_REQUESTED", "Seller", "Listings", "Changes needed: {{ListingTitle}}", "Please update {{ListingTitle}} before it can go live.", "warning", "CHANGES NEEDED", "Your listing needs a few changes", "Hi {{RecipientName}}, our team reviewed <b>{{ListingTitle}}</b>. Please update the following, then resubmit:", [notice("{{ChangesHtml}}")], "Edit listing", "{{SellerListingUrl}}")
add("SELLER_LISTING_REJECTED", "Seller", "Listings", "Not approved: {{ListingTitle}}", "{{ListingTitle}} can't be published. Reason: {{Reason}}", "danger", "NOT APPROVED", "Your listing wasn't approved", "Hi {{RecipientName}}, <b>{{ListingTitle}}</b> can't be published on StockOut.", [notice("<b>Reason:</b> {{Reason}}", "danger")], "View listing", "{{SellerListingUrl}}", "See the prohibited items policy for what can be listed.")
add("SELLER_IMPORT_COMPLETED", "Seller", "Listings", "Your import is done: {{CreatedCount}} listings created", "{{CreatedCount}} created, {{ErrorCount}} need fixing.", "success", "IMPORT FINISHED", "Your bulk import is done", "Hi {{RecipientName}}, your file <b>{{FileName}}</b> finished processing.", [card(kv([("Listings created", "{{CreatedCount}}"), ("Rows that need fixing", "{{ErrorCount}}")]), "Result")], "Review import", "{{ImportUrl}}")
add("SELLER_LISTING_SOLD_OUT", "Seller", "Listings", "Sold out: {{ListingTitle}}", "{{ListingTitle}} has no stock left.", "neutral", "SOLD OUT", "A listing sold out", "Hi {{RecipientName}}, <b>{{ListingTitle}}</b> has no stock left and is hidden from search. Add stock to show it again.", [], "Update stock", "{{SellerListingUrl}}")
add("ADMIN_LISTINGS_PENDING_REVIEW", "Admin", "Listings", "{{PendingCount}} listings waiting for review", "Daily digest of listings to review.", "info", "DAILY DIGEST", "Listings waiting for review", "{{PendingCount}} listings are waiting for approval. The oldest was submitted on {{OldestSubmittedAt}}.", [], "Open approvals", "{{AdminUrl}}")
add("SEARCH_ALERT_MATCHED", "Buyer", "Buying", "New matches for “{{SearchName}}”", "{{MatchCount}} new listings match your saved search.", "info", "SAVED SEARCH", "New stock matches your search", "Hi {{RecipientName}}, {{MatchCount}} new listings match <b>{{SearchName}}</b>.", [card("{{ListingsRowsHtml}}", "New matches")], "See all matches", "{{SearchUrl}}")
add("BUYER_QUOTE_RECEIVED", "Buyer", "Buying", "New quote for your request {{RequestNumber}}", "{{SellerName}} sent a quote: {{QuoteAmount}}.", "info", "NEW QUOTE", "You received a quote", "Hi {{RecipientName}}, <b>{{SellerName}}</b> quoted <b>{{QuoteAmount}}</b> for your request {{RequestNumber}}. The quote is valid until {{ValidUntil}}.", [], "Review quote", "{{RequestUrl}}")
add("SELLER_NEW_BUYER_REQUEST", "Seller", "Selling", "New buyer request: {{RequestTitle}}", "A buyer needs {{RequestTitle}} in {{Emirate}}.", "info", "BUYER REQUEST", "A buyer needs something you sell", "Hi {{RecipientName}}, a buyer in {{Emirate}} is looking for <b>{{RequestTitle}}</b>. Reply with a quote before {{CloseDate}}.", [], "Send a quote", "{{RequestUrl}}")

# Orders: placed and confirmation
add("BUYER_ORDER_PLACED", "Buyer", "Orders", "Order {{OrderNumber}} placed", "Your order is placed. {{TotalAmount}} is on hold, not charged.", "success", "ORDER PLACED", "Thank you, your order is placed", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> is with the sellers. Your card has a hold of <b>{{TotalAmount}}</b>; you're charged only for the items sellers confirm.", [ITEMS, card(kv([("Materials", "{{MaterialsAmount}}"), ("VAT", "{{VatAmount}}"), ("Freight delivery (incl. VAT)", "{{DeliveryAmount}}"), ("!Total on hold", "{{TotalAmount}}")]), "Summary"), ADDR, card(steps([("Sellers confirm", "By {{ConfirmationDeadlineUtc}}. We'll tell you as each seller confirms."), ("Your card is charged", "Only for the items sellers confirm."), ("StockOut delivers to your site", "Then you have 5 days to check the goods.")]), "What happens next", CREAM)], "View your order", "{{OrderUrl}}")
add("SELLER_NEW_ORDER_RECEIVED", "Seller", "Orders", "New order {{SubOrderNumber}}: confirm by {{ConfirmationDeadlineUtc}}", "New order for {{SellerName}}. Confirm by {{ConfirmationDeadlineUtc}}.", "warning", "NEW ORDER · ACTION NEEDED", "You have a new order", "Hi {{RecipientName}}, a buyer ordered from <b>{{SellerName}}</b>. Please confirm or reject order <b>{{SubOrderNumber}}</b> by <b>{{ConfirmationDeadlineUtc}}</b>.", [ITEMS, card(kv([("Order", "{{SubOrderNumber}}"), ("Delivery", "StockOut freight collects from you"), ("Buyer's emirate", "{{BuyerEmirate}}"), ("!Order value", "{{SubOrderTotal}}")]), "Order details"), card(steps([("Confirm the order", "Check stock and confirm in the seller portal."), ("Pack the goods", "StockOut freight books a collection time with you."), ("Get paid", "After delivery and acceptance, minus the StockOut fee.")]), "Next steps", CREAM)], "Confirm or reject", "{{SellerOrderUrl}}", "Can't fulfil it? Reject with a reason so the buyer's card hold is released quickly.")
add("PLATFORM_ADMIN_NEW_ORDER", "Admin", "Orders", "New order {{OrderNumber}} · {{TotalAmount}}", "New order {{OrderNumber}} from {{BuyerName}}.", "info", "NEW ORDER", "New order {{OrderNumber}}", "<b>{{BuyerName}}</b> placed an order with <b>{{SellerCount}}</b> seller(s). Sellers must confirm by {{ConfirmationDeadlineUtc}}.", [card(kv([("Buyer", "{{BuyerName}}"), ("Sellers", "{{SellerNamesHtml}}"), ("Delivery", "Freight to {{BuyerEmirate}}"), ("Payment", "Card hold (not captured)"), ("!Total", "{{TotalAmount}}")]), "Order"), ITEMS], "Open in admin", "{{AdminOrderUrl}}")
add("SELLER_CONFIRMATION_REMINDER", "Seller", "Orders", "Reminder: confirm order {{SubOrderNumber}} by {{ConfirmationDeadlineUtc}}", "{{HoursLeft}} hours left to confirm.", "warning", "REMINDER", "{{HoursLeft}} hours left to confirm", "Hi {{RecipientName}}, order <b>{{SubOrderNumber}}</b> ({{SubOrderTotal}}) is still waiting. Please confirm or reject by <b>{{ConfirmationDeadlineUtc}}</b>.", [ITEMS], "Confirm or reject", "{{SellerOrderUrl}}")
add("BUYER_ORDER_CONFIRMATION_DELAYED", "Buyer", "Orders", "Update on order {{OrderNumber}}", "A seller is taking longer than usual. StockOut is following up.", "warning", "UPDATE", "A seller is taking longer than usual", "Hi {{RecipientName}}, <b>{{SellerName}}</b> hasn't confirmed their part of order {{OrderNumber}} yet. StockOut is following up; you don't need to do anything. Your card is not charged for this part.", [], "View your order", "{{OrderUrl}}")
add("ADMIN_SELLER_CONFIRMATION_ESCALATED", "Admin", "Orders", "Escalated: {{SellerName}} missed confirmation on {{SubOrderNumber}}", "Seller confirmation overdue. Decision needed.", "danger", "ESCALATION", "Seller confirmation overdue", "<b>{{SellerName}}</b> did not confirm <b>{{SubOrderNumber}}</b> ({{SubOrderTotal}}) by {{ConfirmationDeadlineUtc}}. Decide by {{AdminReviewDeadlineUtc}}.", [], "Open escalation", "{{AdminEscalationUrl}}")
add("BUYER_ORDER_SELLER_CONFIRMED", "Buyer", "Orders", "{{SellerName}} confirmed your order {{OrderNumber}}", "{{SellerName}} confirmed. Delivery is being arranged.", "success", "CONFIRMED", "Your order is confirmed", "Hi {{RecipientName}}, <b>{{SellerName}}</b> confirmed their part of order <b>{{OrderNumber}}</b> ({{SubOrderTotal}}). StockOut is arranging freight; we'll email the delivery date.", [ITEMS], "View your order", "{{OrderUrl}}")
add("BUYER_ORDER_SELLER_REJECTED", "Buyer", "Orders", "{{SellerName}} couldn't supply part of order {{OrderNumber}}", "{{SellerName}} rejected their part. That amount is being released from your card hold.", "danger", "NOT AVAILABLE", "A seller couldn't supply your order", "Hi {{RecipientName}}, <b>{{SellerName}}</b> couldn't supply their part of order {{OrderNumber}} ({{SubOrderTotal}}).", [notice("<b>Seller's reason:</b> {{Reason}}", "neutral"), notice("You won't pay for this part. StockOut is releasing that amount from your card hold; we'll confirm once it's done.", "info")], "View your order", "{{OrderUrl}}")
add("ADMIN_ORDER_SELLER_REJECTED", "Admin", "Orders", "Seller rejected {{SubOrderNumber}}", "{{SellerName}} rejected {{SubOrderNumber}}: {{Reason}}", "danger", "SELLER REJECTED", "A seller rejected an order", "<b>{{SellerName}}</b> rejected <b>{{SubOrderNumber}}</b> ({{SubOrderTotal}}). Reason: {{Reason}}. Payment reconciliation is pending.", [], "Open order", "{{AdminOrderUrl}}")
add("FINANCE_RECONCILIATION_APPROVAL_REQUIRED", "Finance", "Payments", "Approval needed: payment reconciliation for {{OrderNumber}}", "Reconciliation of {{Amount}} needs Finance approval.", "warning", "FINANCE APPROVAL", "Payment reconciliation needs approval", "Order <b>{{OrderNumber}}</b> needs a payment reconciliation of <b>{{Amount}}</b> ({{ReconciliationType}}). Nothing has moved yet.", [], "Review and approve", "{{FinanceUrl}}")
# Orders: payment, delivery, acceptance
add("BUYER_PAYMENT_CHARGED", "Buyer", "Payments", "Payment taken for order {{OrderNumber}}: {{ChargedAmount}}", "{{ChargedAmount}} charged for the confirmed items.", "success", "PAYMENT", "Payment taken", "Hi {{RecipientName}}, we charged <b>{{ChargedAmount}}</b> to your card for the confirmed parts of order {{OrderNumber}}. Anything not confirmed has been released.", [], "View your order", "{{OrderUrl}}")
add("BUYER_DELIVERY_SCHEDULED", "Buyer", "Delivery", "Delivery booked for order {{OrderNumber}}", "Your delivery is booked for {{DeliveryWindow}}.", "info", "DELIVERY SCHEDULED", "Your delivery is booked", "Hi {{RecipientName}}, StockOut freight will deliver order <b>{{OrderNumber}}</b> on <b>{{DeliveryWindow}}</b>. Please make sure someone can receive and check the goods.", [card(kv([("Delivery window", "{{DeliveryWindow}}"), ("From", "{{SellerName}}"), ("Driver / contact", "{{DeliveryContact}}"), ("Reference", "{{DeliveryReference}}")]), "Delivery"), ADDR, ITEMS], "Track your order", "{{OrderUrl}}", "Need a different day or site? Change it from the order page before dispatch.")
add("SELLER_COLLECTION_SCHEDULED", "Seller", "Delivery", "Collection booked for {{SubOrderNumber}}", "StockOut freight collects on {{CollectionWindow}}.", "info", "COLLECTION SCHEDULED", "Freight collection is booked", "Hi {{RecipientName}}, StockOut freight will collect order <b>{{SubOrderNumber}}</b> on <b>{{CollectionWindow}}</b>. Please have the goods packed and labelled with the order number.", [card(kv([("Collection window", "{{CollectionWindow}}"), ("Collect from", "{{CollectionAddress}}"), ("Driver / contact", "{{DeliveryContact}}"), ("Reference", "{{DeliveryReference}}")]), "Collection"), ITEMS], "View order", "{{SellerOrderUrl}}")
add("BUYER_ORDER_DISPATCHED", "Buyer", "Delivery", "On the way: order {{OrderNumber}}", "Your order left the seller and is on its way.", "info", "ON THE WAY", "Your order is on the way", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> from {{SellerName}} is with StockOut freight. Expected delivery: <b>{{DeliveryWindow}}</b>.", [ADDR], "Track your order", "{{OrderUrl}}")
add("BUYER_ORDER_DELIVERED", "Buyer", "Delivery", "Delivered: order {{OrderNumber}}. Please check the goods", "Delivered. Accept or report a problem by {{AcceptByDateTime}}.", "success", "DELIVERED", "Your order was delivered", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> from {{SellerName}} was delivered. Please check the goods and accept them, or report a problem by <b>{{AcceptByDateTime}}</b>. After that it's accepted automatically.", [ITEMS], "Accept or report a problem", "{{OrderUrl}}")
add("SELLER_ORDER_DELIVERED", "Seller", "Delivery", "Delivered: {{SubOrderNumber}}", "Delivered to the buyer. Acceptance window ends {{AcceptByDateTime}}.", "success", "DELIVERED", "Your order was delivered", "Hi {{RecipientName}}, <b>{{SubOrderNumber}}</b> was delivered. The buyer has until {{AcceptByDateTime}} to accept or report a problem; then your payout process starts.", [], "View order", "{{SellerOrderUrl}}")
add("BUYER_ACCEPTANCE_REMINDER", "Buyer", "Delivery", "Reminder: check order {{OrderNumber}} by {{AcceptByDateTime}}", "{{DaysLeft}} days left to accept or report a problem.", "warning", "REMINDER", "{{DaysLeft}} days left to check your order", "Hi {{RecipientName}}, please accept order <b>{{OrderNumber}}</b> or report a problem by <b>{{AcceptByDateTime}}</b>. After that it's accepted automatically.", [], "Accept or report a problem", "{{OrderUrl}}")
add("BUYER_ORDER_ACCEPTED", "Buyer", "Orders", "Order {{OrderNumber}} completed", "Thanks for accepting your order.", "success", "COMPLETED", "Order completed", "Hi {{RecipientName}}, you accepted order <b>{{OrderNumber}}</b>{{DeemedNote}}. Thank you for buying surplus and keeping materials out of landfill.", [], "Buy again", "{{OrderUrl}}")
add("SELLER_ORDER_ACCEPTED", "Seller", "Orders", "Accepted: {{SubOrderNumber}}. Payout process started", "The buyer accepted your order.", "success", "ACCEPTED", "The buyer accepted your order", "Hi {{RecipientName}}, the buyer accepted <b>{{SubOrderNumber}}</b>{{DeemedNote}}. Your payout of <b>{{NetPayout}}</b> follows the holding period.", [], "View order", "{{SellerOrderUrl}}")
# Claims, cancellation, changes
add("BUYER_ORDER_CLAIM_SUBMITTED", "Buyer", "Claims", "We received your report for order {{OrderNumber}}", "StockOut is reviewing the problem you reported.", "warning", "PROBLEM REPORTED", "We received your report", "Hi {{RecipientName}}, thanks for reporting a problem with order {{OrderNumber}}. StockOut will review it with the seller and update you; acceptance is paused meanwhile.", [notice("<b>Your report:</b> {{Reason}}", "neutral")], "View your order", "{{OrderUrl}}")
add("SELLER_ORDER_CLAIM_SUBMITTED", "Seller", "Claims", "Problem reported on {{SubOrderNumber}}", "The buyer reported a problem. Please respond.", "danger", "PROBLEM REPORTED", "A buyer reported a problem", "Hi {{RecipientName}}, the buyer reported a problem with <b>{{SubOrderNumber}}</b>.", [notice("<b>Buyer's report:</b> {{Reason}}", "neutral")], "Respond", "{{SellerOrderUrl}}")
add("ADMIN_ORDER_CLAIM_AWAITING_REVIEW", "Admin", "Claims", "Claim to review: {{SubOrderNumber}}", "New buyer claim on {{SubOrderNumber}}.", "danger", "CLAIM", "A claim needs review", "The buyer of <b>{{SubOrderNumber}}</b> ({{SellerName}}) reported: {{Reason}}", [], "Open claims", "{{AdminClaimsUrl}}")
add("BUYER_CLAIM_DECIDED", "Buyer", "Claims", "Decision on your report for order {{OrderNumber}}", "{{Decision}}", "info", "CLAIM DECIDED", "We've reviewed your report", "Hi {{RecipientName}}, StockOut reviewed your report on order {{OrderNumber}}.", [notice("<b>Decision:</b> {{Decision}}", "info")], "View your order", "{{OrderUrl}}")
add("SELLER_CLAIM_DECIDED", "Seller", "Claims", "Decision on the claim for {{SubOrderNumber}}", "{{Decision}}", "info", "CLAIM DECIDED", "The claim was decided", "Hi {{RecipientName}}, StockOut decided the buyer's claim on {{SubOrderNumber}}.", [notice("<b>Decision:</b> {{Decision}}", "info")], "View order", "{{SellerOrderUrl}}")
add("BUYER_ORDER_CANCELLED", "Buyer", "Orders", "Order {{OrderNumber}} cancelled", "Your order was cancelled. Any card hold is being released.", "neutral", "CANCELLED", "Your order was cancelled", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> was cancelled ({{CancelledBy}}). You won't be charged; any card hold is being released.", [], "View order", "{{OrderUrl}}")
add("SELLER_ORDER_CANCELLED", "Seller", "Orders", "Cancelled: {{SubOrderNumber}}", "Order {{SubOrderNumber}} was cancelled. Don't dispatch it.", "neutral", "CANCELLED", "An order was cancelled", "Hi {{RecipientName}}, <b>{{SubOrderNumber}}</b> was cancelled ({{CancelledBy}}). Please don't prepare or hand it to freight.", [], "View order", "{{SellerOrderUrl}}")
add("BUYER_DELIVERY_ADDRESS_CHANGED", "Buyer", "Delivery", "Delivery address updated for order {{OrderNumber}}", "Order {{OrderNumber}} now goes to the new address.", "info", "ADDRESS UPDATED", "Delivery address updated", "Hi {{RecipientName}}, order <b>{{OrderNumber}}</b> will now be delivered to:", [ADDR], "View your order", "{{OrderUrl}}")
add("SELLER_DELIVERY_ADDRESS_CHANGED", "Seller", "Delivery", "Address changed for {{SubOrderNumber}}", "The buyer changed the delivery site.", "warning", "ADDRESS CHANGED", "The delivery address changed", "Hi {{RecipientName}}, the buyer changed the delivery address for <b>{{SubOrderNumber}}</b> to {{BuyerEmirate}}. StockOut freight is re-planning; nothing changes for your collection unless we tell you.", [], "View order", "{{SellerOrderUrl}}")
# Money after the order
add("BUYER_PAYMENT_HOLD_RELEASED", "Buyer", "Payments", "Card hold released: {{Amount}}", "The hold of {{Amount}} on your card was released.", "neutral", "HOLD RELEASED", "Your card hold was released", "Hi {{RecipientName}}, the hold of <b>{{Amount}}</b> on your card was released ({{Reason}}). Your bank may take a few days to show it.", [], "Go to StockOut", "https://www.stockoutme.com/")
add("BUYER_REFUND_ISSUED", "Buyer", "Payments", "Refund of {{Amount}} for order {{OrderNumber}}", "We refunded {{Amount}} to your card.", "success", "REFUND", "Your refund is on its way", "Hi {{RecipientName}}, we refunded <b>{{Amount}}</b> for order {{OrderNumber}} to your card. It usually appears within 5–10 working days.", [], "View your order", "{{OrderUrl}}")
add("INVOICE_READY", "Buyer / Seller", "Payments", "Your tax invoice {{InvoiceNumber}} is ready", "Invoice {{InvoiceNumber}} for {{Amount}}.", "neutral", "INVOICE", "Your tax invoice is ready", "Hi {{RecipientName}}, tax invoice <b>{{InvoiceNumber}}</b> ({{Amount}}) for order {{OrderNumber}} is ready to download.", [], "Download invoice", "{{InvoiceUrl}}")
add("SELLER_PAYOUT_SENT", "Seller", "Payouts", "Payout sent: {{NetPayout}}", "{{NetPayout}} sent to your bank.", "success", "PAYOUT", "Your payout is on its way", "Hi {{RecipientName}}, we sent <b>{{NetPayout}}</b> to your bank account ending {{BankLast4}}.", [card(kv([("Orders", "{{OrderNumbers}}"), ("Sales", "{{GrossAmount}}"), ("StockOut fee (incl. VAT)", "{{FeeAmount}}"), ("!You receive", "{{NetPayout}}")]), "Breakdown")], "View payouts", "{{PayoutsUrl}}")
add("SELLER_PAYOUT_SETUP_INCOMPLETE", "Seller", "Payouts", "Action needed: finish your payout setup", "Add your bank details to get paid.", "warning", "ACTION NEEDED", "Finish your payout setup", "Hi {{RecipientName}}, we can't pay <b>{{CompanyName}}</b> until your payout details are complete: {{MissingItems}}.", [], "Complete setup", "{{PayoutSetupUrl}}")
add("SUPPORT_REPLY", "Buyer / Seller", "Support", "Reply to your request {{TicketNumber}}", "StockOut support replied to {{TicketNumber}}.", "info", "SUPPORT", "We replied to your request", "Hi {{RecipientName}}, StockOut support replied to <b>{{TicketNumber}}</b>: {{ReplyPreview}}", [], "Open conversation", "{{TicketUrl}}")

index = []
for (code, aud, cat, subj, pre, tone, chip, head, intro, blocks, cta, url, *rest) in S:
    note = rest[0] if rest else ""
    htmlb = layout(f"{code} ({aud})", subj, pre, tone, chip, head, intro, blocks, cta, url, note)
    open(os.path.join(OUT, f"{code}.html"), "w").write(htmlb)
    phs = sorted(set(re.findall(r"\{\{(\w+)\}\}", subj + htmlb)))
    # plain-text version (required alongside HTML)
    txt = re.sub(r"<[^>]+>", "", f"{head}\n\n{intro}\n\n{cta}: {url}\n\n{note}\n\nQuestions? info@stockoutme.com\nStockOut, Dubai, UAE").replace("&rarr;", "").strip() + "\n"
    open(os.path.join(OUT, f"{code}.txt"), "w").write(txt)
    index.append({"code": code, "audience": aud, "category": cat, "subject": subj, "placeholders": phs})
json.dump(index, open(os.path.join(OUT, "templates.json"), "w"), indent=1)
print("generated", len(S))
