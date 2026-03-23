import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Users, CalendarDays, Clock, TrendingUp, Bell, XCircle, CheckCircle2, Wifi, WifiOff, MessageCircle } from 'lucide-react';
import { api } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Onboarding } from './Onboarding';

function AnimatedNumber({ value }) {
  const num = typeof value === 'string' ? parseInt(value) : value;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (isNaN(num)) return;
    const duration = 800;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * num));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [num]);
  if (typeof value === 'string' && value.includes('%')) return `${display}%`;
  return display;
}

const STAT_STYLES = [
  { bg: 'bg-sky-50 dark:bg-sky-500/10', icon: 'text-sky-600 dark:text-sky-400', accent: 'border-l-sky-500' },
  { bg: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', accent: 'border-l-emerald-500' },
  { bg: 'bg-violet-50 dark:bg-violet-500/10', icon: 'text-violet-600 dark:text-violet-400', accent: 'border-l-violet-500' },
  { bg: 'bg-amber-50 dark:bg-amber-500/10', icon: 'text-amber-600 dark:text-amber-400', accent: 'border-l-amber-500' },
];

function StatCard({ icon: Icon, value, label, detail, index }) {
  const style = STAT_STYLES[index % STAT_STYLES.length];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className={`hover:shadow-md transition-shadow duration-300 border-l-4 ${style.accent}`}>
        <CardContent className="p-5 flex items-center gap-4">
          <div className={`h-12 w-12 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}>
            <Icon size={22} className={style.icon} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight"><AnimatedNumber value={value} /></p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function MiniBar({ value, max, color = 'bg-primary' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-sm tabular-nums font-medium w-10 text-right">{pct}%</span>
    </div>
  );
}

function formatTime(t) {
  return String(t).substring(0, 5);
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('T')[0].split('-');
  return new Date(y, m - 1, day).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

const MESES = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' };

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function WhatsAppStatus() {
  const [ws, setWs] = useState(null);
  useEffect(() => {
    api('/whatsapp-status').then(setWs).catch(() => {});
  }, []);

  if (!ws) return null;

  const connected = ws.status === 'open';
  const statusLabel = connected ? 'Conectado' : ws.status === 'close' ? 'Desconectado' : ws.status === 'not_found' ? 'No configurado' : 'Sin conexión';
  const statusColor = connected
    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30';
  const iconColor = connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
  const StatusIcon = connected ? Wifi : WifiOff;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <Card className={`border ${statusColor}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${connected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                <MessageCircle size={20} className={iconColor} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-medium">WhatsApp Bot</p>
                <p className="text-xs text-muted-foreground">{ws.instance_name || 'Instancia'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon size={16} className={iconColor} />
              <span className={`text-sm font-medium ${iconColor}`}>{statusLabel}</span>
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
          </div>
          {ws.whatsapp_number && (
            <p className="text-xs text-muted-foreground mt-2">Número: +{ws.whatsapp_number} {ws.profile_name ? `(${ws.profile_name})` : ''}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function Dashboard() {
  const [data, setData] = useState({ totalPacientes: 0, citasHoy: [], proximasCitas: [] });
  const [metricas, setMetricas] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [configChecked, setConfigChecked] = useState(false);

  useEffect(() => {
    api('/dashboard').then(setData).catch(console.error);
    api('/metricas').then(setMetricas).catch(console.error);
    // Check if config is empty (needs onboarding)
    api('/configuracion').then(cfg => {
      if (!cfg.nombre_clinica || cfg.nombre_clinica === 'Mi Clínica Dental') {
        setShowOnboarding(true);
      }
      setConfigChecked(true);
    }).catch(() => setConfigChecked(true));
  }, []);

  const r = metricas?.resumen || {};
  const totalMes = parseInt(r.total_citas) || 0;
  const completadas = parseInt(r.completadas) || 0;
  const canceladas = parseInt(r.canceladas) || 0;
  const noShow = parseInt(r.no_show) || 0;
  const tasaNoShow = totalMes > 0 ? Math.round(((canceladas + noShow) / totalMes) * 100) : 0;
  const rec = metricas?.recordatorios || {};
  const totalRecordatorios = (parseInt(rec.enviados_24h) || 0) + (parseInt(rec.enviados_1h) || 0);

  const citasMesChart = (metricas?.citasPorMes || []).map(m => ({
    mes: MESES[m.mes?.split('-')[1]] || m.mes,
    total: parseInt(m.total) || 0,
  }));

  // Donut chart data
  const donutData = [
    { name: 'Completadas', value: completadas },
    { name: 'Canceladas', value: canceladas },
    { name: 'No asistió', value: noShow },
    { name: 'Otras', value: Math.max(0, totalMes - completadas - canceladas - noShow) },
  ].filter(d => d.value > 0);

  if (showOnboarding && configChecked) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div>
      <div className="mb-6 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Bienvenido</h1>
        <p className="text-muted-foreground mt-1">Resumen de tu clínica</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6 sm:mb-10">
        <StatCard icon={Users} value={data.totalPacientes} label="Pacientes registrados" index={0} />
        <StatCard icon={CalendarDays} value={data.citasHoy.length} label="Citas hoy" index={1} />
        <StatCard icon={Bell} value={totalRecordatorios} label="Recordatorios enviados" detail="Últimos 30 días" index={2} />
        <StatCard icon={TrendingUp} value={`${100 - tasaNoShow}%`} label="Tasa de asistencia" detail="Últimos 30 días" index={3} />
      </div>

      {/* WhatsApp status */}
      <div className="mb-6 sm:mb-10">
        <WhatsAppStatus />
      </div>

      {/* Charts row */}
      {metricas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10">
          {/* Donut - Distribución de citas */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="h-full">
              <div className="p-6 pb-2">
                <h2 className="text-lg font-semibold">Distribución de citas</h2>
                <p className="text-sm text-muted-foreground">Últimos 30 días</p>
              </div>
              <CardContent>
                {donutData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                      {donutData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-muted-foreground">{d.name}</span>
                          <span className="font-medium">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sin datos aún</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Bar chart - Citas por mes */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="h-full">
              <div className="p-6 pb-2">
                <h2 className="text-lg font-semibold">Citas por mes</h2>
              </div>
              <CardContent>
                {citasMesChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={citasMesChart} barSize={32}>
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} width={30} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                      <Bar dataKey="total" name="Citas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-12 text-sm">Sin datos aún</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recordatorios detail */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Card className="h-full">
              <div className="p-6 pb-2">
                <h2 className="text-lg font-semibold">Recordatorios</h2>
                <p className="text-sm text-muted-foreground">Últimos 30 días</p>
              </div>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                      <Clock size={16} className="text-violet-600 dark:text-violet-400" strokeWidth={1.8} />
                    </div>
                    <span className="text-sm">24 horas antes</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{rec.enviados_24h || 0}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                      <Bell size={16} className="text-amber-600 dark:text-amber-400" strokeWidth={1.8} />
                    </div>
                    <span className="text-sm">1 hora antes</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{rec.enviados_1h || 0}</span>
                </div>
                <div className="flex items-center justify-between py-3 bg-secondary/50 rounded-lg px-3 -mx-3">
                  <span className="text-sm font-medium">Total enviados</span>
                  <span className="text-2xl font-bold tabular-nums text-primary">{totalRecordatorios}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Desglose últimos 30 días */}
      {metricas && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="lg:col-span-3">
            <Card>
              <div className="p-6 pb-4">
                <h2 className="text-lg font-semibold">Desglose últimos 30 días</h2>
              </div>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Completadas</span>
                      <span className="font-semibold">{completadas}</span>
                    </div>
                    <MiniBar value={completadas} max={totalMes} color="bg-emerald-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="flex items-center gap-2"><XCircle size={14} className="text-red-500" /> Canceladas</span>
                      <span className="font-semibold">{canceladas}</span>
                    </div>
                    <MiniBar value={canceladas} max={totalMes} color="bg-red-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="flex items-center gap-2"><Clock size={14} className="text-amber-500" /> No-show</span>
                      <span className="font-semibold">{noShow}</span>
                    </div>
                    <MiniBar value={noShow} max={totalMes} color="bg-amber-500" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-4 mt-4 border-t">Total: <span className="font-semibold text-foreground">{totalMes}</span> citas en los últimos 30 días</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Today + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="h-full">
            <div className="p-6 pb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Citas de hoy</h2>
              {data.citasHoy.length > 0 && (
                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  {data.citasHoy.length} cita{data.citasHoy.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <CardContent>
              {data.citasHoy.length > 0 ? (
                <div className="space-y-1">
                  {data.citasHoy.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[48px]">
                          <span className="text-lg font-semibold tabular-nums text-primary">{formatTime(c.hora_cita)}</span>
                        </div>
                        <div>
                          <p className="font-medium">{c.paciente_nombre}</p>
                          <p className="text-sm text-muted-foreground">{c.tipo_cita}</p>
                        </div>
                      </div>
                      <Badge status={c.estado} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <CalendarDays size={36} className="mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
                  <p className="text-muted-foreground">No hay citas para hoy</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card className="h-full">
            <div className="p-6 pb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Próximas citas</h2>
              {data.proximasCitas.length > 0 && (
                <span className="text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                  {data.proximasCitas.length} próxima{data.proximasCitas.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <CardContent>
              {data.proximasCitas.length > 0 ? (
                <div className="space-y-1">
                  {data.proximasCitas.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[48px] leading-tight">
                          <span className="text-xs text-muted-foreground block">{formatDate(c.fecha_cita)}</span>
                          <p className="text-base font-semibold tabular-nums text-primary">{formatTime(c.hora_cita)}</p>
                        </div>
                        <div>
                          <p className="font-medium">{c.paciente_nombre}</p>
                          <p className="text-sm text-muted-foreground">{c.tipo_cita}</p>
                        </div>
                      </div>
                      <Badge status={c.estado} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Clock size={36} className="mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.5} />
                  <p className="text-muted-foreground">No hay citas próximas</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
