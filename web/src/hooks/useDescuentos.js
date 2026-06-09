import { useState, useEffect } from 'react';
import api from '../api/axios';
import { DESCUENTOS_DEFAULT } from '../utils/descuentos';

let cache = null; // cache en módulo para no re-fetcher entre componentes

export function useDescuentos() {
  const [descuentos, setDescuentos] = useState(cache || DESCUENTOS_DEFAULT);

  useEffect(() => {
    if (cache) return;
    api.get('/api/web/config').then(r => {
      const raw = r.data.descuentos_noches;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          cache = parsed;
          setDescuentos(parsed);
        } catch {}
      }
    }).catch(() => {});
  }, []);

  return descuentos;
}
