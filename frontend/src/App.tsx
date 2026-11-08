import { useEffect, useState } from "react";
import Filters from "./components/Filters";
import Login from "./components/Login";
import ScoreChart from "./components/ScoreChart";
import ScoreTables from "./components/ScoreTables";
import TaskPanel from "./components/TaskPanel";
import { api } from "./lib/api";
import { seriesColor } from "./lib/colors";
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

  const subjectColor = (id: number) => seriesColor(data.subjects.findIndex((s) => s.id === id));
  const taskColor = (id: number) => seriesColor(data.tasks.findIndex((t) => t.id === id));

  const shownSubjects = data.subjects.filter((s) => subjectFilter.isShown(s.id));
  const shownTasks = data.tasks.filter((t) => taskFilter.isShown(t.id));

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
            <div className="grid-2">
              <Filters
                title="Subjects"
                items={data.subjects}
                isShown={subjectFilter.isShown}
                onToggle={subjectFilter.toggle}
                onShowAll={subjectFilter.showAll}
                onHideAll={() => subjectFilter.hideAll(data.subjects.map((s) => s.id))}
                colorOf={subjectColor}
              />
              <Filters
                title="Tasks"
                items={data.tasks}
                isShown={taskFilter.isShown}
                onToggle={taskFilter.toggle}
                onShowAll={taskFilter.showAll}
                onHideAll={() => taskFilter.hideAll(data.tasks.map((t) => t.id))}
                colorOf={taskColor}
              />
            </div>
            <ScoreChart
              subjects={shownSubjects}
              tasks={shownTasks}
              cell={data.cell}
              subjectColor={subjectColor}
              taskColor={taskColor}
            />
          </>
        )}

        {!data.loading && tab === "scores" && <ScoreTables data={data} admin={admin} />}

        {!data.loading &&
          tab === "tasks" &&
          (admin ? (
            <TaskPanel data={data} />
          ) : (
            <div className="card">
              <div className="empty">log in to edit</div>
            </div>
          ))}
      </main>
    </div>
  );
}
