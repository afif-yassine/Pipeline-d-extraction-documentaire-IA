// null reste null : c'est le composant qui décide d'afficher « Non lu ».

export function formatEuro(amount: number | null): string | null {
  if (amount === null) return null;
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// "2026-06-03" → "03/06/2026" (la date a déjà été vérifiée par le pipeline)
export function formatDate(isoDate: string | null): string | null {
  if (isoDate === null) return null;
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
