import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input, Select } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog } from './ui/dialog';
import { Plus, Filter, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/utils';

const TIPOS = ['Limpieza dental', 'Consulta general', 'Ortodoncia', 'Endodoncia', 'Extracción', 'Blanqueamiento', 'Implante', 'Corona', 'Revisión', 'Urgencia', 'Otro'];
const ESTADOS = ['Pendiente', 'Confirmada', 'Cancelada', 'Completada', 'Modificada'];

const empty = { paciente_telefono: '', fecha_cita: '', hora_cita: '', tipo_cita: '', estado: 'Pendiente', notas: '' };

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return new Date(y, m - 1, day).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
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

  const load = () => {
    const params = new URLSearchParams();
    if (fecha) params.set('fecha', fecha);
    if (estado) params.set('estado', estado);
    api(`/citas?${params}`).then(setCitas).catch(console.error);
  };

  useEffect(() => { load(); api('/pacientes').then(setPacientes).catch(() => {}); }, []);
  useEffect(() => { load(); }, [fecha, estado]);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Citas</h1>
          <p className="text-muted-foreground mt-1">{citas.length} registradas</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={18} /> Nueva cita
        </Button>
      </div>

      <Card className="animate-fade-in">
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
                  {citas.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              {fecha || estado ? 'No se encontraron citas con esos filtros' : 'No hay citas registradas'}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onClose={() => setDialog(false)} title={editing ? 'Editar cita' : 'Nueva cita'} className="max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Paciente *" value={form.paciente_telefono} onChange={(e) => setForm({ ...form, paciente_telefono: e.target.value })} required>
              <option value="">Seleccionar...</option>
              {pacientes.map((p) => <option key={p.telefono} value={p.telefono}>{p.nombre} ({p.telefono})</option>)}
            </Select>
            <Select label="Tipo de cita *" value={form.tipo_cita} onChange={(e) => setForm({ ...form, tipo_cita: e.target.value })} required>
              <option value="">Seleccionar...</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
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
