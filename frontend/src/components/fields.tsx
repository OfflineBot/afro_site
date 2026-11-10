import { useEffect, useState } from "react";
import { formatSize, parseSize } from "../lib/size";

export function AddForm({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="row"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim());
        setName("");
      }}
    >
      <input
        style={{ flex: 1 }}
        autoComplete="off"
        value={name}
        placeholder={placeholder}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn btn-primary" type="submit">
        Add
      </button>
    </form>
  );
}

export function TextCell({
  value,
  placeholder,
  className,
  onSave,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else if (!next && placeholder && value) onSave("");
    else setDraft(value);
  };

  return (
    <input
      className={className}
      style={{ width: "100%" }}
      autoComplete="off"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

export function ScoreCell({
  value,
  onSave,
}: {
  value: number | null | undefined;
  onSave: (value: number | null) => void;
}) {
  const text = value === null || value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === text) return;
    if (trimmed === "") {
      onSave(null);
      return;
    }
    const next = Number(trimmed.replace(",", "."));
    if (Number.isNaN(next) || next < 0 || next > 100) {
      setDraft(text);
      return;
    }
    onSave(next);
  };

  return (
    <input
      className="cell-input"
      inputMode="decimal"
      autoComplete="off"
      value={draft}
      placeholder="—"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}

export function SizeCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
}) {
  const text = formatSize(value);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (value === null) setDraft(text);
      else onSave(null);
      return;
    }
    const next = parseSize(trimmed);
    if (next === null || next === value) {
      setDraft(text);
      return;
    }
    onSave(next);
  };

  return (
    <input
      className="size-input"
      autoComplete="off"
      value={draft}
      placeholder="size"
      title="parameters, e.g. 0.8B or 700M"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  );
}
