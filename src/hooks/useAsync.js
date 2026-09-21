import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Run an async function on mount (and when deps change), tracking
 * { data, error, loading } and exposing a manual reload().
 */
export default function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate });
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current(...args);
      if (mounted.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (mounted.current) setState({ data: null, error, loading: false });
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (immediate) run().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}
