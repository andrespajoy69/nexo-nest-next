'use client';

import { useParams } from 'next/navigation';
import { MisTickets } from '@/components/MisTickets';

export default function MisFiltroPage() {
  const params = useParams<{ filtro: string }>();
  return <MisTickets filtro={params?.filtro} />;
}
