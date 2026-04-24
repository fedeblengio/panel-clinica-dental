import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, UserCheck, Bot, Clock, User, Phone, RefreshCw } from 'lucide-react';
import { api } from '../lib/utils';

export function Escalaciones() {
  const [escalaciones, setEscalaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cerrando, setCerrando] = useState(null);

  const loadData = () => {
    setLoading(true);
    api('/conversaciones/escaladas')
      .then(data => {
        setEscalaciones(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const cerrarEscalacion = async (sessionId) => {
    setCerrando(sessionId);
    try {
      await api(`/conversaciones/${encodeURIComponent(sessionId)}/cerrar-escalacion`, { method: 'POST' });
      setEscalaciones(prev => prev.filter(e => e.session_id !== sessionId));
    } catch (err) {
      console.error(err);
    }
    setCerrando(null);
  };

  const formatPhone = (sid) => {
    if (!sid) return 'Desconocido';
    const clean = sid.replace(/\D/g, '');
    if (clean.length >= 12) {
      return `+${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return sid;
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace un momento';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Escalaciones</h1>
          <p className="text-muted-foreground mt-1">Conversaciones atendidas por humanos</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
          <RefreshCw size={14} /> Actualizar
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Cargando...</p>
            ) : escalaciones.length > 0 ? (
              <div className="divide-y">
                <AnimatePresence>
                  {escalaciones.map((esc, i) => (
                    <motion.div
                      key={esc.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5"
                    >
                      <div className="h-11 w-11 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium flex items-center gap-1.5">
                            <User size={14} className="text-muted-foreground" />
                            {esc.paciente_nombre || 'Paciente'}
                          </span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone size={12} />
                            {formatPhone(esc.session_id)}
                          </span>
                        </div>
                        {esc.resumen && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{esc.resumen}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                            <User size={10} /> Humano atendiendo
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={10} /> {timeAgo(esc.created_at)}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0"
                        disabled={cerrando === esc.session_id}
                        onClick={() => cerrarEscalacion(esc.session_id)}
                      >
                        {cerrando === esc.session_id ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Cerrando...
                          </>
                        ) : (
                          <>
                            <Bot size={14} /> Devolver al bot
                          </>
                        )}
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <UserCheck size={36} className="text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center font-medium">No hay escalaciones activas</p>
                <p className="text-muted-foreground text-center text-sm mt-1">Todas las conversaciones están siendo atendidas por el bot</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
