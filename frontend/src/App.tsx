import { useEffect, useState } from "react";
import FilterRow from "./components/Filters";
import Login from "./components/Login";
import ScoreChart from "./components/ScoreChart";
import ScoreTables from "./components/ScoreTables";
import SetPicker from "./components/SetPicker";
import SortControl from "./components/SortControl";
import TaskPanel from "./components/TaskPanel";
import { api } from "./lib/api";
import { seriesColor } from "./lib/colors";
import { formatSize, sortSubjects, type SubjectSort } from "./lib/size";
import { useData } from "./lib/useData";
import { useSelection } from "./lib/useSelection";

type Tab = "chart" | "scores" | "tasks";

const TABS: { id: Tab; label: string }[] = [
  { id: "chart", label: "Chart" },
  { id: "scores", label: "Scores" },
  { id: "tasks", label: "Tasks" },
];

const tabFromHash = (): Tab => {
  const hash = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === hash) ? hash : "chart";
};

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [admin, setAdmin] = useState(false);
  const [sort, setSort] = useState<SubjectSort>("manual");
  const [setId, setSetId] = useState<number | null>(null);
  const data = useData();
  const subjectFilter = useSelection();
  const taskFilter = useSelection();

  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    api
      .session()
      .then((s) => setAdmin(s.admin))
      .catch(() => setAdmin(false));
  }, []);

  // An unset or stale id falls back to the first set, so the picker always has a value.
  const activeSet = data.taskSets.find((s) => s.id === setId) ?? data.taskSets[0];
  const tasks = data.tasks.filter((t) => t.set_id === activeSet?.id);

  // Colour follows the entity, not its rank, so sorting never repaints a series.
  const subjectColor = (id: number) => seriesColor(data.subjects.findIndex((s) => s.id === id));
  const taskColor = (id: number) => seriesColor(tasks.findIndex((t) => t.id === id));
  const subjectOf = (id: number) => data.subjects.find((s) => s.id === id);

  const orderedSubjects = sortSubjects(data.subjects, sort);
  const shownSubjects = orderedSubjects.filter((s) => subjectFilter.isShown(s.id));
  const shownTasks = tasks.filter((t) => taskFilter.isShown(t.id));
  const anyReference = data.subjects.some((s) => s.reference);

  return (
    <div className="app">
      <header className="topbar">
        <h1>Afro Sites</h1>
        <nav className="tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                location.hash = id;
                setTab(id);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <SetPicker sets={data.taskSets} value={activeSet?.id} onChange={setSetId} />
        <span className="spacer" />
        <Login admin={admin} onChange={setAdmin} />
      </header>

      <main>
        {data.error && <p className="error">{data.error}</p>}

        {data.loading && (
          <div className="card">
            <div className="empty">loading…</div>
          </div>
        )}

        {!data.loading && tab === "chart" && (
          <>
            <div className="card filters">
              <div className="card-head">
                <h2>Filters</h2>
                {anyReference && (
                  <span className="muted filter-key">
                    <span className="swatch ref" /> reference
                  </span>
                )}
              </div>
              <FilterRow
                title="Subjects"
                items={orderedSubjects}
                isShown={subjectFilter.isShown}
                onToggle={subjectFilter.toggle}
                onShowAll={subjectFilter.showAll}
                onHideAll={() => subjectFilter.hideAll(data.subjects.map((s) => s.id))}
                colorOf={subjectColor}
                isReference={(id) => subjectOf(id)?.reference ?? false}
                metaOf={(id) => formatSize(subjectOf(id)?.size)}
                extra={<SortControl value={sort} onChange={setSort} />}
              />
              <FilterRow
                title="Tasks"
                note={activeSet?.name}
                items={tasks}
                isShown={taskFilter.isShown}
                onToggle={taskFilter.toggle}
                onShowAll={taskFilter.showAll}
                onHideAll={() => taskFilter.hideAll(tasks.map((t) => t.id))}
                colorOf={taskColor}
              />
            </div>
            <ScoreChart
              subjects={shownSubjects}
              tasks={shownTasks}
              cell={data.cell}
              subjectColor={subjectColor}
              taskColor={taskColor}
              isReference={(id) => subjectOf(id)?.reference ?? false}
            />
          </>
        )}

        {!data.loading && tab === "scores" && (
          <>
            <SortControl value={sort} onChange={setSort} standalone />
            <ScoreTables
              data={data}
              subjects={orderedSubjects}
              tasks={tasks}
              admin={admin}
              manual={sort === "manual"}
            />
          </>
        )}

        {!data.loading && tab === "tasks" && (
          <TaskPanel
            data={data}
            tasks={tasks}
            taskSet={activeSet}
            admin={admin}
            onSelectSet={setSetId}
          />
        )}
      </main>
    </div>
  );
}
