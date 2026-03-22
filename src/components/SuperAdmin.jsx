import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog } from './ui/dialog';
import { Plus, Building2, Users, Pencil, Eye, Wifi, WifiOff, QrCode, RefreshCw, Phone, Activity, MessageSquare, CalendarCheck, AlertTriangle, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api, setClinicaId } from '../lib/utils';

const emptyClinica = { nombre: '', slug: '', instance_name: '' };
const emptyUsuario = { username: '', password: '', nombre: '', rol: 'admin', clinica_id: '' };

const STATUS_MAP = {
  open: { label: 'Conectado', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300', icon: Wifi },
  connecting: { label: 'Conectando...', color: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300', icon: RefreshCw },
  close: { label: 'Desconectado', color: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300', icon: WifiOff },
  not_found: { label: 'Sin instancia', color: 'bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-300', icon: WifiOff },
};

function ConnectionBadge({ status }) {
  const info = STATUS_MAP[status] || STATUS_MAP.not_found;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${info.color}`}>
      <Icon size={12} />
      {info.label}
    </span>
  );
}

export function SuperAdmin() {
  const [tab, setTab] = useState('clinicas');
  const [clinicas, setClinicas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [dialogClinica, setDialogClinica] = useState(false);
  const [dialogUsuario, setDialogUsuario] = useState(false);
  const [dialogQR, setDialogQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [qrClinicaName, setQrClinicaName] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrClinicaId, setQrClinicaId] = useState(null);
  const [qrConnected, setQrConnected] = useState(false);
  const [formClinica, setFormClinica] = useState(emptyClinica);
  const [formUsuario, setFormUsuario] = useState(emptyUsuario);
  const [editingClinica, setEditingClinica] = useState(null);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [error, setError] = useState('');
  const [qrError, setQrError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [monitoreo, setMonitoreo] = useState([]);
  const [monitoreoLoading, setMonitoreoLoading] = useState(false);

  const loadClinicas = () => api('/admin/clinicas').then(setClinicas).catch(console.error);
  const loadUsuarios = () => api('/admin/usuarios').then(setUsuarios).catch(console.error);
  const loadMonitoreo = async () => {
    setMonitoreoLoading(true);
    try {
      const data = await api('/admin/monitoreo');
      setMonitoreo(data);
    } catch (err) {
      console.error('Error cargando monitoreo:', err);
    }
    setMonitoreoLoading(false);
  };

  useEffect(() => { loadClinicas(); loadUsuarios(); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClinicas();
    setRefreshing(false);
  };

  const handleSaveClinica = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingClinica) {
        await api(`/admin/clinicas/${editingClinica}`, { method: 'PUT', body: formClinica });
      } else {
        const result = await api('/admin/clinicas', { method: 'POST', body: formClinica });
        // If QR code returned, show it
        if (result.qrcode) {
          setQrData(result.qrcode);
          setQrClinicaName(formClinica.nombre);
          setDialogQR(true);
        }
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

  const fetchQR = async (clinicaId) => {
    try {
      setQrError('');
      const result = await api(`/admin/clinicas/${clinicaId}/qrcode`);
      return result.base64 || result.qrcode?.base64 || result.code || null;
    } catch (err) {
      console.error(err);
      setQrError(err.message || 'Error al obtener QR');
      return null;
    }
  };

  const checkStatus = async (clinicaId) => {
    try {
      const result = await api(`/admin/clinicas/${clinicaId}/status`);
      return result.connection_status;
    } catch {
      return null;
    }
  };

  const showQR = async (clinicaId, clinicaNombre) => {
    setQrLoading(true);
    setQrClinicaName(clinicaNombre);
    setQrClinicaId(clinicaId);
    setQrConnected(false);
    setDialogQR(true);
    setQrData(null);
    setQrError('');
    const qr = await fetchQR(clinicaId);
    setQrData(qr);
    setQrLoading(false);
  };

  // Auto-refresh QR every 15 seconds and check connection status
  useEffect(() => {
    if (!dialogQR || !qrClinicaId || qrConnected) return;

    const interval = setInterval(async () => {
      // First check if already connected
      const status = await checkStatus(qrClinicaId);
      if (status === 'open') {
        setQrConnected(true);
        loadClinicas();
        return;
      }
      // If not connected, refresh QR
      const qr = await fetchQR(qrClinicaId);
      if (qr) setQrData(qr);
    }, 15000);

    return () => clearInterval(interval);
  }, [dialogQR, qrClinicaId, qrConnected]);

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
        <Button variant={tab === 'monitoreo' ? 'default' : 'outline'} onClick={() => { setTab('monitoreo'); if (monitoreo.length === 0) loadMonitoreo(); }}>
          <Activity size={18} /> Monitoreo
        </Button>
      </div>

      {tab === 'clinicas' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /> Actualizar estados
            </Button>
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
                        <th className="pb-3 font-medium text-muted-foreground hidden md:table-cell">Instancia</th>
                        <th className="pb-3 font-medium text-muted-foreground">WhatsApp</th>
                        <th className="pb-3 font-medium text-muted-foreground text-center">Pacientes</th>
                        <th className="pb-3 font-medium text-muted-foreground text-center">Citas</th>
                        <th className="pb-3 font-medium text-muted-foreground text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicas.map((c, i) => (
                        <motion.tr key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                          <td className="py-4">
                            <div className="font-medium">{c.nombre}</div>
                            <div className="text-xs text-muted-foreground">{c.slug}</div>
                          </td>
                          <td className="py-4 font-mono text-sm hidden md:table-cell">{c.instance_name}</td>
                          <td className="py-4">
                            <div className="flex flex-col gap-1">
                              <ConnectionBadge status={c.connection_status} />
                              {c.whatsapp_number && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone size={10} /> +{c.whatsapp_number}
                                </span>
                              )}
                              {c.profile_name && (
                                <span className="text-xs text-muted-foreground">{c.profile_name}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 tabular-nums text-center">{c.total_pacientes}</td>
                          <td className="py-4 tabular-nums text-center">{c.total_citas}</td>
                          <td className="py-4 text-right">
                            <div className="flex gap-1 justify-end">
                              {c.connection_status !== 'open' && (
                                <Button variant="ghost" size="icon" onClick={() => showQR(c.id, c.nombre)} title="Conectar WhatsApp (QR)">
                                  <QrCode size={16} />
                                </Button>
                              )}
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

      {tab === 'monitoreo' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={loadMonitoreo} disabled={monitoreoLoading}>
              <RefreshCw size={18} className={monitoreoLoading ? 'animate-spin' : ''} /> Actualizar métricas
            </Button>
          </div>

          {monitoreoLoading && monitoreo.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3" />
              <p>Cargando métricas...</p>
            </div>
          ) : monitoreo.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No hay datos de monitoreo disponibles</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {monitoreo.map((m, i) => {
                const riskConfig = {
                  bajo: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300', icon: ShieldCheck, border: 'border-emerald-200 dark:border-emerald-500/30' },
                  medio: { color: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300', icon: Shield, border: 'border-amber-200 dark:border-amber-500/30' },
                  alto: { color: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300', icon: ShieldAlert, border: 'border-red-200 dark:border-red-500/30' },
                };
                const risk = riskConfig[m.riesgo] || riskConfig.bajo;
                const RiskIcon = risk.icon;

                return (
                  <motion.div key={m.clinica_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <Card className={`border-2 ${risk.border}`}>
                      <CardContent className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{m.clinica_nombre}</h3>
                            <p className="text-xs text-muted-foreground font-mono">{m.instance_name}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ConnectionBadge status={m.connection_status} />
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${risk.color}`}>
                              <RiskIcon size={12} />
                              Riesgo {m.riesgo}
                            </span>
                          </div>
                        </div>

                        {/* WhatsApp info */}
                        {m.whatsapp_number && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone size={14} /> +{m.whatsapp_number}
                            {m.profile_name && <span>· {m.profile_name}</span>}
                          </div>
                        )}

                        {/* Metrics grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <MessageSquare size={16} className="mx-auto mb-1 text-blue-500" />
                            <p className="text-xl font-bold tabular-nums">{m.bot_msgs_total || 0}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Mensajes bot</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <Users size={16} className="mx-auto mb-1 text-violet-500" />
                            <p className="text-xl font-bold tabular-nums">{m.bot_contactos_unicos || 0}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Contactos</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <CalendarCheck size={16} className="mx-auto mb-1 text-emerald-500" />
                            <p className="text-xl font-bold tabular-nums">{m.recordatorios_24h || 0}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Recordatorios 24h</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <CalendarCheck size={16} className="mx-auto mb-1 text-amber-500" />
                            <p className="text-xl font-bold tabular-nums">{m.recordatorios_1h || 0}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight">Recordatorios 1h</p>
                          </div>
                        </div>

                        {/* Bot vs Human breakdown */}
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">Bot: <strong>{m.bot_msgs_ia || 0}</strong></span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">Humanos: <strong>{m.bot_msgs_humanos || 0}</strong></span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">Citas: <strong>{m.total_citas || 0}</strong></span>
                          {m.bot_msgs_por_dia > 0 && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-muted-foreground">{m.bot_msgs_por_dia} msgs/día</span>
                            </>
                          )}
                        </div>

                        {/* Risk detail */}
                        {m.riesgo !== 'bajo' && (
                          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${risk.color}`}>
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            <span>{m.riesgo_detalle || (m.riesgo === 'alto' ? 'Alto volumen de mensajes. Considerá reducir la frecuencia.' : 'Volumen moderado. Monitoreá la actividad.')}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Dialog: Nueva/Editar Clínica */}
      <Dialog open={dialogClinica} onClose={() => setDialogClinica(false)} title={editingClinica ? 'Editar clínica' : 'Nueva clínica'}>
        <form onSubmit={handleSaveClinica} className="space-y-4">
          {error && <div className="bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 rounded-lg px-4 py-3 text-sm">{error}</div>}
          <Input label="Nombre de la clínica *" value={formClinica.nombre} onChange={e => setFormClinica({ ...formClinica, nombre: e.target.value })} required placeholder="Clínica Dental Sonrisa" />
          <Input label="Slug (identificador único) *" value={formClinica.slug} onChange={e => setFormClinica({ ...formClinica, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required placeholder="clinica-sonrisa" />
          <Input label="Nombre de instancia Evolution API *" value={formClinica.instance_name} onChange={e => setFormClinica({ ...formClinica, instance_name: e.target.value })} required placeholder="bot-clinica-sonrisa" />
          {!editingClinica && (
            <p className="text-xs text-muted-foreground">Al crear la clínica se crea automáticamente la instancia en Evolution API y te muestra el QR para conectar WhatsApp.</p>
          )}
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

      {/* Dialog: QR Code */}
      <Dialog open={dialogQR} onClose={() => { setDialogQR(false); setQrClinicaId(null); }} title={`Conectar WhatsApp - ${qrClinicaName}`}>
        <div className="flex flex-col items-center gap-4">
          {qrConnected ? (
            <div className="py-8 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Wifi size={48} className="mx-auto text-emerald-500 mb-3" />
              </motion.div>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">WhatsApp conectado</p>
              <p className="text-sm text-muted-foreground mt-1">La clínica ya está vinculada correctamente</p>
            </div>
          ) : qrLoading ? (
            <div className="py-12 text-center">
              <RefreshCw size={32} className="animate-spin mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Generando QR...</p>
            </div>
          ) : qrData ? (
            <>
              <p className="text-sm text-muted-foreground text-center">Escaneá este código QR con WhatsApp en el celular de la clínica</p>
              <div className="bg-white p-4 rounded-xl">
                <img src={qrData.startsWith('data:') ? qrData : `data:image/png;base64,${qrData}`} alt="QR Code" className="w-64 h-64" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw size={12} className="animate-spin" />
                El QR se actualiza automáticamente cada 15 segundos
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-2">No se pudo generar el QR.</p>
              {qrError && <p className="text-xs text-red-500 mb-2">{qrError}</p>}
              <p className="text-xs text-muted-foreground">La instancia puede estar ya conectada o hubo un error. Intentá actualizar los estados.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => showQR(qrClinicaId, qrClinicaName)}>
                Reintentar
              </Button>
            </div>
          )}
          <Button variant="outline" onClick={() => { setDialogQR(false); setQrClinicaId(null); }} className="w-full">Cerrar</Button>
        </div>
      </Dialog>
    </div>
  );
}
