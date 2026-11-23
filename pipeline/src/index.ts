// Point d'entrée : npm run extract [dossier]
// Lit le dossier, traite les PDF (plusieurs à la fois, avec une limite), écrit results.json.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { mapWithConcurrency } from "./concurrency";
import { processInvoice } from "./processInvoice";
import type { InvoiceResult, ResultsFile } from "./schema";

const DEFAULT_FOLDER = "invoices";
const OUTPUT_FILE = "interface/public/results.json"; // Vite sert le dossier public/ tel quel
const DEFAULT_CONCURRENCY = 2; // prudent pour le plan gratuit de Mistral

async function main(): Promise<void> {
  loadEnvFile();

  // On échoue tôt, avec la solution, plutôt que d'avoir 4 factures en « 401 » après les relances.
  if (!process.env.MISTRAL_API_KEY) {
    stop("MISTRAL_API_KEY manquante. Copiez .env.example en .env et collez votre clé.");
  }

  const folder = process.argv[2] ?? DEFAULT_FOLDER;
  const pdfFiles = await listPdfFiles(folder);
  if (pdfFiles.length === 0) stop(`Aucun fichier PDF dans le dossier « ${folder} ».`);

  const concurrency = readConcurrency();
  console.log(`${pdfFiles.length} factures à traiter, ${concurrency} à la fois.\n`);

  const invoices = await mapWithConcurrency(pdfFiles, concurrency, async (file) => {
    const result = await processInvoice(path.join(folder, file));
    logResult(result);
    return result;
  });

  const results: ResultsFile = { generatedAt: new Date().toISOString(), invoices };
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));

  const failed = invoices.filter((invoice) => invoice.status === "error").length;
  console.log(`\n${invoices.length} factures : ${invoices.length - failed} lues, ${failed} en échec.`);
  console.log(`Résultats écrits dans ${OUTPUT_FILE}. Lancez « npm run dev » pour les voir.`);
}

async function listPdfFiles(folder: string): Promise<string[]> {
  try {
    const files = await readdir(folder);
    return files.filter((file) => file.toLowerCase().endsWith(".pdf")).sort();
  } catch {
    return stop(`Dossier introuvable : « ${folder} ».`);
  }
}

function logResult(result: InvoiceResult): void {
  if (result.status === "error") {
    console.log(`✗ ${result.sourceFile} : ${result.error}`);
    return;
  }
  const issues = result.checks.filter((check) => check.status !== "ok").length + result.data.warnings.length;
  console.log(`✓ ${result.sourceFile}${issues > 0 ? ` (${issues} point(s) à vérifier)` : ""}`);
}

// Nombre entier ≥ 1, sinon la valeur par défaut. Lu après loadEnvFile(), pas à l'import.
function readConcurrency(): number {
  const value = Number(process.env.CONCURRENCY);
  return Number.isInteger(value) && value >= 1 ? value : DEFAULT_CONCURRENCY;
}

// Lit .env s'il existe (fonction native de Node ≥ 20.12, pas besoin de la bibliothèque dotenv).
// Sans .env, les variables peuvent venir de l'environnement (serveur, CI) : ce n'est pas une erreur.
function loadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch {
    // pas de fichier .env
  }
}

// "never" : la fonction ne revient jamais (process.exit), TypeScript le sait.
function stop(message: string): never {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

main();
