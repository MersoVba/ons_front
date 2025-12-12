import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Forbidden() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">403 — Acesso Negado</h2>
        <p className="text-sm text-muted-foreground mb-4">Você não tem permissão para visualizar esta página.</p>
        <div className="flex gap-2">
          <Link to="/">
            <Button>Voltar ao Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
