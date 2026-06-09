import { useEffect, useRef } from 'react';

/**
 * Llama a `fn` inmediatamente y luego cada `intervalo` ms.
 * También refresca cuando la ventana recupera el foco o se hace visible.
 */
export function useAutoRefresh(fn, intervalo = 60000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    fnRef.current();

    const timer = setInterval(() => fnRef.current(), intervalo);

    function onVisible() {
      if (document.visibilityState === 'visible') fnRef.current();
    }
    function onFocus() { fnRef.current(); }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalo]);
}
