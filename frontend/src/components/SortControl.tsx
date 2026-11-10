import type { SubjectSort } from "../lib/size";

const OPTIONS: { id: SubjectSort; label: string }[] = [
  { id: "manual", label: "manual" },
  { id: "asc", label: "size ↑" },
  { id: "desc", label: "size ↓" },
];

export default function SortControl({
  value,
  onChange,
  standalone,
}: {
  value: SubjectSort;
  onChange: (value: SubjectSort) => void;
  // Outside the filter card the control needs its own label and row.
  standalone?: boolean;
}) {
  const tabs = (
    <div className="tabs">
      {OPTIONS.map(({ id, label }) => (
        <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );

  if (!standalone) return tabs;
  return (
    <div className="row sort-row">
      <span className="muted">model order</span>
      {tabs}
    </div>
  );
}
