import { useCallback, useState } from "react";

import { useToast } from "./toast-context";

type AsyncTask<T> = () => Promise<T>;

export function useCrudActions() {
  const { showError } = useToast();
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const runCreate = useCallback(
    async <T>(
      task: AsyncTask<T>,
      fallbackMessage: string,
    ): Promise<T | undefined> => {
      setCreating(true);
      try {
        return await task();
      } catch (caughtError) {
        showError(toErrorMessage(caughtError, fallbackMessage));
        return undefined;
      } finally {
        setCreating(false);
      }
    },
    [showError],
  );

  const runSave = useCallback(
    async <T>(
      id: string,
      task: AsyncTask<T>,
      fallbackMessage: string,
    ): Promise<T | undefined> => {
      setSavingId(id);
      try {
        return await task();
      } catch (caughtError) {
        showError(toErrorMessage(caughtError, fallbackMessage));
        return undefined;
      } finally {
        setSavingId(null);
      }
    },
    [showError],
  );

  const runDelete = useCallback(
    async <T>(
      task: AsyncTask<T>,
      fallbackMessage: string,
    ): Promise<T | undefined> => {
      setDeleting(true);
      try {
        return await task();
      } catch (caughtError) {
        showError(toErrorMessage(caughtError, fallbackMessage));
        return undefined;
      } finally {
        setDeleting(false);
      }
    },
    [showError],
  );

  return {
    creating,
    savingId,
    deleting,
    runCreate,
    runSave,
    runDelete,
  };
}

function toErrorMessage(caughtError: unknown, fallbackMessage: string) {
  return caughtError instanceof Error ? caughtError.message : fallbackMessage;
}
