import type { TaskSet } from "../lib/api";

export default function SetPicker({
  sets,
  value,
  onChange,
}: {
  sets: TaskSet[];
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  if (sets.length === 0) return null;
  return (
    <label className="set-picker">
      <span className="muted">set</span>
      <select value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        {sets.map((set) => (
          <option key={set.id} value={set.id}>
            {set.name}
          </option>
        ))}
      </select>
    </label>
  );
}
