import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface RequireAuthProps {
  allowed?: string[]; // allowed access types e.g. ['AVD']
  children: React.ReactElement;
}

export default function RequireAuth({ allowed, children }: RequireAuthProps) {
  const location = useLocation();
  const { toast } = useToast();

  let authUser: { email?: string; accessType?: string; token?: string } | null = null;
  try {
    authUser = JSON.parse(localStorage.getItem('authUser') || 'null');
  } catch (e) {
    authUser = null;
  }

  if (!authUser || !authUser.email || !authUser.token) {
    // not logged in
    toast({ title: 'Acesso', description: 'Faça login para continuar', action: undefined });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowed && allowed.length > 0) {
    const has = !!authUser.accessType && allowed.includes(authUser.accessType);
    if (!has) {
      // Log denied attempt
      try {
        const logs = JSON.parse(localStorage.getItem('accessLogs') || '[]');
        const entry = {
          time: new Date().toISOString(),
          path: location.pathname,
          required: allowed,
          user: authUser?.email || null,
          accessType: authUser?.accessType || null,
          result: 'denied'
        };
        if (Array.isArray(logs)) {
          logs.push(entry);
          localStorage.setItem('accessLogs', JSON.stringify(logs));
        } else {
          localStorage.setItem('accessLogs', JSON.stringify([entry]));
        }
      } catch (e) {}

      toast({ title: 'Acesso negado', description: 'Você não tem permissão para acessar esta página', action: undefined });
      return <Navigate to="/forbidden" state={{ from: location }} replace />;
    }
  }

  return children;
}
