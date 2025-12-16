import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-config';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Percent,
  Users,
  Settings,
  TrendingUp,
  Receipt,
  AlertTriangle,
  Building2,
  Bell,
  MessageSquare,
  Shield,
  PanelLeft,
  PanelLeftClose,
  User,
  LogOut,
  Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface LayoutProps {
  children?: React.ReactNode;
}

interface Notificacao {
  id: number;
  empresa: string;
  comprovante: string;
  valor: number | null;
  status: string;
  dataCriacao: string;
  dataEnvio: string;
}

const navigationCommon = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
];

const navigationAVC = [
  { name: 'Aviso de Crédito', href: '/aviso-credito', icon: Banknote },
];

const navigationAVD = [
  { name: 'Aviso de Débito', href: '/aviso-debito', icon: AlertTriangle },
  { name: 'Rateio', href: '/rateio', icon: Percent },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [currentUser] = useState<{email?:string, accessType?:string}>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  });

  const accessType = currentUser?.accessType || '';
  const isADC = accessType === 'AVC' || accessType === 'ADC';

  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loadingNotificacoes, setLoadingNotificacoes] = useState(false);

  const handleLogout = () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    } catch (e) {}
    navigate('/login');
  };

  // Polling contínuo de notificações (a cada 30 segundos)
  useEffect(() => {
    if (!isADC) return;

    // Função para buscar notificações pendentes
    const buscarNotificacoes = async () => {
      try {
        setLoadingNotificacoes(true);
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const cleanToken = token.trim().replace(/[\r\n]/g, '');
        const response = await fetch(`${API_BASE_URL}/notificacoes`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cleanToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('🔔 Resposta da API de notificações:', data);
          
          // A API pode retornar um array, um objeto único, ou um objeto com array
          let notificacoesArray: Notificacao[] = [];
          
          if (Array.isArray(data)) {
            notificacoesArray = data;
          } else if (data.id !== undefined) {
            // Se for um objeto único (como o exemplo fornecido)
            notificacoesArray = [data];
          } else if (data.data && Array.isArray(data.data)) {
            notificacoesArray = data.data;
          } else if (data.notificacoes && Array.isArray(data.notificacoes)) {
            notificacoesArray = data.notificacoes;
          }
          
          console.log('🔔 Notificações processadas:', notificacoesArray.length);
          setNotificacoes(notificacoesArray);
        } else {
          console.error('❌ Erro ao buscar notificações:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ Detalhes do erro:', errorText);
        }
      } catch (error) {
        console.error('Erro ao buscar notificações:', error);
      } finally {
        setLoadingNotificacoes(false);
      }
    };

    // Buscar imediatamente ao montar
    buscarNotificacoes();

    // Configurar polling a cada 1 minuto
    const interval = setInterval(() => {
      buscarNotificacoes();
    }, 60000); // 60 segundos (1 minuto)

    // Limpar intervalo ao desmontar
    return () => clearInterval(interval);
  }, [isADC]);

  // Formatar notificações para exibição
  const formatarNotificacao = (notif: Notificacao) => {
    const dataCriacao = new Date(notif.dataCriacao);
    const agora = new Date();
    const diffMs = agora.getTime() - dataCriacao.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    let tempo = '';
    if (diffMins < 60) {
      tempo = `${diffMins} minuto${diffMins !== 1 ? 's' : ''} atrás`;
    } else if (diffHours < 24) {
      tempo = `${diffHours} hora${diffHours !== 1 ? 's' : ''} atrás`;
    } else {
      tempo = `${diffDays} dia${diffDays !== 1 ? 's' : ''} atrás`;
    }

    return {
      id: notif.id.toString(),
      titulo: `${notif.empresa} - Comprovante ${notif.comprovante}`,
      tipo: 'comprovante',
      tempo: tempo,
      lida: false,
      valor: notif.valor,
      status: notif.status
    };
  };

  const notificacoesFormatadas = notificacoes.map(formatarNotificacao);
  const notificacoesNaoLidas = notificacoesFormatadas.length;
  
  // Debug: log do contador de notificações
  useEffect(() => {
    if (isADC) {
      console.log('🔔 Contador de notificações atualizado:', notificacoesNaoLidas);
    }
  }, [notificacoesNaoLidas, isADC]);

  let filteredNavigation = navigationCommon;
  if (accessType === 'AVD') {
    filteredNavigation = [...navigationCommon, ...navigationAVD];
  } else {
    // Default to AVC
    filteredNavigation = [...navigationCommon, ...navigationAVC];
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border transition-all duration-300",
            sidebarCollapsed ? "justify-between px-2" : "justify-between px-6"
          )}>
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <Building2 className="h-8 w-8 text-sidebar-primary" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{accessType === 'AVD' ? 'ONS' : 'ONS'}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-sidebar-primary" />
                <span className="ml-2 text-lg font-bold text-sidebar-foreground whitespace-nowrap">
                  {accessType === 'AVD' ? 'ONS' : 'ONS'}
                </span>
              </div>
            )}

            {/* Toggle button and Notifications */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex-shrink-0"
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>

              {!sidebarCollapsed && isADC && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="relative">
                      <Bell className="h-5 w-5" />
                      {notificacoesNaoLidas > 0 && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center"
                        >
                          {notificacoesNaoLidas}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel>
                      Notificações Pendentes
                      {loadingNotificacoes && <span className="ml-2 text-xs text-muted-foreground">Carregando...</span>}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notificacoesFormatadas.length === 0 ? (
                      <DropdownMenuItem disabled className="text-center text-sm text-muted-foreground py-4">
                        Nenhuma notificação pendente
                      </DropdownMenuItem>
                    ) : (
                      <>
                        {notificacoesFormatadas.slice(0, 5).map((notif) => (
                          <DropdownMenuItem key={notif.id} className="flex-col items-start p-3">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-medium">
                                {notif.titulo}
                              </span>
                              <div className="h-2 w-2 bg-primary rounded-full ml-2" />
                            </div>
                            <div className="flex items-center justify-between w-full mt-1">
                              <span className="text-xs text-muted-foreground">{notif.tempo}</span>
                              {notif.valor && (
                                <span className="text-xs font-semibold text-primary">
                                  R$ {notif.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                        {notificacoesFormatadas.length > 5 && (
                          <DropdownMenuItem disabled className="text-center text-xs text-muted-foreground py-2">
                            +{notificacoesFormatadas.length - 5} mais notificações
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 py-6 space-y-1",
            sidebarCollapsed ? "px-2" : "px-4"
          )}>
            {filteredNavigation.map((item) => {
              const isActive = location.pathname === item.href;

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center justify-center p-3 text-sm font-medium rounded-lg transition-colors',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className={cn(
            "border-t border-sidebar-border",
            sidebarCollapsed ? "p-2" : "p-4"
          )}>
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center cursor-pointer">
                    <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
                      <span className="text-sm font-medium text-sidebar-primary-foreground">U</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div>
                    <p className="font-medium">{currentUser?.email || 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.accessType ? currentUser.accessType : 'Concessionária XYZ'}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center cursor-pointer">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
                        <span className="text-sm font-medium text-sidebar-primary-foreground">U</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-sidebar-foreground">{currentUser?.email || 'Usuário'}</p>
                      <p className="text-xs text-muted-foreground">{currentUser?.accessType ? currentUser.accessType : 'Concessionária XYZ'}</p>
                    </div>
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-48 p-2">
                  <div className="flex items-center gap-3 p-2">
                    <div className="h-10 w-10 rounded-full bg-sidebar-primary flex items-center justify-center">
                      <span className="text-sm font-medium text-sidebar-primary-foreground">Em</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Emerson de Abreu</p>
                      <p className="text-xs text-muted-foreground">49.931.655/0001-08</p>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 w-full">
                      <User className="h-4 w-4" />
                      <span>Perfil</span>
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <button onClick={handleLogout} className="flex items-center gap-2 w-full text-destructive">
                      <LogOut className="h-4 w-4" />
                      <span>Sair</span>
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "pl-16" : "pl-64"
      )}>
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
