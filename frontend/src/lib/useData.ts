import { useCallback, useEffect, useState } from "react";
import { api, type Score, type Subject, type Task } from "./api";

export type Data = {
  subjects: Subject[];
  tasks: Task[];
  cell: (subjectId: number, taskId: number) => Score | undefined;
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

export function useData(): Data {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, t, v] = await Promise.all([api.subjects(), api.tasks(), api.scores()]);
      setSubjects(s);
      setTasks(t);
      setScores(v);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const byCell = new Map(scores.map((s) => [`${s.subject_id}:${s.task_id}`, s]));

  return {
    subjects,
    tasks,
    cell: (subjectId, taskId) => byCell.get(`${subjectId}:${taskId}`),
    reload,
    loading,
    error,
  };
}
