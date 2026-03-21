import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Users, CalendarDays, Clock, TrendingUp, Bell, XCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/utils';

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

function StatCard({ icon: Icon, value, label, detail, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardContent className="p-6 flex items-center gap-5">
          <motion.div
            className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Icon size={22} className="text-foreground" strokeWidth={1.8} />
          </motion.div>
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

function BarChart({ data, labelKey, valueKey, color = 'bg-primary' }) {
  const max = Math.max(...data.map(d => parseInt(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d, i) => {
        const val = parseInt(d[valueKey]) || 0;
        const h = max > 0 ? (val / max) * 100 : 0;
        const label = d[labelKey] || '';
        const shortLabel = label.length > 7 ? label.slice(5) : label;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs tabular-nums font-medium">{val}</span>
            <div className="w-full flex justify-center">
              <motion.div
                className={`w-full max-w-[40px] rounded-t-md ${color}`}
                initial={{ height: '4%' }}
                animate={{ height: `${Math.max(h, 4)}%` }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[50px]">{shortLabel}</span>
          </div>
        );
      })}
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

export function Dashboard() {
  const [data, setData] = useState({ totalPacientes: 0, citasHoy: [], proximasCitas: [] });
  const [metricas, setMetricas] = useState(null);

  useEffect(() => {
    api('/dashboard').then(setData).catch(console.error);
    api('/metricas').then(setMetricas).catch(console.error);
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
    ...m,
    label: MESES[m.mes?.split('-')[1]] || m.mes
  }));

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

      {/* Metrics row */}
      {metricas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10">
          {/* No-show breakdown */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <div className="p-6 pb-4">
                <h2 className="text-lg font-semibold">Últimos 30 días</h2>
              </div>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> Completadas</span>
                    <span className="font-medium">{completadas}</span>
                  </div>
                  <MiniBar value={completadas} max={totalMes} color="bg-emerald-500" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><XCircle size={14} className="text-red-500" /> Canceladas</span>
                    <span className="font-medium">{canceladas}</span>
                  </div>
                  <MiniBar value={canceladas} max={totalMes} color="bg-red-500" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><Clock size={14} className="text-amber-500" /> No-show</span>
                    <span className="font-medium">{noShow}</span>
                  </div>
                  <MiniBar value={noShow} max={totalMes} color="bg-amber-500" />
                </div>
                <p className="text-sm text-muted-foreground pt-2 border-t">Total: {totalMes} citas en 30 días</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Citas por mes chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card>
              <div className="p-6 pb-4">
                <h2 className="text-lg font-semibold">Citas por mes</h2>
              </div>
              <CardContent>
                {citasMesChart.length > 0 ? (
                  <BarChart data={citasMesChart} labelKey="label" valueKey="total" />
                ) : (
                  <p className="text-muted-foreground text-center py-8 text-sm">Sin datos aún</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recordatorios detail */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <Card>
              <div className="p-6 pb-4">
                <h2 className="text-lg font-semibold">Recordatorios</h2>
                <p className="text-sm text-muted-foreground">Últimos 30 días</p>
              </div>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-base">24 horas antes</span>
                  <span className="text-2xl font-bold tabular-nums">{rec.enviados_24h || 0}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-base">1 hora antes</span>
                  <span className="text-2xl font-bold tabular-nums">{rec.enviados_1h || 0}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-base font-medium">Total enviados</span>
                  <span className="text-2xl font-bold tabular-nums">{totalRecordatorios}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Today + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card>
            <div className="p-6 pb-4">
              <h2 className="text-lg font-semibold">Citas de hoy</h2>
            </div>
            <CardContent>
              {data.citasHoy.length > 0 ? (
                <div className="space-y-3">
                  {data.citasHoy.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold tabular-nums">{formatTime(c.hora_cita)}</span>
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
                <p className="text-muted-foreground text-center py-8">No hay citas para hoy</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <Card>
            <div className="p-6 pb-4">
              <h2 className="text-lg font-semibold">Próximas citas</h2>
            </div>
            <CardContent>
              {data.proximasCitas.length > 0 ? (
                <div className="space-y-3">
                  {data.proximasCitas.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex items-center gap-4">
                        <div className="text-center leading-tight">
                          <span className="text-sm text-muted-foreground">{formatDate(c.fecha_cita)}</span>
                          <p className="text-base font-semibold tabular-nums">{formatTime(c.hora_cita)}</p>
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
                <p className="text-muted-foreground text-center py-8">No hay citas próximas</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
