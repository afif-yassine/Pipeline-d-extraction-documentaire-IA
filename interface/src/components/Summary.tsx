import type { ResultsFile } from "../../../pipeline/src/schema";
import { getInvoiceStatus, STATUS_LABELS, type InvoiceStatus } from "../status";

type Props = { results: ResultsFile };

// En haut de page : combien de factures, et combien demandent l'attention du comptable.
export function Summary({ results }: Props) {
  const count = (status: InvoiceStatus) =>
    results.invoices.filter((invoice) => getInvoiceStatus(invoice) === status).length;

  return (
    <section className="summary" aria-label="Résumé">
      <p>
        <strong>{results.invoices.length} factures</strong> traitées le{" "}
        {new Date(results.generatedAt).toLocaleString("fr-FR")}
      </p>
      <ul>
        <li className="badge badge-no_issue">{count("no_issue")} {STATUS_LABELS.no_issue}</li>
        <li className="badge badge-to_review">{count("to_review")} {STATUS_LABELS.to_review}</li>
        <li className="badge badge-failed">{count("failed")} {STATUS_LABELS.failed}</li>
      </ul>
    </section>
  );
}
