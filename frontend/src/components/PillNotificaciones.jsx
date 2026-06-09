import { useNavigate } from 'react-router-dom';
import { useNotificaciones } from '../context/NotificacionesContext';
import { XMarkIcon } from '@heroicons/react/24/outline';

const TIPO_CONFIG = {
  reserva_web:           { bg: 'bg-blue-100 text-blue-800 border-blue-200',    dot: 'bg-blue-500' },
  mantenimiento_urgente: { bg: 'bg-red-100 text-red-800 border-red-200',       dot: 'bg-red-500' },
  checkout_pendiente:    { bg: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  noshow:                { bg: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  otro:                  { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
};

function getConfig(tipo) {
  return TIPO_CONFIG[tipo] ?? TIPO_CONFIG.otro;
}

export default function PillNotificaciones() {
  const { notificaciones, marcarLeida, marcarTodasLeidas } = useNotificaciones();
  const navigate = useNavigate();

  if (!notificaciones || notificaciones.length === 0) return null;

  function handleClick(n) {
    marcarLeida(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {notificaciones.map(n => {
        const cfg = getConfig(n.tipo);
        return (
          <div
            key={n.id}
            className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border text-xs font-medium cursor-pointer hover:brightness-95 transition-all select-none ${cfg.bg}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}
            />
            <span
              className="max-w-[220px] truncate"
              title={n.mensaje || n.titulo}
              onClick={() => handleClick(n)}
            >
              {n.titulo}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); marcarLeida(n.id); }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
              title="Descartar"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      {notificaciones.length > 1 && (
        <button
          onClick={marcarTodasLeidas}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
