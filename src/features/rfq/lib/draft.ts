/** What a buyer typed into the RFQ form, kept on this device so nothing is lost (files can't be stored). */
export interface RfqDraft {
  item: string;
  categoryId: string;
  quantity: string;
  unit: string;
  details: string;
  targetPrice: string;
  emirate: string;
  neededBy: string;
  fileNote: string;
}

export const EMPTY_DRAFT: RfqDraft = {
  item: "",
  categoryId: "",
  quantity: "",
  unit: "",
  details: "",
  targetPrice: "",
  emirate: "",
  neededBy: "",
  fileNote: "",
};

const KEY = "stockout.market.rfq-draft";

export function loadDraft(): RfqDraft {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<RfqDraft>) }
      : EMPTY_DRAFT;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveDraft(draft: RfqDraft) {
  try {
    if (Object.values(draft).some((v) => v.trim()))
      localStorage.setItem(KEY, JSON.stringify(draft));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the form still works for this visit */
  }
}
