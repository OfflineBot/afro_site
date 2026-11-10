import { api, type Subject, type Task } from "../lib/api";
import { format } from "../lib/format";
import { formatSize } from "../lib/size";
import { moved, useAction } from "../lib/useAction";
import type { Data } from "../lib/useData";
import ArchiveList from "./ArchiveList";
import { AddForm, ScoreCell, SizeCell, TextCell } from "./fields";

type Props = {
  data: Data;
  subjects: Subject[];
  // The tasks of the selected set; every table shows exactly these rows.
  tasks: Task[];
  admin: boolean;
  // The move buttons write positions, so they only make sense while that order is the one shown.
  manual: boolean;
};

export default function ScoreTables({ data, subjects, tasks, admin, manual }: Props) {
  const { run, error } = useAction(data.reload);

  const move = (index: number, to: number) =>
    run(() => api.reorderSubjects(moved(subjects, index, to).map((s) => s.id)));

  return (
    <>
      {admin && (
        <div className="card">
          <div className="card-head">
            <h2>New table</h2>
            <span className="muted">one table per subject</span>
          </div>
          <AddForm placeholder="Name" onAdd={(name) => run(() => api.createSubject(name))} />
          {tasks.length === 0 && (
            <p className="muted">add tasks to this set under Tasks first</p>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {subjects.length === 0 ? (
        <div className="card">
          <div className="empty">no tables yet</div>
        </div>
      ) : (
        <div className="tables">
          {subjects.map((subject, index) => (
            <SubjectTable
              key={subject.id}
              subject={subject}
              data={data}
              tasks={tasks}
              admin={admin}
              onMoveUp={!manual || index === 0 ? undefined : () => move(index, index - 1)}
              onMoveDown={
                !manual || index === subjects.length - 1 ? undefined : () => move(index, index + 1)
              }
              run={run}
            />
          ))}
        </div>
      )}

      {admin && data.archivedSubjects.length > 0 && (
        <ArchiveList
          items={data.archivedSubjects.map((subject) => ({
            id: subject.id,
            name: subject.name,
            meta: formatSize(subject.size),
          }))}
          onRestore={(id) => run(() => api.archiveSubject(id, false))}
        />
      )}
    </>
  );
}

type TableProps = {
  subject: Subject;
  data: Data;
  tasks: Task[];
  admin: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  run: (action: () => Promise<unknown>) => void;
};

function SubjectTable({ subject, data, tasks, admin, onMoveUp, onMoveDown, run }: TableProps) {
  const save = (taskId: number, value: number | null, computed: boolean) =>
    run(() => api.setScore({ subject_id: subject.id, task_id: taskId, value, computed }));

  const scored = tasks.filter((t) => data.cell(subject.id, t.id)?.value != null).length;
  const pending = tasks.filter((t) => {
    const cell = data.cell(subject.id, t.id);
    return cell?.computed && cell.value == null;
  }).length;

  return (
    <section className="card table-card">
      <div className="card-head">
        {admin ? (
          <TextCell
            className="title-input"
            value={subject.name}
            onSave={(name) =>
              run(() =>
                api.updateSubject(subject.id, name, subject.note, subject.reference, subject.size),
              )
            }
          />
        ) : (
          <h2>{subject.name}</h2>
        )}
        {admin && (
          <span className="card-actions">
            <button className="btn-ghost" title="Move up" disabled={!onMoveUp} onClick={onMoveUp}>
              ↑
            </button>
            <button className="btn-ghost" title="Move down" disabled={!onMoveDown} onClick={onMoveDown}>
              ↓
            </button>
            <button
              className="btn-ghost"
              title="Move out of the public view"
              onClick={() => run(() => api.archiveSubject(subject.id, true))}
            >
              archive
            </button>
          </span>
        )}
      </div>

      <div className="row subtitle-row">
        {admin ? (
          <>
            <TextCell
              className="note-input"
              value={subject.note}
              placeholder="note"
              onSave={(note) =>
                run(() =>
                  api.updateSubject(subject.id, subject.name, note, subject.reference, subject.size),
                )
              }
            />
            <SizeCell
              value={subject.size}
              onSave={(size) =>
                run(() =>
                  api.updateSubject(
                    subject.id,
                    subject.name,
                    subject.note,
                    subject.reference,
                    size,
                  ),
                )
              }
            />
            <button
              className="chip"
              aria-pressed={subject.reference}
              title="Not one of my own benchmarks"
              onClick={() =>
                run(() =>
                  api.updateSubject(
                    subject.id,
                    subject.name,
                    subject.note,
                    !subject.reference,
                    subject.size,
                  ),
                )
              }
            >
              <span className={subject.reference ? "swatch ref" : "swatch"} />
              reference
            </button>
          </>
        ) : (
          <>
            {subject.note && <span className="muted">{subject.note}</span>}
            {subject.size !== null && <span className="badge">{formatSize(subject.size)}</span>}
            {subject.reference && (
              <span className="badge">
                <span className="swatch ref" /> reference
              </span>
            )}
          </>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="empty">no tasks in this set</div>
      ) : (
        <table className="score-table">
          <thead>
            <tr>
              <th>Task</th>
              <th title="Computed, score may still be missing">Done</th>
              <th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const cell = data.cell(subject.id, task.id);
              const hasValue = cell?.value != null;
              return (
                <tr key={task.id}>
                  <td className="task-name">{task.name}</td>
                  <td>
                    {hasValue ? (
                      <span className="done" title="scored">
                        ✓
                      </span>
                    ) : admin ? (
                      <input
                        type="checkbox"
                        autoComplete="off"
                        checked={cell?.computed ?? false}
                        title="computed, score still missing"
                        onChange={(e) => save(task.id, null, e.target.checked)}
                      />
                    ) : (
                      <span className={cell?.computed ? "done" : "muted"}>
                        {cell?.computed ? "✓" : "–"}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {admin ? (
                      <ScoreCell
                        value={cell?.value}
                        onSave={(value) => save(task.id, value, value !== null || (cell?.computed ?? false))}
                      />
                    ) : (
                      <span className={hasValue ? undefined : "muted"}>
                        {hasValue ? format(cell!.value!) : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {tasks.length > 0 && (
        <p className="muted table-foot">
          {scored} / {tasks.length} scored
          {pending > 0 && ` · ${pending} awaiting a number`}
        </p>
      )}
    </section>
  );
}
