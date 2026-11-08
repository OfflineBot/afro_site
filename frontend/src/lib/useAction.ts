import { useCallback, useState } from "react";

// Runs a mutation, refreshes the shared data and surfaces the server's message.
export function useAction(reload: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        await reload();
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [reload],
  );

  return { run, error };
}

export function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
