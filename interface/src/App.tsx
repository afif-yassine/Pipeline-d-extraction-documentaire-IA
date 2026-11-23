import { useEffect, useState } from "react";
import { ResultsFileSchema, type ResultsFile } from "../../pipeline/src/schema";
import { InvoiceCard } from "./components/InvoiceCard";
import { Summary } from "./components/Summary";

// Un seul état avec trois cas exclusifs, plutôt que trois useState (loading, error, results)
// qui pourraient se contredire (« chargement » et « erreur » affichés en même temps).
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; results: ResultsFile };

export function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  // [] : chargé une seule fois, au premier affichage.
  useEffect(() => {
    let cancelled = false; // évite de mettre à jour un composant déjà retiré de la page
    loadResults()
      .then((results) => {
        if (!cancelled) setState({ kind: "ready", results });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: "error", message: error instanceof Error ? error.message : "Erreur inconnue" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="page">
      <h1>Factures fournisseurs</h1>
      {state.kind === "loading" && <p className="info">Chargement des résultats…</p>}
      {state.kind === "error" && (
        <p className="info info-error" role="alert">
          Impossible de charger les résultats ({state.message}). Lancez d'abord <code>npm run extract</code>.
        </p>
      )}
      {state.kind === "ready" && (
        <>
          <Summary results={state.results} />
          {state.results.invoices.map((invoice) => (
            <InvoiceCard key={invoice.sourceFile} invoice={invoice} />
          ))}
        </>
      )}
    </main>
  );
}

// Le fichier vient d'un autre programme (et peut-être d'une ancienne version) :
// on le revalide avec le même schéma Zod que celui qui l'a écrit.
async function loadResults(): Promise<ResultsFile> {
  const response = await fetch("/results.json", { cache: "no-store" }); // toujours la dernière extraction
  if (!response.ok) throw new Error(`fichier introuvable, HTTP ${response.status}`);

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("results.json absent ou illisible");
  }

  const parsed = ResultsFileSchema.safeParse(json);
  if (!parsed.success) throw new Error("results.json ne respecte pas le schéma attendu, relancez npm run extract");
  return parsed.data;
}
