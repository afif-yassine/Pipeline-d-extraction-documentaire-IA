import type { Check, Warning } from "../../../pipeline/src/schema";

type Props = {
  warnings: Warning[];
  checks: Check[];
};

// Un symbole en plus de la couleur : lisible aussi pour un daltonien ou une impression en noir et blanc.
const CHECK_ICONS: Record<Check["status"], string> = {
  ok: "✓",
  mismatch: "✗",
  not_verifiable: "?",
};

export function Alerts({ warnings, checks }: Props) {
  return (
    <div className="alerts">
      <ul className="checks">
        {checks.map((check) => (
          <li key={check.name} className={`check check-${check.status}`}>
            <span aria-hidden="true">{CHECK_ICONS[check.status]}</span> <strong>{check.name}</strong>
            {check.status !== "ok" && <> : {check.message}</>}
          </li>
        ))}
      </ul>
      {warnings.length > 0 && (
        <ul className="warnings">
          {/* field + index : unique même si deux avertissements portent sur le même champ */}
          {warnings.map((warning, index) => (
            <li key={`${warning.field}-${index}`}>⚠ {warning.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
