import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { AuthAPI } from "@/lib/auth-api";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMfaRequired, setIsMfaRequired] = useState(false);

  // Registration state
  const [showRegister, setShowRegister] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [contactName, setContactName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [address, setAddress] = useState("");
  const [number, setNumber] = useState("");
  const [bairro, setBairro] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [zip, setZip] = useState("");
  const [accessType, setAccessType] = useState<'AVD'|'AVC'|''>('');

  const fetchAddressByCep = async (cepRaw: string) => {
    const cep = cepRaw.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) throw new Error('CEP lookup failed');
      const data = await res.json();
      if (data.erro) {
        toast({ title: 'CEP não encontrado', description: 'Verifique o CEP informado', action: undefined });
        return;
      }
      setAddress(data.logradouro || '');
      setBairro(data.bairro || '');
      setCity(data.localidade || '');
      setStateUf(data.uf || '');
    } catch (e) {
      // ignore
    }
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Preencha o email", description: "Email é obrigatório", action: undefined });
      return;
    }

    setLoading(true);
    try {
      // Login sem validação de senha - apenas com email
      const response = await AuthAPI.login({ username: email, password: "" });
      
      // Se MFA está habilitado, precisa validar TOTP
      if (response.mfaRequired) {
        setIsMfaRequired(true);
        setStep("mfa");
        toast({ 
          title: "Autenticação em duas etapas", 
          description: "Insira o código do Google Authenticator", 
          action: undefined 
        });
      } else if (response.token) {
        // Login direto sem MFA (código por email ainda não implementado no backend)
        const resolvedAccess = determineAccess(email);
        AuthAPI.saveToken(response.token, email, resolvedAccess);
        toast({ 
          title: "Autenticação concluída", 
          description: `Bem-vindo ao ONS${resolvedAccess ? ` (${resolvedAccess})` : ''}`, 
          action: undefined 
        });
        navigate("/");
      } else {
        // Fluxo antigo: código por email (fallback)
        setStep("mfa");
        setIsMfaRequired(false);
        toast({ 
          title: "Código enviado", 
          description: "Enviamos um código para seu e-mail", 
          action: undefined 
        });
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
      if (isMfaRequired) {
        // Validar TOTP do Google Authenticator
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
            description: "O código do Google Authenticator está incorreto", 
            action: undefined 
          });
        }
      } else {
        // Fluxo antigo: código por email (fallback - simulado)
        setTimeout(() => {
          const resolvedAccess = determineAccess(email);
          try {
            const authUser = { email, accessType: resolvedAccess };
            localStorage.setItem('authUser', JSON.stringify(authUser));
          } catch (e) {
            // ignore
          }
          toast({ 
            title: "Autenticação concluída", 
            description: `Bem-vindo ao ONS${resolvedAccess ? ` (${resolvedAccess})` : ''}`, 
            action: undefined 
          });
          navigate("/");
        }, 600);
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
            {!showRegister ? (
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
                  <label className="text-sm mb-1 block text-muted-foreground">Senha (opcional)</label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="•••••••• (opcional)"
                  />
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Ainda não tem conta?</div>
                    <div className="mt-2">
                      <button type="button" onClick={() => navigate('/forgot-password')} className="text-sm text-muted-foreground">Esqueci minha senha</button>
                    </div>
                  </div>
                  <div>
                    <button type="button" onClick={() => setShowRegister(true)} className="text-sm text-primary">Cadastrar-se</button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Aguarde..." : "Entrar"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Cadastrar-se</h3>
                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">Razão Social</label>
                  <Input value={companyName} onChange={(e)=>setCompanyName(e.target.value)} placeholder="Razão Social" />
                </div>
                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">Nome Fantasia</label>
                  <Input value={tradeName} onChange={(e)=>setTradeName(e.target.value)} placeholder="Nome Fantasia (opcional)" />
                </div>
                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">CNPJ</label>
                  <Input value={cnpj} onChange={(e)=>setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">Nome do Responsável</label>
                  <Input value={contactName} onChange={(e)=>setContactName(e.target.value)} placeholder="Nome do responsável" />
                </div>
                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">E-mail</label>
                  <Input value={regEmail} onChange={(e)=>setRegEmail(e.target.value)} type="email" placeholder="contato@empresa.com" />
                </div>
                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">Telefone</label>
                  <Input value={regPhone} onChange={(e)=>setRegPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>

                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">Tipo de Acesso</label>
                  <select value={accessType} onChange={(e)=>setAccessType(e.target.value as 'AVD'|'AVC'|'')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="">Selecione o tipo de acesso</option>
                    <option value="AVD">AVD</option>
                    <option value="AVC">AVC</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">CEP</label>
                  <Input value={zip} onChange={(e)=>{ setZip(e.target.value); }} onBlur={(e)=>fetchAddressByCep(e.target.value)} placeholder="CEP" />
                </div>

                <div>
                  <label className="text-sm mb-1 block text-muted-foreground">Endereço</label>
                  <Input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Logradouro" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input value={number} onChange={(e)=>setNumber(e.target.value)} placeholder="Número" />
                  <Input value={bairro} onChange={(e)=>setBairro(e.target.value)} placeholder="Bairro" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input value={city} onChange={(e)=>setCity(e.target.value)} placeholder="Cidade" />
                  <Input value={stateUf} onChange={(e)=>setStateUf(e.target.value)} placeholder="UF" />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button onClick={() => {
                    if(!companyName || !cnpj || !contactName || !regEmail || !accessType) {
                      toast({ title: "Preencha os campos obrigatórios", description: "Verifique os campos de cadastro", action: undefined });
                      return;
                    }
                    const pendingUser = {
                      companyName,
                      tradeName,
                      cnpj,
                      contactName,
                      regEmail,
                      regPhone,
                      zip,
                      address,
                      number,
                      bairro,
                      city,
                      stateUf,
                      accessType
                    };
                    try {
                      const existing = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
                      if (Array.isArray(existing)) {
                        existing.push(pendingUser);
                        localStorage.setItem('pendingUsers', JSON.stringify(existing));
                      } else {
                        localStorage.setItem('pendingUsers', JSON.stringify([pendingUser]));
                      }
                    } catch (e) {
                      // ignore storage errors
                    }
                    toast({ title: "Cadastro enviado", description: `Seu cadastro (${accessType}) foi enviado para aprovação (simulado)`, action: undefined });
                    setShowRegister(false);
                  }}>
                    Cadastrar
                  </Button>
                  <Button variant="ghost" onClick={() => setShowRegister(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isMfaRequired 
                ? "Insira o código de 6 dígitos do Google Authenticator." 
                : "Insira o código de 6 dígitos enviado para seu e-mail."}
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
              {!isMfaRequired && (
                <Button variant="ghost" onClick={resendCode}>Reenviar código</Button>
              )}
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
