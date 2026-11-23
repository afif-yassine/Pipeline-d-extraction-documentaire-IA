import type { ExtractedInvoice, Warning } from "./schema";

// Ce que Zod ne vérifie pas, appliqué après la validation :
// 1. une date mal formée ou impossible passe à null ;
// 2. une quantité lue « 0 » passe à null (case masquée ou mal lue) ;
// 3. chaque champ null reçoit un avertissement, même si le LLM a oublié de le mettre.
// On renvoie toujours un nouvel objet : la donnée reçue n'est jamais modifiée.
export function normalizeInvoice(invoice: ExtractedInvoice): ExtractedInvoice {
  return addMissingFieldWarnings(nullifyZeroQuantities(nullifyInvalidDate(invoice)));
}

// Une ligne facturée n'a jamais une quantité de 0. Sur une facture test, l'OCR a lu « 0 »
// à la place d'une case noircie : on refuse cette valeur plutôt que de la garder.
export function nullifyZeroQuantities(invoice: ExtractedInvoice): ExtractedInvoice {
  if (invoice.lineItems === null || !invoice.lineItems.some((line) => line.quantity === 0)) return invoice;

  const warnings: Warning[] = [...invoice.warnings];
  const lineItems = invoice.lineItems.map((line, index) => {
    if (line.quantity !== 0) return line;
    const lineNumber = index + 1;
    warnings.push({ field: `lineItems[${lineNumber}]`, message: `Ligne ${lineNumber} : quantité lue « 0 », probablement masquée ou illisible` });
    return { ...line, quantity: null };
  });
  return { ...invoice, lineItems, warnings };
}

// Exemple : "2026-02-31" ou "03/06/2026" → null + avertissement. La facture est conservée.
export function nullifyInvalidDate(invoice: ExtractedInvoice): ExtractedInvoice {
  const date = invoice.invoiceDate;
  if (date === null || isRealIsoDate(date)) return invoice;

  return {
    ...invoice,
    invoiceDate: null,
    warnings: [...invoice.warnings, { field: "invoiceDate", message: `Date illisible ou impossible (lu : ${date})` }],
  };
}

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // "Z" = UTC : sans lui, le fuseau horaire peut décaler la date d'un jour.
  const date = new Date(`${value}T00:00:00Z`);
  // Une date inexistante (31 février) est décalée par JavaScript (3 mars) : on ne retrouve pas la même chaîne.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Libellés affichés au comptable pour chaque champ non lu.
const MISSING_FIELD_MESSAGES = {
  supplierName: "Fournisseur non lu",
  invoiceDate: "Date non lue",
  invoiceNumber: "Numéro de facture non lu",
  lineItems: "Tableau des lignes illisible",
  totalHT: "Total HT non lu",
  totalTVA: "TVA non lue",
  totalTTC: "Total TTC non lu",
} satisfies Partial<Record<keyof ExtractedInvoice, string>>;

// Aucun champ vide n'est muet. Si le LLM a déjà mis un avertissement (souvent plus précis), on le garde.
export function addMissingFieldWarnings(invoice: ExtractedInvoice): ExtractedInvoice {
  const warnings: Warning[] = [...invoice.warnings];
  const addIfMissing = (field: string, message: string) => {
    if (!warnings.some((warning) => warning.field === field)) warnings.push({ field, message });
  };

  for (const [field, message] of Object.entries(MISSING_FIELD_MESSAGES)) {
    if (invoice[field as keyof typeof MISSING_FIELD_MESSAGES] === null) addIfMissing(field, message);
  }

  invoice.lineItems?.forEach((line, index) => {
    const missing = [
      line.description === null && "désignation",
      line.quantity === null && "quantité",
      line.unitPrice === null && "prix unitaire",
      line.lineTotal === null && "total",
    ].filter((label): label is string => label !== false);

    if (missing.length > 0) {
      const lineNumber = index + 1; // numérotation humaine, comme sur la facture
      addIfMissing(`lineItems[${lineNumber}]`, `Ligne ${lineNumber} : ${missing.join(", ")} non lu(s)`);
    }
  });

  return { ...invoice, warnings };
}
