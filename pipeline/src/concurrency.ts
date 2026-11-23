// Applique `task` à chaque élément, avec au plus `limit` tâches en cours en même temps.
// Le résultat garde l'ordre des éléments, quel que soit l'ordre de fin des tâches.
//
// Pourquoi pas Promise.all(items.map(task)) ? Tout partirait d'un coup : sur 4 000 factures,
// l'API répondrait 429 (trop de requêtes). Pourquoi pas une boucle for ? Une seule à la fois : lent.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let nextIndex = 0;

  // Chaque « ouvrier » prend l'élément suivant dès qu'il a fini le précédent.
  // JavaScript n'exécute qu'un bout de code à la fois : nextIndex++ ne peut pas être pris deux fois.
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index] as T);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
