import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Pacientes } from './components/Pacientes';
import { Citas } from './components/Citas';
import { Conversaciones } from './components/Conversaciones';
import { Escalaciones } from './components/Escalaciones';
import { Configuracion } from './components/Configuracion';
import { Ayuda } from './components/Ayuda';
import { MiCuenta } from './components/MiCuenta';
import { SuperAdmin } from './components/SuperAdmin';
import { setClinicaId } from './lib/utils';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => {
        setAuth(d.authenticated);
        if (d.authenticated) {
          setUser(d);
          if (d.clinicaId) setClinicaId(d.clinicaId);
          else if (d.clinicaActiva) setClinicaId(d.clinicaActiva);
        }
      })
      .catch(() => setAuth(false));
  }, []);

  if (auth === null) return null;

  if (!auth) {
    return (
      <BrowserRouter>
        <Login onLogin={(userData) => {
          setAuth(true);
          setUser(userData);
          if (userData.clinicaId) setClinicaId(userData.clinicaId);
          else if (userData.clinicaActiva) setClinicaId(userData.clinicaActiva);
        }} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Layout onLogout={() => { setAuth(false); setUser(null); setClinicaId(null); }} user={user}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/citas" element={<Citas />} />
          <Route path="/conversaciones" element={<Conversaciones />} />
          <Route path="/escalaciones" element={<Escalaciones />} />
          <Route path="/mi-cuenta" element={<MiCuenta />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/ayuda" element={<Ayuda />} />
          {user?.rol === 'superadmin' && (
            <Route path="/admin" element={<SuperAdmin />} />
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
