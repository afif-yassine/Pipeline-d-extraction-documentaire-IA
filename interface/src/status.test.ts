import { describe, expect, it } from "vitest";
import type { InvoiceResult } from "../../pipeline/src/schema";
import { validInvoice } from "../../pipeline/test/fixtures";
import { getInvoiceStatus, getLineIssue } from "./status";

const okCheck = { name: "HT + TVA = TTC", status: "ok", message: "" } as const;

function success(overrides: Partial<Extract<InvoiceResult, { status: "success" }>> = {}): InvoiceResult {
  return { status: "success", sourceFile: "a.pdf", data: validInvoice(), checks: [okCheck], ...overrides };
}

describe("getInvoiceStatus", () => {
  it("aucun écart quand tout est ok et sans avertissement", () => {
    expect(getInvoiceStatus(success())).toBe("no_issue");
  });
  it("à vérifier dès qu'il y a un avertissement", () => {
    const data = validInvoice({ warnings: [{ field: "totalTTC", message: "Total TTC non lu" }] });
    expect(getInvoiceStatus(success({ data }))).toBe("to_review");
  });
  it("à vérifier quand un contrôle n'est pas vérifiable", () => {
    expect(getInvoiceStatus(success({ checks: [{ ...okCheck, status: "not_verifiable" }] }))).toBe("to_review");
  });
  it("échec quand le traitement a échoué", () => {
    expect(getInvoiceStatus({ status: "error", sourceFile: "a.pdf", error: "OCR vide" })).toBe("failed");
  });
});

describe("getLineIssue", () => {
  it("aucun problème quand quantité × prix = total", () => {
    expect(getLineIssue({ description: "A", quantity: 2, unitPrice: 100, lineTotal: 200 })).toBeNull();
  });
  it("écart quand le total imprimé ne correspond pas (Studio Botanica)", () => {
    expect(getLineIssue({ description: "Taille de haies", quantity: 4, unitPrice: 95, lineTotal: 285 })).toBe("mismatch");
  });
  it("valeur manquante quand une case n'est pas lue", () => {
    expect(getLineIssue({ description: "A", quantity: null, unitPrice: 42.9, lineTotal: 214.5 })).toBe("missing");
  });
});
