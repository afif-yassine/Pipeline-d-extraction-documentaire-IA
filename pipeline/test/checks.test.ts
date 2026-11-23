import { describe, expect, it } from "vitest";
import { amountsMatch, checkHtPlusTvaEqualsTtc, checkLineTotals, checkSumOfLines, runChecks } from "../src/checks";
import { validInvoice } from "./fixtures";

describe("amountsMatch", () => {
  it("ignore l'imprécision des nombres à virgule", () => {
    expect(amountsMatch(0.1 + 0.2, 0.3)).toBe(true);
  });
  it("accepte un écart d'un centime (arrondi imprimé)", () => {
    expect(amountsMatch(3 * 33.333, 100)).toBe(true);
  });
  it("refuse un écart de deux centimes", () => {
    expect(amountsMatch(100, 100.02)).toBe(false);
  });
});

describe("checkLineTotals", () => {
  it("ok quand chaque ligne est juste", () => {
    expect(checkLineTotals(validInvoice()).status).toBe("ok");
  });

  it("signale la ligne fausse avec l'écart (cas de la facture Studio Botanica)", () => {
    const invoice = validInvoice({
      lineItems: [{ description: "Taille de haies", quantity: 4, unitPrice: 95, lineTotal: 285 }],
    });
    const check = checkLineTotals(invoice);
    expect(check.status).toBe("mismatch");
    expect(check.message).toContain("écart 95,00 €");
  });

  it("not_verifiable quand une quantité n'est pas lue", () => {
    const invoice = validInvoice({ lineItems: [{ description: "A", quantity: null, unitPrice: 10, lineTotal: 10 }] });
    expect(checkLineTotals(invoice).status).toBe("not_verifiable");
  });

  it("not_verifiable quand le tableau est illisible", () => {
    expect(checkLineTotals(validInvoice({ lineItems: null })).status).toBe("not_verifiable");
  });
});

describe("checkSumOfLines", () => {
  it("ok quand la somme des lignes = total HT", () => {
    expect(checkSumOfLines(validInvoice()).status).toBe("ok");
  });
  it("mismatch quand le total HT imprimé est différent", () => {
    expect(checkSumOfLines(validInvoice({ totalHT: 235 })).status).toBe("mismatch");
  });
  it("not_verifiable quand le total HT n'est pas lu", () => {
    expect(checkSumOfLines(validInvoice({ totalHT: null })).status).toBe("not_verifiable");
  });
  it("not_verifiable quand un total de ligne manque", () => {
    const invoice = validInvoice({ lineItems: [{ description: "A", quantity: 1, unitPrice: 215, lineTotal: null }] });
    expect(checkSumOfLines(invoice).status).toBe("not_verifiable");
  });
});

describe("checkHtPlusTvaEqualsTtc", () => {
  it("ok quand HT + TVA = TTC", () => {
    expect(checkHtPlusTvaEqualsTtc(validInvoice()).status).toBe("ok");
  });
  it("mismatch quand le TTC est faux", () => {
    expect(checkHtPlusTvaEqualsTtc(validInvoice({ totalTTC: 260 })).status).toBe("mismatch");
  });
  it("not_verifiable quand la TVA n'est pas lue", () => {
    expect(checkHtPlusTvaEqualsTtc(validInvoice({ totalTVA: null })).status).toBe("not_verifiable");
  });
});

describe("runChecks", () => {
  it("renvoie toujours les trois contrôles, dans le même ordre", () => {
    expect(runChecks(validInvoice()).map((check) => check.name)).toEqual([
      "Quantité × prix = total de la ligne",
      "Somme des lignes = total HT",
      "HT + TVA = TTC",
    ]);
  });
});
