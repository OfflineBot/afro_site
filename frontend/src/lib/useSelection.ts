import { useCallback, useState } from "react";

// Tracks what is hidden rather than what is shown, so entities added later are
// visible without re-syncing the filter.
export function useSelection() {
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());

  const toggle = useCallback((id: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const showAll = useCallback(() => setExcluded(new Set()), []);
  const hideAll = useCallback((ids: number[]) => setExcluded(new Set(ids)), []);

  return { isShown: (id: number) => !excluded.has(id), toggle, showAll, hideAll };
}
