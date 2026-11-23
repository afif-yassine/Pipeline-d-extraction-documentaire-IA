import { describe, expect, it } from "vitest";
import { describeError } from "../src/mistral";

// Les appels réseau ne sont pas testés ici (ils demandent une clé et coûtent des requêtes).
// On teste la traduction des erreurs, qui est ce que voit le comptable.

function httpError(statusCode: number, message = "détail"): Error {
  return Object.assign(new Error(message), { statusCode });
}

function namedError(name: string): Error {
  const error = new Error("détail technique");
  error.name = name;
  return error;
}

describe("describeError", () => {
  it.each([
    [httpError(401), "Clé API Mistral refusée (401)"],
    [httpError(429), "Limite de débit Mistral atteinte (429), même après les relances"],
    [httpError(503), "Erreur du serveur Mistral (503)"],
    [httpError(422, "document invalide"), "Erreur HTTP 422 : document invalide"],
    [namedError("RequestTimeoutError"), "Mistral n'a pas répondu en 60 s"],
    [namedError("ConnectionError"), "Erreur réseau : impossible de joindre Mistral"],
    [new Error("OCR vide"), "OCR vide"],
    ["pas une erreur", "Erreur inconnue"],
  ])("%s → %s", (error, expected) => {
    expect(describeError(error)).toBe(expected);
  });
});
