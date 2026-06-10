import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTenant } from '../context/TenantContext';

const LANGS = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'pt', label: 'PT' },
  { code: 'zh', label: '中' },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { config } = useTenant();
  const nombre = config.nombre_hosteria || 'Hostería';
  const inicial = nombre[0].toUpperCase();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: '/', label: t('nav.inicio') },
    { to: '/reservar', label: t('nav.reservar') },
    { to: '/mi-reserva', label: t('nav.mi_reserva') },
  ];

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold">{inicial}</div>
          <span className="font-bold text-slate-800 text-lg">{nombre}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <Link key={l.to} to={l.to}
              className={`text-sm font-medium transition-colors ${location.pathname === l.to ? 'text-amber-600' : 'text-slate-600 hover:text-amber-600'}`}>
              {l.label}
            </Link>
          ))}
          <Link to="/reservar" className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {t('nav.reservar')}
          </Link>
        </div>

        {/* Language selector */}
        <div className="hidden md:flex items-center gap-1">
          {LANGS.map(lang => (
            <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}
              className={`text-xs px-2 py-1 rounded transition-colors ${i18n.language === lang.code ? 'bg-amber-100 text-amber-700 font-bold' : 'text-slate-500 hover:text-slate-700'}`}>
              {lang.label}
            </button>
          ))}
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden text-slate-600" onClick={() => setOpen(!open)}>
          {open ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-3">
          {links.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
              className={`block text-sm font-medium py-2 ${location.pathname === l.to ? 'text-amber-600' : 'text-slate-700'}`}>
              {l.label}
            </Link>
          ))}
          <div className="flex gap-1 pt-2 border-t border-slate-100">
            {LANGS.map(lang => (
              <button key={lang.code} onClick={() => { i18n.changeLanguage(lang.code); setOpen(false); }}
                className={`text-xs px-2 py-1 rounded ${i18n.language === lang.code ? 'bg-amber-100 text-amber-700 font-bold' : 'text-slate-500'}`}>
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
