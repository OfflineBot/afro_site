type Item = { id: number; name: string };

type Props = {
  title: string;
  items: Item[];
  isShown: (id: number) => boolean;
  onToggle: (id: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  colorOf?: (id: number) => string | undefined;
};

export default function Filters({ title, items, isShown, onToggle, onShowAll, onHideAll, colorOf }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
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
            return (
              <button
                key={item.id}
                className="chip"
                aria-pressed={shown}
                onClick={() => onToggle(item.id)}
              >
                {color && (
                  <span
                    className="swatch"
                    style={{ background: shown ? color : "var(--surface1)" }}
                  />
                )}
                {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
