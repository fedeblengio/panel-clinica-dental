import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Pacientes } from './components/Pacientes';
import { Citas } from './components/Citas';

export default function App() {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => setAuth(d.authenticated))
      .catch(() => setAuth(false));
  }, []);

  if (auth === null) return null;

  if (!auth) {
    return (
      <BrowserRouter>
        <Login onLogin={() => setAuth(true)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Layout onLogout={() => setAuth(false)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/citas" element={<Citas />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
