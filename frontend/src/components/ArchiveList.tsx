type Item = { id: number; name: string; meta?: string };

type Props = {
  items: Item[];
  onRestore: (id: number) => void;
  // Inside a card that already has a head, the list drops its own card frame.
  flat?: boolean;
};

export default function ArchiveList({ items, onRestore, flat }: Props) {
  const body = (
    <>
      <div className="card-head">
        <h2 className="archive-title">Archive</h2>
        <span className="muted">kept out of the public view</span>
      </div>
      <div className="chips">
        {items.map((item) => (
          <span key={item.id} className="chip archived">
            {item.name}
            {item.meta && <span className="chip-meta">{item.meta}</span>}
            <button className="btn-ghost" title="Restore" onClick={() => onRestore(item.id)}>
              restore
            </button>
          </span>
        ))}
      </div>
    </>
  );

  return flat ? <div className="archive-flat">{body}</div> : <section className="card">{body}</section>;
}
