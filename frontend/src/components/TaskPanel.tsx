import { api } from "../lib/api";
import { moved, useAction } from "../lib/useAction";
import type { Data } from "../lib/useData";
import ArchiveList from "./ArchiveList";
import { AddForm, TextCell } from "./fields";

export default function TaskPanel({ data, admin }: { data: Data; admin: boolean }) {
  const { run, error } = useAction(data.reload);

  const move = (index: number, to: number) =>
    run(() => api.reorderTasks(moved(data.tasks, index, to).map((t) => t.id)));

  return (
    <section className="card narrow">
      <div className="card-head">
        <h2>Tasks</h2>
        <span className="muted">every table uses this list</span>
      </div>

      {admin && (
        <AddForm placeholder="New task" onAdd={(name) => run(() => api.createTask(name))} />
      )}
      {error && <p className="error">{error}</p>}

      {data.tasks.length === 0 ? (
        <div className="empty">no tasks</div>
      ) : (
        <table>
          <tbody>
            {data.tasks.map((task, index) => (
              <tr key={task.id}>
                <td style={{ width: 1 }} className="muted">
                  {index + 1}
                </td>
                <td>
                  {admin ? (
                    <TextCell
                      value={task.name}
                      onSave={(name) => run(() => api.updateTask(task.id, name))}
                    />
                  ) : (
                    task.name
                  )}
                </td>
                {admin && (
                  <td style={{ width: 1 }}>
                    <button
                      className="btn-ghost"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      className="btn-ghost"
                      title="Move down"
                      disabled={index === data.tasks.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="btn-ghost"
                      title="Move out of the public view"
                      onClick={() => run(() => api.archiveTask(task.id, true))}
                    >
                      archive
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {admin && data.archivedTasks.length > 0 && (
        <ArchiveList
          flat
          items={data.archivedTasks.map((task) => ({ id: task.id, name: task.name }))}
          onRestore={(id) => run(() => api.archiveTask(id, false))}
        />
      )}
    </section>
  );
}
