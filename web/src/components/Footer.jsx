import { useTranslation } from 'react-i18next';
import { useTenant } from '../context/TenantContext';

export default function Footer() {
  const { t } = useTranslation();
  const { config } = useTenant();
  const nombre = config.nombre_hosteria || 'Hostería';
  return (
    <footer className="bg-slate-900 text-slate-400 py-10 mt-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center text-white font-bold text-sm">
            {nombre[0].toUpperCase()}
          </div>
          <span className="text-white font-semibold">{nombre}</span>
        </div>
        <div className="text-sm text-center md:text-right space-y-1">
          {config.direccion && <div>{config.direccion}</div>}
          {config.telefono && <div>{config.telefono}</div>}
          {config.email && <div>{config.email}</div>}
          <div>© {new Date().getFullYear()} {nombre}. {t('footer.derechos')}.</div>
        </div>
      </div>
    </footer>
  );
}
