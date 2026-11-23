import type { LineItem } from "../../../pipeline/src/schema";
import { formatEuro } from "../format";

type Props = { lines: LineItem[] | null };

// null (tableau illisible) et [] (aucune ligne) sont deux informations différentes.
export function LineItemsTable({ lines }: Props) {
  if (lines === null) return <p className="missing-block">Tableau des lignes illisible</p>;
  if (lines.length === 0) return <p className="info">Aucune ligne de produit.</p>;

  return (
    <div className="table-scroll">
      <table className="lines">
        <thead>
          <tr>
            <th>Désignation</th>
            <th>Quantité</th>
            <th>Prix unitaire HT</th>
            <th>Total ligne (imprimé)</th>
          </tr>
        </thead>
        <tbody>
          {/* L'index suffit : les lignes ne sont jamais triées ni filtrées. */}
          {lines.map((line, index) => (
            <tr key={index}>
              <Cell value={line.description} />
              <Cell value={line.quantity?.toString() ?? null} />
              <Cell value={formatEuro(line.unitPrice)} />
              <Cell value={formatEuro(line.lineTotal)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ value }: { value: string | null }) {
  return <td className={value === null ? "cell-missing" : undefined}>{value ?? "Non lu"}</td>;
}
