export type Subject = {
  id: number;
  name: string;
  note: string;
  position: number;
  reference: boolean;
  size: number | null;
  archived: boolean;
};
export type Task = {
  id: number;
  name: string;
  position: number;
  archived: boolean;
  set_id: number;
};
export type TaskSet = { id: number; name: string; position: number };
export type Score = {
  subject_id: number;
  task_id: number;
  value: number | null;
  computed: boolean;
};

const TOKEN_KEY = "afro.token";

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (value: string) => localStorage.setItem(TOKEN_KEY, value),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = token.get();
  const res = await fetch("/api" + path, {
    method,
    cache: "no-store",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? res.statusText);
  return data as T;
}

export const api = {
  session: () => request<{ admin: boolean }>("GET", "/session"),
  login: (password: string) => request<{ token: string }>("POST", "/login", { password }),

  subjects: () => request<Subject[]>("GET", "/subjects"),
  createSubject: (name: string, note = "", reference = false, size: number | null = null) =>
    request<Subject>("POST", "/subjects", { name, note, reference, size }),
  updateSubject: (id: number, name: string, note: string, reference: boolean, size: number | null) =>
    request<Subject>("PATCH", `/subjects/${id}`, { name, note, reference, size }),
  archiveSubject: (id: number, archived: boolean) =>
    request<Subject>("PUT", `/subjects/${id}/archived`, { archived }),
  reorderSubjects: (ids: number[]) => request<Subject[]>("PUT", "/subjects/order", { ids }),

  taskSets: () => request<TaskSet[]>("GET", "/tasksets"),
  createTaskSet: (name: string) => request<TaskSet>("POST", "/tasksets", { name }),
  renameTaskSet: (id: number, name: string) =>
    request<TaskSet>("PATCH", `/tasksets/${id}`, { name }),

  tasks: () => request<Task[]>("GET", "/tasks"),
  createTask: (setId: number, name: string) =>
    request<Task>("POST", "/tasks", { name, set_id: setId }),
  updateTask: (id: number, name: string) => request<Task>("PATCH", `/tasks/${id}`, { name }),
  archiveTask: (id: number, archived: boolean) =>
    request<Task>("PUT", `/tasks/${id}/archived`, { archived }),
  reorderTasks: (ids: number[]) => request<Task[]>("PUT", "/tasks/order", { ids }),

  scores: () => request<Score[]>("GET", "/scores"),
  setScore: (score: Score) => request<Score | void>("PUT", "/scores", score),
};
