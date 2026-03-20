import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Users, CalendarDays, Clock } from 'lucide-react';
import { api } from '../lib/utils';

function StatCard({ icon: Icon, value, label, delay }) {
  return (
    <Card className={`animate-fade-in ${delay}`}>
      <CardContent className="p-6 flex items-center gap-5">
        <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <Icon size={22} className="text-foreground" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTime(t) {
  return String(t).substring(0, 5);
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
}

export function Dashboard() {
  const [data, setData] = useState({ totalPacientes: 0, citasHoy: [], proximasCitas: [] });

  useEffect(() => {
    api('/dashboard').then(setData).catch(console.error);
  }, []);

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Bienvenido</h1>
        <p className="text-muted-foreground mt-1">Resumen de tu clínica</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <StatCard icon={Users} value={data.totalPacientes} label="Pacientes registrados" delay="" />
        <StatCard icon={CalendarDays} value={data.citasHoy.length} label="Citas hoy" delay="animate-stagger-1" />
        <StatCard icon={Clock} value={data.proximasCitas.length} label="Próximas citas" delay="animate-stagger-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="animate-fade-in animate-stagger-2">
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

        <Card className="animate-fade-in animate-stagger-3">
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
      </div>
    </div>
  );
}
