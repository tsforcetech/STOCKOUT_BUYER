/** Shape shared with SearchPage's SearchLanding (kept here so the build-time prerender can use it without React). */
export interface LandingCopy {
  categoryName?: string;
  emirate?: string;
  title: string;
  heading: string;
  intro: string;
  faq: Array<{ q: string; a: string }>;
}

/** Copy for /c/<category>/<emirate> pages, written for searches like "surplus pipes Dubai" or "surplus stock UAE". */
export function landingCopy(category: string | null, emirate: string | null): LandingCopy {
  const where = emirate ?? "the UAE";
  const thing = category ? `surplus ${category.toLowerCase()}` : "surplus stock";
  const Thing = category ? `Surplus ${category}` : "Surplus Stock";
  return {
    categoryName: category ?? undefined,
    emirate: emirate ?? undefined,
    title: `${Thing} in ${emirate ?? "UAE"} – Buy Excess & Unused Stock`,
    heading: `${Thing} in ${emirate ?? "UAE"}`,
    intro: `Buy ${thing} in ${where} from verified sellers: unused, excess and clearance stock from contractors, distributors and manufacturers, at below-market prices. Compare offers, check quantities and request quotes on StockOut.`,
    faq: [
      {
        q: `Where can I buy ${thing} in ${where}?`,
        a: `StockOut lists ${thing} from verified UAE businesses${emirate ? ` with stock in ${emirate}` : " across all emirates"}. Every seller is checked (trade licence and KYC) before they can sell.`,
      },
      {
        q: `Is ${thing} new or used?`,
        a: "Most listings are new, unused surplus: over-ordered project materials, end-of-line or excess inventory. Each listing shows its condition and, where available, an inspection result.",
      },
      {
        q: "Can I ask for a different size or quantity?",
        a: "Yes. Send a request for quote with your BOQ or specification and verified sellers will reply with offers.",
      },
      {
        q: "How do delivery and collection work?",
        a: "Collection or delivery is agreed with the seller. Listings show the stock location so you can plan transport.",
      },
    ],
  };
}

