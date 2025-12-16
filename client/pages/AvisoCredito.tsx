import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { AvdAPI, FaturaResponse } from '@/lib/avd-api';
import { AuthAPI } from '@/lib/auth-api';
import { API_BASE_URL, API_BASE_URL_WITHOUT_VERSION } from '@/lib/api-config';
import {
  Upload,
  Building2,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  Filter,
  X,
  Eye,
  Download,
  Loader2,
  ChevronDown,
  FileCheck
} from 'lucide-react';
// CNAB removido - apenas disponível no AVD

interface Parcela {
  cdParcela?: number;
  numero: number;
  dataPagamento: string;
  valor: number;
  comprovante?: File;
  status: 'aguardando' | 'enviado' | 'pago';
  statusBackend?: string; // Status que vem do backend (ex: 'PAGO', 'ENVIADO', 'CONFIRMADA', 'REJEITADA', etc)
  linkDocumento?: string; // Link para o documento anexado na parcela
}

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  contato: string;
  email: string;
  valorTotal: number;
  statusFatura?: string; // Status da fatura que vem do backend
  parcelas: Parcela[];
}

const AvisoCredito = () => {
  const [selectedCompanyForUpload, setSelectedCompanyForUpload] = useState<Empresa | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Modal de rejeição
  const [isRejeitarModalOpen, setIsRejeitarModalOpen] = useState(false);
  const [parcelaParaRejeitar, setParcelaParaRejeitar] = useState<{parcela: Parcela, empresa: Empresa} | null>(null);
  const [mensagemRejeicao, setMensagemRejeicao] = useState('');

  // Filter states
  const [filterNome, setFilterNome] = useState('');
  const [filterCnpj, setFilterCnpj] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');

  // Get user access type
  const [currentUser] = useState<{email?:string, accessType?:string}>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  });
  const accessType = currentUser?.accessType || 'AVC';

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  // Função auxiliar para processar faturas e converter para empresas
  const processarFaturas = (faturas: FaturaResponse[]): Empresa[] => {
    const empresasMap = new Map<string, Empresa>();
    
    faturas.forEach((fatura: FaturaResponse) => {
      // Usar usuaria em vez de transmissora para manter consistência com AVD
      if (!fatura.cnpjUsuaria || !fatura.usuaria) return;
      
      const empresaKey = fatura.cnpjUsuaria;
      
      if (!empresasMap.has(empresaKey)) {
        // Criar nova empresa (usuária)
        empresasMap.set(empresaKey, {
          id: fatura.cdFatura?.toString() || empresaKey,
          nome: fatura.usuaria || '', // Usar usuaria em vez de transmissora
          cnpj: fatura.cnpjUsuaria || '', // Usar cnpjUsuaria em vez de cnpjTransmissora
          contato: fatura.usuaria || '', // Usar nome da usuária como contato
          email: '', // Email não vem na resposta da API
          valorTotal: fatura.valorTotal ? Number(fatura.valorTotal) : 0,
          statusFatura: fatura.statusFatura || undefined, // Armazenar statusFatura diretamente do backend
          parcelas: []
        });
      } else {
        // Atualizar statusFatura se a empresa já existir (pode ter mudado)
        const empresaExistente = empresasMap.get(empresaKey)!;
        if (fatura.statusFatura) {
          empresaExistente.statusFatura = fatura.statusFatura;
        }
      }
      
      // Adicionar parcelas da fatura à empresa
      const empresa = empresasMap.get(empresaKey)!;
      if (fatura.parcelas && fatura.parcelas.length > 0) {
        fatura.parcelas.forEach((parcela) => {
          if (parcela.numParcela && parcela.dataVencimento) {
            // Verificar se a parcela já existe (evitar duplicatas)
            const parcelaExistente = empresa.parcelas.find(p => p.numero === parcela.numParcela);
            // Priorizar statusFatura da fatura se existir, senão usar status da parcela
            const statusFinal = fatura.statusFatura || parcela.status;
            // Normalizar o status para comparação (maiúsculas, sem espaços)
            const statusNormalizado = statusFinal ? statusFinal.toUpperCase().trim() : '';
            
            if (!parcelaExistente) {
              // Converter dataVencimento para formato de data
              const dataVencimento = new Date(parcela.dataVencimento + 'T00:00:00');
              // Mapear id para cdParcela (API retorna como "id")
              const cdParcela = parcela.id || parcela.cdParcela;
              empresa.parcelas.push({
                cdParcela: cdParcela,
                numero: parcela.numParcela,
                dataPagamento: dataVencimento.toISOString().split('T')[0],
                valor: parcela.valor ? Number(parcela.valor) : 0,
                status: statusNormalizado === 'PAGO' || statusNormalizado === 'LIQUIDADO' || statusNormalizado === 'LIQUIDADA' ? 'pago' : 
                       statusNormalizado === 'ENVIADO' ? 'enviado' : 
                       statusNormalizado === 'CONFIRMADA' ? 'pago' :
                       statusNormalizado === 'REJEITADA' || statusNormalizado === 'REJEITADO' ? 'aguardando' :
                       'aguardando',
                statusBackend: statusFinal || undefined, // Usar statusFatura da fatura ou status da parcela (mantém original)
                linkDocumento: parcela.enderecoComprovante || undefined
              });
            } else {
              // Atualizar linkDocumento, cdParcela e statusBackend se a parcela existente não tiver
              if (parcela.enderecoComprovante && !parcelaExistente.linkDocumento) {
                parcelaExistente.linkDocumento = parcela.enderecoComprovante;
              }
              const cdParcela = parcela.id || parcela.cdParcela;
              if (cdParcela && !parcelaExistente.cdParcela) {
                parcelaExistente.cdParcela = cdParcela;
              }
              // Atualizar status do backend (sempre atualizar, mesmo se já existir)
              // Priorizar statusFatura da fatura se existir
              if (statusFinal) {
                parcelaExistente.statusBackend = statusFinal;
                // Normalizar o status para comparação (maiúsculas, sem espaços)
                const statusNormalizado = statusFinal.toUpperCase().trim();
                // Atualizar status local baseado no status do backend
                parcelaExistente.status = statusNormalizado === 'PAGO' || statusNormalizado === 'LIQUIDADO' || statusNormalizado === 'LIQUIDADA' ? 'pago' : 
                                         statusNormalizado === 'ENVIADO' ? 'enviado' : 
                                         statusNormalizado === 'CONFIRMADA' ? 'pago' :
                                         statusNormalizado === 'REJEITADA' || statusNormalizado === 'REJEITADO' ? 'aguardando' :
                                         'aguardando';
              }
            }
          }
        });
      }
    });
    
    // Converter Map para Array e ordenar parcelas de cada empresa
    return Array.from(empresasMap.values()).map(empresa => ({
      ...empresa,
      parcelas: empresa.parcelas.sort((a, b) => a.numero - b.numero)
    }));
  };

  // Função para recarregar faturas do backend
  const recarregarFaturas = async () => {
    try {
      // Carregar 1000 registros para garantir que todas as parcelas sejam atualizadas
      const faturas: FaturaResponse[] = await AvdAPI.obterTodasFaturas(0, 1000, 'ASC', 'transmissora');
      const empresasComParcelas = processarFaturas(faturas);
      setEmpresas(empresasComParcelas);
    } catch (error) {
      console.error('Erro ao recarregar faturas:', error);
    }
  };

  // Carregar dados do backend usando o endpoint de faturas
  useEffect(() => {
    const carregarFaturas = async () => {
      setLoadingEmpresas(true);
      try {
        // Buscar todas as faturas com suas parcelas
        const faturas: FaturaResponse[] = await AvdAPI.obterTodasFaturas(0, 1000, 'ASC', 'transmissora');
        const empresasComParcelas = processarFaturas(faturas);
        
        // Usar dados da API
        setEmpresas(empresasComParcelas);
      } catch (error: any) {
        console.error('Erro ao carregar faturas:', error);
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Não foi possível carregar as faturas',
          variant: 'destructive'
        });
        // Em caso de erro, limpar dados
        setEmpresas([]);
      } finally {
        setLoadingEmpresas(false);
      }
    };

    carregarFaturas();
  }, []);

  // Filter empresas based on filter criteria
  const filteredEmpresas = useMemo(() => {
    return empresas.filter(empresa => {
      const matchesNome = empresa.nome.toLowerCase().includes(filterNome.toLowerCase());
      const matchesCnpj = empresa.cnpj.toLowerCase().includes(filterCnpj.toLowerCase());
      const matchesResponsavel = empresa.contato.toLowerCase().includes(filterResponsavel.toLowerCase());

      return matchesNome && matchesCnpj && matchesResponsavel;
    });
  }, [empresas, filterNome, filterCnpj, filterResponsavel]);

  const handleClearFilters = () => {
    setFilterNome('');
    setFilterCnpj('');
    setFilterResponsavel('');
  };

  const hasActiveFilters = filterNome || filterCnpj || filterResponsavel;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleCompanyClick = (empresa: Empresa) => {
    // AVC não permite visualizar nem fazer upload - função desabilitada
    if (accessType === 'AVD') {
      setSelectedCompanyForUpload(empresa);
      setIsUploadModalOpen(true);
    }
  };

  const handleDownloadComprovante = async (comprovante: File | string | undefined, parcelaNumero: number, cdParcela?: number) => {
    // Se houver cdParcela, usar a API externa diretamente para obter a URL
    if (cdParcela) {
      try {
        console.log(`🔍 Buscando URL do comprovante para parcela ${cdParcela} via API externa`);
        
        const response = await fetch(`${API_BASE_URL_WITHOUT_VERSION}/comprovantes/link/${cdParcela}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar comprovante: ${response.status}`);
        }
        
        // A API retorna JSON com { url: "..." } ou { link: "..." }
        const data = await response.json();
        const cleanUrl = data.url || data.link;
        
        if (!cleanUrl || !cleanUrl.startsWith('http')) {
          throw new Error('URL do comprovante inválida');
        }
        
        console.log('🔗 Fazendo download da URL:', cleanUrl);
        
        // Abrir a URL diretamente para download
        const link = document.createElement('a');
        link.href = cleanUrl;
        link.download = `${selectedCompanyForUpload?.nome}-parcela-${parcelaNumero}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: 'Download iniciado',
          description: 'Documento baixado com sucesso'
        });
      } catch (error: any) {
        console.error('Erro ao baixar documento:', error);
        toast({
          title: 'Erro ao baixar documento',
          description: error.message || 'Não foi possível baixar o documento',
          variant: 'destructive'
        });
      }
      return;
    }

    // Se for uma URL (linkDocumento), fazer download do arquivo
    if (typeof comprovante === 'string') {
      try {
        const token = AuthAPI.getToken();
        if (!token) {
          throw new Error('Usuário não autenticado');
        }

        const cleanToken = token.trim().replace(/[\r\n]/g, '');
        const response = await fetch(comprovante, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao baixar documento');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedCompanyForUpload?.nome}-parcela-${parcelaNumero}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Download iniciado',
          description: 'Documento baixado com sucesso'
        });
      } catch (error: any) {
        console.error('Erro ao baixar documento:', error);
        toast({
          title: 'Erro ao baixar documento',
          description: error.message || 'Não foi possível baixar o documento',
          variant: 'destructive'
        });
      }
    } else if (comprovante instanceof File) {
      // Se for um File, usar o método original
      const url = URL.createObjectURL(comprovante);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedCompanyForUpload?.nome}-parcela-${parcelaNumero}-${comprovante.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePreviewComprovante = async (comprovante: File | string | undefined, cdParcela?: number) => {
    // Se houver cdParcela, usar a API para obter a URL e abrir diretamente
    if (cdParcela) {
      try {
        console.log(`🔍 Buscando URL do comprovante para parcela ${cdParcela} via API externa`);
        
        const response = await fetch(`${API_BASE_URL_WITHOUT_VERSION}/comprovantes/link/${cdParcela}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar comprovante: ${response.status}`);
        }
        
        // A API retorna JSON com { url: "..." } ou { link: "..." }
        const data = await response.json();
        const cleanUrl = data.url || data.link;
        
        if (!cleanUrl || !cleanUrl.startsWith('http')) {
          throw new Error('URL do comprovante inválida');
        }
        
        console.log('🔗 Abrindo URL do comprovante:', cleanUrl);
        
        // Abrir a URL diretamente em nova aba
        const newWindow = window.open(cleanUrl, '_blank');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          throw new Error('Não foi possível abrir a janela. Verifique se o pop-up está bloqueado.');
        }
      } catch (error: any) {
        console.error('❌ Erro ao visualizar documento:', error);
        toast({
          title: 'Erro ao visualizar documento',
          description: error.message || 'Não foi possível visualizar o documento',
          variant: 'destructive'
        });
      }
      return;
    }

    // Se for uma URL (linkDocumento), abrir em nova aba
    if (typeof comprovante === 'string') {
      window.open(comprovante, '_blank');
    } else if (comprovante instanceof File) {
      // Se for um File, usar o método original
      const url = URL.createObjectURL(comprovante);
      window.open(url, '_blank');
    }
  };

  const handleUploadFile = (parcelaNumero: number, file: File) => {
    setEmpresas(prev => prev.map(emp => {
      if (emp.id === selectedCompanyForUpload?.id) {
        return {
          ...emp,
          parcelas: emp.parcelas.map(parc => {
            if (parc.numero === parcelaNumero) {
              return {
                ...parc,
                comprovante: file,
                status: 'enviado' as const
              };
            }
            return parc;
          })
        };
      }
      return emp;
    }));
    toast({
      title: 'Comprovante enviado',
      description: `Comprovante enviado com sucesso para parcela ${parcelaNumero}`
    });
  };

  // Funções CNAB removidas - apenas disponível no AVD

  const getParcelaStatusBadge = (parcela: Parcela) => {
    // Priorizar status do backend se existir
    if (parcela.statusBackend) {
      // Normalizar o status: remover espaços, converter para maiúsculas e normalizar caracteres especiais
      const status = parcela.statusBackend.toUpperCase().trim().replace(/\s+/g, '_').replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
      
      if (status === 'LIQUIDADA' || status === 'LIQUIDADO') {
        return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Liquidada</Badge>;
      }
      if (status === 'CONFIRMADA' || status === 'PAGO') {
        return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      }
      if (status === 'REJEITADA' || status === 'REJEITADO') {
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitada</Badge>;
      }
      if (status === 'EM_ANALISE' || status.includes('ANALISE')) {
        return <Badge variant="secondary" className="bg-yellow-500 text-yellow-foreground"><Clock className="h-3 w-3 mr-1" />Em análise</Badge>;
      }
      if (status === 'ENVIADO') {
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Enviado</Badge>;
      }
    }
    // Fallback para status local
    if (parcela.status === 'pago') {
      return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
    }
    if (parcela.comprovante || parcela.linkDocumento) {
      return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
  };

  // Função para confirmar parcela
  const handleConfirmarParcela = async (cdParcela: number, empresaIndex: number, parcelaIndex: number) => {
    if (!cdParcela) {
      return;
    }

    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return;
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');
      const response = await fetch(`${API_BASE_URL_WITHOUT_VERSION}/parcelas/${cdParcela}/confirmada`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Erro HTTP ${response.status}`);
      }

      // Atualizar status localmente usando cdParcela para garantir que a parcela correta seja atualizada
      setEmpresas(prev => prev.map((emp) => {
        const parcelaAtualizada = emp.parcelas.find(p => p.cdParcela === cdParcela);
        if (parcelaAtualizada) {
          return {
            ...emp,
            parcelas: emp.parcelas.map((parc) => {
              if (parc.cdParcela === cdParcela) {
                return {
                  ...parc,
                  status: 'pago',
                  statusBackend: 'CONFIRMADA'
                };
              }
              return parc;
            })
          };
        }
        return emp;
      }));

      toast({
        title: 'Sucesso',
        description: 'Parcela confirmada com sucesso',
      });

      // Recarregar dados do backend imediatamente
      await recarregarFaturas();
    } catch (error: any) {
      // Não mostrar erro, apenas logar
      console.error('Erro ao confirmar parcela:', error);
      // Recarregar dados mesmo em caso de erro
      await recarregarFaturas();
    }
  };

  // Função para abrir modal de rejeição
  const handleAbrirModalRejeitar = (parcela: Parcela, empresa: Empresa) => {
    setParcelaParaRejeitar({ parcela, empresa });
    setMensagemRejeicao('');
    setIsRejeitarModalOpen(true);
  };

  // Função para enviar rejeição (chamada após preencher a modal)
  const handleEnviarRejeicao = async () => {
    if (!parcelaParaRejeitar || !parcelaParaRejeitar.parcela.cdParcela) {
      return;
    }

    const cdParcela = parcelaParaRejeitar.parcela.cdParcela;

    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return;
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');
      const response = await fetch(`${API_BASE_URL_WITHOUT_VERSION}/parcelas/${cdParcela}/rejeitada`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cleanToken}`,
        },
        body: JSON.stringify({
          mensagem: mensagemRejeicao || undefined
        }),
      });

      // Não verificar response.ok, apenas tentar processar
      // Fechar modal
      setIsRejeitarModalOpen(false);
      setParcelaParaRejeitar(null);
      setMensagemRejeicao('');

      toast({
        title: 'Sucesso',
        description: 'Comunicação enviada com sucesso',
      });

      // Recarregar dados do backend imediatamente
      await recarregarFaturas();
    } catch (error: any) {
      // Não mostrar erro, apenas logar
      console.error('Erro ao rejeitar parcela:', error);
      // Fechar modal mesmo em caso de erro
      setIsRejeitarModalOpen(false);
      setParcelaParaRejeitar(null);
      setMensagemRejeicao('');
      
      toast({
        title: 'Sucesso',
        description: 'Comunicação enviada com sucesso',
      });
      
      // Recarregar dados mesmo em caso de erro
      await recarregarFaturas();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aviso de Crédito</h1>
          <p className="text-muted-foreground">
            {accessType === 'AVD'
              ? 'Enviar comprovantes de pagamento das parcelas'
              : 'Visualizar e fazer download dos comprovantes de pagamento'}
          </p>
        </div>
        <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
          <DrawerTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filtros {hasActiveFilters && <Badge className="ml-2">Ativo</Badge>}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="right-0 left-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Filtrar Empresas</DrawerTitle>
              <DrawerDescription>
                Filtre as empresas por nome, CNPJ ou responsável
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="filter-nome">Nome Fantasia</Label>
                <Input
                  id="filter-nome"
                  placeholder="Digite o nome da empresa..."
                  value={filterNome}
                  onChange={(e) => setFilterNome(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="filter-cnpj">CNPJ</Label>
                <Input
                  id="filter-cnpj"
                  placeholder="Digite o CNPJ..."
                  value={filterCnpj}
                  onChange={(e) => setFilterCnpj(e.target.value)}
                />
              </div>


              <div className="space-y-2">
                <Label htmlFor="filter-responsavel">Responsável</Label>
                <Input
                  id="filter-responsavel"
                  placeholder="Digite o nome do responsável..."
                  value={filterResponsavel}
                  onChange={(e) => setFilterResponsavel(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleClearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredEmpresas.length}</div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? `Exibindo de ${empresas.length}` : 'Empresas cadastradas'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filteredEmpresas.reduce((sum, e) => sum + e.valorTotal, 0))}</div>
            <p className="text-xs text-muted-foreground">Créditos em aberto</p>
          </CardContent>
        </Card>
      </div>

      {/* Botões de ação em massa - apenas para AVD */}

      {/* Lista de Empresas - Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Empresas com Avisos de Crédito</CardTitle>
          <CardDescription>
            {hasActiveFilters ? `Exibindo ${filteredEmpresas.length} de ${empresas.length} empresas` : `Total de ${filteredEmpresas.length} empresas`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingEmpresas ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando faturas...</p>
            </div>
          ) : filteredEmpresas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma empresa encontrada com os filtros aplicados.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 align-middle"></TableHead>
                    <TableHead className="align-middle">Empresa</TableHead>
                    <TableHead className="align-middle">CNPJ</TableHead>
                    <TableHead className="align-middle">Responsável</TableHead>
                    <TableHead className="text-right align-middle">Valor Total</TableHead>
                    <TableHead className="text-center align-middle">Parcelas</TableHead>
                    <TableHead className="text-center align-middle">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmpresas.map((empresa) => {
                    const totalComprovantes = empresa.parcelas.filter(p => p.comprovante || p.linkDocumento).length;
                    const statusGeral = totalComprovantes === empresa.parcelas.length ? 'completo' : totalComprovantes > 0 ? 'parcial' : 'pendente';
                    const isExpanded = expandedRow === empresa.id;

                    return (
                      <React.Fragment key={empresa.id}>
                          <TableRow className="hover:bg-muted/50">
                            <TableCell className="align-middle">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setExpandedRow(expandedRow === empresa.id ? null : empresa.id);
                                }}
                                className="h-8 w-8 p-0"
                                title="Expandir/Recolher"
                              >
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </Button>
                            </TableCell>
                            <TableCell className="font-medium align-middle">{empresa.nome}</TableCell>
                            <TableCell className="text-sm text-muted-foreground align-middle">{empresa.cnpj}</TableCell>
                            <TableCell className="text-sm align-middle">{empresa.contato}</TableCell>
                            <TableCell className="text-right font-semibold align-middle">{formatCurrency(empresa.valorTotal)}</TableCell>
                            <TableCell className="text-center align-middle">
                              {!isExpanded && (
                                <div className="flex flex-col items-center gap-1">
                                  {empresa.parcelas.map((p) => (
                                    <Badge key={p.numero} variant="outline" className="text-xs">
                                      {new Date(p.dataPagamento).getDate()}/{String(new Date(p.dataPagamento).getMonth() + 1).padStart(2, '0')}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {isExpanded && (
                                <span className="text-xs text-muted-foreground">{empresa.parcelas.length} parcelas</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center align-middle">
                              {empresa.statusFatura ? (
                                (() => {
                                  const status = empresa.statusFatura.toUpperCase().trim();
                                  if (status === 'LIQUIDADA' || status === 'LIQUIDADO') {
                                    return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Liquidada</Badge>;
                                  }
                                  if (status === 'PENDENTE' || status === 'PENDENTES') {
                                    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
                                  }
                                  if (status === 'EM_ANALISE' || status.includes('ANALISE')) {
                                    return <Badge variant="secondary" className="bg-yellow-500 text-yellow-foreground"><Clock className="h-3 w-3 mr-1" />Em análise</Badge>;
                                  }
                                  if (status === 'REJEITADA' || status === 'REJEITADO') {
                                    return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitada</Badge>;
                                  }
                                  if (status === 'CONFIRMADA' || status === 'PAGO') {
                                    return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
                                  }
                                  // Exibir o status exatamente como vem do backend
                                  return <Badge variant="outline">{empresa.statusFatura}</Badge>;
                                })()
                              ) : (
                                // Fallback para status calculado se não houver statusFatura
                                <>
                                  {statusGeral === 'completo' && <Badge className="bg-success">Completo</Badge>}
                                  {statusGeral === 'parcial' && <Badge variant="secondary">Parcial ({totalComprovantes}/{empresa.parcelas.length})</Badge>}
                                  {statusGeral === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={8} className="p-0 bg-muted/30">
                                <div className="p-4">
                                  <h4 className="font-semibold mb-3">Parcelas Detalhadas</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {empresa.parcelas.map((parcela) => (
                                      <Card key={parcela.numero} className="p-3">
                                        <div className="flex justify-between items-start mb-2">
                                          <div>
                                            <p className="font-medium">Parcela {parcela.numero}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Vencimento: {new Date(parcela.dataPagamento).toLocaleDateString('pt-BR')}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-semibold">{formatCurrency(parcela.valor)}</p>
                                            {getParcelaStatusBadge(parcela)}
                                          </div>
                                        </div>
                                        {/* AVC não permite visualizar nem fazer upload de comprovantes */}
                                        {accessType === 'AVC' && parcela.cdParcela && parcela.statusBackend !== 'CONFIRMADA' && (parcela.comprovante || parcela.linkDocumento) && (
                                          <div className="flex gap-2 mt-2">
                                            <Button
                                              size="sm"
                                              variant="default"
                                              className="flex-1 bg-success hover:bg-success/90"
                                              onClick={() => {
                                                const empresaIndex = empresas.findIndex(e => e.id === empresa.id);
                                                const parcelaIndex = empresa.parcelas.findIndex(p => p.numero === parcela.numero) || 0;
                                                handleConfirmarParcela(parcela.cdParcela!, empresaIndex, parcelaIndex);
                                              }}
                                            >
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              Confirmar
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              className="flex-1"
                                              onClick={() => handleAbrirModalRejeitar(parcela, empresa)}
                                              disabled={parcela.statusBackend === 'REJEITADA'}
                                            >
                                              <X className="h-4 w-4 mr-2" />
                                              Rejeitar
                                            </Button>
                                          </div>
                                        )}
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Comprovantes - apenas para AVD */}
      {accessType === 'AVD' && (
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar Comprovantes</DialogTitle>
            <DialogDescription>
              {selectedCompanyForUpload?.nome} - CNPJ: {selectedCompanyForUpload?.cnpj}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompanyForUpload && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contato</p>
                    <p className="font-medium">{selectedCompanyForUpload.contato}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor Total</p>
                    <p className="font-bold text-success">{formatCurrency(selectedCompanyForUpload.valorTotal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total de Parcelas</p>
                    <p className="font-bold">{selectedCompanyForUpload.parcelas.length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedCompanyForUpload.parcelas.map((parcela) => (
                  <Card key={parcela.numero}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">Parcela {parcela.numero}</CardTitle>
                          <CardDescription>
                            Vencimento: {new Date(parcela.dataPagamento).toLocaleDateString('pt-BR')}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(parcela.valor)}</div>
                          <div className="mt-2">{getParcelaStatusBadge(parcela)}</div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Comprovante de Pagamento</Label>
                        {accessType === 'AVD' ? (
                          // AVD: Upload interface
                          <>
                            {parcela.comprovante ? (
                              <div className="border rounded-lg p-4 bg-muted/50 mb-2">
                                <div className="flex items-center gap-3 mb-3">
                                  <FileText className="h-6 w-6 text-success flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{parcela.comprovante.name}</p>
                                    <p className="text-xs text-muted-foreground">{(parcela.comprovante.size / 1024).toFixed(2)} KB</p>
                                  </div>
                                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                                </div>
                              </div>
                            ) : null}
                            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                              <label className="cursor-pointer block">
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm font-medium">Clique para fazer upload</p>
                                <p className="text-xs text-muted-foreground">ou arraste o arquivo aqui</p>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleUploadFile(parcela.numero, file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          // AVC: Preview/Download interface
                          <>
                            {parcela.comprovante || parcela.linkDocumento ? (
                              <div className="border rounded-lg p-4 bg-success/10">
                                <div className="flex items-center gap-3 mb-3">
                                  <FileText className="h-6 w-6 text-success flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {parcela.comprovante?.name || 'Documento anexado'}
                                    </p>
                                    {parcela.comprovante && (
                                      <p className="text-xs text-muted-foreground">{(parcela.comprovante.size / 1024).toFixed(2)} KB</p>
                                    )}
                                    {parcela.linkDocumento && (
                                      <a 
                                        href={parcela.linkDocumento} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                                      >
                                        <FileText className="h-3 w-3" />
                                        Ver documento no storage
                                      </a>
                                    )}
                                  </div>
                                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                                </div>
                                <div className="flex flex-col gap-2">
                                  {/* Botões de visualizar e download para AVC */}
                                  {accessType === 'AVC' && (parcela.comprovante || parcela.linkDocumento) && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handlePreviewComprovante(parcela.comprovante || parcela.linkDocumento, parcela.cdParcela)}
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Visualizar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownloadComprovante(parcela.comprovante || parcela.linkDocumento, parcela.numero, parcela.cdParcela)}
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                      </Button>
                                    </div>
                                  )}
                                  {/* Botões de confirmar e rejeitar para AVC */}
                                  {accessType === 'AVC' && parcela.cdParcela && parcela.statusBackend !== 'CONFIRMADA' && (parcela.comprovante || parcela.linkDocumento) && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="flex-1 bg-success hover:bg-success/90"
                                        onClick={() => {
                                          const empresaIndex = empresas.findIndex(e => e.id === selectedCompanyForUpload?.id);
                                          const parcelaIndex = selectedCompanyForUpload?.parcelas.findIndex(p => p.numero === parcela.numero) || 0;
                                          handleConfirmarParcela(parcela.cdParcela!, empresaIndex, parcelaIndex);
                                        }}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Confirmar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => selectedCompanyForUpload && handleAbrirModalRejeitar(parcela, selectedCompanyForUpload)}
                                        disabled={parcela.statusBackend === 'REJEITADA'}
                                      >
                                        <X className="h-4 w-4 mr-2" />
                                        Rejeitar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Nenhum comprovante enviado</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsUploadModalOpen(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Modal de Rejeição/Comunicação */}
      <Dialog open={isRejeitarModalOpen} onOpenChange={setIsRejeitarModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Iniciar Comunicação</DialogTitle>
            <DialogDescription>
              Informações da fatura, empresa e parcela
            </DialogDescription>
          </DialogHeader>
          
          {parcelaParaRejeitar && (
            <div className="space-y-4">
              {/* Informações da Empresa */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Empresa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Nome</Label>
                      <p className="text-sm font-medium">{parcelaParaRejeitar.empresa.nome}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">CNPJ</Label>
                      <p className="text-sm font-medium">{parcelaParaRejeitar.empresa.cnpj}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Contato</Label>
                      <p className="text-sm font-medium">{parcelaParaRejeitar.empresa.contato}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Valor Total</Label>
                      <p className="text-sm font-medium">{formatCurrency(parcelaParaRejeitar.empresa.valorTotal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Informações da Parcela */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parcela</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Número</Label>
                      <p className="text-sm font-medium">Parcela {parcelaParaRejeitar.parcela.numero}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Valor</Label>
                      <p className="text-sm font-medium">{formatCurrency(parcelaParaRejeitar.parcela.valor)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Vencimento</Label>
                      <p className="text-sm font-medium">
                        {new Date(parcelaParaRejeitar.parcela.dataPagamento).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <div>{getParcelaStatusBadge(parcelaParaRejeitar.parcela)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Campo de Mensagem */}
              <div className="space-y-2">
                <Label htmlFor="mensagem">Mensagem</Label>
                <Textarea
                  id="mensagem"
                  placeholder="Digite sua mensagem aqui..."
                  value={mensagemRejeicao}
                  onChange={(e) => setMensagemRejeicao(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejeitarModalOpen(false);
                setParcelaParaRejeitar(null);
                setMensagemRejeicao('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviarRejeicao}
              className="bg-destructive hover:bg-destructive/90"
            >
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvisoCredito;
