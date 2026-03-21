import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog } from './ui/dialog';
import { Plus, Building2, Users, Pencil, Eye } from 'lucide-react';
import { api, setClinicaId } from '../lib/utils';

const emptyClinica = { nombre: '', slug: '', instance_name: '' };
const emptyUsuario = { username: '', password: '', nombre: '', rol: 'admin', clinica_id: '' };

export function SuperAdmin() {
  const [tab, setTab] = useState('clinicas');
  const [clinicas, setClinicas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [dialogClinica, setDialogClinica] = useState(false);
  const [dialogUsuario, setDialogUsuario] = useState(false);
  const [formClinica, setFormClinica] = useState(emptyClinica);
  const [formUsuario, setFormUsuario] = useState(emptyUsuario);
  const [editingClinica, setEditingClinica] = useState(null);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [error, setError] = useState('');

  const loadClinicas = () => api('/admin/clinicas').then(setClinicas).catch(console.error);
  const loadUsuarios = () => api('/admin/usuarios').then(setUsuarios).catch(console.error);

  useEffect(() => { loadClinicas(); loadUsuarios(); }, []);

  const handleSaveClinica = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingClinica) {
        await api(`/admin/clinicas/${editingClinica}`, { method: 'PUT', body: formClinica });
      } else {
        await api('/admin/clinicas', { method: 'POST', body: formClinica });
      }
      setDialogClinica(false);
      loadClinicas();
    } catch (err) { setError(err.message); }
  };

  const handleSaveUsuario = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = { ...formUsuario, clinica_id: formUsuario.clinica_id || null };
      if (editingUsuario) {
        await api(`/admin/usuarios/${editingUsuario}`, { method: 'PUT', body });
      } else {
        await api('/admin/usuarios', { method: 'POST', body });
      }
      setDialogUsuario(false);
      loadUsuarios();
    } catch (err) { setError(err.message); }
  };

  const switchToClinica = async (clinicaId) => {
    await api('/admin/switch-clinica', { method: 'POST', body: { clinicaId } });
    setClinicaId(clinicaId);
    window.location.href = '/';
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Super Admin</h1>
        <p className="text-muted-foreground mt-1">Gestión de clínicas y usuarios</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button variant={tab === 'clinicas' ? 'default' : 'outline'} onClick={() => setTab('clinicas')}>
          <Building2 size={18} /> Clínicas ({clinicas.length})
        </Button>
        <Button variant={tab === 'usuarios' ? 'default' : 'outline'} onClick={() => setTab('usuarios')}>
          <Users size={18} /> Usuarios ({usuarios.length})
        </Button>
      </div>

      {tab === 'clinicas' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setFormClinica(emptyClinica); setEditingClinica(null); setError(''); setDialogClinica(true); }}>
              <Plus size={18} /> Nueva clínica
            </Button>
          </div>
          <Card>
            <CardContent>
              {clinicas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Nombre</th>
                        <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Slug</th>
                        <th className="pb-3 font-medium text-muted-foreground hidden lg:table-cell">Instancia</th>
                        <th className="pb-3 font-medium text-muted-foreground">Pacientes</th>
                        <th className="pb-3 font-medium text-muted-foreground">Citas</th>
                        <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                        <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicas.map((c, i) => (
                        <motion.tr key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-4 font-medium">{c.nombre}</td>
                          <td className="py-4 text-muted-foreground hidden md:table-cell">{c.slug}</td>
                          <td className="py-4 font-mono text-sm hidden lg:table-cell">{c.instance_name}</td>
                          <td className="py-4 tabular-nums">{c.total_pacientes}</td>
                          <td className="py-4 tabular-nums">{c.total_citas}</td>
                          <td className="py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${c.activa ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'}`}>
                              {c.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => switchToClinica(c.id)} title="Ver como esta clínica">
                                <Eye size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => {
                                setFormClinica({ nombre: c.nombre, slug: c.slug, instance_name: c.instance_name, activa: c.activa });
                                setEditingClinica(c.id);
                                setError('');
                                setDialogClinica(true);
                              }}>
                                <Pencil size={16} />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">No hay clínicas registradas</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {tab === 'usuarios' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setFormUsuario(emptyUsuario); setEditingUsuario(null); setError(''); setDialogUsuario(true); }}>
              <Plus size={18} /> Nuevo usuario
            </Button>
          </div>
          <Card>
            <CardContent>
              {usuarios.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-muted-foreground">Nombre</th>
                        <th className="pb-3 font-medium text-muted-foreground">Usuario</th>
                        <th className="pb-3 font-medium text-muted-foreground">Rol</th>
                        <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Clínica</th>
                        <th className="pb-3 font-medium text-muted-foreground">Estado</th>
                        <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u, i) => (
                        <motion.tr key={u.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-4 font-medium">{u.nombre}</td>
                          <td className="py-4">{u.username}</td>
                          <td className="py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${u.rol === 'superadmin' ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300'}`}>
                              {u.rol === 'superadmin' ? 'Super Admin' : 'Admin Clínica'}
                            </span>
                          </td>
                          <td className="py-4 text-muted-foreground hidden md:table-cell">{u.clinica_nombre || 'Todas'}</td>
                          <td className="py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${u.activo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'}`}>
                              {u.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setFormUsuario({ username: u.username, password: '', nombre: u.nombre, rol: u.rol, clinica_id: u.clinica_id || '', activo: u.activo });
                              setEditingUsuario(u.id);
                              setError('');
                              setDialogUsuario(true);
                            }}>
                              <Pencil size={16} />
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">No hay usuarios registrados</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dialog: Nueva/Editar Clínica */}
      <Dialog open={dialogClinica} onClose={() => setDialogClinica(false)} title={editingClinica ? 'Editar clínica' : 'Nueva clínica'}>
        <form onSubmit={handleSaveClinica} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <Input label="Nombre de la clínica *" value={formClinica.nombre} onChange={e => setFormClinica({ ...formClinica, nombre: e.target.value })} required placeholder="Clínica Dental Sonrisa" />
          <Input label="Slug (identificador único) *" value={formClinica.slug} onChange={e => setFormClinica({ ...formClinica, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required placeholder="clinica-sonrisa" />
          <Input label="Nombre de instancia Evolution API *" value={formClinica.instance_name} onChange={e => setFormClinica({ ...formClinica, instance_name: e.target.value })} required placeholder="bot-clinica-sonrisa" />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editingClinica ? 'Guardar cambios' : 'Crear clínica'}</Button>
            <Button type="button" variant="outline" onClick={() => setDialogClinica(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Nuevo/Editar Usuario */}
      <Dialog open={dialogUsuario} onClose={() => setDialogUsuario(false)} title={editingUsuario ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={handleSaveUsuario} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre completo *" value={formUsuario.nombre} onChange={e => setFormUsuario({ ...formUsuario, nombre: e.target.value })} required placeholder="Dr. Juan Pérez" />
            <Input label="Usuario *" value={formUsuario.username} onChange={e => setFormUsuario({ ...formUsuario, username: e.target.value })} required placeholder="juanperez" />
          </div>
          <Input label={editingUsuario ? "Nueva contraseña (vacío = no cambiar)" : "Contraseña *"} type="password" value={formUsuario.password} onChange={e => setFormUsuario({ ...formUsuario, password: e.target.value })} required={!editingUsuario} placeholder="••••••••" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Rol *</label>
              <select className="w-full h-12 px-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring" value={formUsuario.rol} onChange={e => setFormUsuario({ ...formUsuario, rol: e.target.value })}>
                <option value="admin">Admin Clínica</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Clínica asignada</label>
              <select className="w-full h-12 px-4 rounded-lg border border-input bg-background text-base focus:outline-none focus:ring-2 focus:ring-ring" value={formUsuario.clinica_id} onChange={e => setFormUsuario({ ...formUsuario, clinica_id: e.target.value })}>
                <option value="">Sin asignar (Super Admin)</option>
                {clinicas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editingUsuario ? 'Guardar cambios' : 'Crear usuario'}</Button>
            <Button type="button" variant="outline" onClick={() => setDialogUsuario(false)}>Cancelar</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
