import { useEffect, useState } from "react";
import ArchivePanel from "./components/ArchivePanel";
import FilterMenu from "./components/FilterMenu";
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

type Tab = "chart" | "scores" | "tasks" | "archive";

const TABS: { id: Tab; label: string; adminOnly?: boolean }[] = [
  { id: "chart", label: "Chart" },
  { id: "scores", label: "Scores" },
  { id: "tasks", label: "Tasks" },
  { id: "archive", label: "Archive", adminOnly: true },
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

  // An unset or stale id falls back to the default set, so the picker always has a value.
  const defaultSet = data.taskSets.find((s) => s.default) ?? data.taskSets[0];
  const activeSet = data.taskSets.find((s) => s.id === setId) ?? defaultSet;
  const tasks = data.tasks.filter((t) => t.set_id === activeSet?.id);
  // A set is a whole generation of the benchmark: its own tasks and its own subjects.
  const setSubjects = data.subjects.filter((s) => s.set_id === activeSet?.id);
  const unassigned = data.subjects.filter((s) => s.set_id === null);

  // Colour follows the entity, not its rank, so sorting never repaints a series.
  const subjectColor = (id: number) => seriesColor(setSubjects.findIndex((s) => s.id === id));
  const taskColor = (id: number) => seriesColor(tasks.findIndex((t) => t.id === id));
  const subjectOf = (id: number) => data.subjects.find((s) => s.id === id);
  const anyReference = setSubjects.some((s) => s.reference);

  const orderedSubjects = sortSubjects(setSubjects, sort);
  const shownSubjects = orderedSubjects.filter((s) => subjectFilter.isShown(s.id));
  const shownTasks = tasks.filter((t) => taskFilter.isShown(t.id));
  const archivedCount = data.archivedSubjects.length + data.archivedTasks.length;
  // A visitor landing on #archive has no such tab, so fall back to the board.
  const activeTab: Tab = tab === "archive" && !admin ? "chart" : tab;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Afro Sites</h1>
        <nav className="tabs" role="tablist">
          {TABS.filter((t) => admin || !t.adminOnly).map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => {
                location.hash = id;
                setTab(id);
              }}
            >
              {label}
              {id === "archive" && archivedCount > 0 && (
                <span className="tab-count">{archivedCount}</span>
              )}
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

        {!data.loading && activeTab === "chart" && (
          <ScoreChart
            subjects={shownSubjects}
            tasks={shownTasks}
            cell={data.cell}
            subjectColor={subjectColor}
            taskColor={taskColor}
            isReference={(id) => subjectOf(id)?.reference ?? false}
            filters={
              <>
                <FilterMenu
                  label="Models"
                  items={orderedSubjects}
                  isShown={subjectFilter.isShown}
                  onToggle={subjectFilter.toggle}
                  onShowAll={subjectFilter.showAll}
                  onHideAll={() => subjectFilter.hideAll(setSubjects.map((s) => s.id))}
                  colorOf={subjectColor}
                  isReference={(id) => subjectOf(id)?.reference ?? false}
                  metaOf={(id) => formatSize(subjectOf(id)?.size)}
                  note={anyReference ? "▨ reference" : undefined}
                  extra={<SortControl value={sort} onChange={setSort} />}
                />
                <FilterMenu
                  label="Tasks"
                  items={tasks}
                  isShown={taskFilter.isShown}
                  onToggle={taskFilter.toggle}
                  onShowAll={taskFilter.showAll}
                  onHideAll={() => taskFilter.hideAll(tasks.map((t) => t.id))}
                  colorOf={taskColor}
                  note={activeSet?.name}
                />
              </>
            }
          />
        )}

        {!data.loading && activeTab === "scores" && (
          <>
            <SortControl value={sort} onChange={setSort} standalone />
            <ScoreTables
              data={data}
              subjects={orderedSubjects}
              unassigned={unassigned}
              tasks={tasks}
              activeSet={activeSet}
              admin={admin}
              manual={sort === "manual"}
            />
          </>
        )}

        {!data.loading && activeTab === "archive" && <ArchivePanel data={data} />}

        {!data.loading && activeTab === "tasks" && (
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
