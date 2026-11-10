import type { ReactNode } from "react";

type Item = { id: number; name: string };

type Props = {
  title: string;
  note?: string;
  items: Item[];
  isShown: (id: number) => boolean;
  onToggle: (id: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  colorOf?: (id: number) => string | undefined;
  isReference?: (id: number) => boolean;
  metaOf?: (id: number) => string;
  // Controls that belong to this dimension, shown next to its All/None buttons.
  extra?: ReactNode;
};

export default function FilterRow({
  title,
  note,
  items,
  isShown,
  onToggle,
  onShowAll,
  onHideAll,
  colorOf,
  isReference,
  metaOf,
  extra,
}: Props) {
  const shownCount = items.filter((item) => isShown(item.id)).length;

  return (
    <section className="filter-row">
      <div className="filter-head">
        <h3>{title}</h3>
        {note && <span className="filter-note">{note}</span>}
        <span className="muted filter-count">
          {shownCount} / {items.length}
        </span>
        <span className="filter-spacer" />
        <span className="filter-actions">
          {extra}
          <button className="btn" onClick={onShowAll}>
            All
          </button>
          <button className="btn" onClick={onHideAll}>
            None
          </button>
        </span>
      </div>
      {items.length === 0 ? (
        <div className="empty">nothing yet</div>
      ) : (
        <div className="chips">
          {items.map((item) => {
            const shown = isShown(item.id);
            const color = colorOf?.(item.id);
            const reference = isReference?.(item.id) ?? false;
            const meta = metaOf?.(item.id);
            return (
              <button
                key={item.id}
                className={reference ? "chip chip-ref" : "chip"}
                aria-pressed={shown}
                onClick={() => onToggle(item.id)}
              >
                {color && (
                  <span
                    className={reference ? "swatch ref" : "swatch"}
                    style={{ backgroundColor: shown ? color : "var(--surface1)" }}
                  />
                )}
                {item.name}
                {meta && <span className="chip-meta">{meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
