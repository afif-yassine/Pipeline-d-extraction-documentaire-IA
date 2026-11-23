import { amountsMatch } from "../../pipeline/src/checks";
import type { InvoiceResult, LineItem } from "../../pipeline/src/schema";

export type InvoiceStatus = "no_issue" | "to_review" | "failed";

// Problème d'une ligne du tableau, pour la surligner : écart de calcul ou valeur non lue.
export type LineIssue = "mismatch" | "missing" | null;

// « Aucun écart détecté » et pas « Validée » : les contrôles ne prouvent pas que tout est juste
// (une valeur mal lue mais cohérente avec les autres passe tous les contrôles).
export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  no_issue: "Aucun écart détecté",
  to_review: "À vérifier",
  failed: "Échec",
};

// Calculé à l'affichage, pas stocké dans results.json : il se déduit des données,
// donc il ne peut jamais les contredire.
export function getInvoiceStatus(invoice: InvoiceResult): InvoiceStatus {
  if (invoice.status === "error") return "failed";
  const hasWarning = invoice.data.warnings.length > 0;
  const hasIssue = invoice.checks.some((check) => check.status !== "ok");
  return hasWarning || hasIssue ? "to_review" : "no_issue";
}

// Même règle que le contrôle « quantité × prix = total » (checks.ts), appliquée ligne par ligne :
// le comptable voit directement QUELLE ligne pose problème.
export function getLineIssue(line: LineItem): LineIssue {
  const { description, quantity, unitPrice, lineTotal } = line;
  if (description === null || quantity === null || unitPrice === null || lineTotal === null) return "missing";
  return amountsMatch(quantity * unitPrice, lineTotal) ? null : "mismatch";
}
