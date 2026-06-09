export default function Tabla({ columnas, datos, acciones, cargando }) {
  if (cargando) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columnas.map(col => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {col.label}
              </th>
            ))}
            {acciones && <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datos.length === 0 ? (
            <tr>
              <td colSpan={columnas.length + (acciones ? 1 : 0)} className="px-4 py-10 text-center text-slate-400">
                No hay datos disponibles
              </td>
            </tr>
          ) : (
            datos.map((row, i) => (
              <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                {columnas.map(col => (
                  <td key={col.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
                {acciones && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">{acciones(row)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
