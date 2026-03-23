import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Building2, Clock, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { api } from '../lib/utils';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

const defaultHorarios = {};
DIAS.forEach(d => { defaultHorarios[d] = { abre: '08:00', cierra: '18:00', cerrado: d === 'domingo' }; });

const steps = [
  { icon: Building2, title: 'Datos de tu clínica', desc: 'Información básica' },
  { icon: Clock, title: 'Horarios de atención', desc: 'Días y horarios' },
  { icon: CheckCircle2, title: 'Listo', desc: 'Todo configurado' },
];

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
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
  });

  const updateHorario = (dia, field, value) => {
    setForm(prev => ({
      ...prev,
      horarios: { ...prev.horarios, [dia]: { ...prev.horarios[dia], [field]: value } }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('/configuracion', { method: 'PUT', body: form });
      setStep(2);
    } catch {
      // silently continue
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i <= step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s.title}
              </span>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Bienvenido a DentalPanel</h2>
                      <p className="text-sm text-muted-foreground">Configurá los datos básicos de tu clínica</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Input label="Nombre de la clínica" value={form.nombre_clinica} onChange={e => setForm({ ...form, nombre_clinica: e.target.value })} placeholder="Ej: Clínica Dental Sonrisa" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Dirección" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Av. España 1234" />
                      <Input label="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="0981123456" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="clinica@email.com" />
                      <Input label="Nombre del bot" value={form.nombre_bot} onChange={e => setForm({ ...form, nombre_bot: e.target.value })} placeholder="Sofía" />
                    </div>
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button onClick={() => setStep(1)} disabled={!form.nombre_clinica}>
                      Siguiente <ChevronRight size={16} />
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Horarios de atención</h2>
                      <p className="text-sm text-muted-foreground">Configurá los días y horarios de tu clínica</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {DIAS.map(dia => (
                      <div key={dia} className="flex items-center gap-3 flex-wrap">
                        <span className="w-24 text-sm font-medium">{DIAS_LABEL[dia]}</span>
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
                              className="h-9 px-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <span className="text-muted-foreground text-sm">a</span>
                            <input
                              type="time"
                              value={form.horarios[dia]?.cierra || '18:00'}
                              onChange={e => updateHorario(dia, 'cierra', e.target.value)}
                              className="h-9 px-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={() => setStep(0)}>
                      <ChevronLeft size={16} /> Anterior
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar y finalizar'}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">¡Todo listo!</h2>
                  <p className="text-muted-foreground mb-6">Tu clínica está configurada. Podés cambiar estos datos en cualquier momento desde Configuración.</p>
                  <Button onClick={onComplete} size="lg">
                    Ir al panel
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
