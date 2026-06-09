// Descuentos hardcodeados como fallback mientras carga la config
export const DESCUENTOS_DEFAULT = [
  { desde: 7, pct: 15, label: 'Semana completa' },
  { desde: 4, pct: 10, label: 'Estadía larga' },
  { desde: 2, pct:  5, label: 'Varios días' },
];

// descuentos debe estar ordenado de mayor a menor (desde DESC) para que find() devuelva el mayor aplicable
export function descuentoPara(noches, descuentos = DESCUENTOS_DEFAULT) {
  const ordenados = [...descuentos].sort((a, b) => b.desde - a.desde);
  return ordenados.find(d => noches >= d.desde) || null;
}

export function precioConDescuento(precioNoche, noches, descuentos = DESCUENTOS_DEFAULT) {
  const d = descuentoPara(noches, descuentos);
  const precio = d
    ? Math.round(precioNoche * (1 - d.pct / 100) * 100) / 100
    : precioNoche;
  return { precio, descuento: d };
}
