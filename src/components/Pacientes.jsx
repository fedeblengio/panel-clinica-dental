import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/input';
import { Dialog } from './ui/dialog';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/utils';

const empty = { telefono: '', nombre: '', email: '', fecha_nacimiento: '', notas: '' };

export function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = (q = '') => api(`/pacientes?buscar=${q}`).then(setPacientes).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(buscar);
  };

  const openNew = () => { setForm(empty); setEditing(null); setError(''); setDialog(true); };
  const openEdit = (p) => { setForm(p); setEditing(p.id); setError(''); setDialog(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api(`/pacientes/${editing}`, { method: 'PUT', body: form });
      } else {
        await api('/pacientes', { method: 'POST', body: form });
      }
      setDialog(false);
      load(buscar);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api(`/pacientes/${id}`, { method: 'DELETE' });
      setConfirm(null);
      load(buscar);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground mt-1">{pacientes.length} registrados</p>
        </div>
        <Button onClick={openNew} size="default">
          <Plus size={18} /> Nuevo paciente
        </Button>
      </div>

      <Card className="animate-fade-in">
        <div className="p-6 pb-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full h-12 pl-11 pr-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Buscar por nombre, teléfono o email..."
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">Buscar</Button>
          </form>
        </div>
        <CardContent>
          {pacientes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Nombre</th>
                    <th className="pb-3 font-medium text-muted-foreground">Teléfono</th>
                    <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="pb-3 font-medium text-muted-foreground hidden lg:table-cell">Nacimiento</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-4 font-medium">{p.nombre}</td>
                      <td className="py-4 tabular-nums">{p.telefono}</td>
                      <td className="py-4 text-muted-foreground hidden md:table-cell">{p.email || '—'}</td>
                      <td className="py-4 text-muted-foreground hidden lg:table-cell">{p.fecha_nacimiento || '—'}</td>
                      <td className="py-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setConfirm(p.id)}>
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
              {buscar ? `No se encontraron pacientes con "${buscar}"` : 'No hay pacientes registrados'}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog} onClose={() => setDialog(false)} title={editing ? 'Editar paciente' : 'Nuevo paciente'}>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Juan Pérez" />
            <Input label="Teléfono *" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} required placeholder="59891234567" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="juan@email.com" />
            <Input label="Fecha de nacimiento" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} placeholder="15/03/1985" />
          </div>
          <Textarea label="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones, alergias..." />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editing ? 'Guardar cambios' : 'Crear paciente'}</Button>
            <Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Eliminar paciente">
        <p className="text-muted-foreground mb-6">Esta acción eliminará al paciente y todas sus citas. No se puede deshacer.</p>
        <div className="flex gap-3">
          <Button variant="destructive" className="flex-1" onClick={() => handleDelete(confirm)}>Eliminar</Button>
          <Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button>
        </div>
      </Dialog>
    </div>
  );
}
