import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState(''); // CNPJ or email
  const [step, setStep] = useState<'identify' | 'mfa'>('identify');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const submitIdentify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier) {
      toast({ title: 'Informe CNPJ ou e-mail', description: 'Preencha o CNPJ ou e-mail para continuar', action: undefined });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('mfa');
      toast({ title: 'Código enviado', description: 'Enviamos um código para o contato cadastrado (simulado)', action: undefined });
    }, 800);
  };

  const verifyOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.trim().length !== 6) {
      toast({ title: 'Código inválido', description: 'Informe o código de 6 dígitos', action: undefined });
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: 'Código válido', description: 'Você pode redefinir sua senha', action: undefined });
      navigate('/reset-password', { state: { identifier } });
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow">
        {step === 'identify' ? (
          <form onSubmit={submitIdentify} className="space-y-4">
            <h2 className="text-lg font-semibold">Esqueci minha senha</h2>
            <p className="text-sm text-muted-foreground">Informe o CNPJ ou o e-mail cadastrado. Enviaremos um código para validação.</p>

            <div>
              <label className="text-sm mb-1 block text-muted-foreground">CNPJ ou E-mail</label>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="CNPJ ou e-mail" />
            </div>

            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => navigate('/login')}>Voltar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar código'}</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <h2 className="text-lg font-semibold">Verificação</h2>
            <p className="text-sm text-muted-foreground">Insira o código de 6 dígitos enviado.</p>

            <div className="flex items-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    const next = otp.split('');
                    next[i] = val;
                    const newOtp = next.join('');
                    setOtp(newOtp);
                    if (val && i < 5) {
                      const nextEl = document.getElementById(`otp-f-${i + 1}`) as HTMLInputElement | null;
                      nextEl?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) {
                      const prevEl = document.getElementById(`otp-f-${i - 1}`) as HTMLInputElement | null;
                      prevEl?.focus();
                    }
                  }}
                  id={`otp-f-${i}`}
                  className="w-12 h-12 text-center text-lg rounded-md border border-input bg-background"
                  aria-label={`Dígito ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex justify-between items-center">
              <Button variant="ghost" onClick={() => setStep('identify')}>Alterar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Verificando...' : 'Verificar'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
