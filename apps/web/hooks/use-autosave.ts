'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * Ch.12 §85: every form supports autosave + dirty-state. Debounces on
 * react-hook-form's own `watch`, so this works with any form already
 * built on shadcn's `<Form>` wrapper without changing how fields are
 * registered.
 */
export function useAutosave<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  onSave: (values: TFieldValues) => Promise<void>,
  { delayMs = 1500 }: { delayMs?: number } = {},
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!form.formState.isDirty) return;
      setStatus('dirty');

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setStatus('saving');
        onSave(values as TFieldValues)
          .then(() => setStatus('saved'))
          .catch(() => setStatus('error'));
      }, delayMs);
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `form` is a stable react-hook-form ref; `onSave`/`delayMs` intentionally not retriggering the subscription
  }, [form]);

  return status;
}
