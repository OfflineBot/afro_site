type Item = { id: number; name: string };

type Props = {
  title: string;
  items: Item[];
  isShown: (id: number) => boolean;
  onToggle: (id: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  colorOf?: (id: number) => string | undefined;
  isReference?: (id: number) => boolean;
  metaOf?: (id: number) => string;
};

export default function Filters({
  title,
  items,
  isShown,
  onToggle,
  onShowAll,
  onHideAll,
  colorOf,
  isReference,
  metaOf,
}: Props) {
  const anyReference = items.some((item) => isReference?.(item.id));

  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {anyReference && (
          <span className="muted filter-key">
            <span className="swatch ref" /> reference
          </span>
        )}
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" onClick={onShowAll}>
          All
        </button>
        <button className="btn" onClick={onHideAll}>
          None
        </button>
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
    </div>
  );
}
