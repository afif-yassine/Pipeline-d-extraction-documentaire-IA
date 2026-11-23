import type { ExtractedInvoice } from "../src/schema";

// Une facture cohérente, réutilisée par les tests. Chaque test change seulement ce qu'il vérifie.
// 2 × 100 + 1 × 15 = 215 HT ; 215 + 43 = 258 TTC.
export function validInvoice(overrides: Partial<ExtractedInvoice> = {}): ExtractedInvoice {
  return {
    supplierName: "ATELIER MÉCA-PRÉCISION",
    invoiceDate: "2026-06-12",
    invoiceNumber: "FAC-2026-0342",
    lineItems: [
      { description: "Pièce usinée", quantity: 2, unitPrice: 100, lineTotal: 200 },
      { description: "Frais de port", quantity: 1, unitPrice: 15, lineTotal: 15 },
    ],
    totalHT: 215,
    totalTVA: 43,
    totalTTC: 258,
    warnings: [],
    ...overrides,
  };
}
