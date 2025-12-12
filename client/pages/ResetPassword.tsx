import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const identifier = (location.state as any)?.identifier;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!identifier) {
      navigate('/forgot-password');
    }
  }, [identifier, navigate]);

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password || !confirm) {
      toast({ title: 'Preencha as senhas', description: 'Ambas as senhas são obrigatórias', action: undefined });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Senhas não conferem', description: 'Verifique as senhas informadas', action: undefined });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: 'Senha redefinida', description: 'Sua senha foi atualizada com sucesso (simulado)', action: undefined });
      navigate('/login');
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow">
        <h2 className="text-lg font-semibold">Redefinir senha</h2>
        <p className="text-sm text-muted-foreground">Redefinir senha para: {identifier}</p>

        <form onSubmit={submit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm mb-1 block text-muted-foreground">Nova senha</label>
            <Input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="••••••••" />
          </div>

          <div>
            <label className="text-sm mb-1 block text-muted-foreground">Confirmar nova senha</label>
            <Input value={confirm} onChange={(e)=>setConfirm(e.target.value)} type="password" placeholder="••••••••" />
          </div>

          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => navigate('/forgot-password')}>Voltar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Aguarde...' : 'Redefinir'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
