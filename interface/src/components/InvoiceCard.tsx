import type { InvoiceResult, Warning } from "../../../pipeline/src/schema";
import { formatDate, formatEuro } from "../format";
import { getInvoiceStatus, STATUS_LABELS } from "../status";
import { Alerts } from "./Alerts";
import { Field } from "./Field";
import { LineItemsTable } from "./LineItemsTable";

type Props = { invoice: InvoiceResult };

// Une carte par PDF. Le nom du fichier est en titre : on sait toujours d'où vient chaque donnée.
export function InvoiceCard({ invoice }: Props) {
  const status = getInvoiceStatus(invoice);

  return (
    <article className={`card card-${status}`}>
      <header className="card-header">
        <h2>📄 {invoice.sourceFile}</h2>
        <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
      </header>

      {invoice.status === "error" ? (
        <p className="error-message">{invoice.error}</p>
      ) : (
        <>
          {/* Écarts et avertissements en premier : c'est ce que le comptable doit voir. */}
          <Alerts warnings={invoice.data.warnings} checks={invoice.checks} />
          <div className="fields">
            <Field label="Fournisseur" value={invoice.data.supplierName} warning={warningFor(invoice.data.warnings, "supplierName")} />
            <Field label="Date" value={formatDate(invoice.data.invoiceDate)} warning={warningFor(invoice.data.warnings, "invoiceDate")} />
            <Field label="N° de facture" value={invoice.data.invoiceNumber} warning={warningFor(invoice.data.warnings, "invoiceNumber")} />
            <Field label="Total HT" value={formatEuro(invoice.data.totalHT)} warning={warningFor(invoice.data.warnings, "totalHT")} />
            <Field label="TVA" value={formatEuro(invoice.data.totalTVA)} warning={warningFor(invoice.data.warnings, "totalTVA")} />
            <Field label="Total TTC" value={formatEuro(invoice.data.totalTTC)} warning={warningFor(invoice.data.warnings, "totalTTC")} />
          </div>
          <LineItemsTable lines={invoice.data.lineItems} />
        </>
      )}
    </article>
  );
}

function warningFor(warnings: Warning[], field: string): string | undefined {
  return warnings.find((warning) => warning.field === field)?.message;
}
