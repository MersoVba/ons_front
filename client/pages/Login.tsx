import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { AuthAPI } from "@/lib/auth-api";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Preencha o email", description: "Email é obrigatório", action: undefined });
      return;
    }

    if (!password) {
      toast({ title: "Preencha a senha", description: "Senha é obrigatória", action: undefined });
      return;
    }

    setLoading(true);
    try {
      const response = await AuthAPI.login({ username: email, password: password });
      
      // Se é primeiro acesso, o backend retorna um token temporário
      if (response.firstAccess && response.token) {
        const resolvedAccess = determineAccess(email);
        AuthAPI.saveToken(response.token, email, resolvedAccess);
        toast({ 
          title: "Primeiro acesso", 
          description: "Você será redirecionado para definir sua senha", 
          action: undefined 
        });
        navigate("/");
      } 
      // Se não tem token e não é primeiro acesso, precisa validar código 2FA
      else if (response.mfaRequired || (!response.token && !response.firstAccess)) {
        setIsMfaRequired(false); // Código enviado por email, não TOTP
        setStep("mfa");
        toast({ 
          title: "Código enviado", 
          description: "Enviamos um código de 6 dígitos para seu e-mail", 
          action: undefined 
        });
      } 
      // Login direto com token
      else if (response.token) {
        const resolvedAccess = determineAccess(email);
        AuthAPI.saveToken(response.token, email, resolvedAccess);
        toast({ 
          title: "Autenticação concluída", 
          description: `Bem-vindo ao ONS${resolvedAccess ? ` (${resolvedAccess})` : ''}`, 
          action: undefined 
        });
        navigate("/");
      }
    } catch (error: any) {
      toast({ 
        title: "Erro ao fazer login", 
        description: error.message || "Credenciais inválidas", 
        action: undefined 
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.trim().length !== 6) {
      toast({ title: "Código inválido", description: "Informe o código de 6 dígitos", action: undefined });
      return;
    }

    setLoading(true);
    try {
      // Validar código 2FA enviado por email
      const response = await AuthAPI.validateTotp({
        username: email,
        codigoTotp: otp.trim(),
      });

      if (response.token) {
        const resolvedAccess = determineAccess(email);
        AuthAPI.saveToken(response.token, email, resolvedAccess);
        toast({ 
          title: "Autenticação concluída", 
          description: `Bem-vindo ao ONS${resolvedAccess ? ` (${resolvedAccess})` : ''}`, 
          action: undefined 
        });
        navigate("/");
      } else {
        toast({ 
          title: "Código inválido", 
          description: "O código está incorreto ou expirado", 
          action: undefined 
        });
      }
    } catch (error: any) {
      toast({ 
        title: "Erro ao verificar código", 
        description: error.message || "Código inválido", 
        action: undefined 
      });
    } finally {
      setLoading(false);
    }
  };

  const resendCode = () => {
    toast({ title: "Código reenviado", description: "Verifique seu e-mail (simulado)", action: undefined });
  };

  const determineAccess = (loginEmail: string) => {
    const e = (loginEmail || '').trim().toLowerCase();
    if (e === 'avd@ons.com.br') return 'AVD';
    if (e === 'avc@ons.com.br') return 'AVC';
    try {
      const approved = JSON.parse(localStorage.getItem('approvedUsers') || '[]');
      if (Array.isArray(approved)) {
        const match = approved.find((u:any) => (u.regEmail || '').toLowerCase() === e);
        if (match && match.accessType) return match.accessType;
      }
      const pending = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
      if (Array.isArray(pending)) {
        const p = pending.find((u:any) => (u.regEmail || '').toLowerCase() === e);
        if (p && p.accessType) return p.accessType;
      }
    } catch (err) {}
    return '';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Test Credentials Info */}
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">Credenciais de Teste:</p>
          <div className="text-xs text-blue-800 space-y-1">
            <p><strong>AVD (Aviso de Débito):</strong> avd@ons.com.br</p>
            <p><strong>AVC (Aviso de Crédito):</strong> avc@ons.com.br</p>
            <p className="mt-2 italic">Senha: Não é necessária</p>
          </div>
        </div>

        <div className="p-8 bg-card rounded-lg shadow">
          {step === "credentials" ? (
          <div className="space-y-4">
            <form onSubmit={submitCredentials} className="space-y-4">
              <div>
                <label className="text-sm mb-1 block text-muted-foreground">E-mail</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="seu@exemplo.com"
                />
              </div>

              <div>
                <label className="text-sm mb-1 block text-muted-foreground">Senha</label>
                <div className="relative">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <button 
                  type="button" 
                  onClick={() => navigate('/forgot-password')} 
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Aguarde..." : "Entrar"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Insira o código de 6 dígitos enviado para seu e-mail.
            </p>

            <div>
              {/* Custom OTP inputs to ensure they render correctly */}
              <div className="flex items-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <input
                    key={i}
                    inputMode="numeric"
                    maxLength={1}
                    value={otp[i] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      const next = otp.split("");
                      next[i] = val;
                      const newOtp = next.join("");
                      setOtp(newOtp);
                      if (val && i < 5) {
                        const nextEl = document.getElementById(`otp-${i + 1}`) as HTMLInputElement | null;
                        nextEl?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) {
                        const prevEl = document.getElementById(`otp-${i - 1}`) as HTMLInputElement | null;
                        prevEl?.focus();
                      }
                    }}
                    id={`otp-${i}`}
                    className="w-12 h-12 text-center text-lg rounded-md border border-input bg-background"
                    aria-label={`Dígito ${i + 1}`}
                    autoComplete={i === 0 ? "one-time-code" : ""}
                    />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => {
                setStep("credentials");
                setIsMfaRequired(false);
                setOtp("");
              }}>Alterar credenciais</Button>
              <Button variant="ghost" onClick={resendCode}>Reenviar código</Button>
            </div>

            <div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Verificar"}
              </Button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
