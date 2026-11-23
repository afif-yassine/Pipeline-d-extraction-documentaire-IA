import type { Check, ExtractedInvoice } from "./schema";

// Écart accepté entre deux montants : 1 centime, pour les arrondis imprimés sur la facture.
export const TOLERANCE_CENTS = 1;

// Les contrôles ne corrigent jamais une valeur : ils signalent, le comptable décide.
// Chaque contrôle renvoie "ok", "mismatch" (écart chiffré) ou "not_verifiable" (une valeur manque).
export function runChecks(invoice: ExtractedInvoice): Check[] {
  return [checkLineTotals(invoice), checkSumOfLines(invoice), checkHtPlusTvaEqualsTtc(invoice)];
}

// Pour chaque ligne : quantité × prix unitaire = total de la ligne imprimé.
export function checkLineTotals(invoice: ExtractedInvoice): Check {
  const name = "Quantité × prix = total de la ligne";
  const lines = invoice.lineItems;

  if (lines === null || lines.length === 0) {
    return { name, status: "not_verifiable", message: "Aucune ligne de produit lue." };
  }

  const mismatches: string[] = [];
  let hasMissingValue = false;

  lines.forEach((line, index) => {
    if (line.quantity === null || line.unitPrice === null || line.lineTotal === null) {
      hasMissingValue = true;
      return;
    }
    const expected = line.quantity * line.unitPrice;
    if (!amountsMatch(expected, line.lineTotal)) {
      mismatches.push(
        `Ligne ${index + 1} « ${line.description ?? "sans désignation"} » : ` +
          `${line.quantity} × ${formatEuro(line.unitPrice)} = ${formatEuro(expected)}, ` +
          `imprimé ${formatEuro(line.lineTotal)} (écart ${formatEuro(Math.abs(expected - line.lineTotal))})`,
      );
    }
  });

  // Un écart trouvé est plus important qu'une valeur manquante : on le montre en priorité.
  if (mismatches.length > 0) return { name, status: "mismatch", message: mismatches.join(" ; ") };
  if (hasMissingValue) return { name, status: "not_verifiable", message: "Au moins une ligne a une valeur non lue." };
  return { name, status: "ok", message: "Toutes les lignes sont cohérentes." };
}

// Somme des totaux de ligne imprimés = total HT.
export function checkSumOfLines(invoice: ExtractedInvoice): Check {
  const name = "Somme des lignes = total HT";
  const { lineItems: lines, totalHT } = invoice;

  if (lines === null || lines.length === 0 || totalHT === null) {
    return { name, status: "not_verifiable", message: "Lignes ou total HT non lus." };
  }

  let sum = 0;
  for (const line of lines) {
    // Une seule ligne sans total suffit à rendre la somme fausse : on ne conclut pas.
    if (line.lineTotal === null) {
      return { name, status: "not_verifiable", message: "Au moins un total de ligne n'a pas été lu." };
    }
    sum += line.lineTotal;
  }

  if (!amountsMatch(sum, totalHT)) {
    return {
      name,
      status: "mismatch",
      message: `Somme des lignes ${formatEuro(sum)}, total HT imprimé ${formatEuro(totalHT)} (écart ${formatEuro(Math.abs(sum - totalHT))})`,
    };
  }
  return { name, status: "ok", message: formatEuro(sum) };
}

// Total HT + TVA = total TTC.
export function checkHtPlusTvaEqualsTtc(invoice: ExtractedInvoice): Check {
  const name = "HT + TVA = TTC";
  const { totalHT, totalTVA, totalTTC } = invoice;

  if (totalHT === null || totalTVA === null || totalTTC === null) {
    return { name, status: "not_verifiable", message: "Total HT, TVA ou TTC non lu." };
  }

  const expected = totalHT + totalTVA;
  const detail = `${formatEuro(totalHT)} + ${formatEuro(totalTVA)} = ${formatEuro(expected)}`;
  if (!amountsMatch(expected, totalTTC)) {
    return {
      name,
      status: "mismatch",
      message: `${detail}, TTC imprimé ${formatEuro(totalTTC)} (écart ${formatEuro(Math.abs(expected - totalTTC))})`,
    };
  }
  return { name, status: "ok", message: detail };
}

// On compare en centimes entiers : les nombres à virgule de JavaScript sont imprécis
// (0.1 + 0.2 = 0.30000000000000004), les entiers ne le sont pas.
export function amountsMatch(a: number, b: number): boolean {
  return Math.abs(toCents(a) - toCents(b)) <= TOLERANCE_CENTS;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function formatEuro(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} €`;
}
