import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Clock, Wifi, CalendarDays, Users, MessageSquare, Sparkles, Eye, EyeOff, ArrowLeft, KeyRound } from 'lucide-react';

/* ─── Dental Logo ─── */
function DentalLogo({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C9.5 2 7.5 3.5 6.5 5C5.5 6.5 5 8 5 10C5 12 5.5 13.5 6 15C6.5 16.5 7 18 7.5 19.5C8 21 8.5 22 9.5 22C10.5 22 11 21 11.5 19.5C12 18 12 18 12 18C12 18 12 18 12.5 19.5C13 21 13.5 22 14.5 22C15.5 22 16 21 16.5 19.5C17 18 17.5 16.5 18 15C18.5 13.5 19 12 19 10C19 8 18.5 6.5 17.5 5C16.5 3.5 14.5 2 12 2Z" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}

/* ─── Features ─── */
const features = [
  { icon: CalendarDays, text: 'Gestión de citas inteligente', desc: 'Agenda automatizada con IA' },
  { icon: Users, text: 'Historial completo de pacientes', desc: 'Fichas clínicas digitales' },
  { icon: MessageSquare, text: 'Bot WhatsApp con IA integrada', desc: 'Atención 24/7 automática' },
  { icon: Clock, text: 'Recordatorios automáticos', desc: 'Reduce ausencias un 70%' },
  { icon: Wifi, text: 'Todo en la nube', desc: 'Accedé desde cualquier lugar' },
];

/* ─── Main Login Component ─── */
export function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedFor, setBlockedFor] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'code' | 'newpass'
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [codeSending, setCodeSending] = useState(false);

  useEffect(() => {
    if (blockedFor <= 0) return;
    const timer = setInterval(() => {
      setBlockedFor(prev => {
        if (prev <= 1) { setError(''); return 0; }
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
        if (data.blockedFor) setBlockedFor(data.blockedFor);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (codeSending) return;
    setCodeSending(true);
    setError('');
    try {
      const res = await fetch('/api/forgot-password/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.ok) {
        setMaskedPhone(data.phone);
        setMode('code');
      } else {
        setError(data.error || 'Error al enviar código');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setCodeSending(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code: resetCode, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        setMode('newpass');
      } else {
        setError(data.error || 'Error al verificar código');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const goToForgot = () => {
    setMode('forgot');
    setError('');
    setResetCode('');
    setNewPassword('');
    setShowNewPassword(false);
    setMaskedPhone('');
  };

  const goToLogin = () => {
    setMode('login');
    setError('');
    setPassword('');
    setShowPassword(false);
  };

  const isBlocked = blockedFor > 0;

  return (
    <div className="min-h-screen flex dark relative overflow-hidden">
      {/* Global animated background - same across both halves */}
      <div className="absolute inset-0 bg-[hsl(210,25%,5%)]">
        <div className="login-gradient-bg" />
      </div>

      {/* Two-panel layout with gap */}
      <div className="relative z-10 flex flex-col lg:flex-row w-full min-h-screen p-4 lg:p-6 gap-4 lg:gap-6">

        {/* LEFT CARD - Branding (hidden on mobile) */}
        <motion.div
          className="hidden lg:flex lg:w-[38%] xl:w-[35%] login-glass-card rounded-2xl overflow-hidden"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col justify-between p-10 xl:p-14 w-full">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                  <DentalLogo size={28} className="text-cyan-400" />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">DentalPanel</span>
              </div>
              <p className="text-cyan-300/70 text-sm ml-1 font-light">
                Gestión inteligente para tu clínica
              </p>
            </motion.div>

            {/* Hero text */}
            <div className="space-y-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
              >
                <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                  Tu clínica,<br />
                  <span className="login-gradient-text">bajo control.</span>
                </h2>
                <p className="text-white/60 mt-4 text-lg max-w-md leading-relaxed">
                  Automatizá la gestión de pacientes, citas y comunicación con WhatsApp. Todo desde un solo lugar.
                </p>
              </motion.div>

              {/* Features */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.6 }}
              >
                {features.map(({ icon: Icon, text, desc }, i) => (
                  <motion.div
                    key={text}
                    className="flex items-center gap-4 group"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.1, duration: 0.5, ease: 'easeOut' }}
                  >
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/30 transition-all duration-300">
                      <Icon size={20} className="text-cyan-400" strokeWidth={1.5} />
                    </div>
                    <div>
                      <span className="text-white/90 text-base font-medium">{text}</span>
                      <p className="text-white/40 text-sm">{desc}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Footer */}
            <motion.div
              className="flex items-center gap-2 text-white/30 text-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
            >
              <Shield size={12} />
              <span>&copy; {new Date().getFullYear()} DentalPanel. Todos los derechos reservados.</span>
            </motion.div>
          </div>
        </motion.div>

        {/* RIGHT CARD - Login form */}
        <motion.div
          className="flex-1 lg:w-1/2 login-glass-card rounded-2xl flex items-center justify-center px-4 sm:px-8"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          <motion.div
            className="w-full max-w-sm py-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {/* Mobile logo */}
            <div className="flex flex-col items-center mb-8 lg:hidden">
              <motion.div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <DentalLogo size={34} className="text-white" />
              </motion.div>
              <h1 className="text-2xl font-bold tracking-tight text-white">DentalPanel</h1>
              <p className="text-neutral-400 text-sm mt-1">Gestión inteligente para tu clínica</p>
            </div>

            {/* Desktop heading */}
            <div className="hidden lg:block text-left mb-8">
              <div className="flex items-center gap-2 mb-1">
                {mode === 'login' ? (
                  <Sparkles size={18} className="text-cyan-400" />
                ) : (
                  <KeyRound size={18} className="text-cyan-400" />
                )}
                <span className="text-cyan-400 text-xs font-medium uppercase tracking-wider">
                  {mode === 'login' ? 'Panel de Administración' : 'Recuperar Contraseña'}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {mode === 'login' ? 'Bienvenido de vuelta' : mode === 'forgot' ? 'Recuperar contraseña' : mode === 'code' ? 'Verificar código' : 'Contraseña actualizada'}
              </h1>
              <p className="text-neutral-500 mt-1 text-sm">
                {mode === 'login' ? 'Ingresá tus credenciales para continuar' : mode === 'forgot' ? 'Ingresá tu usuario para recibir un código' : mode === 'code' ? 'Ingresá el código que recibiste por WhatsApp' : 'Ya podés iniciar sesión'}
              </p>
            </div>

            {/* Mobile heading for forgot password */}
            {mode !== 'login' && (
              <div className="lg:hidden text-center mb-6">
                <KeyRound size={24} className="text-cyan-400 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-white">
                  {mode === 'forgot' ? 'Recuperar contraseña' : mode === 'code' ? 'Verificar código' : 'Listo'}
                </h2>
              </div>
            )}

            <AnimatePresence mode="wait">
              {mode === 'login' ? (
                <motion.form
                  key="login"
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <div className={`border rounded-xl px-4 py-3 text-sm backdrop-blur-sm ${
                          isBlocked
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
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

                  <div className="space-y-4">
                    <Input
                      label="Usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ingresá tu usuario"
                      required
                      autoFocus
                      disabled={isBlocked}
                      className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40 rounded-xl h-12"
                      labelClassName="text-neutral-400 text-xs uppercase tracking-wider"
                    />
                    <div className="space-y-2">
                      <label className="text-neutral-400 text-xs uppercase tracking-wider text-sm font-medium">Contraseña</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Ingresá tu contraseña"
                          required
                          disabled={isBlocked}
                          className="flex h-12 w-full rounded-xl border px-4 pr-12 text-base transition-colors file:border-0 file:bg-transparent placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white/5 border-white/10 text-white focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      className="w-full login-btn-glow bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white border-0 rounded-xl h-12 font-semibold text-base shadow-lg shadow-cyan-500/20"
                      size="lg"
                      disabled={loading || isBlocked}
                    >
                      {isBlocked ? `Bloqueado (${blockedFor}s)` : loading ? 'Ingresando...' : 'Iniciar sesión'}
                    </Button>
                  </motion.div>

                  <button
                    type="button"
                    onClick={goToForgot}
                    className="w-full text-center text-sm text-cyan-400/60 hover:text-cyan-400 transition-colors mt-2"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </motion.form>
              ) : mode === 'forgot' ? (
                <motion.form
                  key="forgot"
                  onSubmit={handleSendCode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl px-4 py-3 text-sm">{error}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <p className="text-neutral-400 text-sm">
                    Ingresá tu usuario y te enviaremos un código de verificación a tu WhatsApp registrado.
                  </p>

                  <Input
                    label="Usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresá tu usuario"
                    required
                    autoFocus
                    className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40 rounded-xl h-12"
                    labelClassName="text-neutral-400 text-xs uppercase tracking-wider"
                  />

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white border-0 rounded-xl h-12 font-semibold text-base"
                    disabled={codeSending}
                  >
                    {codeSending ? 'Enviando código...' : 'Enviar código por WhatsApp'}
                  </Button>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full flex items-center justify-center gap-2 text-sm text-cyan-400/60 hover:text-cyan-400 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Volver al inicio de sesión
                  </button>
                </motion.form>
              ) : mode === 'code' ? (
                <motion.form
                  key="code"
                  onSubmit={handleVerifyCode}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl px-4 py-3 text-sm">{error}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-xl px-4 py-3 text-sm">
                    Enviamos un código de 6 dígitos al WhatsApp terminado en <strong>{maskedPhone}</strong>. Válido por 10 minutos.
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Código de verificación"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="123456"
                      required
                      autoFocus
                      maxLength={6}
                      className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40 rounded-xl h-12 text-center text-2xl tracking-[0.5em] font-mono"
                      labelClassName="text-neutral-400 text-xs uppercase tracking-wider"
                    />
                    <div className="space-y-2">
                      <label className="text-neutral-400 text-xs uppercase tracking-wider text-sm font-medium">Nueva contraseña</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Ingresá tu nueva contraseña"
                          required
                          minLength={4}
                          className="flex h-12 w-full rounded-xl border px-4 pr-12 text-base transition-colors placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 bg-white/5 border-white/10 text-white focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white border-0 rounded-xl h-12 font-semibold text-base"
                    disabled={loading || resetCode.length !== 6}
                  >
                    {loading ? 'Verificando...' : 'Verificar y cambiar contraseña'}
                  </Button>

                  <button
                    type="button"
                    onClick={goToForgot}
                    className="w-full flex items-center justify-center gap-2 text-sm text-cyan-400/60 hover:text-cyan-400 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Reenviar código
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm">
                    Contraseña cambiada correctamente. Ya podés iniciar sesión con tu nueva contraseña.
                  </div>
                  <Button
                    onClick={goToLogin}
                    className="w-full bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white border-0 rounded-xl h-12 font-semibold text-base"
                  >
                    Iniciar sesión
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-center text-xs text-white/20 mt-8 lg:hidden">
              &copy; {new Date().getFullYear()} DentalPanel
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
