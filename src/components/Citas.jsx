import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input, Select } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog } from './ui/dialog';
import { Plus, Filter, Pencil, Trash2, List, CalendarDays, ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TIPOS = ['Limpieza dental', 'Consulta general', 'Ortodoncia', 'Endodoncia', 'Extracción', 'Blanqueamiento', 'Implante', 'Corona', 'Revisión', 'Urgencia', 'Otro'];
const ESTADOS = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada', 'Modificada', 'No Asistio'];

const empty = { paciente_telefono: '', fecha_cita: '', hora_cita: '', tipo_cita: '', estado: 'Pendiente', notas: '' };
const PAGE_SIZE = 10;

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return new Date(y, m - 1, day).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

const HOURS = [];
for (let h = 7; h <= 21; h++) {
  HOURS.push(`${String(h).padStart(2, '0')}:00`);
}

const statusColor = {
  Pendiente: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300',
  Confirmada: 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300',
  Cancelada: 'bg-red-100 border-red-300 text-red-900 dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-300',
  Completada: 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-300',
  Modificada: 'bg-violet-100 border-violet-300 text-violet-900 dark:bg-violet-500/20 dark:border-violet-500/40 dark:text-violet-300',
  'No Asistio': 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300',
};

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function CalendarView({ citas, onEdit }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isToday = (d) => toDateStr(d) === toDateStr(new Date());

  const getCitasForDay = (date) => {
    const ds = toDateStr(date);
    return citas.filter(c => {
      const cd = String(c.fecha_cita).split('T')[0];
      return cd === ds;
    }).sort((a, b) => (a.hora_cita || '').localeCompare(b.hora_cita || ''));
  };

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft size={18} /> Anterior
        </Button>
        <div className="text-center">
          <span className="font-medium">
            {days[0].toLocaleDateString('es-PY', { day: 'numeric', month: 'short' })} — {days[6].toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          Siguiente <ChevronRight size={18} />
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => setWeekStart(getWeekStart(new Date()))}>
        Ir a hoy
      </Button>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Headers */}
        {days.map((d, i) => (
          <div key={i} className={`text-center p-2 rounded-lg ${isToday(d) ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
            <div className="text-sm font-medium">{DIAS_SEMANA[i]}</div>
            <div className="text-lg font-bold">{d.getDate()}</div>
          </div>
        ))}
        {/* Day columns */}
        {days.map((d, i) => {
          const dayCitas = getCitasForDay(d);
          return (
            <div key={`col-${i}`} className={`min-h-[200px] border rounded-lg p-1.5 space-y-1 ${isToday(d) ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              {dayCitas.length > 0 ? dayCitas.map(c => (
                <motion.button
                  key={c.id}
                  onClick={() => onEdit(c)}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left p-2 rounded-md border text-sm transition-all ${statusColor[c.estado] || 'bg-secondary'}`}
                >
                  <div className="font-semibold tabular-nums">{String(c.hora_cita).substring(0, 5)}</div>
                  <div className="font-medium truncate">{c.paciente_nombre}</div>
                  <div className="text-xs opacity-75 truncate">{c.tipo_cita}</div>
                </motion.button>
              )) : (
                <p className="text-xs text-muted-foreground text-center pt-4">—</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Citas() {
  const [citas, setCitas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState('');
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [page, setPage] = useState(1);

  const load = () => {
    const params = new URLSearchParams();
    if (fecha) params.set('fecha', fecha);
    if (estado) params.set('estado', estado);
    api(`/citas?${params}`).then(setCitas).catch(console.error);
  };

  useEffect(() => { load(); api('/pacientes').then(setPacientes).catch(() => {}); }, []);
  useEffect(() => { setPage(1); load(); }, [fecha, estado]);

  const openNew = () => { setForm(empty); setEditing(null); setError(''); setDialog(true); };
  const openEdit = (c) => {
    setForm({
      ...c,
      fecha_cita: c.fecha_cita ? String(c.fecha_cita).split('T')[0] : '',
      hora_cita: String(c.hora_cita).substring(0, 5),
    });
    setEditing(c.id);
    setError('');
    setDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api(`/citas/${editing}`, { method: 'PUT', body: form });
      } else {
        await api('/citas', { method: 'POST', body: form });
      }
      setDialog(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    await api(`/citas/${id}`, { method: 'DELETE' }).catch(console.error);
    setConfirm(null);
    load();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Citas', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Fecha', 'Hora', 'Paciente', 'Tipo', 'Estado']],
      body: citas.map(c => [
        formatDate(c.fecha_cita),
        String(c.hora_cita).substring(0, 5),
        c.paciente_nombre || '',
        c.tipo_cita || '',
        c.estado || '',
      ]),
    });
    doc.save('citas.pdf');
  };

  const exportExcel = () => {
    const data = citas.map(c => ({
      Fecha: formatDate(c.fecha_cita),
      Hora: String(c.hora_cita).substring(0, 5),
      Paciente: c.paciente_nombre || '',
      Tipo: c.tipo_cita || '',
      Estado: c.estado || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Citas');
    XLSX.writeFile(wb, 'citas.xlsx');
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(citas.length / PAGE_SIZE));
  const paginatedCitas = citas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIdx = (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(page * PAGE_SIZE, citas.length);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Citas</h1>
          <p className="text-muted-foreground mt-1">{citas.length} registradas</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2.5 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`p-2.5 transition-colors ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
            >
              <CalendarDays size={18} />
            </button>
          </motion.div>
          <Button onClick={openNew}>
            <Plus size={18} /> Nueva cita
          </Button>
        </div>
      </motion.div>

      {view === 'calendar' ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <CalendarView citas={citas} onEdit={openEdit} />
          </CardContent>
        </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card>
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter size={18} className="text-muted-foreground" />
              <input
                type="date"
                className="h-12 px-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
              <select
                className="h-12 px-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              {(fecha || estado) && (
                <Button variant="ghost" size="sm" onClick={() => { setFecha(''); setEstado(''); }}>Limpiar</Button>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={exportPDF}>
                <Download size={16} /> Exportar PDF
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={exportExcel}>
                <FileSpreadsheet size={16} /> Exportar Excel
              </Button>
            </div>
          </div>
          <CardContent>
            {citas.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">Fecha</th>
                      <th className="pb-3 font-medium text-muted-foreground">Hora</th>
                      <th className="pb-3 font-medium text-muted-foreground">Paciente</th>
                      <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                      <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                      <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCitas.map((c, i) => (
                      <motion.tr key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="py-4">{formatDate(c.fecha_cita)}</td>
                        <td className="py-4 font-semibold tabular-nums">{String(c.hora_cita).substring(0, 5)}</td>
                        <td className="py-4 font-medium">{c.paciente_nombre}</td>
                        <td className="py-4 text-muted-foreground hidden md:table-cell">{c.tipo_cita}</td>
                        <td className="py-4"><Badge status={c.estado} /></td>
                        <td className="py-4 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                              <Pencil size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirm(c.id)}>
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center justify-center py-12">
                <CalendarDays size={36} className="text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-center">
                  {fecha || estado ? 'No se encontraron citas con esos filtros' : 'No hay citas registradas'}
                </p>
              </motion.div>
            )}
          </CardContent>
          {citas.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {startIdx}-{endIdx} de {citas.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
        </motion.div>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} title={editing ? 'Editar cita' : 'Nueva cita'} className="max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Paciente *" value={form.paciente_telefono} onChange={(e) => setForm({ ...form, paciente_telefono: e.target.value })} required>
              <option value="">Seleccionar...</option>
              {pacientes.map((p) => <option key={p.telefono} value={p.telefono}>{p.nombre} ({p.telefono})</option>)}
            </Select>
            <Select label="Tipo de cita *" value={form.tipo_cita} onChange={(e) => setForm({ ...form, tipo_cita: e.target.value })} required>
              <option value="">Seleccionar...</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Fecha *" type="date" value={form.fecha_cita} onChange={(e) => setForm({ ...form, fecha_cita: e.target.value })} required />
            <Input label="Hora *" type="time" value={form.hora_cita} onChange={(e) => setForm({ ...form, hora_cita: e.target.value })} required />
            <Select label="Estado" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </div>
          <Input label="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Notas adicionales" />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? 'Guardar cambios' : 'Crear cita'}</Button>
            <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Eliminar cita">
        <p className="text-muted-foreground mb-6">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => handleDelete(confirm)}>Eliminar</Button>
          <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  );
}
