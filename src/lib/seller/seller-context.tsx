import * as React from "react";
import { useAuth } from "@/lib/auth/auth-context";
import type { SellerContextResponse } from "@/api/types/user-organization";

const KEY = "stockout.market.activeSeller";

interface SellerModeValue {
  sellers: SellerContextResponse[];
  activeSeller: SellerContextResponse | null;
  setActiveSellerId: (sellerId: string) => void;
}

const SellerModeContext = React.createContext<SellerModeValue | null>(null);

/** Tracks which seller account the user is operating (a user can belong to several sellers). */
export function SellerModeProvider({ children }: { children: React.ReactNode }) {
  const { actor } = useAuth();
  const sellers = React.useMemo(() => actor?.sellerContexts ?? [], [actor]);
  const [selectedId, setSelectedId] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  const activeSeller = sellers.find((s) => s.sellerId === selectedId) ?? sellers[0] ?? null;

  const setActiveSellerId = React.useCallback((sellerId: string) => {
    setSelectedId(sellerId);
    try {
      localStorage.setItem(KEY, sellerId);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(() => ({ sellers, activeSeller, setActiveSellerId }), [sellers, activeSeller, setActiveSellerId]);
  return <SellerModeContext.Provider value={value}>{children}</SellerModeContext.Provider>;
}

export function useSellerMode(): SellerModeValue {
  const ctx = React.useContext(SellerModeContext);
  if (!ctx) throw new Error("useSellerMode must be used inside SellerModeProvider");
  return ctx;
}

/** Seller can manage listings only once verified and active (backend publication gate: seller standing). */
export function sellerCanList(s: SellerContextResponse | null): boolean {
  return !!s && s.status === "ACTIVE";
}
