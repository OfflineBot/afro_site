import type { SubjectSort } from "../lib/size";

const OPTIONS: { id: SubjectSort; label: string }[] = [
  { id: "manual", label: "manual" },
  { id: "asc", label: "size ↑" },
  { id: "desc", label: "size ↓" },
];

export default function SortControl({
  value,
  onChange,
}: {
  value: SubjectSort;
  onChange: (value: SubjectSort) => void;
}) {
  return (
    <div className="row sort-row">
      <span className="muted">subject order</span>
      <div className="tabs">
        {OPTIONS.map(({ id, label }) => (
          <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
