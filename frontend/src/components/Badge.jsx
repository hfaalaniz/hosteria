const COLORS = {
  disponible: 'bg-green-100 text-green-800',
  ocupada: 'bg-red-100 text-red-800',
  limpieza: 'bg-yellow-100 text-yellow-800',
  mantenimiento: 'bg-orange-100 text-orange-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmada: 'bg-blue-100 text-blue-800',
  checkin: 'bg-green-100 text-green-800',
  checkout: 'bg-slate-100 text-slate-700',
  cancelada: 'bg-red-100 text-red-800',
  noshow: 'bg-gray-100 text-gray-600',
  pagada: 'bg-green-100 text-green-800',
  anulada: 'bg-red-100 text-red-800',
  alta: 'bg-red-100 text-red-800',
  media: 'bg-yellow-100 text-yellow-800',
  baja: 'bg-slate-100 text-slate-600',
  resuelto: 'bg-green-100 text-green-800',
  en_proceso: 'bg-blue-100 text-blue-800',
};

export default function Badge({ value, label }) {
  const color = COLORS[value] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label || value}
    </span>
  );
}
