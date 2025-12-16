import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ProcessarComprovanteResponse, PagamentoBoleto, ComprovantePagamentoRequest, ComprovantePagamentoResponse, TipoDocumento } from '@shared/api';
import { AuthAPI } from '@/lib/auth-api';
import { AvdAPI, IntegracaoUsuariaTransmissoraResponse, FaturaResponse } from '@/lib/avd-api';
import { API_BASE_URL, API_BASE_URL_WITHOUT_VERSION } from '@/lib/api-config';
import { OpenFinanceAPI, IniciarPagamentoParcelaResponse } from '@/lib/open-finance-api';
import { DashboardAPI, DashboardAvdResponse } from '@/lib/dashboard-api';
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
  FileCheck,
  Trash2,
  ChevronDown,
  CreditCard,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';

interface ParcelaDebito {
  cdParcela?: number;
  numParcela: number;
  data: string;
  valor: number;
  comprovante?: File;
  status: 'aguardando' | 'enviado' | 'pago';
  statusBackend?: string; // Status que vem do backend (ex: 'PAGO', 'ENVIADO', 'CONFIRMADA', 'REJEITADA', etc)
  dadosExtraidos?: PagamentoBoleto;
  linkDocumento?: string;
  valorDivergente?: number; // Valor divergente (inadimplência) quando o pagamento foi menor que o esperado
  formaPagamento?: string; // Forma de pagamento (ex: 'OPEN_FINANCE', 'BOLETO', etc)
}

interface Usuaria {
  id: string;
  usuaria: string;
  cnpj: string;
  codigoUsuaria: string;
  tributos: number;
  valorTotal: number;
  statusFatura?: string; // Status da fatura que vem do backend
  parcelas: ParcelaDebito[];
}

const AvisoDebito = () => {
  const [selectedUsuariaForUpload, setSelectedUsuariaForUpload] = useState<Usuaria | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isCNABDialogOpen, setIsCNABDialogOpen] = useState(false);
  const [isOpenFinanceDialogOpen, setIsOpenFinanceDialogOpen] = useState(false);
  const [selectedParcelasForOpenFinance, setSelectedParcelasForOpenFinance] = useState<Set<number>>(new Set());
  const [cnabFile, setCnabFile] = useState<File | null>(null);
  const [isProcessingCNAB, setIsProcessingCNAB] = useState(false);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [parcelasProcessando, setParcelasProcessando] = useState<Set<number>>(new Set());
  const [parcelasProcessadas, setParcelasProcessadas] = useState<Set<number>>(new Set());
  const [progressoProcessamento, setProgressoProcessamento] = useState<{
    total: number;
    processadas: number;
    itens: Array<{ fatura: string; parcela: number; cdParcela: number; status: 'processando' | 'processada' | 'erro' }>;
  } | null>(null);
  const [dadosExtraidosModal, setDadosExtraidosModal] = useState<{
    parcelaNumero: number;
    dados: PagamentoBoleto;
    banco: string;
    arquivo?: File;
  } | null>(null);
  const [pagamentosOpenFinance, setPagamentosOpenFinance] = useState<Map<number, {
    status: 'PENDENTE_BANCO' | 'CONFIRMADO' | 'FALHOU' | 'CRIADO';
    externalPaymentId: string;
    pagamentoId: number;
  }>>(new Map());
  const [uploadingForUsuaria, setUploadingForUsuaria] = useState<{usuariaId: string, parcelaNumero: number} | null>(null);

  // Filter states
  const [filterUsuaria, setFilterUsuaria] = useState('');
  const [filterCnpj, setFilterCnpj] = useState('');
  const [filterCodigo, setFilterCodigo] = useState('');

  // Estados de paginação
  const [pagina, setPagina] = useState(0);
  const [quantidade, setQuantidade] = useState(1000);
  const [ordem, setOrdem] = useState<'ASC' | 'DESC'>('ASC');
  const [ordenarPor, setOrdenarPor] = useState('transmissora');
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalItens, setTotalItens] = useState(0);

  // Get user access type (opcional - não requer login)
  const [currentUser] = useState<{email?:string, accessType?:string}>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  });
  const accessType = currentUser?.accessType || 'AVD';

  // Verificação de autenticação removida - acesso liberado

  const [usuarias, setUsuarias] = useState<Usuaria[]>([]);
  const [loadingUsuarias, setLoadingUsuarias] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardAvdResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Carregar dados do dashboard AVD
  useEffect(() => {
    const carregarDashboard = async () => {
      setLoadingDashboard(true);
      try {
        const data = await DashboardAPI.obterMetricasAvd();
        setDashboardData(data);
      } catch (error: any) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoadingDashboard(false);
      }
    };
    
    carregarDashboard();
  }, []);

  // Função para carregar dados do backend usando o endpoint de faturas
  const carregarFaturas = async () => {
      setLoadingUsuarias(true);
      try {
        // Buscar todas as faturas com suas parcelas
        const faturas: FaturaResponse[] = await AvdAPI.obterTodasFaturas(pagina, quantidade, ordem, ordenarPor);
        
        console.log('📋 Faturas carregadas da API:', faturas);
        console.log('📋 Primeira parcela (exemplo):', faturas[0]?.parcelas?.[0]);
        if (faturas[0]?.parcelas?.[0]) {
          console.log('📋 Status da primeira parcela:', faturas[0].parcelas[0].status);
        }
        
            // Agrupar faturas por usuária
            const usuariasMap = new Map<string, Usuaria>();
            
            faturas.forEach((fatura: FaturaResponse) => {
              if (!fatura.cnpjUsuaria || !fatura.usuaria) return;
              
              const usuariaKey = fatura.cnpjUsuaria;
              
              if (!usuariasMap.has(usuariaKey)) {
                // Criar nova usuária
                usuariasMap.set(usuariaKey, {
                  id: fatura.cdFatura?.toString() || fatura.cnpjUsuaria,
                  usuaria: fatura.usuaria || '',
                  cnpj: fatura.cnpjUsuaria || '',
                  codigoUsuaria: fatura.codigoUsuaria || '',
                  tributos: fatura.tributos ? Number(fatura.tributos) : 0,
                  valorTotal: fatura.valorTotal ? Number(fatura.valorTotal) : 0,
                  statusFatura: fatura.statusFatura || undefined, // Armazenar statusFatura diretamente do backend
                  parcelas: []
                });
              } else {
                // Atualizar statusFatura se a usuária já existir (pode ter mudado)
                const usuariaExistente = usuariasMap.get(usuariaKey)!;
                if (fatura.statusFatura) {
                  usuariaExistente.statusFatura = fatura.statusFatura;
                }
              }
              
              // Adicionar parcelas da fatura à usuária
              const usuaria = usuariasMap.get(usuariaKey)!;
              if (fatura.parcelas && fatura.parcelas.length > 0) {
                fatura.parcelas.forEach((parcela) => {
                  if (parcela.numParcela && parcela.dataVencimento) {
                    // Verificar se a parcela já existe (evitar duplicatas)
                    const parcelaExistente = usuaria.parcelas.find(p => p.numParcela === parcela.numParcela);
                    
                    // Mapear id para cdParcela (API retorna como "id" mas backend espera "cdParcela")
                    const cdParcela = parcela.id || parcela.cdParcela;
                    
                    // Priorizar status da parcela se existir e for um status de pagamento confirmado
                    // Caso contrário, usar statusFatura da fatura
                    // Status da parcela tem prioridade quando é CONFIRMADA, PAGO, LIQUIDADO, etc
                    const statusParcelaNormalizado = parcela.status ? parcela.status.toUpperCase().trim() : '';
                    const statusFinal = (statusParcelaNormalizado === 'CONFIRMADA' || 
                                        statusParcelaNormalizado === 'PAGO' || 
                                        statusParcelaNormalizado === 'LIQUIDADO' || 
                                        statusParcelaNormalizado === 'LIQUIDADA') 
                                      ? parcela.status 
                                      : (parcela.status || fatura.statusFatura);
                    
                    if (!parcelaExistente) {
                      // Converter dataVencimento para ISO string
                      const dataVencimento = new Date(parcela.dataVencimento + 'T00:00:00');
                      
                      if (!cdParcela) {
                        console.error('❌ Parcela sem cdParcela (id):', {
                          numParcela: parcela.numParcela,
                          parcelaCompleta: parcela,
                          id: parcela.id,
                          cdParcela: parcela.cdParcela
                        });
                      }
                      
                      // Normalizar status para comparação
                      const statusNormalizado = statusFinal ? statusFinal.toUpperCase().trim() : '';
                      
                      usuaria.parcelas.push({
                        cdParcela: cdParcela,
                        numParcela: parcela.numParcela,
                        data: dataVencimento.toISOString(),
                        valor: parcela.valor ? Number(parcela.valor) : 0,
                        status: statusNormalizado === 'PAGO' || 
                               statusNormalizado === 'LIQUIDADO' || 
                               statusNormalizado === 'LIQUIDADA' || 
                               statusNormalizado === 'CONFIRMADA' ? 'pago' : 
                               statusNormalizado === 'ENVIADO' ? 'enviado' : 
                               statusNormalizado === 'REJEITADA' || statusNormalizado === 'REJEITADO' ? 'aguardando' :
                               'aguardando',
                        statusBackend: statusFinal || undefined, // Usar status da parcela ou statusFatura da fatura
                        linkDocumento: parcela.enderecoComprovante || undefined,
                        valorDivergente: parcela.valorDivergente ? Number(parcela.valorDivergente) : undefined,
                        formaPagamento: parcela.formaPagamento || undefined
                      });
                      console.log('✅ Nova parcela adicionada:', {
                        numParcela: parcela.numParcela,
                        statusFatura: fatura.statusFatura,
                        statusParcela: parcela.status,
                        statusBackend: statusFinal,
                        statusLocal: usuaria.parcelas[usuaria.parcelas.length - 1].status
                      });
                    } else {
                      // Atualizar o cdParcela se a parcela existente não tiver
                      if (cdParcela && !parcelaExistente.cdParcela) {
                        parcelaExistente.cdParcela = cdParcela;
                        console.log('✅ cdParcela atualizado para parcela existente:', {
                          numParcela: parcela.numParcela,
                          cdParcela: cdParcela
                        });
                      }
                      // Atualizar valorDivergente se existir
                      if (parcela.valorDivergente !== null && parcela.valorDivergente !== undefined) {
                        parcelaExistente.valorDivergente = Number(parcela.valorDivergente);
                      }
                      // Atualizar formaPagamento se existir
                      if (parcela.formaPagamento) {
                        parcelaExistente.formaPagamento = parcela.formaPagamento;
                      }
                      // Atualizar status do backend (sempre atualizar, mesmo se já existir)
                      if (statusFinal) {
                        parcelaExistente.statusBackend = statusFinal;
                        // Normalizar status para comparação
                        const statusNormalizado = statusFinal.toUpperCase().trim();
                        // Atualizar status local baseado no status do backend
                        parcelaExistente.status = statusNormalizado === 'PAGO' || 
                                                 statusNormalizado === 'LIQUIDADO' || 
                                                 statusNormalizado === 'LIQUIDADA' || 
                                                 statusNormalizado === 'CONFIRMADA' ? 'pago' : 
                                                 statusNormalizado === 'ENVIADO' ? 'enviado' : 
                                                 statusNormalizado === 'REJEITADA' || statusNormalizado === 'REJEITADO' ? 'aguardando' :
                                                 'aguardando';
                        console.log('✅ Status atualizado para parcela existente:', {
                          numParcela: parcela.numParcela,
                          statusFatura: fatura.statusFatura,
                          statusParcela: parcela.status,
                          statusBackend: statusFinal,
                          statusLocal: parcelaExistente.status,
                          formaPagamento: parcela.formaPagamento
                        });
                      }
                    }
                  }
                });
              }
            });
            
            // Converter Map para Array e ordenar parcelas de cada usuária
            const usuariasComParcelas: Usuaria[] = Array.from(usuariasMap.values()).map(usuaria => ({
              ...usuaria,
              parcelas: usuaria.parcelas.sort((a, b) => a.numParcela - b.numParcela)
            }));

            // Atualizar total de itens (se a API retornar informações de paginação, usar; senão, usar quantidade retornada)
            setTotalItens(faturas.length);

            // Usar dados da API
            setUsuarias(usuariasComParcelas);
          } catch (error: any) {
            console.error('Erro ao carregar faturas:', error);
            toast({
              title: 'Erro ao carregar dados',
              description: error.message || 'Não foi possível carregar as faturas',
              variant: 'destructive'
            });
            // Em caso de erro, limpar dados
            setUsuarias([]);
          } finally {
            setLoadingUsuarias(false);
          }
        };

  // Carregar dados do backend usando o endpoint de faturas
  useEffect(() => {
    carregarFaturas();
  }, []);

  // Filter usuarias based on filter criteria
  const filteredUsuarias = useMemo(() => {
    return usuarias.filter(usuaria => {
      const matchesUsuaria = usuaria.usuaria.toLowerCase().includes(filterUsuaria.toLowerCase());
      const matchesCnpj = usuaria.cnpj.toLowerCase().includes(filterCnpj.toLowerCase());
      const matchesCodigo = usuaria.codigoUsuaria.toLowerCase().includes(filterCodigo.toLowerCase());

      return matchesUsuaria && matchesCnpj && matchesCodigo;
    });
  }, [usuarias, filterUsuaria, filterCnpj, filterCodigo]);

  const handleClearFilters = () => {
    setFilterUsuaria('');
    setFilterCnpj('');
    setFilterCodigo('');
  };

  const hasActiveFilters = filterUsuaria || filterCnpj || filterCodigo;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleUsuariaClick = (usuaria: Usuaria) => {
    setSelectedUsuariaForUpload(usuaria);
    setIsUploadModalOpen(true);
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
        link.download = `${selectedUsuariaForUpload?.usuaria}-parcela-${parcelaNumero}.pdf`;
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

    // Se for um File, usar o método original
    if (comprovante instanceof File) {
      const url = URL.createObjectURL(comprovante);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedUsuariaForUpload?.usuaria}-parcela-${parcelaNumero}-${comprovante.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePreviewComprovante = async (comprovante: File | string | undefined, cdParcela?: number) => {
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

    // Se for uma string (URL), abrir diretamente
    if (typeof comprovante === 'string') {
      window.open(comprovante, '_blank');
      return;
    }

    // Se for um File, usar o método original
    if (comprovante instanceof File) {
      const url = URL.createObjectURL(comprovante);
      window.open(url, '_blank');
    }
  };

  const processarPDF = async (file: File, parcelaNumero: number, usuariaId?: string) => {
    setIsProcessingPDF(true);
    const targetUsuariaId = usuariaId || selectedUsuariaForUpload?.id;
    
    try {
      console.log('='.repeat(80));
      console.log('🚀 INICIANDO PROCESSAMENTO DE PDF');
      console.log('='.repeat(80));
      console.log('📄 Arquivo:', file.name);
      console.log('📦 Tamanho:', (file.size / 1024).toFixed(2), 'KB');
      console.log('📦 Parcela:', parcelaNumero);
      console.log('='.repeat(80));

      const formData = new FormData();
      formData.append('pdf', file);

      console.log('📤 Enviando arquivo para o servidor...');
      console.log('🌐 URL:', window.location.origin + '/api/pagamento-boleto/upload');
      
      const response = await fetch('/api/pagamento-boleto/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('📥 Resposta recebida, status:', response.status);
      console.log('📥 Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', response.status);
        console.error('❌ Corpo do erro:', errorText);
        throw new Error(`Erro ao processar PDF: ${response.status} - ${errorText}`);
      }

      const result: ProcessarComprovanteResponse = await response.json();
      console.log('📋 Resultado do processamento:', result);

      if (result.sucesso && result.dados) {
        // Log detalhado dos dados extraídos no frontend
        console.log('\n' + '='.repeat(80));
        console.log('✅ DADOS DO COMPROVANTE EXTRAÍDOS (FRONTEND)');
        console.log('='.repeat(80));
        console.log('📦 Parcela:', parcelaNumero);
        console.log('📄 Nome do arquivo:', file.name);
        console.log('🏦 Banco detectado:', result.bancoDetectado);
        console.log('');
        console.log('🏛️ DADOS BANCÁRIOS:');
        console.log('  • Agência:', result.dados.agencia || '❌ não encontrado');
        console.log('  • Conta:', result.dados.conta || '❌ não encontrado');
        console.log('  • Banco:', result.dados.banco || '❌ não encontrado');
        console.log('  • Número de Identificação:', result.dados.numeroIdentificacao || '❌ não encontrado');
        console.log('');
        console.log('👤 BENEFICIÁRIO:');
        console.log('  • Nome:', result.dados.beneficiario || '❌ não encontrado');
        console.log('  • CNPJ/CPF:', result.dados.cnpjBeneficiario || '❌ não encontrado');
        console.log('');
        console.log('💳 PAGADOR:');
        console.log('  • Nome:', result.dados.pagador || '❌ não encontrado');
        console.log('');
        console.log('📅 DATAS:');
        console.log('  • Data de Vencimento:', result.dados.dataVencimento || '❌ não encontrado');
        console.log('  • Data de Pagamento:', result.dados.dataPagamento || '❌ não encontrado');
        console.log('');
        console.log('💰 VALORES:');
        console.log('  • Valor do Documento:', result.dados.valorDocumento ? `R$ ${result.dados.valorDocumento.toFixed(2).replace('.', ',')}` : '❌ não encontrado');
        console.log('  • Valor Cobrado:', result.dados.valorCobrado ? `R$ ${result.dados.valorCobrado.toFixed(2).replace('.', ',')}` : '❌ não encontrado');
        console.log('');
        console.log('📄 Tipo Documento:', result.dados.tipoDocumento || 'não informado');
        console.log('');
        console.log('='.repeat(80));
        console.log('📦 DADOS COMPLETOS EM JSON:');
        console.log(JSON.stringify(result.dados, null, 2));
        console.log('='.repeat(80) + '\n');

        // Converter PDF para base64
        const pdfBase64 = await fileToBase64(file);
        
        // Buscar usuária para obter CNPJ
        const usuaria = usuarias.find(u => u.id === targetUsuariaId);
        if (!usuaria) {
          throw new Error('Usuária não encontrada');
        }

        // Preparar payload para enviar ao backend
        // Converter datas de string ISO para LocalDate (YYYY-MM-DD)
        const formatDateForBackend = (dateString?: string): string | undefined => {
          if (!dateString) return undefined;
          try {
            const date = new Date(dateString);
            return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
          } catch {
            return undefined;
          }
        };

        const payload: ComprovantePagamentoRequest = {
          banco: result.dados.banco || result.bancoDetectado || '',
          tipoDocumento: (result.dados.tipoDocumento as TipoDocumento) || TipoDocumento.BOLETO,
          numeroIdentificacao: result.dados.numeroIdentificacao,
          agencia: result.dados.agencia,
          conta: result.dados.conta,
          beneficiario: result.dados.beneficiario,
          cnpjBeneficiario: result.dados.cnpjBeneficiario,
          pagador: result.dados.pagador,
          dataVencimento: formatDateForBackend(result.dados.dataVencimento),
          dataPagamento: formatDateForBackend(result.dados.dataPagamento),
          valorDocumento: result.dados.valorDocumento,
          valorCobrado: result.dados.valorCobrado,
          cnpjPagador: usuaria.cnpj.replace(/\D/g, ''), // Remover formatação do CNPJ
          pdfBase64: pdfBase64,
          nomeArquivo: file.name
        };

        // Buscar o id da parcela (cdParcela mapeado da API)
        const parcelaAtual = usuaria.parcelas.find(p => p.numParcela === parcelaNumero);
        const idParcela = parcelaAtual?.cdParcela; // cdParcela é o id da parcela

        if (!idParcela || idParcela === null || idParcela === undefined) {
          console.error('❌ idParcela não encontrado ou inválido:', {
            parcelaNumero,
            parcelaAtual,
            idParcela,
            todasParcelas: usuaria.parcelas.map(p => ({
              numParcela: p.numParcela,
              cdParcela: p.cdParcela
            }))
          });
          throw new Error('idParcela não encontrado. Por favor, recarregue a página e tente novamente.');
        }

        console.log('📦 idParcela encontrado e validado:', {
          idParcela,
          tipo: typeof idParcela,
          parcelaNumero
        });

        // Adicionar dados extraídos ao payload para campos específicos de TED
        payload.dadosExtraidos = result.dados;

        // Enviar para o backend
        console.log('📤 Enviando comprovante para o backend...');
        const backendResponse = await enviarComprovanteBackend(payload, idParcela);
        console.log('✅ Resposta do backend:', backendResponse);

        // Atualizar parcela com dados extraídos e link do documento
        setUsuarias(prev => prev.map(usr => {
          if (usr.id === targetUsuariaId) {
            return {
              ...usr,
              parcelas: usr.parcelas.map(parc => {
                if (parc.numParcela === parcelaNumero) {
                  return {
                    ...parc,
                    cdParcela: parc.cdParcela || idParcela, // Garantir que o cdParcela seja preservado
                    comprovante: file,
                    dadosExtraidos: result.dados,
                    linkDocumento: backendResponse.linkDocumento,
                    status: 'enviado' as const
                  };
                }
                return parc;
              })
            };
          }
          return usr;
        }));

        const tipoDoc = result.dados.tipoDocumento || 'BOLETO';
        const tipoDocLabel = tipoDoc === 'BOLETO' ? 'Boleto' : 
                            tipoDoc === 'TED' ? 'TED' : 
                            tipoDoc === 'TRANSFERECIA' ? 'Transferência' : 
                            tipoDoc === 'DOC' ? 'DOC' : tipoDoc;

        toast({
          title: 'Comprovante enviado com sucesso',
          description: `Comprovante ${tipoDocLabel} processado e enviado ao backend${result.bancoDetectado ? ` (${result.bancoDetectado})` : ''}.`
        });
      } else {
        console.error('❌ Erro na resposta do servidor:', result);
        throw new Error(result.erro || 'Erro ao processar PDF');
      }
    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      toast({
        title: 'Erro ao processar PDF',
        description: error instanceof Error ? error.message : 'Não foi possível processar o arquivo PDF',
        variant: 'destructive'
      });
    } finally {
      setIsProcessingPDF(false);
    }
  };

  // Função auxiliar para converter File para base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1]; // Remove o prefixo data:application/pdf;base64,
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Função para enviar comprovante ao backend
  // Envia todos os dados (JSON + base64) em uma única chamada para /comprovantes/pagamentos
  const enviarComprovanteBackend = async (payload: ComprovantePagamentoRequest, idParcela?: number): Promise<ComprovantePagamentoResponse> => {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    if (!idParcela || idParcela === null || idParcela === undefined || isNaN(idParcela)) {
      console.error('❌ idParcela inválido na função enviarComprovanteBackend:', idParcela);
      throw new Error('idParcela é obrigatório e deve ser um número válido');
    }

    const API_BASE_URL = API_BASE_URL_WITHOUT_VERSION;
    const cleanToken = token.trim().replace(/[\r\n]/g, '');
    
    // Preparar payload completo conforme estrutura da API
    const requestPayload: any = {
      idParcela: Number(idParcela),
      banco: payload.banco,
      tipoDocumento: payload.tipoDocumento,
      numeroIdentificacao: payload.numeroIdentificacao,
      agencia: payload.agencia,
      conta: payload.conta,
      beneficiario: payload.beneficiario,
      cnpjBeneficiario: payload.cnpjBeneficiario,
      pagador: payload.pagador,
      dataVencimento: payload.dataVencimento,
      dataPagamento: payload.dataPagamento,
      valorDocumento: payload.valorDocumento,
      valorCobrado: payload.valorCobrado,
      cnpjPagador: payload.cnpjPagador,
      comprovanteBase64: payload.pdfBase64
    };

    // Adicionar campos específicos para TED se o tipo de documento for TED
    if (payload.tipoDocumento === TipoDocumento.TED && payload.dadosExtraidos) {
      const dados = payload.dadosExtraidos;
      requestPayload.bancoDestino = dados.bancoDestino;
      requestPayload.bancoDestinoNumero = dados.bancoDestinoNumero;
      requestPayload.bancoDestinoISPB = dados.bancoDestinoISPB;
      requestPayload.agenciaDestino = dados.agenciaDestino;
      requestPayload.contaDestino = dados.contaDestino;
      requestPayload.finalidade = dados.finalidade;
      requestPayload.controle = dados.controle;
      requestPayload.dataHoraSolicitacao = dados.dataHoraSolicitacao;
    }

    console.log('📤 Enviando comprovante completo para /comprovantes/pagamentos:', {
      endpoint: `${API_BASE_URL}/comprovantes/pagamentos`,
      idParcela: idParcela,
      tipoDocumento: payload.tipoDocumento,
      banco: payload.banco,
      cnpjPagador: payload.cnpjPagador,
      comprovanteBase64Length: payload.pdfBase64?.length || 0
    });

    const response = await fetch(`${API_BASE_URL}/comprovantes/pagamentos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Erro ao enviar comprovante';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.erro || errorMessage;
      } catch {
        errorMessage = errorText || `Erro HTTP ${response.status}`;
      }
      console.error('❌ Erro ao enviar comprovante:', errorMessage);
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ Comprovante enviado com sucesso:', result);
    
    return {
      mensagem: result.mensagem || 'Comprovante enviado com sucesso',
      dataEnvioComprovante: result.dataEnvioComprovante || new Date().toISOString(),
      linkDocumento: result.linkDocumento
    };
  };

  const handleAlterarComprovante = async (parcelaNumero: number, file: File, cdParcela?: number) => {
    if (!cdParcela) {
      toast({
        title: 'Erro',
        description: 'ID da parcela não encontrado. Por favor, recarregue a página.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessingPDF(true);
    try {
      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('idParcela', cdParcela.toString());

      const response = await fetch(`${API_BASE_URL_WITHOUT_VERSION}/comprovantes/alterar`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro ao alterar comprovante' }));
        throw new Error(errorData.error || 'Erro ao alterar comprovante');
      }

      const result = await response.json().catch(() => ({}));

      // Atualizar estado local
      setUsuarias(prev => prev.map(usr => {
        if (usr.id === selectedUsuariaForUpload?.id) {
          return {
            ...usr,
            parcelas: usr.parcelas.map(parc => {
              if (parc.numParcela === parcelaNumero) {
                return {
                  ...parc,
                  comprovante: file,
                  linkDocumento: result.linkDocumento || parc.linkDocumento,
                  status: 'enviado' as const
                };
              }
              return parc;
            })
          };
        }
        return usr;
      }));

      toast({
        title: 'Comprovante alterado com sucesso',
        description: `Comprovante da parcela ${parcelaNumero} foi alterado com sucesso`
      });
    } catch (error) {
      console.error('Erro ao alterar comprovante:', error);
      toast({
        title: 'Erro ao alterar comprovante',
        description: error instanceof Error ? error.message : 'Não foi possível alterar o comprovante',
        variant: 'destructive'
      });
    } finally {
      setIsProcessingPDF(false);
    }
  };

  // Gerar arquivo CNAB - chama API sem enviar parcelas
  const handleGerarCNAB = async () => {
    try {
      // Chamar API para gerar arquivo CNAB
      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');
      
      // O endpoint remessa está em /ons-api/api/v1/remessa/gerarArquivoCnab
      // Usar API_BASE_URL que já inclui /api/v1
      const urlCompleta = `${API_BASE_URL}/remessa/gerarArquivoCnab`;
      console.log('🔗 URL da API:', urlCompleta);
      
      const response = await fetch(urlCompleta, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro ao gerar arquivo CNAB');
        throw new Error(errorText || 'Erro ao gerar arquivo CNAB');
      }

      // A API retorna JSON com o arquivo em base64
      const data = await response.json();
      
      if (!data.arquivo) {
        throw new Error('Resposta da API não contém o arquivo');
      }

      // Decodificar base64 para blob
      const base64Data = data.arquivo;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'text/plain' });
      
      // Usar o nome do arquivo retornado pela API ou gerar um padrão
      const nomeArquivo = data.nomeArquivo || `remessa_cnab_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.txt`;
      
      // Fazer download do arquivo
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Arquivo CNAB gerado',
        description: data.mensagem || `Arquivo gerado com ${data.quantidadeRegistros || 0} registros`
      });
    } catch (error) {
      console.error('Erro ao gerar CNAB:', error);
      toast({
        title: 'Erro ao gerar CNAB',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  };

  // Pagar parcela via Open Finance
  const handlePagarViaOpenFinance = async (cdParcela: number, valor: number) => {
    try {
      // Iniciar pagamento
      const response: IniciarPagamentoParcelaResponse = await OpenFinanceAPI.iniciarPagamento({
        parcelaId: cdParcela,
        valor: valor
      });

      // Salvar informações do pagamento
      setPagamentosOpenFinance(prev => {
        const newMap = new Map(prev);
        newMap.set(cdParcela, {
          status: response.status,
          externalPaymentId: response.externalPaymentId,
          pagamentoId: response.pagamentoId
        });
        return newMap;
      });

      toast({
        title: 'Pagamento iniciado',
        description: response.status === 'PENDENTE_BANCO' 
          ? 'Aguardando confirmação do banco...' 
          : 'Pagamento processado com sucesso!'
      });

      // Se estiver pendente, iniciar polling para verificar status
      if (response.status === 'PENDENTE_BANCO') {
        // Polling a cada 2 segundos por até 30 segundos
        let tentativas = 0;
        const maxTentativas = 15; // 30 segundos / 2 segundos

        const intervalId = setInterval(async () => {
          tentativas++;
          
          try {
            // Tentar verificar status do pagamento
            const statusPagamento = await OpenFinanceAPI.verificarStatusPagamento(response.pagamentoId);
            
            if (statusPagamento && (statusPagamento.status === 'CONFIRMADO' || statusPagamento.status === 'FALHOU')) {
              clearInterval(intervalId);
              
              // Atualizar estado do pagamento
              setPagamentosOpenFinance(prev => {
                const newMap = new Map(prev);
                const pagamento = newMap.get(cdParcela);
                if (pagamento) {
                  newMap.set(cdParcela, {
                    ...pagamento,
                    status: statusPagamento.status
                  });
                }
                return newMap;
              });

              // Recarregar dados para atualizar status da parcela
              await carregarFaturas();

              toast({
                title: statusPagamento.status === 'CONFIRMADO' ? 'Pagamento confirmado!' : 'Pagamento falhou',
                description: statusPagamento.status === 'CONFIRMADO' 
                  ? 'O pagamento foi confirmado com sucesso' 
                  : 'O pagamento foi rejeitado. Tente novamente.',
                variant: statusPagamento.status === 'CONFIRMADO' ? 'default' : 'destructive'
              });
            }
          } catch (error) {
            // Se o endpoint não existir, apenas logar o erro e continuar tentando
            // O backend processa automaticamente após alguns segundos
            console.log('Aguardando processamento automático do backend...');
          }

          // Timeout após max tentativas
          if (tentativas >= maxTentativas) {
            clearInterval(intervalId);
            toast({
              title: 'Timeout',
              description: 'Não foi possível confirmar o status do pagamento. Verifique mais tarde.',
              variant: 'destructive'
            });
          }
        }, 2000);
      } else if (response.status === 'CONFIRMADO') {
        // Se já foi confirmado, recarregar dados
        await carregarFaturas();
      }
    } catch (error: any) {
      console.error('Erro ao pagar via Open Finance:', error);
      toast({
        title: 'Erro ao iniciar pagamento',
        description: error.message || 'Não foi possível iniciar o pagamento via Open Finance',
        variant: 'destructive'
      });
    }
  };

  // Processar arquivo CNAB retornado do banco
  const handleProcessarCNAB = async () => {
    if (!cnabFile) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Por favor, selecione um arquivo CNAB para processar',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessingCNAB(true);
    setProgressoProcessamento(null);
    
    try {
      // Primeiro, ler o arquivo para identificar as parcelas que serão processadas
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.onerror = reject;
        reader.readAsText(cnabFile);
      });

      // Processar linhas do arquivo CNAB para identificar parcelas
      const linhas = fileContent.split(/\r?\n/).filter(linha => linha.trim().length > 0);
      const parcelasIdentificadas: Array<{ cdParcela: number; fatura: string }> = [];

      // Processar linha por linha para identificar parcelas
      for (let index = 0; index < linhas.length; index++) {
        const linha = linhas[index];
        
        if (linha.length >= 1 && linha[0] === '3') {
          if (linha.length >= 150 && linha.length >= 11 && linha[10] === 'A') {
            try {
              const nossoNumero = linha.substring(129, 149).trim();
              const codigoOcorrencia = linha.length >= 232 ? linha.substring(229, 231).trim() : '';
              
              if (nossoNumero && nossoNumero !== '00000000000000000000' && nossoNumero !== '') {
                const cdParcela = parseInt(nossoNumero);
                if (!isNaN(cdParcela) && cdParcela > 0) {
                  const codigoOk = !codigoOcorrencia || codigoOcorrencia === '' || ['00', '01', '02', '06'].includes(codigoOcorrencia);
                  
                  if (codigoOk) {
                    // Encontrar a fatura correspondente
                    const faturaEncontrada = usuarias.find(usr => 
                      usr.parcelas.some(parc => parc.cdParcela === cdParcela)
                    );
                    const nomeFatura = faturaEncontrada ? faturaEncontrada.usuaria : `Fatura ${cdParcela}`;
                    
                    parcelasIdentificadas.push({
                      cdParcela,
                      fatura: nomeFatura
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`Erro ao processar linha ${index + 1}:`, error);
            }
          }
        }
      }

      // Inicializar progresso
      const totalParcelas = parcelasIdentificadas.length;
      const itensProgresso = parcelasIdentificadas.map(item => ({
        fatura: item.fatura,
        parcela: item.cdParcela,
        cdParcela: item.cdParcela,
        status: 'processando' as const
      }));

      setProgressoProcessamento({
        total: totalParcelas,
        processadas: 0,
        itens: itensProgresso
      });

      // Converter arquivo para base64
      const arquivoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(cnabFile);
      });

      // Chamar API para processar remessa de pagamento
      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');

      const urlCompleta = `${API_BASE_URL}/remessa/remessaPagamento`;
      console.log('🔗 URL da API:', urlCompleta);

      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arquivoBase64: arquivoBase64,
          nomeArquivo: cnabFile.name
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro ao processar remessa de pagamento');
        throw new Error(errorText || 'Erro ao processar remessa de pagamento');
      }

      // Verificar o Content-Type da resposta
      const contentType = response.headers.get('content-type');
      let data: any = {};
      let mensagemSucesso = '';

      if (contentType && contentType.includes('application/json')) {
        // Se for JSON, fazer parse
        try {
          data = await response.json();
          mensagemSucesso = data.mensagem || data.message || '';
        } catch (jsonError) {
          // Se falhar o parse JSON, tentar ler como texto
          const textResponse = await response.text();
          mensagemSucesso = textResponse || 'Arquivo processado com sucesso';
        }
      } else {
        // Se não for JSON, ler como texto
        const textResponse = await response.text();
        mensagemSucesso = textResponse || 'Arquivo processado com sucesso';
      }

      console.log('✅ Resposta da API:', data);

      // Processar resposta da API e atualizar status das parcelas
      if (data) {
        // Se a resposta contém statusFatura ou lista de parcelas processadas
        const statusFatura = data.statusFatura;
        const parcelasProcessadas = data.parcelasProcessadas || data.parcelas || (Array.isArray(data) ? data : []);
        
        setUsuarias(prev => {
          return prev.map(usr => {
            const parcelasAtualizadasUsr = usr.parcelas.map(parc => {
              // Verificar se esta parcela foi processada na resposta
              const parcelaProcessada = parcelasProcessadas.find((p: any) => 
                p.cdParcela === parc.cdParcela || 
                p.id === parc.cdParcela ||
                (p.numParcela && p.numParcela === parc.numParcela)
              );
              
              // Se encontrou a parcela na resposta, atualizar status
              // IMPORTANTE: Priorizar statusFatura da fatura, não o status individual da parcela
              if (parcelaProcessada) {
                // Priorizar statusFatura da fatura (da resposta geral) sobre status da parcela individual
                const novoStatus = statusFatura || parcelaProcessada.statusFatura || parcelaProcessada.status || 'LIQUIDADO';
                console.log(`🔄 Atualizando parcela ${parc.cdParcela} com statusFatura da fatura:`, statusFatura, 'status final:', novoStatus);
                return {
                  ...parc,
                  status: (novoStatus === 'LIQUIDADO' || novoStatus === 'LIQUIDADA' || novoStatus === 'PAGO' || novoStatus === 'CONFIRMADA') ? 'pago' as const : parc.status,
                  statusBackend: novoStatus
                };
              }
              
              // Se a resposta tem statusFatura geral e a parcela está na lista de processadas do progresso
              if (statusFatura && progressoProcessamento?.itens.some(item => item.cdParcela === parc.cdParcela)) {
                console.log(`🔄 Atualizando parcela ${parc.cdParcela} com statusFatura geral da fatura:`, statusFatura);
                return {
                  ...parc,
                  status: (statusFatura === 'LIQUIDADA' || statusFatura === 'LIQUIDADO') ? 'pago' as const : parc.status,
                  statusBackend: statusFatura
                };
              }
              
              return parc;
            });
            
            return {
              ...usr,
              parcelas: parcelasAtualizadasUsr
            };
          });
        });
      }

      // Atualizar progresso - marcar todas como processadas
      setProgressoProcessamento(prev => {
        if (!prev) return null;
        return {
          ...prev,
          processadas: prev.total,
          itens: prev.itens.map(item => ({
            ...item,
            status: 'processada' as const
          }))
        };
      });

      // Aguardar um pouco para mostrar o progresso completo
      await new Promise(resolve => setTimeout(resolve, 500));

      // Recarregar dados do backend para atualizar status das parcelas
      await carregarFaturas();

      // Toast de sucesso
      toast({
        title: 'Remessa de pagamento processada com sucesso',
        description: mensagemSucesso || `${totalParcelas} parcelas processadas e baixas aplicadas`
      });

      // Limpar progresso após um delay
      setTimeout(() => {
        setProgressoProcessamento(null);
        setIsCNABDialogOpen(false);
        setCnabFile(null);
        setParcelasProcessando(new Set());
        setParcelasProcessadas(new Set());
      }, 2000);
    } catch (error) {
      console.error('Erro ao processar CNAB:', error);
      
      // Marcar itens como erro
      setProgressoProcessamento(prev => {
        if (!prev) return null;
        return {
          ...prev,
          itens: prev.itens.map(item => ({
            ...item,
            status: 'erro' as const
          }))
        };
      });

      toast({
        title: 'Erro ao processar CNAB',
        description: error instanceof Error ? error.message : 'Não foi possível processar o arquivo CNAB',
        variant: 'destructive'
      });
      
      // Limpar estados de processamento em caso de erro
      setTimeout(() => {
        setParcelasProcessando(new Set());
        setParcelasProcessadas(new Set());
        setProgressoProcessamento(null);
      }, 3000);
    } finally {
      setIsProcessingCNAB(false);
    }
  };

  const handleUploadFile = async (parcelaNumero: number, file: File, usuariaId?: string) => {
    const targetUsuariaId = usuariaId || selectedUsuariaForUpload?.id;
    const parcela = selectedUsuariaForUpload?.parcelas.find(p => p.numParcela === parcelaNumero);
    
    // Se já existe comprovante, usar a API de alterar
    if (parcela && (parcela.comprovante || parcela.linkDocumento) && parcela.cdParcela) {
      await handleAlterarComprovante(parcelaNumero, file, parcela.cdParcela);
      return;
    }
    
    // Se for PDF, processar automaticamente
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await processarPDF(file, parcelaNumero, targetUsuariaId);
    } else {
      // Para outros tipos de arquivo, apenas salvar
      console.log('=== COMPROVANTE ANEXADO (NÃO PDF) ===');
      console.log('Parcela:', parcelaNumero);
      console.log('Arquivo:', file.name);
      console.log('Tipo:', file.type);
      console.log('Tamanho:', (file.size / 1024).toFixed(2), 'KB');
      console.log('======================================');

      setUsuarias(prev => prev.map(usr => {
        if (usr.id === targetUsuariaId) {
          return {
            ...usr,
            parcelas: usr.parcelas.map(parc => {
              if (parc.numParcela === parcelaNumero) {
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
        return usr;
      }));
      toast({
        title: 'Comprovante enviado',
        description: `Comprovante enviado com sucesso para parcela ${parcelaNumero}`
      });
    }
    
    // Limpar estado de upload
    if (uploadingForUsuaria) {
      setUploadingForUsuaria(null);
    }
  };

  const handleQuickUpload = (usuaria: Usuaria, parcelaNumero: number) => {
    setUploadingForUsuaria({ usuariaId: usuaria.id, parcelaNumero });
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleUploadFile(parcelaNumero, file, usuaria.id);
      } else {
        setUploadingForUsuaria(null);
      }
    };
    input.click();
  };

  const handleRemoverComprovante = (parcelaNumero: number) => {
    setUsuarias(prev => prev.map(usr => {
      if (usr.id === selectedUsuariaForUpload?.id) {
        return {
          ...usr,
          parcelas: usr.parcelas.map(parc => {
            if (parc.numParcela === parcelaNumero) {
              console.log('=== COMPROVANTE REMOVIDO ===');
              console.log('Parcela:', parcelaNumero);
              console.log('Arquivo removido:', parc.comprovante?.name);
              console.log('============================');
              return {
                ...parc,
                comprovante: undefined,
                dadosExtraidos: undefined,
                status: 'aguardando' as const
              };
            }
            return parc;
          })
        };
      }
      return usr;
    }));
    toast({
      title: 'Comprovante removido',
      description: `Comprovante removido da parcela ${parcelaNumero}`
    });
  };

  const getParcelaStatusBadge = (parcela: ParcelaDebito) => {
    // Priorizar status do backend se existir
    if (parcela.statusBackend) {
      // Normalizar o status: remover espaços, converter para maiúsculas e normalizar caracteres especiais
      const status = parcela.statusBackend.toUpperCase().trim().replace(/\s+/g, '_').replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
      
      if (status === 'CONFIRMADA' || status === 'PAGO' || status === 'LIQUIDADO' || status === 'LIQUIDADA') {
        return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Liquidado</Badge>;
      }
      if (status === 'REJEITADA' || status === 'REJEITADO') {
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      }
      if (status === 'PENDENTES' || status === 'PENDENTE') {
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      }
      if (status === 'EM_ANALISE' || status.includes('ANALISE')) {
        return <Badge variant="secondary" className="bg-yellow-500 text-yellow-foreground"><Clock className="h-3 w-3 mr-1" />Em análise</Badge>;
      }
      if (status === 'ENVIADO') {
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Enviado</Badge>;
      }
    }
    // Fallback para status local
    if (parcela.comprovante || parcela.linkDocumento) {
      return <Badge variant="default" className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Aguardando</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aviso de Débito</h1>
          <p className="text-muted-foreground">
            Gerenciar débitos e enviar comprovantes de pagamento
            {loadingUsuarias && <span className="ml-2 text-blue-500">Carregando...</span>}
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
              <DrawerTitle>Filtrar Usuárias</DrawerTitle>
              <DrawerDescription>
                Filtre as usuárias por nome, CNPJ ou código
              </DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="filter-usuaria">Usuária</Label>
                <Input
                  id="filter-usuaria"
                  placeholder="Digite o nome da usuária..."
                  value={filterUsuaria}
                  onChange={(e) => setFilterUsuaria(e.target.value)}
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
                <Label htmlFor="filter-codigo">Código Usuária</Label>
                <Input
                  id="filter-codigo"
                  placeholder="Digite o código..."
                  value={filterCodigo}
                  onChange={(e) => setFilterCodigo(e.target.value)}
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

      {/* Botões de ação em massa - Upload de Remessa de Pagamento */}
      <div className="flex gap-2 mb-4">
        <Button onClick={handleGerarCNAB} variant="outline" className="flex items-center gap-2">
          <FileCheck className="h-4 w-4" />
          Gerar Arquivo CNAB
        </Button>
        <Button onClick={() => setIsCNABDialogOpen(true)} variant="default" className="flex items-center gap-2 bg-primary">
          <Upload className="h-4 w-4" />
          Upload Remessa de Pagamento
        </Button>
        <Button 
          onClick={() => setIsOpenFinanceDialogOpen(true)} 
          variant="default" 
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <CreditCard className="h-4 w-4" />
          Pagar via Open Finance
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuárias</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredUsuarias.length}</div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters ? `Exibindo de ${usuarias.length}` : 'Usuárias com débitos'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total em Débito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div className="text-2xl font-bold">Carregando...</div>
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(dashboardData?.totalPagar ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Débitos pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Controles de Paginação */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="quantidade" className="text-sm">Itens por página:</Label>
                <Select
                  value={quantidade.toString()}
                  onValueChange={(value) => {
                    setQuantidade(Number(value));
                    setPagina(0);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
                    <SelectItem value="2000">2000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="ordenarPor" className="text-sm">Ordenar por:</Label>
                <Select
                  value={ordenarPor}
                  onValueChange={(value) => {
                    setOrdenarPor(value);
                    setPagina(0);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transmissora">Transmissora</SelectItem>
                    <SelectItem value="usuaria">Usuária</SelectItem>
                    <SelectItem value="valorTotal">Valor Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="ordem" className="text-sm">Ordem:</Label>
                <Select
                  value={ordem}
                  onValueChange={(value: 'ASC' | 'DESC') => {
                    setOrdem(value);
                    setPagina(0);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">Crescente</SelectItem>
                    <SelectItem value="DESC">Decrescente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(prev => Math.max(0, prev - 1))}
                disabled={pagina === 0 || loadingUsuarias}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[120px] text-center">
                Página {pagina + 1} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina(prev => prev + 1)}
                disabled={pagina >= totalPaginas - 1 || loadingUsuarias}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {totalItens > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Total de {totalItens} faturas encontradas
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lista de Usuárias - Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Aviso de Débito</CardTitle>
          <CardDescription>
            {hasActiveFilters ? `Exibindo ${filteredUsuarias.length} de ${usuarias.length} usuárias` : `Total de ${filteredUsuarias.length} usuárias`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsuarias ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando faturas...</p>
            </div>
          ) : filteredUsuarias.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma usuária encontrada com os filtros aplicados.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 align-middle"></TableHead>
                    <TableHead className="align-middle">Usuária</TableHead>
                    <TableHead className="align-middle">CNPJ</TableHead>
                    <TableHead className="align-middle">Código</TableHead>
                    <TableHead className="text-right align-middle">Valor Total</TableHead>
                    <TableHead className="text-right align-middle">Inadimplência</TableHead>
                    <TableHead className="text-center align-middle">Parcelas</TableHead>
                    <TableHead className="text-center align-middle">Status</TableHead>
                    <TableHead className="text-center align-middle">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsuarias.map((usuaria) => {
                    const totalComprovantes = usuaria.parcelas.filter(p => p.comprovante || p.linkDocumento).length;
                    const statusGeral = totalComprovantes === usuaria.parcelas.length ? 'completo' : totalComprovantes > 0 ? 'parcial' : 'pendente';
                    const isExpanded = expandedRow === usuaria.id;
                    // Calcular inadimplência total da fatura (soma de todos os valorDivergente das parcelas)
                    const inadimplenciaTotal = usuaria.parcelas.reduce((sum, parcela) => {
                      return sum + (parcela.valorDivergente && parcela.valorDivergente > 0 ? parcela.valorDivergente : 0);
                    }, 0);

                    return (
                      <React.Fragment key={usuaria.id}>
                        <TableRow className="hover:bg-muted/50">
                          <TableCell className="align-middle">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setExpandedRow(expandedRow === usuaria.id ? null : usuaria.id);
                              }}
                              className="h-8 w-8 p-0"
                              title="Expandir/Recolher"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium align-middle">{usuaria.usuaria}</TableCell>
                          <TableCell className="text-sm text-muted-foreground align-middle">{usuaria.cnpj}</TableCell>
                          <TableCell className="text-sm align-middle">{usuaria.codigoUsuaria}</TableCell>
                          <TableCell className="text-right font-semibold align-middle">{formatCurrency(usuaria.valorTotal)}</TableCell>
                          <TableCell className="text-right align-middle">
                            {inadimplenciaTotal > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                  {formatCurrency(inadimplenciaTotal)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {((inadimplenciaTotal / usuaria.valorTotal) * 100).toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {!isExpanded && (
                              <div className="flex flex-col items-center gap-1">
                                {usuaria.parcelas.map((p) => (
                                  <Badge key={p.numParcela} variant="outline" className="text-xs">
                                    {new Date(p.data).getDate()}/{String(new Date(p.data).getMonth() + 1).padStart(2, '0')}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {isExpanded && (
                              <span className="text-xs text-muted-foreground">{usuaria.parcelas.length} parcelas</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {usuaria.statusFatura ? (
                              (() => {
                                const status = usuaria.statusFatura.toUpperCase().trim();
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
                                // Exibir o status exatamente como vem do backend
                                return <Badge variant="outline">{usuaria.statusFatura}</Badge>;
                              })()
                            ) : (
                              // Fallback para status calculado se não houver statusFatura
                              <>
                                {statusGeral === 'completo' && <Badge className="bg-success">Completo</Badge>}
                                {statusGeral === 'parcial' && <Badge variant="secondary">Parcial ({totalComprovantes}/{usuaria.parcelas.length})</Badge>}
                                {statusGeral === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUsuariaClick(usuaria);
                              }}
                              className="h-8 w-8 p-0"
                              title="Gerenciar comprovantes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={9} className="p-0 bg-muted/30">
                              <div className="p-4">
                                <h4 className="font-semibold mb-3">Parcelas Detalhadas</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {usuaria.parcelas.map((parcela) => (
                                    <Card key={parcela.numParcela} className="p-3">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <p className="font-medium">Parcela {parcela.numParcela}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Vencimento: {new Date(parcela.data).toLocaleDateString('pt-BR')}
                                            {parcela.formaPagamento && (
                                              <span className="ml-1">
                                                • {parcela.formaPagamento === 'OPEN_FINANCE' ? 'Open Finance' : parcela.formaPagamento}
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="font-semibold">{formatCurrency(parcela.valor)}</p>
                                          {parcela.valorDivergente && parcela.valorDivergente > 0 && (
                                            <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                                              Inadimplente: {formatCurrency(parcela.valorDivergente)}
                                            </p>
                                          )}
                                          <div className="mt-1">
                                            {parcelasProcessando.has(parcela.cdParcela || 0) ? (
                                              <Badge variant="secondary" className="flex items-center gap-1 w-fit ml-auto">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Processando...
                                              </Badge>
                                            ) : parcelasProcessadas.has(parcela.cdParcela || 0) ? (
                                              <Badge variant="default" className="bg-success text-success-foreground flex items-center gap-1 w-fit ml-auto">
                                                <CheckCircle className="h-3 w-3" />
                                                Liquidado
                                              </Badge>
                                            ) : (
                                              getParcelaStatusBadge(parcela)
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      {/* Mini indicador de inadimplência no card expandido */}
                                      {parcela.valorDivergente && parcela.valorDivergente > 0 && (
                                        <div className="mb-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-xs">
                                          <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                                            <span className="text-red-700 dark:text-red-300">
                                              Inadimplência: {formatCurrency(parcela.valorDivergente)} ({((parcela.valorDivergente / parcela.valor) * 100).toFixed(1)}%)
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                      {parcela.comprovante || parcela.linkDocumento ? (
                                        <div className="mt-2 flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 text-xs"
                                            onClick={() => handlePreviewComprovante(parcela.comprovante || parcela.linkDocumento, parcela.cdParcela)}
                                          >
                                            <Eye className="h-3 w-3 mr-1" />
                                            Ver
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 text-xs"
                                            onClick={() => handleDownloadComprovante(parcela.comprovante || parcela.linkDocumento, parcela.numParcela, parcela.cdParcela)}
                                          >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </Button>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground mt-2">Sem comprovante</p>
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

      {/* Modal de Comprovantes */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Comprovantes</DialogTitle>
            <DialogDescription>
              {selectedUsuariaForUpload?.usuaria} - CNPJ: {selectedUsuariaForUpload?.cnpj}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUsuariaForUpload && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Código Usuária</p>
                    <p className="font-medium">{selectedUsuariaForUpload.codigoUsuaria}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tributos</p>
                    <p className="font-bold text-warning">{formatCurrency(selectedUsuariaForUpload.tributos)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor Total</p>
                    <p className="font-bold text-destructive">{formatCurrency(selectedUsuariaForUpload.valorTotal)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total de Parcelas</p>
                    <p className="font-bold">{selectedUsuariaForUpload.parcelas.length}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedUsuariaForUpload.parcelas.map((parcela) => (
                  <Card key={parcela.numParcela}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">Parcela {parcela.numParcela}</CardTitle>
                          <CardDescription>
                            Vencimento: {new Date(parcela.data).toLocaleDateString('pt-BR')}
                            {parcela.formaPagamento && (
                              <span className="ml-2">
                                • {parcela.formaPagamento === 'OPEN_FINANCE' ? 'Open Finance' : parcela.formaPagamento}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatCurrency(parcela.valor)}</div>
                          <div className="mt-2">{getParcelaStatusBadge(parcela)}</div>
                          {parcela.formaPagamento && parcela.formaPagamento === 'OPEN_FINANCE' && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              <CreditCard className="h-3 w-3 mr-1" />
                              Open Finance
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Alerta de Inadimplência */}
                      {parcela.valorDivergente && parcela.valorDivergente > 0 && (
                        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                                <h4 className="font-semibold text-red-900 dark:text-red-100">Inadimplência Detectada</h4>
                              </div>
                              <Badge variant="destructive" className="text-sm whitespace-nowrap">
                                {formatCurrency(parcela.valorDivergente)}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-red-700 dark:text-red-300">
                              Esta parcela foi paga com valor inferior ao esperado. Há uma diferença de{' '}
                              <strong>{((parcela.valorDivergente / parcela.valor) * 100).toFixed(2)}%</strong> em relação ao valor original.
                            </p>
                            
                            {/* Mini gráfico de inadimplência */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-center">
                                <div className="h-24 w-24">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={[
                                          { name: 'Valor Pago', value: parcela.valor - parcela.valorDivergente, color: '#10B981' },
                                          { name: 'Inadimplência', value: parcela.valorDivergente, color: '#EF4444' }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={22}
                                        outerRadius={40}
                                        paddingAngle={2}
                                        dataKey="value"
                                      >
                                        {[
                                          { name: 'Valor Pago', value: parcela.valor - parcela.valorDivergente, color: '#10B981' },
                                          { name: 'Inadimplência', value: parcela.valorDivergente, color: '#EF4444' }
                                        ].map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                      </Pie>
                                    </PieChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-center gap-6 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    Pago: {formatCurrency(parcela.valor - parcela.valorDivergente)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    Inadimplente: {formatCurrency(parcela.valorDivergente)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Comprovante de Pagamento</Label>
                        
                        {/* Comprovante Anexado */}
                        {parcela.comprovante || parcela.linkDocumento ? (
                          <div className="border rounded-lg p-4 bg-muted/50 mb-3">
                            <div className="flex items-center gap-3 mb-3">
                              <FileText className="h-6 w-6 text-success flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium truncate">
                                    {parcela.comprovante?.name || 'Documento enviado'}
                                  </p>
                                  {parcela.dadosExtraidos?.tipoDocumento && (
                                    <Badge variant="secondary" className="text-xs">
                                      {parcela.dadosExtraidos.tipoDocumento === 'BOLETO' ? 'Boleto' : 
                                       parcela.dadosExtraidos.tipoDocumento === 'TED' ? 'TED' : 
                                       parcela.dadosExtraidos.tipoDocumento === 'TRANSFERECIA' ? 'Transferência' : 
                                       parcela.dadosExtraidos.tipoDocumento === 'DOC' ? 'DOC' : 
                                       parcela.dadosExtraidos.tipoDocumento}
                                    </Badge>
                                  )}
                                </div>
                                {parcela.comprovante && (
                                  <p className="text-xs text-muted-foreground">{(parcela.comprovante.size / 1024).toFixed(2)} KB</p>
                                )}
                                {parcela.dadosExtraidos && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      <FileCheck className="h-3 w-3 mr-1" />
                                      Dados extraídos
                                    </Badge>
                                    {parcela.dadosExtraidos.banco && (
                                      <Badge variant="outline" className="text-xs">
                                        {parcela.dadosExtraidos.banco}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {parcela.dadosExtraidos && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDadosExtraidosModal({
                                    parcelaNumero: parcela.numParcela,
                                    dados: parcela.dadosExtraidos!,
                                    banco: parcela.dadosExtraidos.banco || 'DESCONHECIDO',
                                    arquivo: parcela.comprovante
                                  })}
                                >
                                  <FileCheck className="h-4 w-4 mr-2" />
                                  Ver Dados
                                </Button>
                              )}
                              {parcela.linkDocumento && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreviewComprovante(parcela.linkDocumento, parcela.cdParcela)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Abrir comprovante
                                </Button>
                              )}
                              {parcela.comprovante && (
                                <>
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
                                    onClick={() => handleDownloadComprovante(parcela.comprovante || parcela.linkDocumento, parcela.numParcela, parcela.cdParcela)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* Área de Upload */}
                        {!parcela.comprovante && !parcela.linkDocumento && (
                          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                            <label className={`cursor-pointer block ${isProcessingPDF ? 'opacity-50 pointer-events-none' : ''}`}>
                              {isProcessingPDF ? (
                                <>
                                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                                  <p className="text-sm font-medium">Processando PDF...</p>
                                  <p className="text-xs text-muted-foreground">Aguarde enquanto extraímos os dados</p>
                                </>
                              ) : (
                                <>
                                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                  <p className="text-sm font-medium">Clique para fazer upload</p>
                                  <p className="text-xs text-muted-foreground">ou arraste o arquivo aqui (PDF será processado automaticamente)</p>
                                </>
                              )}
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                disabled={isProcessingPDF}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleUploadFile(parcela.numParcela, file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}

                        {/* Opção de Trocar Comprovante */}
                        {(parcela.comprovante || parcela.linkDocumento) && (
                          <div className="border rounded-lg p-4 bg-muted/30">
                            <Label className="text-xs text-muted-foreground mb-2 block">Trocar comprovante</Label>
                            <label className={`cursor-pointer block ${isProcessingPDF ? 'opacity-50 pointer-events-none' : ''}`}>
                              {isProcessingPDF ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span>Processando novo arquivo...</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm">
                                  <Upload className="h-4 w-4" />
                                  <span>Clique para selecionar outro arquivo</span>
                                </div>
                              )}
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.jpg,.jpeg,.png"
                                disabled={isProcessingPDF}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleUploadFile(parcela.numParcela, file);
                                  }
                                }}
                              />
                            </label>
                          </div>
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

      {/* Modal de Dados Extraídos */}
      <Dialog open={!!dadosExtraidosModal} onOpenChange={(open) => !open && setDadosExtraidosModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados Extraídos do Comprovante</DialogTitle>
            <DialogDescription>
              Parcela {dadosExtraidosModal?.parcelaNumero} - Banco: {dadosExtraidosModal?.banco}
            </DialogDescription>
          </DialogHeader>
          
          {dadosExtraidosModal && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações do Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {dadosExtraidosModal.dados.banco && (
                      <div>
                        <p className="text-muted-foreground">Banco</p>
                        <p className="font-medium">{dadosExtraidosModal.dados.banco}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.agencia && (
                      <div>
                        <p className="text-muted-foreground">Agência</p>
                        <p className="font-medium">{dadosExtraidosModal.dados.agencia}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.conta && (
                      <div>
                        <p className="text-muted-foreground">Conta</p>
                        <p className="font-medium">{dadosExtraidosModal.dados.conta}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.numeroIdentificacao && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Número de Identificação</p>
                        <p className="font-medium font-mono text-xs">{dadosExtraidosModal.dados.numeroIdentificacao}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Beneficiário</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {dadosExtraidosModal.dados.beneficiario && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Nome</p>
                        <p className="font-medium">{dadosExtraidosModal.dados.beneficiario}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.cnpjBeneficiario && (
                      <div>
                        <p className="text-muted-foreground">CNPJ/CPF</p>
                        <p className="font-medium">{dadosExtraidosModal.dados.cnpjBeneficiario}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pagador</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    {dadosExtraidosModal.dados.pagador && (
                      <div>
                        <p className="text-muted-foreground">Nome</p>
                        <p className="font-medium">{dadosExtraidosModal.dados.pagador}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Valores e Datas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {dadosExtraidosModal.dados.dataVencimento && (
                      <div>
                        <p className="text-muted-foreground">Data de Vencimento</p>
                        <p className="font-medium">{new Date(dadosExtraidosModal.dados.dataVencimento).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.dataPagamento && (
                      <div>
                        <p className="text-muted-foreground">Data de Pagamento</p>
                        <p className="font-medium">{new Date(dadosExtraidosModal.dados.dataPagamento).toLocaleDateString('pt-BR')}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.valorDocumento !== undefined && (
                      <div>
                        <p className="text-muted-foreground">Valor do Documento</p>
                        <p className="font-bold text-lg">{formatCurrency(dadosExtraidosModal.dados.valorDocumento)}</p>
                      </div>
                    )}
                    {dadosExtraidosModal.dados.valorCobrado !== undefined && (
                      <div>
                        <p className="text-muted-foreground">Valor Cobrado</p>
                        <p className="font-bold text-lg">{formatCurrency(dadosExtraidosModal.dados.valorCobrado)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Seção do Arquivo Anexado */}
              {dadosExtraidosModal.arquivo && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documento Anexado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{dadosExtraidosModal.arquivo.name}</p>
                          <p className="text-xs text-muted-foreground">{(dadosExtraidosModal.arquivo.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreviewComprovante(dadosExtraidosModal.arquivo!)}
                        >
                          <FileCheck className="h-4 w-4 mr-2" />
                          Visualizar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadComprovante(dadosExtraidosModal.arquivo!, dadosExtraidosModal.parcelaNumero)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Remover arquivo do modal e do estado
                            handleRemoverComprovante(dadosExtraidosModal.parcelaNumero);
                            setDadosExtraidosModal(prev => prev ? { ...prev, arquivo: undefined } : null);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Próximo passo:</strong> Revise os dados extraídos e envie para a API do backend quando estiver pronto.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDadosExtraidosModal(null)}>
              Fechar
            </Button>
            <Button onClick={() => {
              // Aqui você pode adicionar a lógica para enviar os dados para a API do backend Java
              toast({
                title: 'Dados prontos para envio',
                description: 'Os dados foram extraídos e estão prontos para serem enviados à API'
              });
              setDadosExtraidosModal(null);
            }}>
              Confirmar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para processar arquivo CNAB */}
      <Dialog open={isCNABDialogOpen} onOpenChange={setIsCNABDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Processar Arquivo CNAB</DialogTitle>
            <DialogDescription>
              Faça upload do arquivo CNAB retornado pelo banco para processar os pagamentos em lote
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cnab-file">Arquivo CNAB (.txt)</Label>
              <Input
                id="cnab-file"
                type="file"
                accept=".txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCnabFile(file);
                    setProgressoProcessamento(null);
                  }
                }}
                disabled={isProcessingCNAB}
              />
              {cnabFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Arquivo selecionado: {cnabFile.name}
                </p>
              )}
            </div>

            {/* Seção de Progresso */}
            {progressoProcessamento && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base font-semibold">Progresso do Processamento</Label>
                    <span className="text-sm text-muted-foreground">
                      {progressoProcessamento.processadas} / {progressoProcessamento.total}
                    </span>
                  </div>
                  <Progress 
                    value={(progressoProcessamento.processadas / progressoProcessamento.total) * 100} 
                    className="h-2"
                  />
                </div>

                {/* Lista de Faturas e Parcelas */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {progressoProcessamento.itens.map((item, index) => (
                    <div
                      key={`${item.cdParcela}-${index}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        item.status === 'processada' && "bg-green-50 border-green-200",
                        item.status === 'processando' && "bg-blue-50 border-blue-200",
                        item.status === 'erro' && "bg-red-50 border-red-200"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {item.status === 'processando' && (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600 flex-shrink-0" />
                        )}
                        {item.status === 'processada' && (
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        {item.status === 'erro' && (
                          <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.fatura}</p>
                          <p className="text-xs text-muted-foreground">
                            Parcela #{item.parcela}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {item.status === 'processando' && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            Processando...
                          </Badge>
                        )}
                        {item.status === 'processada' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700">
                            Processada
                          </Badge>
                        )}
                        {item.status === 'erro' && (
                          <Badge variant="destructive">
                            Erro
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCNABDialogOpen(false);
                setCnabFile(null);
                setProgressoProcessamento(null);
              }}
              disabled={isProcessingCNAB}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessarCNAB}
              disabled={!cnabFile || isProcessingCNAB}
            >
              {isProcessingCNAB ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Processar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para pagamento via Open Finance */}
      <Dialog open={isOpenFinanceDialogOpen} onOpenChange={setIsOpenFinanceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagar Parcelas via Open Finance</DialogTitle>
            <DialogDescription>
              Selecione as parcelas que deseja pagar via Open Finance. O pagamento será processado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto border rounded-lg p-4">
              <div className="space-y-2">
                {filteredUsuarias.map((usuaria) => (
                  <div key={usuaria.id} className="space-y-2">
                    <div className="font-semibold text-sm">{usuaria.usuaria}</div>
                    {usuaria.parcelas
                      .filter(p => p.cdParcela && !p.comprovante && !p.linkDocumento)
                      .map((parcela) => {
                        const isSelected = selectedParcelasForOpenFinance.has(parcela.cdParcela!);
                        const pagamento = pagamentosOpenFinance.get(parcela.cdParcela!);
                        return (
                          <div
                            key={parcela.numParcela}
                            className={`flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted/50 ${
                              isSelected ? 'bg-primary/10 border-primary' : ''
                            }`}
                            onClick={() => {
                              if (pagamento?.status === 'PENDENTE_BANCO' || pagamento?.status === 'CONFIRMADO') return;
                              setSelectedParcelasForOpenFinance(prev => {
                                const newSet = new Set(prev);
                                if (isSelected) {
                                  newSet.delete(parcela.cdParcela!);
                                } else {
                                  newSet.add(parcela.cdParcela!);
                                }
                                return newSet;
                              });
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                disabled={pagamento?.status === 'PENDENTE_BANCO' || pagamento?.status === 'CONFIRMADO'}
                                className="cursor-pointer"
                              />
                              <span className="text-sm">
                                Parcela {parcela.numParcela} - {formatCurrency(parcela.valor)} - Venc: {new Date(parcela.data).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            <div>
                              {pagamento?.status === 'PENDENTE_BANCO' && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Processando...
                                </Badge>
                              )}
                              {pagamento?.status === 'CONFIRMADO' && (
                                <Badge variant="default" className="bg-success text-success-foreground">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Confirmado
                                </Badge>
                              )}
                              {pagamento?.status === 'FALHOU' && (
                                <Badge variant="destructive">
                                  Falhou
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}
                {filteredUsuarias.every(u => u.parcelas.every(p => !p.cdParcela || p.comprovante || p.linkDocumento)) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma parcela disponível para pagamento via Open Finance
                  </p>
                )}
              </div>
            </div>
            {selectedParcelasForOpenFinance.size > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedParcelasForOpenFinance.size} parcela(s) selecionada(s)
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpenFinanceDialogOpen(false);
                setSelectedParcelasForOpenFinance(new Set());
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (selectedParcelasForOpenFinance.size === 0) {
                  toast({
                    title: 'Nenhuma parcela selecionada',
                    description: 'Por favor, selecione pelo menos uma parcela para pagar',
                    variant: 'destructive'
                  });
                  return;
                }

                // Processar cada parcela selecionada
                for (const cdParcela of selectedParcelasForOpenFinance) {
                  const usuaria = filteredUsuarias.find(u => 
                    u.parcelas.some(p => p.cdParcela === cdParcela)
                  );
                  const parcela = usuaria?.parcelas.find(p => p.cdParcela === cdParcela);
                  if (parcela) {
                    await handlePagarViaOpenFinance(cdParcela, parcela.valor);
                    // Pequeno delay entre pagamentos
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }
                }

                toast({
                  title: 'Pagamentos iniciados',
                  description: `${selectedParcelasForOpenFinance.size} pagamento(s) iniciado(s) via Open Finance`
                });

                setSelectedParcelasForOpenFinance(new Set());
                setIsOpenFinanceDialogOpen(false);
              }}
              disabled={selectedParcelasForOpenFinance.size === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar {selectedParcelasForOpenFinance.size} Parcela(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvisoDebito;

