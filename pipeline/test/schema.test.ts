import { describe, expect, it } from "vitest";
import { ExtractedInvoiceSchema, ResultsFileSchema } from "../src/schema";
import { validInvoice } from "./fixtures";

describe("ExtractedInvoiceSchema", () => {
  it("accepte une facture complète", () => {
    expect(ExtractedInvoiceSchema.safeParse(validInvoice()).success).toBe(true);
  });

  it("accepte null partout où une valeur peut être illisible", () => {
    const unreadable = validInvoice({
      supplierName: null,
      invoiceDate: null,
      invoiceNumber: null,
      lineItems: null,
      totalHT: null,
      totalTVA: null,
      totalTTC: null,
    });
    expect(ExtractedInvoiceSchema.safeParse(unreadable).success).toBe(true);
  });

  it("refuse un montant écrit en texte (le LLM doit renvoyer un nombre)", () => {
    const result = ExtractedInvoiceSchema.safeParse({ ...validInvoice(), totalHT: "1 944,00 €" });
    expect(result.success).toBe(false);
  });

  it("refuse un champ manquant : absent n'est pas la même chose que null", () => {
    const { totalTTC: _removed, ...withoutTotal } = validInvoice();
    expect(ExtractedInvoiceSchema.safeParse(withoutTotal).success).toBe(false);
  });

  it("refuse warnings à null", () => {
    expect(ExtractedInvoiceSchema.safeParse({ ...validInvoice(), warnings: null }).success).toBe(false);
  });
});

describe("ResultsFileSchema", () => {
  it("refuse un résultat en succès sans données", () => {
    const file = { generatedAt: "2026-06-12T10:00:00.000Z", invoices: [{ status: "success", sourceFile: "a.pdf" }] };
    expect(ResultsFileSchema.safeParse(file).success).toBe(false);
  });

  it("accepte un résultat en échec avec seulement le fichier et le message", () => {
    const file = { generatedAt: "2026-06-12T10:00:00.000Z", invoices: [{ status: "error", sourceFile: "a.pdf", error: "OCR vide" }] };
    expect(ResultsFileSchema.safeParse(file).success).toBe(true);
  });
});
