export type Subject = {
  id: number;
  name: string;
  note: string;
  position: number;
  reference: boolean;
  size: number | null;
};
export type Task = { id: number; name: string; position: number };
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
  deleteSubject: (id: number) => request<void>("DELETE", `/subjects/${id}`),
  reorderSubjects: (ids: number[]) => request<Subject[]>("PUT", "/subjects/order", { ids }),

  tasks: () => request<Task[]>("GET", "/tasks"),
  createTask: (name: string) => request<Task>("POST", "/tasks", { name }),
  updateTask: (id: number, name: string) => request<Task>("PATCH", `/tasks/${id}`, { name }),
  deleteTask: (id: number) => request<void>("DELETE", `/tasks/${id}`),
  reorderTasks: (ids: number[]) => request<Task[]>("PUT", "/tasks/order", { ids }),

  scores: () => request<Score[]>("GET", "/scores"),
  setScore: (score: Score) => request<Score | void>("PUT", "/scores", score),
};
