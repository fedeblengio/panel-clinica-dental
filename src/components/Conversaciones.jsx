import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { MessageSquare, ArrowLeft, User, Bot } from 'lucide-react';
import { api } from '../lib/utils';

function ChatBubble({ message, role }) {
  const isUser = role === 'user' || role === 'human';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
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
    </div>
  );
}

export function Conversaciones() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/conversaciones')
      .then(data => { setConversations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => { setSelected(null); setMessages([]); }}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{formatPhone(selected)}</h1>
            <p className="text-muted-foreground text-sm">{messages.length} mensajes</p>
          </div>
        </div>

        <Card className="animate-fade-in">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {messages.length > 0 ? messages.map((m, i) => (
                <ChatBubble key={i} message={m.message} role={m.role} />
              )) : (
                <p className="text-muted-foreground text-center py-8">No hay mensajes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Conversaciones</h1>
        <p className="text-muted-foreground mt-1">Historial de chats del bot con pacientes</p>
      </div>

      <Card className="animate-fade-in">
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground text-center py-12">Cargando...</p>
          ) : conversations.length > 0 ? (
            <div className="divide-y">
              {conversations.map((c, i) => (
                <button
                  key={i}
                  onClick={() => openChat(c.session_id)}
                  className="w-full flex items-center gap-4 p-4 sm:p-5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <MessageSquare size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{formatPhone(c.session_id)}</p>
                    <p className="text-sm text-muted-foreground truncate">{c.ultimo_mensaje || 'Sin mensajes'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                      {c.total_mensajes} msgs
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-12">No hay conversaciones registradas</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
