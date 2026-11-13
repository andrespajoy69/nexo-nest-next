'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Boot } from '@/components/ui';

export default function AdminPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/metricas');
  }, [router]);
  return <Boot />;
}
