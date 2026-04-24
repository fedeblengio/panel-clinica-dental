import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, CalendarDays, MessageSquare, Settings, HelpCircle, LogOut, Sun, Moon, Menu, X, Shield, Activity, User, AlertTriangle } from 'lucide-react';
import { useTheme } from '../lib/useTheme';
import { NotificacionesBell } from './Notificaciones';

const sidebarSpring = { type: 'spring', stiffness: 300, damping: 30 };

// Tooth/dental SVG icon for branding
function DentalLogo({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C9.5 2 7.5 3.5 6.5 5C5.5 6.5 5 8 5 10C5 12 5.5 13.5 6 15C6.5 16.5 7 18 7.5 19.5C8 21 8.5 22 9.5 22C10.5 22 11 21 11.5 19.5C12 18 12 18 12 18C12 18 12 18 12.5 19.5C13 21 13.5 22 14.5 22C15.5 22 16 21 16.5 19.5C17 18 17.5 16.5 18 15C18.5 13.5 19 12 19 10C19 8 18.5 6.5 17.5 5C16.5 3.5 14.5 2 12 2Z" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}

export function Layout({ children, onLogout, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Inicio' },
    { to: '/pacientes', icon: Users, label: 'Pacientes' },
    { to: '/citas', icon: CalendarDays, label: 'Citas' },
    { to: '/conversaciones', icon: MessageSquare, label: 'Conversaciones' },
    { to: '/escalaciones', icon: AlertTriangle, label: 'Escalaciones' },
    { to: '/mi-cuenta', icon: User, label: 'Mi Cuenta' },
    { to: '/configuracion', icon: Settings, label: 'Configuración' },
    { to: '/ayuda', icon: HelpCircle, label: 'Ayuda' },
    ...(user?.rol === 'superadmin' ? [{ to: '/admin', icon: Shield, label: 'Super Admin' }] : []),
  ];

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    onLogout();
    navigate('/login');
  };

  const clinicName = user?.clinicaNombre || 'Clínica Dental';
  const isSuperadmin = user?.rol === 'superadmin';
  const brandName = 'DentalPanel';
  const sidebarTitle = isSuperadmin ? brandName : clinicName;
  const sidebarSubtitle = isSuperadmin ? 'Gestión clínica' : 'Panel de gestión';

  const mobileContent = (
    <>
      <div>
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
              <DentalLogo size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{sidebarTitle}</h1>
              <p className="text-xs text-muted-foreground">{sidebarSubtitle}</p>
            </div>
          </div>
          <div className="border-t pt-3 mt-1">
            <p className="text-sm font-medium truncate">{user?.nombre || 'Usuario'}</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${
              isSuperadmin
                ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300'
                : 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
            }`}>
              {isSuperadmin ? 'Super Admin' : 'Administrador'}
            </span>
          </div>
        </div>
        <nav className="space-y-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="space-y-1">
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 w-full"
        >
          {dark ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
          {dark ? 'Modo claro' : 'Modo oscuro'}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 w-full"
        >
          <LogOut size={20} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  const currentLabel = links.find(l => l.to === location.pathname)?.label || 'Inicio';

  return (
    <div className="flex min-h-screen">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between h-14 px-4 border-b bg-card md:hidden">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-accent transition-colors">
          <Menu size={22} strokeWidth={1.8} />
        </button>
        <div className="flex items-center gap-2">
          <DentalLogo size={18} className="text-primary" />
          <span className="font-semibold">{currentLabel}</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 w-64 bg-card flex flex-col justify-between py-8 px-4 shadow-2xl z-50"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <X size={20} strokeWidth={1.8} />
              </button>
              {mobileContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar - dark themed, expands on hover */}
      <motion.aside
        className="hidden md:flex bg-sidebar text-sidebar-foreground flex-col justify-between py-6 fixed inset-y-0 left-0 z-30 overflow-hidden"
        animate={{ width: expanded ? 256 : 64 }}
        transition={sidebarSpring}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <div>
          {/* Logo + branding */}
          <div className="flex items-center h-12 mb-6 px-4">
            <div className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
              <DentalLogo size={20} className="text-white" />
            </div>
            <motion.div
              className="ml-3 whitespace-nowrap overflow-hidden"
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-base font-bold tracking-tight block text-white">{sidebarTitle}</span>
              <span className="text-xs text-sidebar-foreground/60 block">{sidebarSubtitle}</span>
            </motion.div>
          </div>

          {/* User info indicator */}
          <motion.div
            className="mx-3 mb-4 px-3 py-2 rounded-lg bg-white/5 overflow-hidden"
            animate={{ opacity: expanded ? 1 : 0, height: expanded ? 'auto' : 0, marginBottom: expanded ? 16 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {user?.nombre && (
              <span className="text-xs font-medium text-sidebar-foreground/80 block truncate">{user.nombre}</span>
            )}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${
              isSuperadmin
                ? 'bg-violet-500/20 text-violet-300'
                : 'bg-sky-500/20 text-sky-300'
            }`}>
              {isSuperadmin ? 'Super Admin' : 'Admin'}
            </span>
          </motion.div>

          <nav className="space-y-1 px-2">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-sidebar-accent text-white'
                      : 'text-sidebar-foreground/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.8} className="shrink-0" />
                <motion.span
                  className="text-sm"
                  animate={{ opacity: expanded ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {label}
                </motion.span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="space-y-1 px-2">
          <NotificacionesBell collapsed={!expanded} />
          <button
            onClick={toggle}
            className="flex items-center gap-3 px-3 py-3 rounded-lg font-medium text-sidebar-foreground/70 hover:bg-white/10 hover:text-white transition-all duration-200 w-full whitespace-nowrap"
          >
            {dark ? <Sun size={20} strokeWidth={1.8} className="shrink-0" /> : <Moon size={20} strokeWidth={1.8} className="shrink-0" />}
            <motion.span
              className="text-sm"
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {dark ? 'Modo claro' : 'Modo oscuro'}
            </motion.span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 rounded-lg font-medium text-sidebar-foreground/70 hover:bg-white/10 hover:text-white transition-all duration-200 w-full whitespace-nowrap"
          >
            <LogOut size={20} strokeWidth={1.8} className="shrink-0" />
            <motion.span
              className="text-sm"
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              Cerrar sesión
            </motion.span>
          </button>
        </div>
      </motion.aside>

      <motion.main
        className="flex-1 overflow-auto pt-14 md:pt-0"
        animate={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? (expanded ? 256 : 64) : 0 }}
        transition={sidebarSpring}
      >
        <div className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </div>
  );
}
