import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AuthAPI } from "@/lib/auth-api";

export default function Profile() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // In a real app, fetch user profile from API / context
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  })();

  const user = {
    name: stored?.email || "Usuário Admin",
    company: stored?.company || "Concessionária XYZ",
    email: stored?.email || "admin@example.com",
    phone: stored?.phone || "(11) 99999-9999",
    role: stored?.accessType || "Usuário",
  };

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ qrCodeBase64: string; secret: string; manualEntryKey: string } | null>(null);
  const [mfaVerificationCode, setMfaVerificationCode] = useState("");
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaDisableCode, setMfaDisableCode] = useState("");

  // Verificar status do MFA ao carregar
  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const status = await AuthAPI.getMfaStatus();
      setMfaEnabled(status.habilitado);
    } catch (error: any) {
      // Se não conseguir verificar, assume que não está habilitado
      console.error("Erro ao verificar status MFA:", error);
    }
  };

  const handleSetupMfa = async () => {
    setMfaLoading(true);
    try {
      const setupData = await AuthAPI.getMfaSetup();
      setMfaSetupData(setupData);
      setShowMfaSetup(true);
    } catch (error: any) {
      toast({
        title: "Erro ao configurar MFA",
        description: error.message || "Não foi possível obter a configuração do MFA",
        action: undefined,
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEnableMfa = async () => {
    if (mfaVerificationCode.trim().length !== 6) {
      toast({
        title: "Código inválido",
        description: "Informe o código de 6 dígitos do Google Authenticator",
        action: undefined,
      });
      return;
    }

    setMfaLoading(true);
    try {
      await AuthAPI.enableMfa({ codigoTotp: mfaVerificationCode.trim() });
      setMfaEnabled(true);
      setShowMfaSetup(false);
      setMfaVerificationCode("");
      setMfaSetupData(null);
      toast({
        title: "MFA habilitado",
        description: "Autenticação em duas etapas foi habilitada com sucesso",
        action: undefined,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao habilitar MFA",
        description: error.message || "Código inválido",
        action: undefined,
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (mfaDisableCode.trim().length !== 6) {
      toast({
        title: "Código inválido",
        description: "Informe o código de 6 dígitos do Google Authenticator",
        action: undefined,
      });
      return;
    }

    setMfaLoading(true);
    try {
      await AuthAPI.disableMfa({
        username: user.email,
        codigoTotp: mfaDisableCode.trim(),
      });
      setMfaEnabled(false);
      setShowMfaDisable(false);
      setMfaDisableCode("");
      toast({
        title: "MFA desabilitado",
        description: "Autenticação em duas etapas foi desabilitada",
        action: undefined,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao desabilitar MFA",
        description: error.message || "Código inválido",
        action: undefined,
      });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      AuthAPI.clearToken();
    } catch (e) {}
    navigate('/login');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card p-6 rounded-lg shadow">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xl font-medium">
            U
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.role} — {user.company}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">E-mail</p>
            <p className="text-sm">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telefone</p>
            <p className="text-sm">{user.phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Empresa</p>
            <p className="text-sm">{user.company}</p>
          </div>

          {/* Seção MFA */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium">Autenticação em Duas Etapas (MFA)</p>
                <p className="text-xs text-muted-foreground">
                  {mfaEnabled ? "Habilitado" : "Desabilitado"}
                </p>
              </div>
              {mfaEnabled ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowMfaDisable(true)}
                  disabled={mfaLoading}
                >
                  Desabilitar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetupMfa}
                  disabled={mfaLoading}
                >
                  Configurar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline">Editar</Button>
          <Button onClick={handleLogout}>Logout</Button>
        </div>
      </div>

      {/* Dialog de Configuração MFA */}
      <Dialog open={showMfaSetup} onOpenChange={setShowMfaSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Autenticação em Duas Etapas</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com o Google Authenticator ou insira a chave manualmente
            </DialogDescription>
          </DialogHeader>
          {mfaSetupData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${mfaSetupData.qrCodeBase64}`}
                  alt="QR Code MFA"
                  className="border rounded-lg p-2"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Chave para entrada manual:</p>
                <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                  {mfaSetupData.manualEntryKey}
                </p>
              </div>
              <div>
                <label className="text-sm mb-1 block text-muted-foreground">
                  Código de verificação (6 dígitos)
                </label>
                <Input
                  value={mfaVerificationCode}
                  onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowMfaSetup(false);
              setMfaVerificationCode("");
              setMfaSetupData(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleEnableMfa} disabled={mfaLoading || !mfaSetupData}>
              {mfaLoading ? "Habilitando..." : "Habilitar MFA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Desabilitar MFA */}
      <Dialog open={showMfaDisable} onOpenChange={setShowMfaDisable}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desabilitar Autenticação em Duas Etapas</DialogTitle>
            <DialogDescription>
              Para desabilitar o MFA, insira o código atual do Google Authenticator
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block text-muted-foreground">
                Código de verificação (6 dígitos)
              </label>
              <Input
                value={mfaDisableCode}
                onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowMfaDisable(false);
              setMfaDisableCode("");
            }}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDisableMfa} disabled={mfaLoading}>
              {mfaLoading ? "Desabilitando..." : "Desabilitar MFA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
