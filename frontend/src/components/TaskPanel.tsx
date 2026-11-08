import { api } from "../lib/api";
import { moved, useAction } from "../lib/useAction";
import type { Data } from "../lib/useData";
import { AddForm, TextCell } from "./fields";

export default function TaskPanel({ data }: { data: Data }) {
  const { run, error } = useAction(data.reload);

  const move = (index: number, to: number) =>
    run(() => api.reorderTasks(moved(data.tasks, index, to).map((t) => t.id)));

  return (
    <section className="card narrow">
      <div className="card-head">
        <h2>Tasks</h2>
        <span className="muted">every table uses this list</span>
      </div>

      <AddForm placeholder="New task" onAdd={(name) => run(() => api.createTask(name))} />
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
                  <TextCell
                    value={task.name}
                    onSave={(name) => run(() => api.updateTask(task.id, name))}
                  />
                </td>
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
                    title="Delete"
                    onClick={() => run(() => api.deleteTask(task.id))}
                  >
                    ✕
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
