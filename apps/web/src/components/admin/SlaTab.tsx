'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { Cargando, ErrorPanel, UrgenciaBadge } from '@/components/ui';
import { API } from '@/lib/api';
import { SLA_DEFAULT } from '@/lib/constants';

const URGENCIAS = [
  { u: 'Crítica', nota: 'Incidente de seguridad en curso' },
  { u: 'Alta', nota: 'Bloqueo operativo relevante' },
  { u: 'Media', nota: 'Afectación parcial del trabajo' },
  { u: 'Baja', nota: 'Solicitud sin bloqueo' },
];

type Config = Record<string, { respuesta: number; resolucion: number }>;

export function SlaTab() {
  const { toast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<any>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    API.admin
      .sla()
      .then((r: any) => setConfig(r || SLA_DEFAULT))
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div className="panel">
        <ErrorPanel error={error} />
      </div>
    );
  }
  if (!config) return <Cargando />;

  const cambiar = (urgencia: string, campo: 'respuesta' | 'resolucion', valor: string) => {
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            [urgencia]: {
              ...prev[urgencia],
              [campo]: Number(valor),
            },
          }
        : prev,
    );
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await API.admin.guardarSla(config);
      toast('Configuración de SLA actualizada');
    } catch (err: any) {
      toast(err?.message || 'No se pudo guardar la configuración', 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className="panel">
        <div className="panel__head">
          <h2>Tiempos comprometidos por urgencia</h2>
          <span>horas</span>
        </div>
        <div className="panel__body">
          <p className="campo__ayuda" style={{ marginBottom: 16 }}>
            El reloj de respuesta inicia al crear el ticket. El de resolución se pausa mientras el
            ticket está en espera. Los cambios aplican a tickets nuevos.
          </p>
          <form onSubmit={guardar}>
            <div className="tabla-wrap">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Urgencia</th>
                    <th>Contexto</th>
                    <th>Respuesta (h)</th>
                    <th>Resolución (h)</th>
                  </tr>
                </thead>
                <tbody>
                  {URGENCIAS.map(({ u, nota }) => (
                    <tr key={u}>
                      <td>
                        <UrgenciaBadge urgencia={u} />
                      </td>
                      <td className="texto-muted" style={{ fontSize: 11 }}>
                        {nota}
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 110 }}
                          type="number"
                          min={1}
                          max={720}
                          value={Number(config[u]?.respuesta) || 1}
                          onChange={(e) => cambiar(u, 'respuesta', e.target.value)}
                          required
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ maxWidth: 110 }}
                          type="number"
                          min={1}
                          max={720}
                          value={Number(config[u]?.resolucion) || 1}
                          onChange={(e) => cambiar(u, 'resolucion', e.target.value)}
                          required
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="submit" className="btn btn--primario" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <h2>Cómo se calcula</h2>
        </div>
        <div className="panel__body">
          <div className="datos-grid">
            <div className="dato">
              <dt>Semáforo</dt>
              <dd>Rojo: Crítica/Alta · Amarillo: Media · Verde: Baja</dd>
            </div>
            <div className="dato">
              <dt>Pausa</dt>
              <dd>En Espera detiene el contador y lo reanuda al volver a En Progreso</dd>
            </div>
            <div className="dato">
              <dt>Escalamiento</dt>
              <dd>No reinicia el SLA; el caso sigue bajo el mismo compromiso</dd>
            </div>
            <div className="dato">
              <dt>Incumplimiento</dt>
              <dd>Se registra al resolver o al superar el vencimiento</dd>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
