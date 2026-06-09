import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-slate-900 text-slate-400 py-10 mt-16">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center text-white font-bold text-sm">H</div>
          <span className="text-white font-semibold">Hostería Familiar</span>
        </div>
        <p className="text-sm">© {new Date().getFullYear()} Hostería Familiar. {t('footer.derechos')}.</p>
      </div>
    </footer>
  );
}
