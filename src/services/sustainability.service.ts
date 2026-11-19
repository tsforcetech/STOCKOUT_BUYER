import { http } from "@/lib/api/client";
import type { TransactionSustainabilityReportDto } from "@/api/types/sustainability";

const seg = encodeURIComponent;
export const REPORT_PAGE_SIZE = 20;

/**
 * SUS-03 sustainability impact reports (bidding-deal Buyer/SellerSustainabilityReportsController). Lists return a bare
 * array. The seller is passed as ?sellerId= (the controller accepts it; the gateway strips X-Organization-Id).
 * PDFs come back as a Blob through the authenticated client; the browser never builds report values itself.
 */
export const sustainabilityService = {
  buyerReports: (page: number, signal?: AbortSignal) =>
    http.get<TransactionSustainabilityReportDto[]>("/api/v1/buyer/sustainability/reports", { query: { page, pageSize: REPORT_PAGE_SIZE }, signal }),
  buyerOrderReport: (orderId: string, signal?: AbortSignal) =>
    http.get<TransactionSustainabilityReportDto>(`/api/v1/buyer/orders/${seg(orderId)}/sustainability-report`, { signal }),
  buyerPdf: (reportId: string) => http.get<Blob>(`/api/v1/buyer/sustainability/reports/${seg(reportId)}/download`, { responseType: "blob" }),
  sellerReports: (sellerId: string, page: number, signal?: AbortSignal) =>
    http.get<TransactionSustainabilityReportDto[]>("/api/v1/seller/sustainability/reports", { query: { sellerId, page, pageSize: REPORT_PAGE_SIZE }, signal }),
  sellerSubOrderReport: (sellerId: string, subOrderId: string, signal?: AbortSignal) =>
    http.get<TransactionSustainabilityReportDto>(`/api/v1/seller/suborders/${seg(subOrderId)}/sustainability-report`, { query: { sellerId }, signal }),
  sellerPdf: (sellerId: string, reportId: string) =>
    http.get<Blob>(`/api/v1/seller/sustainability/reports/${seg(reportId)}/download`, { query: { sellerId }, responseType: "blob" }),
};

export const sustainabilityKeys = {
  buyerList: ["sustainability", "buyer"] as const,
  buyerOrder: (orderId: string) => ["sustainability", "buyer", "order", orderId] as const,
  sellerList: (sellerId: string) => ["sustainability", "seller", sellerId] as const,
  sellerSubOrder: (sellerId: string, subOrderId: string) => ["sustainability", "seller", sellerId, subOrderId] as const,
};
