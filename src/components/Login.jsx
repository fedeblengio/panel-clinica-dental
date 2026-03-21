import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedFor, setBlockedFor] = useState(0);

  // Countdown timer when blocked
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
        onLogin();
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Clínica Dental</h1>
          <p className="text-muted-foreground mt-2 text-base">Ingresá para continuar</p>
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
      </motion.div>
    </div>
  );
}
