import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { HelpCircle, ChevronDown, LayoutDashboard, Users, CalendarDays, MessageSquare, Settings, Bot, Mail } from 'lucide-react';

const faqs = [
  {
    pregunta: '¿Cómo funciona el chatbot de WhatsApp?',
    respuesta: 'El chatbot responde automáticamente a los pacientes que escriben al WhatsApp de la clínica. Puede agendar citas, modificarlas, cancelarlas y responder consultas. Funciona 24/7 y usa inteligencia artificial para entender lo que el paciente necesita.',
  },
  {
    pregunta: '¿Qué pasa si un paciente manda un audio?',
    respuesta: 'El bot transcribe el audio automáticamente a texto y responde como si fuera un mensaje escrito. Soporta audios en cualquier idioma.',
  },
  {
    pregunta: '¿El bot puede equivocarse?',
    respuesta: 'Como toda IA, puede cometer errores en casos poco comunes. Por eso existe la función de "escalar a humano": si el bot no puede resolver algo, envía un email al administrador para que intervenga manualmente.',
  },
  {
    pregunta: '¿Cómo cambio el nombre del bot?',
    respuesta: 'Andá a Configuración → cambiá el campo "Nombre del bot/asistente" → Guardar. El bot empezará a presentarse con el nuevo nombre.',
  },
  {
    pregunta: '¿Los cambios en Configuración se aplican de inmediato?',
    respuesta: 'Sí. Cuando guardás cambios en Configuración (nombre, horarios, servicios, precios, prompt), el bot los usa desde el próximo mensaje que reciba.',
  },
  {
    pregunta: '¿Puedo ver las conversaciones del bot con los pacientes?',
    respuesta: 'Sí. Andá a la sección "Conversaciones" en el menú lateral. Ahí podés ver todas las conversaciones, ordenadas por la más reciente.',
  },
  {
    pregunta: '¿Qué hago si el bot no está respondiendo?',
    respuesta: 'Verificá que: 1) El workflow esté activo en n8n, 2) WhatsApp esté conectado correctamente en Evolution API, 3) Los servicios estén funcionando. Si el problema persiste, contactá a soporte.',
  },
];

const guias = [
  {
    icon: LayoutDashboard,
    titulo: 'Dashboard',
    items: [
      { titulo: 'Panel principal', desc: 'Muestra un resumen general: total de pacientes, citas de hoy, próximas citas y métricas del mes.' },
      { titulo: 'Gráficos', desc: 'Los gráficos muestran tendencias de citas por mes, pacientes nuevos y actividad semanal.' },
      { titulo: 'Citas de hoy', desc: 'Lista las citas programadas para el día actual con hora, paciente y estado.' },
    ],
  },
  {
    icon: Users,
    titulo: 'Pacientes',
    items: [
      { titulo: 'Ver pacientes', desc: 'Lista todos los pacientes registrados. Podés buscar por nombre, teléfono o email.' },
      { titulo: 'Agregar paciente', desc: 'Clic en "Nuevo Paciente" → completá nombre y teléfono (obligatorios) → email y fecha de nacimiento son opcionales → Guardar.' },
      { titulo: 'Editar paciente', desc: 'Clic en el ícono de editar (lápiz) junto al paciente → modificá los datos → Guardar.' },
      { titulo: 'Eliminar paciente', desc: 'Clic en el ícono de eliminar (papelera) → confirmá. Se eliminan también todas sus citas.' },
    ],
  },
  {
    icon: CalendarDays,
    titulo: 'Citas',
    items: [
      { titulo: 'Ver citas', desc: 'Muestra todas las citas. Podés filtrar por fecha y por estado (Pendiente, Confirmada, Cancelada, etc.).' },
      { titulo: 'Crear cita manual', desc: 'Clic en "Nueva Cita" → seleccioná el paciente, fecha, hora y tipo de servicio → Guardar.' },
      { titulo: 'Estados de cita', desc: 'Pendiente = recién creada. Confirmada = el paciente confirmó. Modificada = se cambió fecha/hora. Cancelada = fue cancelada. Completada = ya se atendió.' },
      { titulo: 'Citas desde WhatsApp', desc: 'Cuando el bot agenda una cita, aparece automáticamente acá con estado "Pendiente".' },
    ],
  },
  {
    icon: MessageSquare,
    titulo: 'Conversaciones',
    items: [
      { titulo: 'Ver conversaciones', desc: 'Muestra el historial de todas las conversaciones del bot con pacientes por WhatsApp.' },
      { titulo: 'Detalle', desc: 'Clic en una conversación para ver el intercambio completo de mensajes entre el paciente y el bot.' },
      { titulo: 'Identificación', desc: 'Cada conversación se identifica por el número de teléfono del paciente.' },
    ],
  },
  {
    icon: Settings,
    titulo: 'Configuración',
    items: [
      { titulo: 'Datos generales', desc: 'Nombre de la clínica, nombre del bot, dirección, teléfono y email. Si dejás un campo vacío, el bot usa valores por defecto.' },
      { titulo: 'Horarios de atención', desc: 'Configurá el horario de apertura y cierre para cada día. Marcá "Cerrado" para los días que no atendés. El bot no agendará citas fuera de estos horarios.' },
      { titulo: 'Servicios y precios', desc: 'Agregá cada servicio con su duración y precio. El bot informa estos datos cuando un paciente pregunta. Si no hay servicios cargados, usa una lista genérica.' },
      { titulo: 'Mensaje de bienvenida', desc: 'Mensaje que el bot usa la primera vez que un paciente escribe. Si lo dejás vacío, el bot saluda con su mensaje estándar.' },
      { titulo: 'Prompt del Bot (IA)', desc: 'Instrucciones personalizadas para el comportamiento del bot. Acá podés agregar reglas de negocio, promociones, instrucciones especiales, etc. Se combina con las reglas base del bot.' },
    ],
  },
  {
    icon: Bot,
    titulo: 'Chatbot WhatsApp',
    items: [
      { titulo: 'Qué puede hacer', desc: 'Agendar citas, modificar citas, cancelar citas, consultar disponibilidad, registrar pacientes nuevos, informar servicios y precios, y escalar a humano.' },
      { titulo: 'Qué NO puede hacer', desc: 'No puede procesar pagos, no puede acceder a historial médico, no puede enviar fotos/documentos y no puede atender grupos de WhatsApp.' },
      { titulo: 'Tipos de mensaje', desc: 'Entiende texto y audios. Imágenes, videos, stickers y documentos no están soportados (responde que no puede procesarlos).' },
      { titulo: 'Horarios', desc: 'El bot responde 24/7 pero solo agenda dentro del horario de atención configurado.' },
      { titulo: 'Memoria', desc: 'El bot recuerda los últimos 10 mensajes de cada conversación. Si pasa mucho tiempo, puede que no recuerde el contexto anterior.' },
    ],
  },
];

function FaqItem({ pregunta, respuesta }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <button
      onClick={() => setAbierto(!abierto)}
      className="w-full text-left border-b last:border-0 py-4 transition-colors hover:bg-accent/30 px-4 -mx-4 rounded-lg"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-base">{pregunta}</span>
        <ChevronDown
          size={18}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </div>
      {abierto && (
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{respuesta}</p>
      )}
    </button>
  );
}

function GuiaSection({ icon: Icon, titulo, items }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Card className="animate-fade-in">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full p-6 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon size={20} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold">{titulo}</h3>
        </div>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        />
      </button>
      {abierto && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {items.map((item, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{item.titulo}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function Ayuda() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ayuda</h1>
          <p className="text-muted-foreground mt-1">Guías y preguntas frecuentes</p>
        </div>
      </div>

      {/* Preguntas frecuentes */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Preguntas frecuentes</h2>
        </div>
        <Card className="animate-fade-in">
          <CardContent className="divide-y-0">
            {faqs.map((faq, i) => (
              <FaqItem key={i} {...faq} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Guías por sección */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Guías por sección</h2>
        <div className="space-y-3">
          {guias.map((guia, i) => (
            <GuiaSection key={i} {...guia} />
          ))}
        </div>
      </div>

      {/* Contacto soporte */}
      <Card className="animate-fade-in">
        <CardContent>
          <div className="flex items-start gap-4 py-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">¿No encontrás lo que buscás?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Si tenés alguna duda que no está cubierta acá, contactá a soporte técnico para recibir ayuda personalizada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
