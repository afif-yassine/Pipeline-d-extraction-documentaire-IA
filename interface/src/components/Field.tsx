type Props = {
  label: string;
  value: string | null;
  warning?: string;
};

// Une valeur null n'est jamais vide à l'écran : elle s'affiche « Non lu », sur fond orange.
export function Field({ label, value, warning }: Props) {
  return (
    <div className={value === null ? "field field-missing" : "field"}>
      <span className="field-label">{label}</span>
      <span className="field-value">{value ?? "Non lu"}</span>
      {warning && <span className="field-warning">{warning}</span>}
    </div>
  );
}
