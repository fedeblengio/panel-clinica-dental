import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Clock, Wifi, CalendarDays, Users, MessageSquare } from 'lucide-react';

function DentalLogo({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C9.5 2 7.5 3.5 6.5 5C5.5 6.5 5 8 5 10C5 12 5.5 13.5 6 15C6.5 16.5 7 18 7.5 19.5C8 21 8.5 22 9.5 22C10.5 22 11 21 11.5 19.5C12 18 12 18 12 18C12 18 12 18 12.5 19.5C13 21 13.5 22 14.5 22C15.5 22 16 21 16.5 19.5C17 18 17.5 16.5 18 15C18.5 13.5 19 12 19 10C19 8 18.5 6.5 17.5 5C16.5 3.5 14.5 2 12 2Z" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}

const features = [
  { icon: CalendarDays, text: 'Gestión de citas inteligente' },
  { icon: Users, text: 'Historial completo de pacientes' },
  { icon: MessageSquare, text: 'Bot WhatsApp con IA integrada' },
  { icon: Clock, text: 'Recordatorios automáticos' },
  { icon: Wifi, text: 'Todo en la nube, accedé desde cualquier lugar' },
];

export function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedFor, setBlockedFor] = useState(0);

  useEffect(() => {
    if (blockedFor <= 0) return;
    const timer = setInterval(() => {
      setBlockedFor(prev => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [blockedFor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (blockedFor > 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.ok) {
        const sessionRes = await fetch('/api/session');
        const sessionData = await sessionRes.json();
        onLogin(sessionData);
      } else {
        setError(data.error || 'Credenciales incorrectas');
        if (data.blockedFor) {
          setBlockedFor(data.blockedFor);
        }
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const isBlocked = blockedFor > 0;

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-900" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(6,182,212,0.25)_0%,transparent_60%)]" />

        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-10 w-48 h-48 bg-white/5 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div>
            <motion.div
              className="flex items-center gap-3 mb-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <DentalLogo size={28} className="text-white" />
              </div>
              <span className="text-2xl font-bold text-white">DentalPanel</span>
            </motion.div>
            <motion.p
              className="text-cyan-300/80 text-sm ml-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Gestión inteligente para tu clínica
            </motion.p>
          </div>

          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Tu clínica,<br />
                <span className="text-cyan-400">bajo control.</span>
              </h2>
              <p className="text-white/80 mt-4 text-lg max-w-md">
                Automatizá la gestión de pacientes, citas y comunicación con WhatsApp. Todo desde un solo lugar.
              </p>
            </motion.div>

            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              {features.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={text}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/20 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-cyan-300" strokeWidth={1.8} />
                  </div>
                  <span className="text-white/90 text-sm">{text}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <motion.p
            className="text-white/50 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            &copy; {new Date().getFullYear()} DentalPanel. Todos los derechos reservados.
          </motion.p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 px-4 sm:px-8">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-sky-500/25">
              <DentalLogo size={30} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">DentalPanel</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestión inteligente para tu clínica</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block text-left mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Bienvenido</h1>
            <p className="text-muted-foreground mt-1">Ingresá tus credenciales para continuar</p>
          </div>

          <motion.form
            key={error}
            onSubmit={handleSubmit}
            className="space-y-5"
            animate={error ? { x: [0, -10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
          >
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`border rounded-lg px-4 py-3 text-sm ${
                    isBlocked
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
                  }`}>
                    {error}
                    {isBlocked && (
                      <div className="mt-2 font-semibold tabular-nums">
                        Esperá {blockedFor}s para intentar de nuevo
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Input
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresá tu usuario"
              required
              autoFocus
              disabled={isBlocked}
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresá tu contraseña"
              required
              disabled={isBlocked}
            />
            <Button type="submit" className="w-full" size="lg" disabled={loading || isBlocked}>
              {isBlocked ? `Bloqueado (${blockedFor}s)` : loading ? 'Ingresando...' : 'Iniciar sesión'}
            </Button>
          </motion.form>

          <p className="text-center text-xs text-muted-foreground mt-8 lg:hidden">
            &copy; {new Date().getFullYear()} DentalPanel
          </p>
        </motion.div>
      </div>
    </div>
  );
}
