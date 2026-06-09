import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './i18n';
import './index.css';
import Inicio from './pages/Inicio';
import Reservar from './pages/Reservar';
import MiReserva from './pages/MiReserva';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/reservar" element={<Reservar />} />
            <Route path="/mi-reserva" element={<MiReserva />} />
          </Routes>
        </main>
        <Footer />
      </div>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}
