import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../../api";
import { Button } from "../ui/button";

export function useResource<T>(path: string, invalidateOn = "") {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError("");
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision, invalidateOn]);
  return {
    data,
    error,
    loading,
    refresh: useCallback(() => setRevision((v) => v + 1), []),
  };
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export function ResourceState({
  error,
  loading,
  retry,
}: {
  error: string;
  loading: boolean;
  retry: () => void;
}) {
  if (error)
    return (
      <div className="error" role="alert">
        {error}
        <Button variant="ghost" onClick={retry}>
          Réessayer
        </Button>
      </div>
    );
  return loading ? (
    <p className="commercial-status" role="status">
      Chargement…
    </p>
  ) : null;
}

export function useEditing(open: boolean, onEditing: (value: boolean) => void) {
  useEffect(() => {
    onEditing(open);
    return () => onEditing(false);
  }, [open, onEditing]);
}

export function useSubmitLock() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  return {
    busy,
    start: () => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      return true;
    },
    end: () => {
      lock.current = false;
      setBusy(false);
    },
  };
}
