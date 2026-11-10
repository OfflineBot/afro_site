import { api, type Task, type TaskSet } from "../lib/api";
import { moved, useAction } from "../lib/useAction";
import type { Data } from "../lib/useData";
import ArchiveList from "./ArchiveList";
import { AddForm, TextCell } from "./fields";

type Props = {
  data: Data;
  tasks: Task[];
  taskSet: TaskSet | undefined;
  admin: boolean;
  onSelectSet: (id: number) => void;
};

export default function TaskPanel({ data, tasks, taskSet, admin, onSelectSet }: Props) {
  const { run, error } = useAction(data.reload);

  const move = (index: number, to: number) =>
    run(() => api.reorderTasks(moved(tasks, index, to).map((t) => t.id)));

  const addSet = (name: string) =>
    run(async () => {
      const created = await api.createTaskSet(name);
      onSelectSet(created.id);
    });

  const archived = data.archivedTasks.filter((t) => t.set_id === taskSet?.id);

  return (
    <>
      <section className="card narrow">
        <div className="card-head">
          {admin && taskSet ? (
            <TextCell
              className="title-input"
              value={taskSet.name}
              onSave={(name) => run(() => api.renameTaskSet(taskSet.id, name))}
            />
          ) : (
            <h2>{taskSet?.name ?? "Tasks"}</h2>
          )}
          <span className="muted">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        {admin && taskSet && (
          <AddForm placeholder="New task" onAdd={(name) => run(() => api.createTask(taskSet.id, name))} />
        )}
        {error && <p className="error">{error}</p>}

        {tasks.length === 0 ? (
          <div className="empty">no tasks in this set</div>
        ) : (
          <table>
            <tbody>
              {tasks.map((task, index) => (
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
                        disabled={index === tasks.length - 1}
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

        {admin && archived.length > 0 && (
          <ArchiveList
            flat
            items={archived.map((task) => ({ id: task.id, name: task.name }))}
            onRestore={(id) => run(() => api.archiveTask(id, false))}
          />
        )}
      </section>

      {admin && (
        <section className="card narrow">
          <div className="card-head">
            <h2>Task sets</h2>
            <span className="muted">each set has its own tasks</span>
          </div>
          <AddForm placeholder="New task set" onAdd={addSet} />
          <div className="chips">
            {data.taskSets.map((set) => (
              <button
                key={set.id}
                className="chip"
                aria-pressed={set.id === taskSet?.id}
                onClick={() => onSelectSet(set.id)}
              >
                {set.name}
                <span className="chip-meta">
                  {data.tasks.filter((t) => t.set_id === set.id).length}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
