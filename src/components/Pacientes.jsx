import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input, Textarea } from './ui/input';
import { Dialog } from './ui/dialog';
import { Plus, Search, Pencil, Trash2, Users, Download, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const empty = { telefono: '', nombre: '', email: '', fecha_nacimiento: '', notas: '' };
const PAGE_SIZE = 10;

export function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const load = (q = '') => api(`/pacientes?buscar=${q}`).then(setPacientes).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
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

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Pacientes', 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Nombre', 'Teléfono', 'Email', 'Fecha Nacimiento']],
      body: pacientes.map(p => [p.nombre, p.telefono, p.email || '', p.fecha_nacimiento || '']),
    });
    doc.save('pacientes.pdf');
  };

  const exportExcel = () => {
    const data = pacientes.map(p => ({
      Nombre: p.nombre,
      'Teléfono': p.telefono,
      Email: p.email || '',
      'Fecha Nacimiento': p.fecha_nacimiento || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
    XLSX.writeFile(wb, 'pacientes.xlsx');
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(pacientes.length / PAGE_SIZE));
  const paginatedPacientes = pacientes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIdx = (page - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(page * PAGE_SIZE, pacientes.length);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground mt-1">{pacientes.length} registrados</p>
        </div>
        <Button onClick={openNew} size="default">
          <Plus size={18} /> Nuevo paciente
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card>
        <div className="p-6 pb-4">
          <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full h-12 pl-11 pr-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Buscar por nombre, teléfono o email..."
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary">Buscar</Button>
            <Button type="button" variant="outline" size="sm" onClick={exportPDF}>
              <Download size={16} /> Exportar PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet size={16} /> Exportar Excel
            </Button>
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
                  {paginatedPacientes.map((p, i) => (
                    <motion.tr key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold bg-primary/10 text-primary">
                            {p.nombre ? p.nombre.charAt(0).toUpperCase() : '?'}
                          </div>
                          {p.nombre}
                        </div>
                      </td>
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
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center justify-center py-12">
              <Users size={36} className="text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-center">
                {buscar ? `No se encontraron pacientes con "${buscar}"` : 'No hay pacientes registrados'}
              </p>
            </motion.div>
          )}
        </CardContent>
        {pacientes.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {startIdx}-{endIdx} de {pacientes.length}
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

      <Dialog open={dialog} onClose={() => setDialog(false)} title={editing ? 'Editar paciente' : 'Nuevo paciente'}>
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre *" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Juan Pérez" />
            <Input label="Teléfono *" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} required placeholder="59891234567" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
