import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, LogOut, Sun, Moon } from 'lucide-react';
import { useTheme } from '../lib/useTheme';

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/pacientes', icon: Users, label: 'Pacientes' },
  { to: '/citas', icon: CalendarDays, label: 'Citas' },
];

export function Layout({ children, onLogout }) {
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    onLogout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-card flex flex-col justify-between py-8 px-4 shrink-0">
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
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
