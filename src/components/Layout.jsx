import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, MessageSquare, Settings, HelpCircle, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { useTheme } from '../lib/useTheme';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/pacientes', icon: Users, label: 'Pacientes' },
  { to: '/citas', icon: CalendarDays, label: 'Citas' },
  { to: '/conversaciones', icon: MessageSquare, label: 'Conversaciones' },
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
  { to: '/ayuda', icon: HelpCircle, label: 'Ayuda' },
];

export function Layout({ children, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    onLogout();
    navigate('/login');
  };

  const mobileContent = (
    <>
      <div>
        <div className="px-4 mb-12">
          <h1 className="text-xl font-bold tracking-tight">Clínica Dental</h1>
          <p className="text-sm text-muted-foreground mt-1">Panel de gestión</p>
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
        <span className="font-semibold">{currentLabel}</span>
        <div className="w-10" />
      </header>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-card flex flex-col justify-between py-8 px-4 shadow-2xl animate-slide-in z-50">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <X size={20} strokeWidth={1.8} />
            </button>
            {mobileContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar - collapsed, expands on hover */}
      <aside className="hidden md:flex w-16 hover:w-64 border-r bg-card flex-col justify-between py-6 fixed inset-y-0 left-0 z-30 transition-all duration-300 overflow-hidden group">
        <div>
          {/* Logo icon / expanded title */}
          <div className="flex items-center h-12 mb-6 px-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <LayoutDashboard size={18} className="text-primary" />
            </div>
            <span className="ml-3 text-lg font-bold tracking-tight whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Clínica Dental
            </span>
          </div>

          <nav className="space-y-1 px-2">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`
                }
              >
                <Icon size={20} strokeWidth={1.8} className="shrink-0" />
                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm">
                  {label}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="space-y-1 px-2">
          <button
            onClick={toggle}
            className="flex items-center gap-3 px-3 py-3 rounded-lg font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 w-full whitespace-nowrap"
          >
            {dark ? <Sun size={20} strokeWidth={1.8} className="shrink-0" /> : <Moon size={20} strokeWidth={1.8} className="shrink-0" />}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm">
              {dark ? 'Modo claro' : 'Modo oscuro'}
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 rounded-lg font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 w-full whitespace-nowrap"
          >
            <LogOut size={20} strokeWidth={1.8} className="shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm">
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pt-14 md:pt-0 md:ml-16">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
