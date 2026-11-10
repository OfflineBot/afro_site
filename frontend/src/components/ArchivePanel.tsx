import { api } from "../lib/api";
import { formatSize } from "../lib/size";
import { useAction } from "../lib/useAction";
import type { Data } from "../lib/useData";

export default function ArchivePanel({ data }: { data: Data }) {
  const { run, error } = useAction(data.reload);
  const setName = (id: number) => data.taskSets.find((s) => s.id === id)?.name ?? "unknown set";
  const empty = data.archivedSubjects.length === 0 && data.archivedTasks.length === 0;

  return (
    <section className="card narrow">
      <div className="card-head">
        <h2>Archive</h2>
        <span className="muted">kept out of the public view, scores untouched</span>
      </div>
      {error && <p className="error">{error}</p>}

      {empty ? (
        <div className="empty">nothing archived</div>
      ) : (
        <table>
          <tbody>
            {data.archivedSubjects.map((subject) => (
              <tr key={"s" + subject.id}>
                <td className="muted archive-kind">subject</td>
                <td>
                  {subject.name}
                  {subject.size !== null && (
                    <span className="chip-meta">{formatSize(subject.size)}</span>
                  )}
                  <span className="chip-meta">
                    {subject.set_id === null ? "unassigned" : setName(subject.set_id)}
                  </span>
                </td>
                <td style={{ width: 1 }}>
                  <button
                    className="btn"
                    onClick={() => run(() => api.archiveSubject(subject.id, false))}
                  >
                    restore
                  </button>
                </td>
              </tr>
            ))}
            {data.archivedTasks.map((task) => (
              <tr key={"t" + task.id}>
                <td className="muted archive-kind">task</td>
                <td>
                  {task.name}
                  <span className="chip-meta">{setName(task.set_id)}</span>
                </td>
                <td style={{ width: 1 }}>
                  <button
                    className="btn"
                    onClick={() => run(() => api.archiveTask(task.id, false))}
                  >
                    restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
