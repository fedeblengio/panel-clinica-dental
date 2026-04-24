import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { MessageSquare, ArrowLeft, User, Bot, AlertTriangle, UserCheck } from 'lucide-react';
import { api } from '../lib/utils';

function ChatBubble({ message, role, index = 0 }) {
  const isUser = role === 'user' || role === 'human';
  return (
    <motion.div initial={{ opacity: 0, x: isUser ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-md'
            : 'bg-secondary rounded-tl-md'
        }`}>
          {message}
        </div>
      </div>
    </motion.div>
  );
}

export function Conversaciones() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [escaladas, setEscaladas] = useState([]);

  const loadData = () => {
    Promise.all([
      api('/conversaciones'),
      api('/conversaciones/escaladas'),
    ]).then(([convs, esc]) => {
      setConversations(convs);
      setEscaladas(esc);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const isEscalada = (sessionId) => escaladas.some(e => e.session_id === sessionId);

  const getEscalacion = (sessionId) => escaladas.find(e => e.session_id === sessionId);

  const cerrarEscalacion = async (sessionId) => {
    try {
      await api(`/conversaciones/${encodeURIComponent(sessionId)}/cerrar-escalacion`, { method: 'POST' });
      setEscaladas(prev => prev.filter(e => e.session_id !== sessionId));
    } catch (err) {
      console.error(err);
    }
  };

  const openChat = async (sessionId) => {
    setSelected(sessionId);
    try {
      const msgs = await api(`/conversaciones/${encodeURIComponent(sessionId)}`);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
      setMessages([]);
    }
  };

  // Format phone from sessionId (e.g., "595981123456" -> "+595 981 123456")
  const formatPhone = (sid) => {
    if (!sid) return 'Desconocido';
    const clean = sid.replace(/\D/g, '');
    if (clean.length >= 12) {
      return `+${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`;
    }
    return sid;
  };

  return (
    <AnimatePresence mode="wait">
      {selected ? (
        <motion.div key={selected} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => { setSelected(null); setMessages([]); }}>
              <ArrowLeft size={20} />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{formatPhone(selected)}</h1>
                {isEscalada(selected) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 text-xs font-medium">
                    <AlertTriangle size={12} /> Escalado
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{messages.length} mensajes</p>
            </div>
            {isEscalada(selected) && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => cerrarEscalacion(selected)}>
                <UserCheck size={14} /> Devolver al bot
              </Button>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {messages.length > 0 ? messages.map((m, i) => (
                  <ChatBubble key={i} message={m.message} role={m.role} index={i} />
                )) : (
                  <p className="text-muted-foreground text-center py-8">No hay mensajes</p>
                )}
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Conversaciones</h1>
            <p className="text-muted-foreground mt-1">Historial de chats del bot con pacientes</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-muted-foreground text-center py-12">Cargando...</p>
              ) : conversations.length > 0 ? (
                <div className="divide-y">
                  {conversations.map((c, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => openChat(c.session_id)}
                      className="w-full flex items-center gap-4 p-4 sm:p-5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${isEscalada(c.session_id) ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-secondary'}`}>
                        {isEscalada(c.session_id)
                          ? <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                          : <MessageSquare size={18} className="text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{formatPhone(c.session_id)}</p>
                          {isEscalada(c.session_id) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                              Escalado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {isEscalada(c.session_id) ? getEscalacion(c.session_id)?.resumen || c.ultimo_mensaje : c.ultimo_mensaje || 'Sin mensajes'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                          {c.total_mensajes} msgs
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare size={36} className="text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-center">No hay conversaciones registradas</p>
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
