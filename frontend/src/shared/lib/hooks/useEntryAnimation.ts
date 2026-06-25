import { useEffect, useState } from 'react';

/** Entry animations play once per screen mount, then turn off (e.g. on pull-to-refresh). */
export function useEntryAnimation(durationMs = 1000) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setEnabled(false), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs]);

  return enabled;
}
