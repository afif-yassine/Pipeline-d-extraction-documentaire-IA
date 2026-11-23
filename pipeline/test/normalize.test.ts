import { describe, expect, it } from "vitest";
import { addMissingFieldWarnings, isRealIsoDate, normalizeInvoice, nullifyInvalidDate, nullifyZeroQuantities } from "../src/normalize";
import { validInvoice } from "./fixtures";

describe("isRealIsoDate", () => {
  it.each(["2026-06-12", "2024-02-29", "2009-09-17"])("accepte %s", (date) => {
    expect(isRealIsoDate(date)).toBe(true);
  });
  it.each(["2026-02-31", "2025-02-29", "2026-13-01", "12/06/2026", "2026-6-12", ""])("refuse %s", (date) => {
    expect(isRealIsoDate(date)).toBe(false);
  });
});

describe("nullifyInvalidDate", () => {
  it("passe une date impossible à null avec un avertissement", () => {
    const result = nullifyInvalidDate(validInvoice({ invoiceDate: "2026-02-31" }));
    expect(result.invoiceDate).toBeNull();
    expect(result.warnings).toEqual([{ field: "invoiceDate", message: "Date illisible ou impossible (lu : 2026-02-31)" }]);
  });
  it("ne touche pas une date valide", () => {
    const invoice = validInvoice();
    expect(nullifyInvalidDate(invoice)).toBe(invoice);
  });
});

describe("addMissingFieldWarnings", () => {
  it("ajoute un avertissement pour chaque champ null", () => {
    const result = addMissingFieldWarnings(validInvoice({ totalTTC: null, invoiceNumber: null }));
    expect(result.warnings.map((warning) => warning.field)).toEqual(["invoiceNumber", "totalTTC"]);
  });

  it("garde l'avertissement du LLM au lieu d'en ajouter un second", () => {
    const llmWarning = { field: "totalTTC", message: "Montant taché sur le scan" };
    const result = addMissingFieldWarnings(validInvoice({ totalTTC: null, warnings: [llmWarning] }));
    expect(result.warnings).toEqual([llmWarning]);
  });

  it("signale les valeurs manquantes d'une ligne, numérotée à partir de 1", () => {
    const result = addMissingFieldWarnings(
      validInvoice({ lineItems: [{ description: null, quantity: 1, unitPrice: null, lineTotal: 10 }] }),
    );
    expect(result.warnings).toEqual([{ field: "lineItems[1]", message: "Ligne 1 : désignation, prix unitaire non lu(s)" }]);
  });

  it("ne modifie pas la facture reçue", () => {
    const invoice = validInvoice({ totalHT: null });
    addMissingFieldWarnings(invoice);
    expect(invoice.warnings).toEqual([]);
  });
});

describe("nullifyZeroQuantities", () => {
  it("passe une quantité 0 à null avec un avertissement (case masquée lue « 0 » par l'OCR)", () => {
    const invoice = validInvoice({ lineItems: [{ description: "Filtre", quantity: 0, unitPrice: 42.9, lineTotal: 214.5 }] });
    const result = nullifyZeroQuantities(invoice);
    expect(result.lineItems?.[0]?.quantity).toBeNull();
    expect(result.warnings).toEqual([{ field: "lineItems[1]", message: "Ligne 1 : quantité lue « 0 », probablement masquée ou illisible" }]);
  });
  it("ne touche pas une facture sans quantité à 0", () => {
    const invoice = validInvoice();
    expect(nullifyZeroQuantities(invoice)).toBe(invoice);
  });
});

describe("normalizeInvoice", () => {
  it("une date impossible donne un seul avertissement, pas deux", () => {
    const result = normalizeInvoice(validInvoice({ invoiceDate: "2026-02-31" }));
    expect(result.warnings.filter((warning) => warning.field === "invoiceDate")).toHaveLength(1);
  });
  it("une quantité à 0 donne un seul avertissement pour la ligne, pas deux", () => {
    const result = normalizeInvoice(validInvoice({ lineItems: [{ description: "A", quantity: 0, unitPrice: 10, lineTotal: 10 }] }));
    expect(result.warnings.filter((warning) => warning.field === "lineItems[1]")).toHaveLength(1);
  });
});
