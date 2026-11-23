import type { InvoiceResult } from "../../pipeline/src/schema";

export type InvoiceStatus = "no_issue" | "to_review" | "failed";

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
