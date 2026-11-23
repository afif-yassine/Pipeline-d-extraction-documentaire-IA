import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { runChecks } from "./checks";
import { describeError, extractInvoice, runOcr } from "./mistral";
import { normalizeInvoice } from "./normalize";
import { ExtractedInvoiceSchema, type InvoiceResult } from "./schema";

// Tout fichier PDF commence par ces 5 octets.
const PDF_SIGNATURE = "%PDF-";

// Les étapes pour UN fichier : lecture → OCR → LLM → validation Zod → normalisation → contrôles.
// Cette fonction ne lève jamais d'erreur : elle renvoie toujours un résultat (succès ou échec),
// pour qu'une facture en échec ne fasse jamais tomber le traitement des autres.
export async function processInvoice(pdfPath: string): Promise<InvoiceResult> {
  const sourceFile = path.basename(pdfPath);
  const fail = (error: string): InvoiceResult => ({ status: "error", sourceFile, error });

  let pdf: Buffer;
  try {
    pdf = await readFile(pdfPath);
  } catch {
    return fail("Fichier illisible ou introuvable");
  }
  // Vérifié avant l'appel à l'API : un faux PDF donne un message clair et ne coûte pas de requête.
  if (pdf.subarray(0, PDF_SIGNATURE.length).toString("latin1") !== PDF_SIGNATURE) {
    return fail("Ce fichier n'est pas un PDF valide");
  }

  try {
    const ocrText = await runOcr(pdf);
    const llmOutput = await extractInvoice(ocrText);

    const parsed = ExtractedInvoiceSchema.safeParse(llmOutput);
    if (!parsed.success) {
      return fail(`Réponse du LLM non conforme au schéma :\n${z.prettifyError(parsed.error)}`);
    }

    const invoice = normalizeInvoice(parsed.data);
    return { status: "success", sourceFile, data: invoice, checks: runChecks(invoice) };
  } catch (error) {
    return fail(describeError(error));
  }
}
