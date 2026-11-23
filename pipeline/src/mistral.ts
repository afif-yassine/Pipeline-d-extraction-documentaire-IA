// Seul fichier qui parle à Mistral. Le reste du pipeline ne connaît que trois fonctions :
// runOcr(), extractInvoice() et describeError(). Changer de fournisseur = changer ce fichier.
// Les erreurs ne sont PAS attrapées ici : processInvoice.ts décide quoi en faire.

import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "./prompt";
import { ExtractedInvoiceSchema } from "./schema";

export const OCR_MODEL = "mistral-ocr-latest";
export const LLM_MODEL = "mistral-small-latest";
export const TIMEOUT_MS = 60_000; // délai max par appel (défaut du SDK : 5 minutes)

// Le JSON Schema est calculé une seule fois, à partir du schéma Zod (même source de vérité).
const INVOICE_JSON_SCHEMA = z.toJSONSchema(ExtractedInvoiceSchema);

// Client créé au premier appel, pas à l'import : le .env est chargé dans main(),
// donc APRÈS l'exécution des imports. Créé trop tôt, il ne verrait pas la clé.
let client: Mistral | undefined;

function getClient(): Mistral {
  client ??= new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
    timeoutMs: TIMEOUT_MS,
    retryConfig: {
      strategy: "backoff", // relance sur 429, 500, 502, 503, 504, en attendant de plus en plus
      backoff: { initialInterval: 1_000, maxInterval: 8_000, exponent: 2, maxElapsedTime: 30_000 },
      retryConnectionErrors: true, // relance aussi sur erreur réseau et délai dépassé
    },
  });
  return client;
}

// Étape 1 : Mistral OCR lit le PDF comme une image, page par page.
// C'est ce qui permet de lire le scan dégradé et le PDF dont le texte est mal encodé.
export async function runOcr(pdf: Buffer): Promise<string> {
  const response = await getClient().ocr.process({
    model: OCR_MODEL,
    document: { type: "document_url", documentUrl: `data:application/pdf;base64,${pdf.toString("base64")}` },
  });

  const text = response.pages.map((page) => page.markdown).join("\n\n");
  if (text.trim() === "") throw new Error("OCR vide : aucun texte trouvé dans le PDF");
  return text;
}

// Étape 2 : le LLM transforme le texte OCR en JSON, au format imposé par le schéma (mode strict).
// On renvoie "unknown" : tant que Zod n'a pas vérifié, on ne sait pas ce que contient la réponse.
export async function extractInvoice(ocrText: string): Promise<unknown> {
  const response = await getClient().chat.complete({
    model: LLM_MODEL,
    temperature: 0, // même entrée → même sortie autant que possible : on extrait, on ne crée pas
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: ocrText },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: { name: "invoice", schemaDefinition: INVOICE_JSON_SCHEMA, strict: true },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Réponse du LLM vide ou inattendue");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Réponse du LLM qui n'est pas du JSON valide");
  }
}

// Transforme une erreur (SDK Mistral ou autre) en message lisible pour le comptable.
// Le SDK lève ces erreurs après avoir épuisé ses relances.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "Erreur inconnue";

  if (error.name === "RequestTimeoutError") return `Mistral n'a pas répondu en ${TIMEOUT_MS / 1000} s`;
  if (error.name === "ConnectionError") return "Erreur réseau : impossible de joindre Mistral";

  const statusCode = "statusCode" in error ? error.statusCode : undefined;
  if (statusCode === 401) return "Clé API Mistral refusée (401)";
  if (statusCode === 429) return "Limite de débit Mistral atteinte (429), même après les relances";
  if (typeof statusCode === "number" && statusCode >= 500) return `Erreur du serveur Mistral (${statusCode})`;
  if (typeof statusCode === "number") return `Erreur HTTP ${statusCode} : ${error.message}`;

  return error.message;
}
