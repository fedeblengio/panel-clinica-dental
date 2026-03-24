import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Shield, Clock, Wifi, CalendarDays, Users, MessageSquare, Sparkles } from 'lucide-react';

/* ─── Particle Canvas ─── */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef([]);
  const animFrameRef = useRef(null);

  const initParticles = useCallback((width, height) => {
    const count = Math.min(80, Math.floor((width * height) / 12000));
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h;

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      particlesRef.current = initParticles(canvas.offsetWidth, canvas.offsetHeight);
    };

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      const cw = canvas.offsetWidth;
      const ch = canvas.offsetHeight;
      ctx.clearRect(0, 0, cw, ch);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;
      const connectionDist = 120;
      const mouseDist = 150;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.pulse += 0.015;
        const pulseOpacity = p.opacity + Math.sin(p.pulse) * 0.15;

        // Mouse repulsion
        const dxm = p.x - mouse.x;
        const dym = p.y - mouse.y;
        const distMouse = Math.sqrt(dxm * dxm + dym * dym);
        if (distMouse < mouseDist) {
          const force = (mouseDist - distMouse) / mouseDist * 0.02;
          p.vx += dxm * force;
          p.vy += dym * force;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < -10) p.x = cw + 10;
        if (p.x > cw + 10) p.x = -10;
        if (p.y < -10) p.y = ch + 10;
        if (p.y > ch + 10) p.y = -10;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${pulseOpacity})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${pulseOpacity * 0.15})`;
        ctx.fill();

        // Connections
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const lineOpacity = (1 - dist / connectionDist) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'auto' }}
    />
  );
}

/* ─── Floating Orbs (CSS-only ambient light) ─── */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-orb login-orb-4" />
    </div>
  );
}

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

  const isBlocked = blockedFor > 0;

  return (
    <div className="min-h-screen flex dark relative overflow-hidden">
      {/* Global animated background */}
      <div className="absolute inset-0 bg-[hsl(210,25%,5%)]">
        <div className="login-gradient-bg" />
        <FloatingOrbs />
        <ParticleCanvas />
      </div>

      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative z-10">
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
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
              transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
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
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/15 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/30 transition-all duration-300">
                    <Icon size={18} className="text-cyan-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className="text-white/90 text-sm font-medium">{text}</span>
                    <p className="text-white/40 text-xs">{desc}</p>
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
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center relative z-10 px-4 sm:px-8">
        {/* Glassmorphism card */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <div className="login-glass-card rounded-2xl p-8 sm:p-10">
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
                <Sparkles size={18} className="text-cyan-400" />
                <span className="text-cyan-400 text-xs font-medium uppercase tracking-wider">Panel de Administración</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Bienvenido de vuelta</h1>
              <p className="text-neutral-500 mt-1 text-sm">Ingresá tus credenciales para continuar</p>
            </div>

            <motion.form
              onSubmit={handleSubmit}
              className="space-y-5"
              animate={error ? { x: [0, -8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.4 }}
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
                <Input
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresá tu contraseña"
                  required
                  disabled={isBlocked}
                  className="bg-white/5 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-cyan-500/40 focus-visible:border-cyan-500/40 rounded-xl h-12"
                  labelClassName="text-neutral-400 text-xs uppercase tracking-wider"
                />
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
            </motion.form>
          </div>

          <p className="text-center text-xs text-white/20 mt-6 lg:hidden">
            &copy; {new Date().getFullYear()} DentalPanel
          </p>
        </motion.div>
      </div>
    </div>
  );
}
