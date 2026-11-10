import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MAX_SERIES, SERIES } from "../lib/colors";
import { format } from "../lib/format";
import { formatSize } from "../lib/size";
import type { Score, Subject, Task } from "../lib/api";

type Mode = "task" | "subject" | "size";
type View = "bars" | "table";

type Props = {
  subjects: Subject[];
  tasks: Task[];
  cell: (subjectId: number, taskId: number) => Score | undefined;
  subjectColor: (id: number) => string;
  taskColor: (id: number) => string;
  isReference: (subjectId: number) => boolean;
};

export default function ScoreChart({
  subjects,
  tasks,
  cell,
  subjectColor,
  taskColor,
  isReference,
}: Props) {
  const [mode, setMode] = useState<Mode>("task");
  const [view, setView] = useState<View>("bars");

  const bySize = mode === "size";
  const byTask = mode === "task";
  const groups = byTask ? tasks : subjects;
  const all = byTask ? subjects : tasks;
  const series = (bySize ? tasks : all).slice(0, MAX_SERIES);
  const colorOf = byTask ? subjectColor : taskColor;

  // Plotting against size only works for models that carry one.
  const sized = subjects
    .filter((s) => s.size !== null)
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
  const sizeRows = sized.map((subject) => {
    const row: Record<string, string | number> = { size: subject.size ?? 0, name: subject.name };
    for (const task of series) {
      const score = cell(subject.id, task.id);
      if (score?.value != null) row["k" + task.id] = score.value;
    }
    return row;
  });
  const sizeTicks = [...new Set(sized.map((s) => s.size ?? 0))];

  const rows = groups.map((group) => {
    const row: Record<string, string | number> = { name: group.name };
    for (const item of series) {
      const subjectId = byTask ? item.id : group.id;
      const score = byTask ? cell(item.id, group.id) : cell(group.id, item.id);
      if (score?.value != null) {
        row["k" + item.id] = score.value;
      } else if (score?.computed) {
        row["k" + item.id] = 0;
        row["p" + item.id] = 1;
      }
      if (isReference(subjectId)) row["r" + item.id] = 1;
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
          <button role="tab" aria-selected={mode === "subject"} onClick={() => setMode("subject")}>
            by subject
          </button>
          <button role="tab" aria-selected={bySize} onClick={() => setMode("size")}>
            by size
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

      <svg width="0" height="0" aria-hidden="true" className="chart-defs">
        <defs>
          {SERIES.map((color, index) => (
            <pattern
              key={color}
              id={`hatch-${index}`}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill={color} opacity="0.35" />
              <rect width="3" height="6" fill={color} />
            </pattern>
          ))}
        </defs>
      </svg>

      {bySize ? (
        sized.length === 0 || series.length === 0 ? (
          <div className="empty">no model in this set has a size yet</div>
        ) : view === "bars" ? (
          <>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sizeRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--surface0)" />
                  <XAxis
                    type="number"
                    dataKey="size"
                    scale={sizeTicks.length > 1 ? "log" : "linear"}
                    domain={["dataMin", "dataMax"]}
                    ticks={sizeTicks}
                    tickFormatter={(v: number) => formatSize(v)}
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
                  <Tooltip content={<SizeTooltip />} cursor={{ stroke: "var(--surface1)" }} />
                  {series.map((task) => (
                    <Line
                      key={task.id}
                      type="linear"
                      dataKey={"k" + task.id}
                      name={task.name}
                      stroke={taskColor(task.id)}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: taskColor(task.id) }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="legend">
              {series.map((task) => (
                <span key={task.id}>
                  <span className="swatch" style={{ backgroundColor: taskColor(task.id) }} />
                  {task.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="num">Size</th>
                  {series.map((task) => (
                    <th key={task.id} className="num">
                      {task.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sized.map((subject, index) => (
                  <tr key={subject.id}>
                    <td>{subject.name}</td>
                    <td className="num">{formatSize(subject.size)}</td>
                    {series.map((task) => {
                      const value = sizeRows[index]["k" + task.id];
                      return (
                        <td key={task.id} className={value === undefined ? "num muted" : "num"}>
                          {value === undefined ? "—" : format(Number(value))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : empty ? (
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
                  <span
                    className={byTask && isReference(item.id) ? "swatch ref" : "swatch"}
                    style={{ backgroundColor: colorOf(item.id) }}
                  />
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

      {!bySize && all.length > series.length && (
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
  const key = String(dataKey).slice(1);

  if (!payload?.["p" + key]) {
    const slot = SERIES.indexOf(fill ?? "");
    const textured = payload?.["r" + key] && slot >= 0;
    return (
      <Rectangle
        {...props}
        fill={textured ? `url(#hatch-${slot})` : fill}
        radius={[4, 4, 0, 0]}
      />
    );
  }

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
            style={isPending(item) ? { borderColor: item.color } : { backgroundColor: item.color }}
          />
          {item.name}
          <span className="val">{isPending(item) ? "pending" : format(item.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function SizeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as Record<string, string | number> | undefined;
  const items = [...payload]
    .filter((item) => item.value !== undefined)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="tooltip">
      <div className="tooltip-title">
        {row?.name} · {formatSize(Number(row?.size))}
      </div>
      {items.map((item) => (
        <div className="tooltip-row" key={item.name}>
          <span className="swatch" style={{ backgroundColor: item.color }} />
          {item.name}
          <span className="val">{format(item.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
