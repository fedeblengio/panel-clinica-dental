import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/input';
import { Save, Plus, Trash2, Building2, Bot, Phone } from 'lucide-react';
import { api } from '../lib/utils';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

const defaultHorarios = {};
DIAS.forEach(d => { defaultHorarios[d] = { abre: '08:00', cierra: '18:00', cerrado: d === 'domingo' }; });

export function Configuracion() {
  const [form, setForm] = useState({
    nombre_clinica: '',
    direccion: '',
    telefono: '',
    email: '',
    nombre_bot: 'Sofía',
    horarios: defaultHorarios,
    servicios: [],
    mensaje_bienvenida: '',
    prompt_sistema: '',
    telefono_notificaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [nuevoServicio, setNuevoServicio] = useState({ nombre: '', duracion: 30, precio: '' });

  useEffect(() => {
    api('/configuracion').then(data => {
      if (data && data.nombre_clinica !== undefined) {
        setForm({
          nombre_clinica: data.nombre_clinica || '',
          direccion: data.direccion || '',
          telefono: data.telefono || '',
          email: data.email || '',
          nombre_bot: data.nombre_bot || 'Sofía',
          horarios: data.horarios || defaultHorarios,
          servicios: data.servicios || [],
          mensaje_bienvenida: data.mensaje_bienvenida || '',
          prompt_sistema: data.prompt_sistema || '',
          telefono_notificaciones: data.telefono_notificaciones || '',
        });
      }
    }).catch(console.error);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api('/configuracion', { method: 'PUT', body: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateHorario = (dia, field, value) => {
    setForm(prev => ({
      ...prev,
      horarios: {
        ...prev.horarios,
        [dia]: { ...prev.horarios[dia], [field]: value }
      }
    }));
  };

  const addServicio = () => {
    if (!nuevoServicio.nombre) return;
    setForm(prev => ({
      ...prev,
      servicios: [...prev.servicios, { ...nuevoServicio, precio: parseInt(nuevoServicio.precio) || 0 }]
    }));
    setNuevoServicio({ nombre: '', duracion: 30, precio: '' });
  };

  const removeServicio = (index) => {
    setForm(prev => ({
      ...prev,
      servicios: prev.servicios.filter((_, i) => i !== index)
    }));
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground mt-1">Datos de tu clínica</p>
        </div>
      </motion.div>

      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</motion.div>
        )}
        {saved && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 rounded-lg px-4 py-3 text-sm">Configuración guardada correctamente</motion.div>
        )}

        {/* Datos generales */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 * 0.1, duration: 0.4 }}>
        <Card>
          <div className="p-6 pb-4 flex items-center gap-3">
            <Building2 size={20} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">Datos generales</h2>
          </div>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nombre de la clínica" value={form.nombre_clinica} onChange={e => setForm({ ...form, nombre_clinica: e.target.value })} placeholder="Sonrisa Perfecta" />
              <Input label="Nombre del bot/asistente" value={form.nombre_bot} onChange={e => setForm({ ...form, nombre_bot: e.target.value })} placeholder="Sofía" />
              <Input label="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Av. España 1234, Asunción" />
              <Input label="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="0981123456" />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="clinica@email.com" />
            </div>
            <div className="mt-4 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 mb-2">
                <Phone size={16} className="text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Notificaciones de escalación</span>
              </div>
              <Input label="Teléfono de la recepcionista (para avisos del bot)" value={form.telefono_notificaciones} onChange={e => setForm({ ...form, telefono_notificaciones: e.target.value })} placeholder="595981123456" />
              <p className="text-xs text-muted-foreground mt-1">Cuando un paciente pida hablar con una persona, el bot enviará un mensaje a este número con el resumen del problema.</p>
            </div>
            <div className="mt-4">
              <Textarea label="Mensaje de bienvenida personalizado" value={form.mensaje_bienvenida} onChange={e => setForm({ ...form, mensaje_bienvenida: e.target.value })} placeholder="Mensaje que el bot usa al saludar (opcional)" />
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Horarios */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 * 0.1, duration: 0.4 }}>
        <Card>
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold">Horarios de atención</h2>
          </div>
          <CardContent>
            <div className="space-y-3">
              {DIAS.map(dia => (
                <div key={dia} className="flex items-center gap-3 flex-wrap">
                  <span className="w-24 text-base font-medium">{DIAS_LABEL[dia]}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.horarios[dia]?.cerrado || false}
                      onChange={e => updateHorario(dia, 'cerrado', e.target.checked)}
                      className="w-4 h-4 rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">Cerrado</span>
                  </label>
                  {!form.horarios[dia]?.cerrado && (
                    <>
                      <input
                        type="time"
                        value={form.horarios[dia]?.abre || '08:00'}
                        onChange={e => updateHorario(dia, 'abre', e.target.value)}
                        className="h-10 px-3 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <span className="text-muted-foreground">a</span>
                      <input
                        type="time"
                        value={form.horarios[dia]?.cierra || '18:00'}
                        onChange={e => updateHorario(dia, 'cierra', e.target.value)}
                        className="h-10 px-3 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Servicios */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 * 0.1, duration: 0.4 }}>
        <Card>
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold">Servicios y precios</h2>
          </div>
          <CardContent>
            {form.servicios.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">Servicio</th>
                      <th className="pb-3 font-medium text-muted-foreground">Duración</th>
                      <th className="pb-3 font-medium text-muted-foreground">Precio (PYG)</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.servicios.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-3 font-medium">{s.nombre}</td>
                        <td className="py-3">{s.duracion} min</td>
                        <td className="py-3 tabular-nums">{(s.precio || 0).toLocaleString('es-PY')}</td>
                        <td className="py-3 text-right">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeServicio(i)}>
                            <Trash2 size={16} className="text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-end gap-3 flex-wrap">
              <Input label="Servicio" value={nuevoServicio.nombre} onChange={e => setNuevoServicio({ ...nuevoServicio, nombre: e.target.value })} placeholder="Limpieza dental" />
              <Input label="Duración (min)" type="number" value={nuevoServicio.duracion} onChange={e => setNuevoServicio({ ...nuevoServicio, duracion: parseInt(e.target.value) || 30 })} />
              <Input label="Precio (PYG)" type="number" value={nuevoServicio.precio} onChange={e => setNuevoServicio({ ...nuevoServicio, precio: e.target.value })} placeholder="200000" />
              <Button type="button" variant="secondary" onClick={addServicio}>
                <Plus size={18} /> Agregar
              </Button>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Prompt del Bot */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3 * 0.1, duration: 0.4 }}>
        <Card>
          <div className="p-6 pb-4 flex items-center gap-3">
            <Bot size={20} className="text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Prompt del Bot (IA)</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Instrucciones personalizadas para el comportamiento del chatbot. Los datos de la clínica, horarios y servicios se inyectan automáticamente.</p>
            </div>
          </div>
          <CardContent>
            <Textarea
              value={form.prompt_sistema}
              onChange={e => setForm({ ...form, prompt_sistema: e.target.value })}
              placeholder={"Eres Sofía, la asistente virtual de recepción. Eres cálida, amable y siempre tenés buena onda...\n\nAcá podés escribir las instrucciones de personalidad, reglas de negocio, flujos de trabajo, etc."}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Variables disponibles que se reemplazan automáticamente: {'{nombre_clinica}'}, {'{direccion}'}, {'{telefono}'}, {'{email}'}, {'{nombre_bot}'}, {'{horarios}'}, {'{servicios}'}
            </p>
          </CardContent>
        </Card>
        </motion.div>

        {/* Save button */}
        <motion.div className="flex justify-end" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button type="submit" size="lg" disabled={saving}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </motion.div>
      </form>
    </div>
  );
}
