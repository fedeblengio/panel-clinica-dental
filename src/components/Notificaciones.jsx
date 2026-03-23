import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, UserPlus, CalendarPlus, XCircle } from 'lucide-react';
import { api } from '../lib/utils';

const ICON_MAP = {
  paciente: UserPlus,
  cita: CalendarPlus,
  cancelacion: XCircle,
};

const COLOR_MAP = {
  paciente: 'text-sky-500',
  cita: 'text-emerald-500',
  cancelacion: 'text-red-500',
};

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}

export function NotificacionesBell({ collapsed = false }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    api('/notificaciones').then(setItems).catch(() => {});
    const interval = setInterval(() => {
      api('/notificaciones').then(setItems).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = useCallback(() => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 8,
        left: rect.left,
      });
    }
    setOpen(v => !v);
  }, [open]);

  const count = items.length;

  return (
    <>
      <div ref={btnRef} className="relative">
        <button
          onClick={handleToggle}
          className="flex items-center gap-3 px-3 py-3 rounded-lg font-medium text-sidebar-foreground/70 hover:bg-white/10 hover:text-white transition-all duration-200 w-full whitespace-nowrap relative"
        >
          <Bell size={20} strokeWidth={1.8} className="shrink-0" />
          {count > 0 && (
            <span className="absolute top-2 left-7 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
          {!collapsed && (
            <motion.span
              className="text-sm"
              animate={{ opacity: collapsed ? 0 : 1 }}
              transition={{ duration: 0.2 }}
            >
              Notificaciones
            </motion.span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed w-80 bg-card border rounded-xl shadow-2xl z-[100] overflow-hidden"
            style={{ bottom: `calc(100vh - ${pos.top}px)`, left: pos.left }}
          >
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold">Notificaciones</h3>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {items.length > 0 ? items.map((item, i) => {
                const Icon = ICON_MAP[item.tipo] || Bell;
                const color = COLOR_MAP[item.tipo] || 'text-muted-foreground';
                return (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors border-b last:border-0">
                    <div className={`mt-0.5 ${color}`}>
                      <Icon size={16} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-tight">{item.mensaje}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.fecha)}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-8 text-center">
                  <Bell size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Sin notificaciones recientes</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
