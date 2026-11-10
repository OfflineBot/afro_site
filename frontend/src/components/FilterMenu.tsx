import { useEffect, useRef, useState, type ReactNode } from "react";

type Item = { id: number; name: string };

type Props = {
  label: string;
  items: Item[];
  isShown: (id: number) => boolean;
  onToggle: (id: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  colorOf?: (id: number) => string | undefined;
  isReference?: (id: number) => boolean;
  metaOf?: (id: number) => string;
  note?: string;
  // Controls that belong to this dimension, shown above its list.
  extra?: ReactNode;
};

export default function FilterMenu({
  label,
  items,
  isShown,
  onToggle,
  onShowAll,
  onHideAll,
  colorOf,
  isReference,
  metaOf,
  note,
  extra,
}: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("mousedown", away);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("mousedown", away);
      removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = items.filter((item) => isShown(item.id)).length;
  const all = shown === items.length;

  return (
    <div className="filter-menu" ref={box}>
      <button className="btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {label}
        <span className={all ? "filter-count" : "filter-count narrowed"}>
          {shown}/{items.length}
        </span>
        <span className="caret">▾</span>
      </button>

      {open && (
        <div className="filter-pop">
          <div className="filter-pop-head">
            {note && <span className="filter-note">{note}</span>}
            <span className="filter-spacer" />
            <button className="btn" onClick={onShowAll}>
              All
            </button>
            <button className="btn" onClick={onHideAll}>
              None
            </button>
          </div>
          {extra && <div className="filter-pop-extra">{extra}</div>}
          {items.length === 0 ? (
            <div className="empty">nothing yet</div>
          ) : (
            <div className="filter-list">
              {items.map((item) => {
                const on = isShown(item.id);
                const reference = isReference?.(item.id) ?? false;
                const color = colorOf?.(item.id);
                const meta = metaOf?.(item.id);
                return (
                  <button
                    key={item.id}
                    className="filter-item"
                    aria-pressed={on}
                    onClick={() => onToggle(item.id)}
                  >
                    <span className="tick">{on ? "✓" : ""}</span>
                    {color && (
                      <span
                        className={reference ? "swatch ref" : "swatch"}
                        style={{ backgroundColor: on ? color : "var(--surface1)" }}
                      />
                    )}
                    <span className="filter-item-name">{item.name}</span>
                    {meta && <span className="chip-meta">{meta}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
