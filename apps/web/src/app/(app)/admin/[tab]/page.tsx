'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icon } from '@/components/Icon';
import { AuditoriaTab } from '@/components/admin/AuditoriaTab';
import { KedbAdminTab } from '@/components/admin/KedbAdminTab';
import { MetricasTab } from '@/components/admin/MetricasTab';
import { SeguimientoTab } from '@/components/admin/SeguimientoTab';
import { SlaTab } from '@/components/admin/SlaTab';
import { UsuariosTab } from '@/components/admin/UsuariosTab';
import { Boot } from '@/components/ui';
import { ADMIN_TABS } from '@/lib/constants';
import { useTitulo } from '@/lib/useTitulo';

export default function AdminTabPage() {
  const params = useParams<{ tab: string }>();
  const router = useRouter();
  const { usuario, cargando } = useAuth();
  useTitulo('Administración');

  const tab = ADMIN_TABS.some((t) => t.id === params?.tab) ? params.tab : 'metricas';

  useEffect(() => {
    if (!cargando && usuario && usuario.rol !== 'Administrador') {
      router.replace('/dashboard');
    }
  }, [cargando, usuario, router]);

  useEffect(() => {
    const valido = ADMIN_TABS.some((t) => t.id === params?.tab);
    if (params?.tab && !valido) router.replace('/admin/metricas');
  }, [params?.tab, router]);

  if (cargando || !usuario) return <Boot />;
  if (usuario.rol !== 'Administrador') return <Boot />;

  return (
    <>
      <div className="pagina-head">
        <div className="pagina-head__texto">
          <span className="eyebrow">Gobierno del servicio</span>
          <h1>Consola de administración</h1>
          <p>Indicadores globales, cuentas, tiempos de SLA, base de conocimiento y trazabilidad.</p>
        </div>
        <div className="pagina-head__acciones">
          <Link className="btn btn--fantasma" href="/triaje">
            <Icon name="escudo" /> Ir al triaje
          </Link>
          <Link className="btn btn--fantasma" href="/admin/metricas">
            <Icon name="grafico" /> Ver métricas
          </Link>
        </div>
      </div>

      <div className="admin-tabs">
        {ADMIN_TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/${t.id}`}
            className={t.id === tab ? 'activo' : ''}
          >
            {t.texto}
          </Link>
        ))}
      </div>

      <div id="admin-contenido">
        {tab === 'seguimiento' && <SeguimientoTab />}
        {tab === 'usuarios' && <UsuariosTab />}
        {tab === 'sla' && <SlaTab />}
        {tab === 'kedb' && <KedbAdminTab />}
        {tab === 'auditoria' && <AuditoriaTab />}
        {(tab === 'metricas' || !ADMIN_TABS.some((t) => t.id === tab)) && <MetricasTab />}
      </div>
    </>
  );
}
