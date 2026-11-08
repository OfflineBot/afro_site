import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MAX_SERIES } from "../lib/colors";
import { format } from "../lib/format";
import type { Score, Subject, Task } from "../lib/api";

type Mode = "task" | "subject";
type View = "bars" | "table";

type Props = {
  subjects: Subject[];
  tasks: Task[];
  cell: (subjectId: number, taskId: number) => Score | undefined;
  subjectColor: (id: number) => string;
  taskColor: (id: number) => string;
};

export default function ScoreChart({ subjects, tasks, cell, subjectColor, taskColor }: Props) {
  const [mode, setMode] = useState<Mode>("task");
  const [view, setView] = useState<View>("bars");

  const byTask = mode === "task";
  const groups = byTask ? tasks : subjects;
  const all = byTask ? subjects : tasks;
  const series = all.slice(0, MAX_SERIES);
  const colorOf = byTask ? subjectColor : taskColor;

  const rows = groups.map((group) => {
    const row: Record<string, string | number> = { name: group.name };
    for (const item of series) {
      const score = byTask ? cell(item.id, group.id) : cell(group.id, item.id);
      if (score?.value != null) {
        row["k" + item.id] = score.value;
      } else if (score?.computed) {
        row["k" + item.id] = 0;
        row["p" + item.id] = 1;
      }
    }
    return row;
  });

  const empty = groups.length === 0 || series.length === 0;
  const pending = rows.reduce(
    (sum, row) => sum + series.filter((item) => row["p" + item.id]).length,
    0,
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2>Scores</h2>
        <span style={{ flex: 1 }} />
        <div className="tabs">
          <button role="tab" aria-selected={byTask} onClick={() => setMode("task")}>
            by task
          </button>
          <button role="tab" aria-selected={!byTask} onClick={() => setMode("subject")}>
            by subject
          </button>
        </div>
        <div className="tabs">
          <button role="tab" aria-selected={view === "bars"} onClick={() => setView("bars")}>
            bars
          </button>
          <button role="tab" aria-selected={view === "table"} onClick={() => setView("table")}>
            table
          </button>
        </div>
      </div>

      {empty ? (
        <div className="empty">nothing selected</div>
      ) : view === "bars" ? (
        <>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="var(--surface0)" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  tickLine={false}
                  axisLine={{ stroke: "var(--surface0)" }}
                  tick={{ fill: "var(--subtext0)", fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  width={40}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--subtext0)", fontSize: 12 }}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "var(--surface0)", fillOpacity: 0.4 }}
                />
                {series.map((item) => (
                  <Bar
                    key={item.id}
                    dataKey={"k" + item.id}
                    name={item.name}
                    fill={colorOf(item.id)}
                    maxBarSize={24}
                    shape={<BarShape />}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {series.length > 1 && (
            <div className="legend">
              {series.map((item) => (
                <span key={item.id}>
                  <span className="swatch" style={{ background: colorOf(item.id) }} />
                  {item.name}
                </span>
              ))}
            </div>
          )}
          {pending > 0 && (
            <p className="muted chart-foot">
              <span className="swatch-outline" /> {pending} computed, score still missing
            </p>
          )}
        </>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>{byTask ? "Task" : "Subject"}</th>
                {series.map((item) => (
                  <th key={item.id} className="num">
                    {item.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.name)}>
                  <td>{row.name}</td>
                  {series.map((item) => {
                    const value = row["k" + item.id];
                    if (value !== undefined) {
                      return (
                        <td key={item.id} className="num">
                          {format(Number(value))}
                        </td>
                      );
                    }
                    return (
                      <td key={item.id} className="num muted" title={row["p" + item.id] ? "computed, no score yet" : undefined}>
                        {row["p" + item.id] ? "✓" : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {all.length > series.length && (
        <p className="muted">
          showing {series.length} of {all.length} — deselect some to compare the rest
        </p>
      )}
    </div>
  );
}

const pendingKey = (dataKey: unknown) => "p" + String(dataKey).slice(1);

type BarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  dataKey?: string;
  payload?: Record<string, string | number>;
};

function BarShape(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, fill, dataKey, payload } = props;
  if (!payload?.[pendingKey(dataKey)]) return <Rectangle {...props} radius={[4, 4, 0, 0]} />;

  const height = 12;
  return (
    <rect
      x={x}
      y={y - height}
      width={width}
      height={height}
      rx={3}
      fill="none"
      stroke={fill}
      strokeWidth={1.5}
      strokeDasharray="3 2"
    />
  );
}

type TooltipPayload = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: Record<string, string | number>;
};

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const isPending = (item: TooltipPayload) => Boolean(item.payload?.[pendingKey(item.dataKey)]);
  const items = [...payload].sort((a, b) => {
    if (isPending(a) !== isPending(b)) return isPending(a) ? 1 : -1;
    return (b.value ?? 0) - (a.value ?? 0);
  });

  return (
    <div className="tooltip">
      <div className="tooltip-title">{label}</div>
      {items.map((item) => (
        <div className="tooltip-row" key={item.name}>
          <span
            className={isPending(item) ? "swatch-outline" : "swatch"}
            style={isPending(item) ? { borderColor: item.color } : { background: item.color }}
          />
          {item.name}
          <span className="val">{isPending(item) ? "pending" : format(item.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
