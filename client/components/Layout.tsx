import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
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

const navigationCommon = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
];

const navigationAVC = [
  { name: 'Aviso de Crédito', href: '/aviso-credito', icon: Banknote },
];

const navigationAVD = [
  { name: 'Aviso de Débito', href: '/aviso-debito', icon: AlertTriangle },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [currentUser] = useState<{email?:string, accessType?:string}>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  });

  const accessType = currentUser?.accessType || '';

  const handleLogout = () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    } catch (e) {}
    navigate('/login');
  };

  // Mock notifications - em produção viria de uma API/Context
  const notificacoesRecentes = [
    {
      id: '1',
      titulo: 'Vencimento em 3 dias - NFe 000001234',
      tipo: 'vencimento',
      tempo: '2 horas atrás',
      lida: false
    },
    {
      id: '2',
      titulo: 'Atualização Cadastral Aprovada',
      tipo: 'cadastral',
      tempo: '1 dia atrás',
      lida: false
    },
    {
      id: '3',
      titulo: 'Novo Documento de Cobrança',
      tipo: 'documento',
      tempo: '2 dias atrás',
      lida: true
    }
  ];

  const notificacoesNaoLidas = notificacoesRecentes.filter(n => !n.lida).length;

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
                  <p>{accessType === 'AVD' ? 'ONS - AVD' : 'ONS'}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-sidebar-primary" />
                <span className="ml-2 text-lg font-bold text-sidebar-foreground whitespace-nowrap">
                  {accessType === 'AVD' ? 'ONS - AVD' : 'ONS'}
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

              {!sidebarCollapsed && (
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
                    <DropdownMenuLabel>Notificações Recentes</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notificacoesRecentes.slice(0, 3).map((notif) => (
                      <DropdownMenuItem key={notif.id} className="flex-col items-start p-3">
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-sm ${!notif.lida ? 'font-medium' : 'text-muted-foreground'}`}>
                            {notif.titulo}
                          </span>
                          {!notif.lida && (
                            <div className="h-2 w-2 bg-primary rounded-full ml-2" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{notif.tempo}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/comunicacao" className="w-full text-center text-sm text-primary">
                        Ver todas as notificações
                      </Link>
                    </DropdownMenuItem>
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
