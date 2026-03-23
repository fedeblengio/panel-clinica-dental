import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { User, Shield, Building2, Lock, KeyRound } from 'lucide-react';
import { api } from '../lib/utils';

export function MiCuenta() {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwError, setPwError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/session')
      .then(r => r.json())
      .then(d => { if (d.authenticated) setUser(d); });
    api('/configuracion')
      .then(d => setConfig(d))
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    setPwError(null);

    if (!currentPassword || !newPassword) {
      setPwError('Completá todos los campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (newPassword.length < 4) {
      setPwError('La contraseña debe tener al menos 4 caracteres');
      return;
    }

    setLoading(true);
    try {
      const data = await api('/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      if (data.ok) {
        setPwMsg('Contraseña cambiada correctamente');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwError(data.error || 'Error al cambiar contraseña');
      }
    } catch {
      setPwError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const isSuperadmin = user?.rol === 'superadmin';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold tracking-tight">Mi Cuenta</h1>
        <p className="text-muted-foreground mt-1">Información de tu cuenta y configuración de seguridad</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* User info card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Información de usuario</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Usuario</span>
                    <p className="font-medium">{user?.username || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Nombre</span>
                    <p className="font-medium">{user?.nombre || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Rol</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isSuperadmin
                          ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300'
                          : 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {isSuperadmin ? 'Super Admin' : 'Administrador'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Clínica</span>
                    <p className="font-medium">{user?.clinicaNombre || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Change password card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Contraseña actual</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="pl-10"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Nueva contraseña</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="pl-10"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Confirmar nueva contraseña</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  {pwError && <p className="text-sm text-red-500">{pwError}</p>}
                  {pwMsg && <p className="text-sm text-green-600 dark:text-green-400">{pwMsg}</p>}
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Cambiando...' : 'Cambiar contraseña'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column - Clinic info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Información de la clínica</h2>
              </div>
              {config ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Nombre</span>
                    <p className="font-medium">{config.nombre_clinica || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Dirección</span>
                    <p className="font-medium">{config.direccion || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Teléfono</span>
                    <p className="font-medium">{config.telefono || '—'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <p className="font-medium">{config.email || '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Cargando información...</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
