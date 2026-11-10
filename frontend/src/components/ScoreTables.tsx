import { api, type Subject } from "../lib/api";
import { format } from "../lib/format";
import { moved, useAction } from "../lib/useAction";
import type { Data } from "../lib/useData";
import { AddForm, ScoreCell, TextCell } from "./fields";

export default function ScoreTables({ data, admin }: { data: Data; admin: boolean }) {
  const { run, error } = useAction(data.reload);

  const move = (index: number, to: number) =>
    run(() => api.reorderSubjects(moved(data.subjects, index, to).map((s) => s.id)));

  return (
    <>
      {admin && (
        <div className="card">
          <div className="card-head">
            <h2>New table</h2>
            <span className="muted">one table per subject</span>
          </div>
          <AddForm placeholder="Name" onAdd={(name) => run(() => api.createSubject(name))} />
          {data.tasks.length === 0 && (
            <p className="muted">add tasks under Tasks first — every table uses the same ones</p>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {data.subjects.length === 0 ? (
        <div className="card">
          <div className="empty">no tables yet</div>
        </div>
      ) : (
        <div className="tables">
          {data.subjects.map((subject, index) => (
            <SubjectTable
              key={subject.id}
              subject={subject}
              data={data}
              admin={admin}
              onMoveUp={index === 0 ? undefined : () => move(index, index - 1)}
              onMoveDown={index === data.subjects.length - 1 ? undefined : () => move(index, index + 1)}
              run={run}
            />
          ))}
        </div>
      )}
    </>
  );
}

type TableProps = {
  subject: Subject;
  data: Data;
  admin: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  run: (action: () => Promise<unknown>) => void;
};

function SubjectTable({ subject, data, admin, onMoveUp, onMoveDown, run }: TableProps) {
  const save = (taskId: number, value: number | null, computed: boolean) =>
    run(() => api.setScore({ subject_id: subject.id, task_id: taskId, value, computed }));

  const scored = data.tasks.filter((t) => data.cell(subject.id, t.id)?.value != null).length;
  const pending = data.tasks.filter((t) => {
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
            onSave={(name) => run(() => api.updateSubject(subject.id, name, subject.note, subject.reference))}
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
              title="Delete"
              onClick={() => run(() => api.deleteSubject(subject.id))}
            >
              ✕
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
              onSave={(note) => run(() => api.updateSubject(subject.id, subject.name, note, subject.reference))}
            />
            <button
              className="chip"
              aria-pressed={subject.reference}
              title="Not one of my own benchmarks"
              onClick={() =>
                run(() =>
                  api.updateSubject(subject.id, subject.name, subject.note, !subject.reference),
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
            {subject.reference && (
              <span className="badge">
                <span className="swatch ref" /> reference
              </span>
            )}
          </>
        )}
      </div>

      {data.tasks.length === 0 ? (
        <div className="empty">no tasks</div>
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
            {data.tasks.map((task) => {
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

      {data.tasks.length > 0 && (
        <p className="muted table-foot">
          {scored} / {data.tasks.length} scored
          {pending > 0 && ` · ${pending} awaiting a number`}
        </p>
      )}
    </section>
  );
}
