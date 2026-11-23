import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { extractInvoice, runOcr } from "../src/mistral";
import { processInvoice } from "../src/processInvoice";
import { validInvoice } from "./fixtures";

// On remplace les deux appels réseau par des fausses fonctions : pas de clé, pas de coût,
// et on peut simuler chaque réponse possible de l'API. describeError reste la vraie.
vi.mock("../src/mistral", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/mistral")>();
  return { ...original, runOcr: vi.fn(), extractInvoice: vi.fn() };
});

let folder: string;
let pdfPath: string;

beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "factures-"));
  pdfPath = path.join(folder, "facture.pdf");
  await writeFile(pdfPath, "%PDF-1.4 contenu de test");
});

beforeEach(() => {
  vi.mocked(runOcr).mockReset().mockResolvedValue("texte OCR");
  vi.mocked(extractInvoice).mockReset().mockResolvedValue(validInvoice());
});

describe("processInvoice", () => {
  it("renvoie les données, les contrôles et le nom du fichier source", async () => {
    const result = await processInvoice(pdfPath);
    expect(result.status).toBe("success");
    expect(result.sourceFile).toBe("facture.pdf");
    if (result.status === "success") expect(result.checks.every((check) => check.status === "ok")).toBe(true);
  });

  it("échec clair si le fichier n'existe pas, sans appeler l'API", async () => {
    const result = await processInvoice(path.join(folder, "absent.pdf"));
    expect(result).toEqual({ status: "error", sourceFile: "absent.pdf", error: "Fichier illisible ou introuvable" });
    expect(runOcr).not.toHaveBeenCalled();
  });

  it("échec clair si le fichier n'est pas un PDF, sans appeler l'API", async () => {
    const fakePath = path.join(folder, "faux.pdf");
    await writeFile(fakePath, "ceci est un fichier texte");
    const result = await processInvoice(fakePath);
    expect(result.status === "error" && result.error).toBe("Ce fichier n'est pas un PDF valide");
    expect(runOcr).not.toHaveBeenCalled();
  });

  it("échec si la réponse du LLM ne respecte pas le schéma", async () => {
    vi.mocked(extractInvoice).mockResolvedValue({ ...validInvoice(), totalHT: "215 €" });
    const result = await processInvoice(pdfPath);
    expect(result.status === "error" && result.error).toContain("non conforme au schéma");
  });

  it("échec lisible si l'API renvoie une limite de débit (429)", async () => {
    vi.mocked(runOcr).mockRejectedValue(Object.assign(new Error("Too Many Requests"), { statusCode: 429 }));
    const result = await processInvoice(pdfPath);
    expect(result.status === "error" && result.error).toBe("Limite de débit Mistral atteinte (429), même après les relances");
  });

  it("applique la normalisation : une date impossible devient null avec un avertissement", async () => {
    vi.mocked(extractInvoice).mockResolvedValue(validInvoice({ invoiceDate: "2026-02-31" }));
    const result = await processInvoice(pdfPath);
    expect(result.status === "success" && result.data.invoiceDate).toBeNull();
  });
});
