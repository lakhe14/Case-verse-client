import { useCallback, useState } from 'react';

/** Minimal controlled-form helper. Validation lives on the server. */
export default function useForm(initial) {
  const [values, setValues] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValues((v) => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const setField = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
  }, []);

  const handleSubmit = (fn) => async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await fn(values);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, setField, onChange, handleSubmit, submitting, error, setError };
}
