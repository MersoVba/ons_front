import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Percent, Calculator, FileText, Download, Loader2, CheckCircle, Clock, X, FileCheck, FileSpreadsheet, AlertTriangle, CreditCard, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AvdAPI, FaturaResponse } from '@/lib/avd-api';
import { AuthAPI } from '@/lib/auth-api';
import { API_BASE_URL } from '@/lib/api-config';
import { DashboardAPI, DashboardAvdResponse } from '@/lib/dashboard-api';
import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { OpenFinanceAPI, IniciarPagamentoParcelaResponse, IniciarPagamentoFaturasResponse } from '@/lib/open-finance-api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface EmpresaRateio {
  id: string;
  nome: string;
  cnpj: string;
  codigo: string;
  tributos: number;
  valorTotal: number;
  statusFatura?: string;
  percentual: number;
  valorRateado: number;
  valorDivergente: number; // Valor divergente (inadimplência) da fatura
  faturaIds: number[]; // IDs das faturas originais para pagamento
}

const Rateio = () => {
  const [loading, setLoading] = useState(true);
  const [valorEmEspecie, setValorEmEspecie] = useState<number>(0); // Valor em espécie que o usuário tem para pagar (editável)
  const [dashboardData, setDashboardData] = useState<DashboardAvdResponse | null>(null); // Dados do dashboard AVD
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [percentuais, setPercentuais] = useState<{ [key: string]: number }>({});
  const [empresas, setEmpresas] = useState<EmpresaRateio[]>([]);
  const [isOpenFinanceDialogOpen, setIsOpenFinanceDialogOpen] = useState(false);
  const [empresasSelecionadasOpenFinance, setEmpresasSelecionadasOpenFinance] = useState<Set<string>>(new Set());
  const [isCNABDialogOpen, setIsCNABDialogOpen] = useState(false);
  const [empresasSelecionadasCNAB, setEmpresasSelecionadasCNAB] = useState<Set<string>>(new Set());
  const [isProcessarRetornoDialogOpen, setIsProcessarRetornoDialogOpen] = useState(false);
  const [cnabRetornoFile, setCnabRetornoFile] = useState<File | null>(null);
  const [isProcessingCNABRetorno, setIsProcessingCNABRetorno] = useState(false);
  const [progressoProcessamento, setProgressoProcessamento] = useState<{
    total: number;
    processadas: number;
    itens: Array<{ fatura: string; parcela: number; cdParcela: number; status: 'processando' | 'processada' | 'erro' }>;
  } | null>(null);
  const [pagamentosOpenFinance, setPagamentosOpenFinance] = useState<Map<string, {
    status: string;
    externalPaymentId: string;
    pagamentoId: number;
  }>>(new Map());

  // Estados de paginação
  const [pagina, setPagina] = useState(0);
  const [quantidade, setQuantidade] = useState(1000);
  const [ordem, setOrdem] = useState<'ASC' | 'DESC'>('ASC');
  const [ordenarPor, setOrdenarPor] = useState('transmissora');
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalItens, setTotalItens] = useState(0);

  // Carregar dados do dashboard AVD
  useEffect(() => {
    const carregarDashboard = async () => {
      setLoadingDashboard(true);
      try {
        const data = await DashboardAPI.obterMetricasAvd();
        setDashboardData(data);
        // valorTotalDebito agora é calculado da soma dos valorDivergente das empresas
      } catch (error: any) {
        console.error('Erro ao carregar dados do dashboard:', error);
        // Em caso de erro, manter o valor calculado das faturas
      } finally {
        setLoadingDashboard(false);
      }
    };
    
    carregarDashboard();
  }, []);

  // Carregar dados de AVD
  useEffect(() => {
    const carregarDadosAVD = async () => {
      setLoading(true);
      try {
        const faturas: FaturaResponse[] = await AvdAPI.obterTodasFaturas(pagina, quantidade, ordem, ordenarPor);
        
        // Agrupar faturas por usuária (CNPJ)
        const empresasMap = new Map<string, EmpresaRateio>();
        
        faturas.forEach((fatura: FaturaResponse) => {
          if (!fatura.cnpjUsuaria || !fatura.usuaria || !fatura.cdFatura) return;
          
          // Filtrar faturas: apenas NULL, PARCIAL, PENDENTE
          const statusFaturaNormalizado = (fatura.statusFatura?.toUpperCase().trim() || 'NULL');
          const statusFaturaValido = statusFaturaNormalizado === 'NULL' || 
                                     statusFaturaNormalizado === 'PARCIAL' || 
                                     statusFaturaNormalizado === 'PENDENTE';
          
          if (!statusFaturaValido) {
            return; // Pular faturas que não estão nos status permitidos
          }
          
          // Filtrar parcelas: apenas PENDENTE, PARCIAL, RATEIO
          const parcelasPendentes = fatura.parcelas?.filter(parcela => {
            const statusParcela = (parcela.status?.toUpperCase().trim() || 'PENDENTE');
            return statusParcela === 'PENDENTE' || 
                   statusParcela === 'PARCIAL' || 
                   statusParcela === 'RATEIO';
          }) || [];
          
          // Se não houver parcelas pendentes, pular a fatura
          if (parcelasPendentes.length === 0) {
            return;
          }
          
          // Recalcular valorTotal baseado apenas nas parcelas pendentes
          const valorTotalPendente = parcelasPendentes.reduce((sum, p) => sum + (p.valor ? Number(p.valor) : 0), 0);
          
          const empresaKey = fatura.cnpjUsuaria;
          
          if (!empresasMap.has(empresaKey)) {
            // Verificar se cdFatura existe e é válido
            if (!fatura.cdFatura || fatura.cdFatura <= 0) {
              console.warn('⚠️ Fatura sem cdFatura válido:', fatura);
              return; // Pular faturas sem ID válido
            }
            
            empresasMap.set(empresaKey, {
              id: fatura.cdFatura.toString() || empresaKey,
              nome: fatura.usuaria || '',
              cnpj: fatura.cnpjUsuaria || '',
              codigo: fatura.codigoUsuaria || '',
              tributos: fatura.tributos ? Number(fatura.tributos) : 0,
              valorTotal: valorTotalPendente, // Usar valor das parcelas pendentes
              statusFatura: fatura.statusFatura || undefined,
              percentual: 0,
              valorRateado: 0,
              valorDivergente: fatura.valorDivergente != null ? Number(fatura.valorDivergente) : 0, // Valor divergente da fatura
              faturaIds: [fatura.cdFatura] // Armazenar ID da fatura
            });
          } else {
            // Somar valores se a empresa já existir
            const empresaExistente = empresasMap.get(empresaKey)!;
            empresaExistente.valorTotal += valorTotalPendente; // Usar valor das parcelas pendentes
            empresaExistente.tributos += fatura.tributos ? Number(fatura.tributos) : 0;
            empresaExistente.valorDivergente += fatura.valorDivergente != null ? Number(fatura.valorDivergente) : 0; // Somar valor divergente
            // Adicionar ID da fatura ao array (apenas se for válido)
            if (fatura.cdFatura && fatura.cdFatura > 0 && !empresaExistente.faturaIds.includes(fatura.cdFatura)) {
              empresaExistente.faturaIds.push(fatura.cdFatura);
            }
            // Atualizar status (já filtrado para status válidos)
            if (fatura.statusFatura) {
              empresaExistente.statusFatura = fatura.statusFatura;
            }
          }
        });
        
        const empresasArray = Array.from(empresasMap.values());
        setEmpresas(empresasArray);
        
        // Atualizar total de itens (se a API retornar informações de paginação, usar; senão, usar quantidade retornada)
        // Por enquanto, vamos usar a quantidade de faturas retornadas como estimativa
        setTotalItens(faturas.length);
        
        // Não sobrescrever valorTotalDebito - ele já foi carregado do dashboard
        // O valorTotalDebito deve vir sempre do dashboard (totalPagar)
        // Valor em espécie permanece 0 por padrão (usuário deve informar)
        
        // Calcular valor total em débito = soma de todos os valorDivergente
        const totalDebitoInadimplente = empresasArray.reduce((sum, emp) => {
          const valorDivergente = emp.valorDivergente ?? 0;
          return sum + Math.abs(valorDivergente);
        }, 0);
        
        // Calcular percentuais iniciais baseados no valorDivergente de cada empresa
        const percentuaisIniciais: { [key: string]: number } = {};
        empresasArray.forEach(emp => {
          const valorDivergenteEmp = Math.abs(emp.valorDivergente ?? 0);
          if (totalDebitoInadimplente > 0) {
            percentuaisIniciais[emp.id] = (valorDivergenteEmp / totalDebitoInadimplente) * 100;
          }
        });
        setPercentuais(percentuaisIniciais);
        
      } catch (error: any) {
        console.error('Erro ao carregar dados de AVD:', error);
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Não foi possível carregar os dados de AVD',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    carregarDadosAVD();
  }, [pagina, quantidade, ordem, ordenarPor]);

  // Calcular total de páginas (assumindo que a API retorna informações de paginação)
  // Se a API não retornar, vamos calcular baseado na quantidade de itens
  useEffect(() => {
    if (totalItens > 0) {
      setTotalPaginas(Math.ceil(totalItens / quantidade));
    }
  }, [totalItens, quantidade]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar valor como moeda BRL
  const formatCurrencyInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Handler para mudança no input de valor em espécie com máscara
  const handleValorEmEspecieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove tudo exceto números
    const numbersOnly = inputValue.replace(/\D/g, '');
    
    if (numbersOnly === '') {
      setValorEmEspecie(0);
      return;
    }
    
    // Converte para número (centavos) e depois divide por 100
    const valueInCents = parseInt(numbersOnly, 10);
    const value = valueInCents / 100;
    setValorEmEspecie(value);
  };
  
  // Atualizar valores rateados quando valorEmEspecie ou percentuais mudarem
  useEffect(() => {
    setEmpresas(prevEmpresas => prevEmpresas.map(emp => ({
      ...emp,
      percentual: percentuais[emp.id] || 0,
      valorRateado: (valorEmEspecie * (percentuais[emp.id] || 0)) / 100
    })));
  }, [valorEmEspecie]);

  const calcularRateio = () => {
    const totalPercentual = Object.values(percentuais).reduce((sum, val) => sum + val, 0);
    
    if (Math.abs(totalPercentual - 100) > 0.01) {
      toast({
        title: 'Erro na validação',
        description: `A soma dos percentuais deve ser igual a 100%. Atual: ${totalPercentual.toFixed(2)}%`,
        variant: 'destructive'
      });
      return;
    }

    // Calcular valores rateados usando o valor em espécie (não o valor do débito)
    const empresasAtualizadas = empresas.map(emp => ({
      ...emp,
      percentual: percentuais[emp.id] || 0,
      valorRateado: (valorEmEspecie * (percentuais[emp.id] || 0)) / 100
    }));

    setEmpresas(empresasAtualizadas);
    
    toast({
      title: 'Rateio calculado',
      description: 'Os valores foram distribuídos com sucesso'
    });
  };

  // Total calculado baseado no valor em espécie
  const totalCalculado = empresas.reduce((sum, emp) => {
    const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
    return sum + (valorEmEspecie * percentualAtual / 100);
  }, 0);
  const totalPercentual = empresas.reduce((sum, emp) => sum + (percentuais[emp.id] || emp.percentual || 0), 0);

  // Calcular valor total em débito = soma de todos os valorDivergente das empresas
  const valorTotalDebito = useMemo(() => {
    return empresas.reduce((sum, emp) => {
      const valorDivergente = emp.valorDivergente ?? 0;
      return sum + Math.abs(valorDivergente); // Soma valores absolutos (sempre positivo)
    }, 0);
  }, [empresas]);

  // Calcular inadimplência total baseado no valor disponível para rateio
  // Inadimplência = valorTotalDebito - valorEmEspecie (sempre negativo)
  const totalInadimplente = useMemo(() => {
    // Se não há valor disponível ou débito, não há inadimplência
    if (valorTotalDebito === 0 || valorEmEspecie === 0) {
      return -valorTotalDebito; // Tudo é inadimplente se não há valor disponível
    }
    // Inadimplência = o que falta pagar (valorTotalDebito - valorEmEspecie)
    const valorFaltaPagar = Math.max(0, valorTotalDebito - valorEmEspecie);
    return -valorFaltaPagar; // Sempre negativo
  }, [valorTotalDebito, valorEmEspecie]);

  // Calcular percentual de inadimplência usando valorTotalDebito (soma dos valorDivergente)
  const percentualInadimplencia = valorTotalDebito > 0 
    ? (Math.abs(totalInadimplente) / valorTotalDebito) * 100 
    : 0;

  // Dados para o gráfico de inadimplência (usando valorTotalDebito = soma dos valorDivergente)
  const chartData = useMemo(() => {
    // Sempre retornar dados, mesmo que sejam zeros
    // Usar valor absoluto para o gráfico (inadimplência sempre positiva no gráfico)
    const valorInadimplenteAbsoluto = Math.abs(totalInadimplente);
    // Valor Coberto = valor que o usuário tem disponível para rateio
    const valorCoberto = valorEmEspecie;
    
    return [
      {
        name: 'Valor Coberto',
        value: valorCoberto,
        color: '#10B981' // verde
      },
      {
        name: 'Inadimplência',
        value: valorInadimplenteAbsoluto,
        color: '#EF4444' // vermelho
      }
    ];
  }, [valorTotalDebito, totalInadimplente, valorEmEspecie]);

  const chartConfig = {
    'Valor Coberto': {
      label: 'Valor Coberto',
      color: '#10B981'
    },
    'Inadimplência': {
      label: 'Inadimplência',
      color: '#EF4444'
    }
  };
  
  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    
    const statusNormalizado = status.toUpperCase().trim();
    if (statusNormalizado === 'LIQUIDADA' || statusNormalizado === 'LIQUIDADO') {
      return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Liquidada</Badge>;
    }
    if (statusNormalizado === 'PENDENTE' || statusNormalizado === 'PENDENTES') {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
    if (statusNormalizado === 'EM_ANALISE' || statusNormalizado.includes('ANALISE')) {
      return <Badge variant="secondary" className="bg-yellow-500 text-yellow-foreground"><Clock className="h-3 w-3 mr-1" />Em análise</Badge>;
    }
    if (statusNormalizado === 'REJEITADA' || statusNormalizado === 'REJEITADO') {
      return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitada</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  // Exportar para PDF
  const handleExportarPDF = () => {
    // TODO: Implementar exportação para PDF usando biblioteca como jsPDF ou react-pdf
    toast({
      title: 'Exportação PDF',
      description: 'Funcionalidade de exportação PDF em desenvolvimento'
    });
  };

  // Exportar para XLS
  const handleExportarXLS = () => {
    // Criar conteúdo XLS usando ponto e vírgula (padrão Excel brasileiro)
    let conteudo = 'Usuária;CNPJ;Código;Valor Total;Percentual (%);Valor Rateado;Valor Inadimplente\n';
    
    empresas.forEach(emp => {
      const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
      const valorRateado = (valorEmEspecie * percentualAtual) / 100;
      // Valor inadimplente vem da API (valorDivergente) - sempre negativo
      const valorDivergenteBruto = emp.valorDivergente || 0;
      const valorInadimplente = valorDivergenteBruto > 0 ? -Math.abs(valorDivergenteBruto) : valorDivergenteBruto;
      
      // Usar ponto para decimais e ponto e vírgula como separador
      const nome = emp.nome.replace(/;/g, ' '); // Remover ponto e vírgula do nome se houver
      conteudo += `${nome};${emp.cnpj};${emp.codigo};${emp.valorTotal.toFixed(2).replace('.', ',')};${percentualAtual.toFixed(2).replace('.', ',')};${valorRateado.toFixed(2).replace('.', ',')};${valorInadimplente.toFixed(2).replace('.', ',')}\n`;
    });

    // Adicionar resumo
    const saldo = valorEmEspecie - valorTotalDebito;
    conteudo += `\nResumo:\n`;
    conteudo += `Valor Total do Débito;${valorTotalDebito.toFixed(2).replace('.', ',')}\n`;
    conteudo += `Valor em Espécie;${valorEmEspecie.toFixed(2).replace('.', ',')}\n`;
    conteudo += `Saldo;${saldo.toFixed(2).replace('.', ',')}\n`;
    conteudo += `Total Rateado;${totalCalculado.toFixed(2).replace('.', ',')}\n`;

    // Criar blob e fazer download
    const blob = new Blob(['\ufeff' + conteudo], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rateio_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação XLS',
      description: 'Arquivo XLS gerado com sucesso'
    });
  };

  // Exportar para CSV
  const handleExportarCSV = () => {
    // Criar conteúdo CSV usando ponto e vírgula (padrão brasileiro)
    let conteudo = 'Usuária;CNPJ;Código;Valor Total;Percentual (%);Valor Rateado;Valor Inadimplente\n';
    
    empresas.forEach(emp => {
      const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
      const valorRateado = (valorEmEspecie * percentualAtual) / 100;
      // Valor inadimplente vem da API (valorDivergente) - sempre negativo
      const valorDivergenteBruto = emp.valorDivergente || 0;
      const valorInadimplente = valorDivergenteBruto > 0 ? -Math.abs(valorDivergenteBruto) : valorDivergenteBruto;
      
      // Usar ponto e vírgula como separador e vírgula para decimais (padrão brasileiro)
      const nome = emp.nome.replace(/;/g, ' ').replace(/"/g, '""'); // Escapar aspas e remover ponto e vírgula
      conteudo += `"${nome}";"${emp.cnpj}";"${emp.codigo}";${emp.valorTotal.toFixed(2).replace('.', ',')};${percentualAtual.toFixed(2).replace('.', ',')};${valorRateado.toFixed(2).replace('.', ',')};${valorInadimplente.toFixed(2).replace('.', ',')}\n`;
    });

    // Adicionar resumo
    const saldo = valorEmEspecie - valorTotalDebito;
    conteudo += `\nResumo:\n`;
    conteudo += `"Valor Total do Débito";${valorTotalDebito.toFixed(2).replace('.', ',')}\n`;
    conteudo += `"Valor em Espécie";${valorEmEspecie.toFixed(2).replace('.', ',')}\n`;
    conteudo += `"Saldo";${saldo.toFixed(2).replace('.', ',')}\n`;
    conteudo += `"Total Rateado";${totalCalculado.toFixed(2).replace('.', ',')}\n`;

    // Criar blob e fazer download
    const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rateio_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação CSV',
      description: 'Arquivo CSV gerado com sucesso'
    });
  };

  // Toggle seleção de empresa no Open Finance
  const toggleEmpresaSelecionada = (empresaId: string) => {
    setEmpresasSelecionadasOpenFinance(prev => {
      const newSet = new Set(prev);
      if (newSet.has(empresaId)) {
        newSet.delete(empresaId);
      } else {
        newSet.add(empresaId);
      }
      return newSet;
    });
  };

  // Selecionar todas as empresas
  const selecionarTodasEmpresas = () => {
    const todasIds = empresas
      .filter(emp => {
        const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
        const valorRateado = (valorEmEspecie * percentualAtual) / 100;
        return valorRateado > 0;
      })
      .map(emp => emp.id);
    setEmpresasSelecionadasOpenFinance(new Set(todasIds));
  };

  // Desselecionar todas as empresas
  const desselecionarTodasEmpresas = () => {
    setEmpresasSelecionadasOpenFinance(new Set());
  };

  // Pagar rateio via Open Finance com split
  const handlePagarRateioViaOpenFinance = async () => {
    try {
      if (empresasSelecionadasOpenFinance.size === 0) {
        toast({
          title: 'Nenhuma fatura selecionada',
          description: 'Por favor, selecione pelo menos uma empresa para liquidar',
          variant: 'destructive'
        });
        return;
      }

      if (valorEmEspecie <= 0) {
        toast({
          title: 'Valor inválido',
          description: 'É necessário ter um valor em espécie válido para realizar o pagamento',
          variant: 'destructive'
        });
        return;
      }

      setLoading(true);

      // Coletar IDs de todas as faturas das empresas selecionadas e seus valores rateados
      const faturaIdsSet = new Set<number>();
      const faturasComValorMap = new Map<number, number>(); // faturaId -> valorDocumento
      
      for (const empresa of empresas) {
        // Processar apenas empresas selecionadas
        if (!empresasSelecionadasOpenFinance.has(empresa.id)) {
          continue;
        }

        const percentualAtual = percentuais[empresa.id] || empresa.percentual || 0;
        const valorRateado = (valorEmEspecie * percentualAtual) / 100;

        if (valorRateado > 0 && empresa.faturaIds && empresa.faturaIds.length > 0) {
          // Dividir o valor rateado igualmente entre as faturas da empresa
          const valorPorFatura = valorRateado / empresa.faturaIds.length;
          
          // Para cada fatura da empresa, adicionar o ID e o valor rateado
          empresa.faturaIds.forEach(faturaId => {
            // Adicionar ID da fatura ao set (evita duplicatas)
            faturaIdsSet.add(faturaId);
            
            // Se a fatura já existe no mapa, somar o valor (caso a mesma fatura apareça em múltiplas empresas)
            const valorAtual = faturasComValorMap.get(faturaId) || 0;
            faturasComValorMap.set(faturaId, valorAtual + valorPorFatura);
          });
        }
      }

      // Converter para arrays
      const faturaIds = Array.from(faturaIdsSet);
      const faturasComValor = Array.from(faturasComValorMap.entries()).map(([faturaId, valorDocumento]) => ({
        faturaId,
        valorDocumento
      }));

      if (faturaIds.length === 0 || faturasComValor.length === 0) {
        toast({
          title: 'Nenhuma fatura encontrada',
          description: 'Não foi possível encontrar IDs de faturas para as empresas selecionadas',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      console.log('💳 Enviando pagamento de faturas via Open Finance:', {
        faturaIds: faturaIds,
        faturasComValor: faturasComValor,
        quantidade: faturaIds.length
      });

      // Chamar API para pagar faturas via Open Finance
      // Endpoint: POST /api/openfinance/faturas/pagar
      // Body: { 
      //   "faturaIds": [0, 1, 2, ...],
      //   "faturasComValor": [
      //     { "faturaId": 0, "valorDocumento": 100.50 },
      //     { "faturaId": 1, "valorDocumento": 200.75 }
      //   ]
      // }
      const response: IniciarPagamentoFaturasResponse = await OpenFinanceAPI.pagarFaturas({
        faturaIds: faturaIds,
        faturasComValor: faturasComValor
      });

      console.log('✅ Resposta do pagamento:', response);

      // Salvar informações do pagamento
      setPagamentosOpenFinance(prev => {
        const newMap = new Map(prev);
        // Marcar todas as empresas selecionadas como processadas
        empresasSelecionadasOpenFinance.forEach(empresaId => {
          newMap.set(empresaId, {
            status: response.status,
            externalPaymentId: response.externalPaymentId,
            pagamentoId: response.pagamentoId
          });
        });
        return newMap;
      });

      toast({
        title: 'Pagamento iniciado',
        description: `${response.faturasProcessadas || faturaIds.length} fatura(s) sendo liquidada(s) via Open Finance`,
        variant: 'default'
      });

      // Fechar dialog após sucesso
      setIsOpenFinanceDialogOpen(false);
      setEmpresasSelecionadasOpenFinance(new Set());

      // Se houver pagamento pendente, iniciar polling
      if (response.status === 'PENDENTE_BANCO' || response.status === 'CRIADO') {
        // Iniciar verificação de status (polling)
        const intervalId = setInterval(async () => {
          try {
            const status = await OpenFinanceAPI.verificarStatusPagamento(response.pagamentoId);
            if (status && (status.status === 'CONFIRMADO' || status.status === 'FALHOU')) {
              // Atualizar status de todas as empresas selecionadas
              setPagamentosOpenFinance(prev => {
                const newMap = new Map(prev);
                empresasSelecionadasOpenFinance.forEach(empresaId => {
                  const pagamento = newMap.get(empresaId);
                  if (pagamento && pagamento.pagamentoId === response.pagamentoId) {
                    newMap.set(empresaId, { 
                      status: status.status, 
                      externalPaymentId: pagamento.externalPaymentId,
                      pagamentoId: pagamento.pagamentoId 
                    });
                  }
                });
                return newMap;
              });
              
              // Limpar intervalo quando confirmado ou falhou
              clearInterval(intervalId);
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error);
          }
        }, 3000); // Verificar a cada 3 segundos

        // Limpar intervalo após 60 segundos
        setTimeout(() => clearInterval(intervalId), 60000);
      }

    } catch (error: any) {
      console.error('Erro ao pagar via Open Finance:', error);
      toast({
        title: 'Erro ao processar pagamento',
        description: error.message || 'Erro desconhecido ao processar pagamento via Open Finance',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle seleção de empresa no CNAB
  const toggleEmpresaSelecionadaCNAB = (empresaId: string) => {
    setEmpresasSelecionadasCNAB(prev => {
      const newSet = new Set(prev);
      if (newSet.has(empresaId)) {
        newSet.delete(empresaId);
      } else {
        newSet.add(empresaId);
      }
      return newSet;
    });
  };

  // Selecionar todas as empresas para CNAB
  const selecionarTodasEmpresasCNAB = () => {
    const todasIds = empresas
      .filter(emp => {
        const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
        const valorRateado = (valorEmEspecie * percentualAtual) / 100;
        return valorRateado > 0;
      })
      .map(emp => emp.id);
    setEmpresasSelecionadasCNAB(new Set(todasIds));
  };

  // Desselecionar todas as empresas para CNAB
  const desselecionarTodasEmpresasCNAB = () => {
    setEmpresasSelecionadasCNAB(new Set());
  };

  // Processar arquivo CNAB retornado do banco
  const handleProcessarCNABRetorno = async () => {
    if (!cnabRetornoFile) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Por favor, selecione um arquivo CNAB de retorno para processar',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessingCNABRetorno(true);
    setProgressoProcessamento(null);
    
    try {
      // Primeiro, ler o arquivo para identificar as faturas que serão processadas
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.onerror = reject;
        reader.readAsText(cnabRetornoFile);
      });

      // Processar linhas do arquivo CNAB para identificar faturas
      const linhas = fileContent.split(/\r?\n/).filter(linha => linha.trim().length > 0);
      const faturasIdentificadas: Array<{ cdFatura: number; empresa: string }> = [];

      // Processar linha por linha para identificar faturas
      for (let index = 0; index < linhas.length; index++) {
        const linha = linhas[index];
        
        if (linha.length >= 1 && linha[0] === '3') {
          if (linha.length >= 150 && linha.length >= 11 && linha[10] === 'A') {
            try {
              const nossoNumero = linha.substring(129, 149).trim();
              const codigoOcorrencia = linha.length >= 232 ? linha.substring(229, 231).trim() : '';
              
              if (nossoNumero && nossoNumero !== '00000000000000000000' && nossoNumero !== '') {
                const cdFatura = parseInt(nossoNumero);
                if (!isNaN(cdFatura) && cdFatura > 0) {
                  const codigoOk = !codigoOcorrencia || codigoOcorrencia === '' || ['00', '01', '02', '06'].includes(codigoOcorrencia);
                  
                  if (codigoOk) {
                    // Encontrar a empresa correspondente
                    const empresaEncontrada = empresas.find(emp => 
                      emp.faturaIds && emp.faturaIds.includes(cdFatura)
                    );
                    const nomeEmpresa = empresaEncontrada ? empresaEncontrada.nome : `Fatura ${cdFatura}`;
                    
                    faturasIdentificadas.push({
                      cdFatura,
                      empresa: nomeEmpresa
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
      const totalFaturas = faturasIdentificadas.length;
      const itensProgresso = faturasIdentificadas.map(item => ({
        fatura: item.empresa,
        parcela: item.cdFatura,
        cdParcela: item.cdFatura,
        status: 'processando' as const
      }));

      setProgressoProcessamento({
        total: totalFaturas,
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
        reader.readAsDataURL(cnabRetornoFile);
      });

      // Chamar API para processar remessa de pagamento
      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');

      const urlCompleta = `${API_BASE_URL}/remessa/remessaPagamento`;
      console.log('🔗 Processando remessa de retorno:', urlCompleta);

      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arquivoBase64: arquivoBase64,
          nomeArquivo: cnabRetornoFile.name
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
        try {
          data = await response.json();
          mensagemSucesso = data.mensagem || data.message || '';
        } catch (jsonError) {
          const textResponse = await response.text();
          mensagemSucesso = textResponse || 'Arquivo processado com sucesso';
        }
      } else {
        const textResponse = await response.text();
        mensagemSucesso = textResponse || 'Arquivo processado com sucesso';
      }

      console.log('✅ Resposta da API:', data);

      // Processar resposta da API e atualizar status das faturas
      if (data) {
        const statusFatura = data.statusFatura;
        const faturasProcessadas = data.faturasProcessadas || data.faturas || (Array.isArray(data) ? data : []);
        
        setEmpresas(prev => {
          return prev.map(emp => {
            // Verificar se alguma fatura desta empresa foi processada
            const faturasEmpresaProcessadas = faturasProcessadas.filter((f: any) => 
              emp.faturaIds && emp.faturaIds.includes(f.cdFatura || f.id || f.cdParcela)
            );
            
            if (faturasEmpresaProcessadas.length > 0 || (statusFatura && emp.faturaIds && emp.faturaIds.some(id => 
              faturasIdentificadas.some(f => f.cdFatura === id)
            ))) {
              const novoStatus = statusFatura || faturasEmpresaProcessadas[0]?.statusFatura || faturasEmpresaProcessadas[0]?.status || 'LIQUIDADO';
              console.log(`🔄 Atualizando empresa ${emp.nome} com status:`, novoStatus);
              return {
                ...emp,
                statusFatura: novoStatus
              };
            }
            
            return emp;
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

      toast({
        title: 'Remessa processada',
        description: mensagemSucesso || `Arquivo processado com sucesso. ${totalFaturas} fatura(s) atualizada(s).`
      });

      // Fechar dialog e limpar arquivo
      setIsProcessarRetornoDialogOpen(false);
      setCnabRetornoFile(null);
      setProgressoProcessamento(null);

      // Recarregar dados para atualizar status
      const faturas: FaturaResponse[] = await AvdAPI.obterTodasFaturas(0, 1000, 'ASC', 'transmissora');
      // Atualizar empresas com novos dados
      const empresasMap = new Map<string, EmpresaRateio>();
      
      faturas.forEach((fatura: FaturaResponse) => {
        if (!fatura.cnpjUsuaria || !fatura.usuaria || !fatura.cdFatura) return;
        
        // Filtrar faturas: apenas NULL, PARCIAL, PENDENTE
        const statusFaturaNormalizado = (fatura.statusFatura?.toUpperCase().trim() || 'NULL');
        const statusFaturaValido = statusFaturaNormalizado === 'NULL' || 
                                   statusFaturaNormalizado === 'PARCIAL' || 
                                   statusFaturaNormalizado === 'PENDENTE';
        
        if (!statusFaturaValido) {
          return; // Pular faturas que não estão nos status permitidos
        }
        
        // Filtrar parcelas: apenas PENDENTE, PARCIAL, RATEIO
        const parcelasPendentes = fatura.parcelas?.filter(parcela => {
          const statusParcela = (parcela.status?.toUpperCase().trim() || 'PENDENTE');
          return statusParcela === 'PENDENTE' || 
                 statusParcela === 'PARCIAL' || 
                 statusParcela === 'RATEIO';
        }) || [];
        
        // Se não houver parcelas pendentes, pular a fatura
        if (parcelasPendentes.length === 0) {
          return;
        }
        
        // Recalcular valorTotal baseado apenas nas parcelas pendentes
        const valorTotalPendente = parcelasPendentes.reduce((sum, p) => sum + (p.valor ? Number(p.valor) : 0), 0);
        
        const empresaKey = fatura.cnpjUsuaria;
        
        if (!empresasMap.has(empresaKey)) {
          empresasMap.set(empresaKey, {
            id: fatura.cdFatura.toString() || empresaKey,
            nome: fatura.usuaria || '',
            cnpj: fatura.cnpjUsuaria || '',
            codigo: fatura.codigoUsuaria || '',
            tributos: fatura.tributos ? Number(fatura.tributos) : 0,
            valorTotal: valorTotalPendente, // Usar valor das parcelas pendentes
            statusFatura: fatura.statusFatura || undefined,
            percentual: percentuais[empresaKey] || 0,
            valorRateado: 0,
            valorDivergente: fatura.valorDivergente ? Number(fatura.valorDivergente) : 0, // Valor divergente da fatura
            faturaIds: [fatura.cdFatura]
          });
        } else {
          const empresaExistente = empresasMap.get(empresaKey)!;
          empresaExistente.valorTotal += valorTotalPendente; // Usar valor das parcelas pendentes
          empresaExistente.tributos += fatura.tributos ? Number(fatura.tributos) : 0;
          empresaExistente.valorDivergente += fatura.valorDivergente ? Number(fatura.valorDivergente) : 0; // Somar valor divergente
          if (fatura.cdFatura && !empresaExistente.faturaIds.includes(fatura.cdFatura)) {
            empresaExistente.faturaIds.push(fatura.cdFatura);
          }
          // Atualizar status (já filtrado para status válidos)
          if (fatura.statusFatura) {
            empresaExistente.statusFatura = fatura.statusFatura;
          }
        }
      });
      
      const empresasArray = Array.from(empresasMap.values());
      setEmpresas(empresasArray);

    } catch (error: any) {
      console.error('Erro ao processar CNAB de retorno:', error);
      toast({
        title: 'Erro ao processar CNAB',
        description: error.message || 'Não foi possível processar o arquivo CNAB de retorno',
        variant: 'destructive'
      });
      
      // Marcar itens com erro no progresso
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
    } finally {
      setIsProcessingCNABRetorno(false);
    }
  };

  // Gerar arquivo CNAB baseado no rateio
  const handleGerarCNAB = async () => {
    try {
      // Validar se há faturas selecionadas
      if (empresasSelecionadasCNAB.size === 0) {
        toast({
          title: 'Nenhuma fatura selecionada',
          description: 'Por favor, selecione pelo menos uma fatura para gerar a remessa de pagamento',
          variant: 'destructive'
        });
        return;
      }

      if (valorEmEspecie <= 0) {
        toast({
          title: 'Valor inválido',
          description: 'É necessário ter um valor em espécie válido para gerar o CNAB',
          variant: 'destructive'
        });
        return;
      }

      setLoading(true);

      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Usuário não autenticado');
      }

      const cleanToken = token.trim().replace(/[\r\n]/g, '');
      
      /**
       * Coletar dados para gerar CNAB com rateio sequencial
       * 
       * O backend irá:
       * 1. Filtrar parcelas das faturas selecionadas
       * 2. Ordenar parcelas por data de vencimento (mais antigas primeiro)
       * 3. Aplicar rateio sequencial:
       *    - Inclui parcelas que cabem no valorRateio
       *    - Pode incluir parcelas parciais se necessário
       * 4. Gerar arquivo CNAB apenas com as parcelas que cabem no valorRateio
       * 
       * Exemplo:
       * - Fatura 3 com 3 parcelas de R$ 666,67 cada (total R$ 2.000,00)
       * - valorRateio: 971.43
       * - Remessa gerada: 2 parcelas (1 integral + 1 parcial)
       */
      const faturaIdsSet = new Set<number>();
      const empresasNomes: string[] = [];
      let valorRateioTotal = 0;
      
      const empresasSelecionadas = empresas.filter(emp => empresasSelecionadasCNAB.has(emp.id));
      
      console.log('📋 Empresas selecionadas para CNAB:', empresasSelecionadas.map(emp => ({
        id: emp.id,
        nome: emp.nome,
        faturaIds: emp.faturaIds
      })));
      
      empresasSelecionadas.forEach(emp => {
        // Adicionar nome da empresa (sem duplicatas)
        if (emp.nome && !empresasNomes.includes(emp.nome)) {
          empresasNomes.push(emp.nome);
        }
        
        // Adicionar todos os faturaIds desta empresa
        if (emp.faturaIds && emp.faturaIds.length > 0) {
          emp.faturaIds.forEach(faturaId => {
            if (faturaId && faturaId > 0) {
              faturaIdsSet.add(faturaId);
            }
          });
        }
        
        // Calcular valor rateado total (soma dos valores rateados de todas as empresas selecionadas)
        const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
        const valorRateado = (valorEmEspecie * percentualAtual) / 100;
        valorRateioTotal += valorRateado;
      });

      // Converter Set para Array
      const faturaIds = Array.from(faturaIdsSet);

      console.log('📦 Dados coletados para rateio sequencial:', {
        faturaIds: faturaIds,
        empresasNomes: empresasNomes,
        valorRateioTotal: valorRateioTotal,
        valorEmEspecie: valorEmEspecie
      });

      if (faturaIds.length === 0) {
        toast({
          title: 'Nenhuma fatura encontrada',
          description: 'Não foi possível encontrar IDs de faturas válidos para as empresas selecionadas',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      if (empresasNomes.length === 0) {
        toast({
          title: 'Nenhuma empresa encontrada',
          description: 'Não foi possível encontrar nomes de empresas para as seleções',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      /**
       * Payload para gerar CNAB com rateio sequencial
       * 
       * Formato:
       * {
       *   "faturaIds": [3],                    // IDs das faturas selecionadas
       *   "empresas": ["Empresa Ficticia Zeta LTDA"],  // Nomes das empresas
       *   "valorRateio": 971.43                // Valor total disponível para rateio
       * }
       * 
       * O backend irá processar:
       * - Filtrar parcelas das faturas especificadas
       * - Ordenar por data de vencimento (mais antigas primeiro)
       * - Aplicar valorRateio sequencialmente
       * - Gerar CNAB apenas com parcelas que cabem no valor
       */
      const payload = {
        faturaIds: faturaIds,
        empresas: empresasNomes,
        valorRateio: parseFloat(valorRateioTotal.toFixed(2))
      };

      // Chamar API para gerar arquivo CNAB (POST)
      // Endpoint: POST /api/v1/remessa/gerarArquivoCnab
      const urlCompleta = `${API_BASE_URL}/remessa/gerarArquivoCnab`;
      console.log('🔗 Gerando CNAB do rateio - Payload final:', JSON.stringify(payload, null, 2));
      
      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro ao gerar arquivo CNAB');
        throw new Error(errorText || 'Erro ao gerar arquivo CNAB');
      }

      // A API pode retornar JSON com o arquivo em base64 ou o arquivo diretamente
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Resposta JSON com base64
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
        const nomeArquivo = data.nomeArquivo || `remessa_rateio_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.txt`;
        
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
          description: data.mensagem || `Arquivo gerado com ${data.quantidadeRegistros || empresas.length} registros`
        });
      } else {
        // Resposta direta como arquivo
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `remessa_rateio_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: 'Arquivo CNAB gerado',
          description: `Remessa de pagamento gerada com ${empresasSelecionadasCNAB.size} fatura(s) selecionada(s)`
        });
        
        // Fechar dialog após sucesso
        setIsCNABDialogOpen(false);
        setEmpresasSelecionadasCNAB(new Set());
      }
    } catch (error: any) {
      console.error('Erro ao gerar CNAB:', error);
      toast({
        title: 'Erro ao gerar CNAB',
        description: error.message || 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rateio</h1>
          <p className="text-muted-foreground">
            Distribua valores entre empresas de acordo com percentuais
          </p>
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar Rateio
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportarPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar como PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportarXLS}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar como XLS
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportarCSV}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar como CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={() => {
              // Ao abrir o dialog, selecionar todas as empresas com valor rateado > 0
              const todasIds = empresas
                .filter(emp => {
                  const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
                  const valorRateado = (valorEmEspecie * percentualAtual) / 100;
                  return valorRateado > 0;
                })
                .map(emp => emp.id);
              setEmpresasSelecionadasOpenFinance(new Set(todasIds));
              setIsOpenFinanceDialogOpen(true);
            }} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Pagar via Open Finance
          </Button>
          <Button 
            onClick={() => {
              // Ao abrir o dialog, selecionar todas as empresas com valor rateado > 0
              const todasIds = empresas
                .filter(emp => {
                  const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
                  const valorRateado = (valorEmEspecie * percentualAtual) / 100;
                  return valorRateado > 0;
                })
                .map(emp => emp.id);
              setEmpresasSelecionadasCNAB(new Set(todasIds));
              setIsCNABDialogOpen(true);
            }} 
          >
            <FileCheck className="h-4 w-4 mr-2" />
            Gerar Arquivo CNAB
          </Button>
          <Button 
            onClick={() => setIsProcessarRetornoDialogOpen(true)} 
            variant="outline"
          >
            <Upload className="h-4 w-4 mr-2" />
            Processar Remessa de Retorno
          </Button>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Entrada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Valores de Entrada
            </CardTitle>
            <CardDescription>
              Informe o valor total a ser rateado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Valor Total em Débito</Label>
              <div className="p-3 bg-muted rounded-md">
                {loadingDashboard ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-lg font-semibold">Carregando...</span>
                  </div>
                ) : (
                  <span className="text-lg font-semibold">
                    {formatCurrency(valorTotalDebito)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Débitos pendentes
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valorEmEspecie">Valor que tenho</Label>
              <Input
                id="valorEmEspecie"
                type="text"
                value={valorEmEspecie > 0 ? formatCurrencyInput(valorEmEspecie) : ''}
                onChange={handleValorEmEspecieChange}
                placeholder="R$ 0,00"
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Digite o valor que você tem disponível para pagar
              </p>
            </div>
            <Button onClick={calcularRateio} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Rateio
            </Button>
          </CardContent>
        </Card>

        {/* Card de Resumo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Resumo do Rateio
            </CardTitle>
            <CardDescription>
              Total calculado e percentuais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor Total do Débito:</span>
                <span className="text-sm font-semibold">{formatCurrency(valorTotalDebito)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor que tenho:</span>
                <span className="text-sm font-semibold">{formatCurrency(valorEmEspecie)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-sm font-medium">
                  {(() => {
                    const saldo = valorEmEspecie - valorTotalDebito;
                    return saldo < 0 ? 'Saldo de Inadimplência:' : 'Saldo:';
                  })()}
                </span>
                {(() => {
                  const saldo = valorEmEspecie - valorTotalDebito;
                  const isNegativo = saldo < 0;
                  const isPositivo = saldo > 0;
                  return (
                    <span className={`text-sm font-bold ${
                      isNegativo 
                        ? 'text-red-600' 
                        : isPositivo 
                          ? 'text-green-600' 
                          : 'text-foreground'
                    }`}>
                      {isNegativo ? '-' : isPositivo ? '+' : ''}
                      {formatCurrency(Math.abs(saldo))}
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Rateado:</span>
                <span className="text-sm font-semibold">{formatCurrency(totalCalculado)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Percentual:</span>
                <Badge variant={Math.abs(totalPercentual - 100) < 0.01 ? "default" : "destructive"}>
                  {totalPercentual.toFixed(2)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Inadimplência */}
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Análise de Inadimplência
            </CardTitle>
            <CardDescription>
              Percentual de inadimplência em relação ao total do débito
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Gráfico Donut */}
              <div className="flex items-center justify-center relative">
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            const value = data.value as number;
                            const percent = valorTotalDebito > 0 ? (value / valorTotalDebito) * 100 : 0;
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid gap-2">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="h-2.5 w-2.5 rounded-full" 
                                      style={{ backgroundColor: data.payload?.color }}
                                    />
                                    <span className="text-sm font-medium">{data.name}</span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="font-semibold">{formatCurrency(value)}</span>
                                    <span className="text-muted-foreground ml-2">
                                      ({percent.toFixed(2)}%)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                {/* Percentual no centro do gráfico */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {percentualInadimplencia.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Inadimplência
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de Inadimplência */}
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor Total do Débito:</span>
                    <span className="text-sm font-semibold">{formatCurrency(valorTotalDebito)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor Coberto:</span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(valorEmEspecie)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor Inadimplente:</span>
                    <span className="text-sm font-semibold text-red-600">
                      {formatCurrency(totalInadimplente)}
                    </span>
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-medium">Percentual de Inadimplência:</span>
                    <Badge 
                      variant="destructive"
                      className="text-base px-3 py-1 bg-red-600 text-white"
                    >
                      {percentualInadimplencia.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, percentualInadimplencia)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {percentualInadimplencia > 20 
                      ? '⚠️ Alta inadimplência detectada'
                      : percentualInadimplencia > 10
                      ? '⚠️ Atenção: inadimplência moderada'
                      : '✓ Inadimplência dentro do esperado'
                    }
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Tabela de Empresas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Distribuição por Empresa
          </CardTitle>
          <CardDescription>
            Configure os percentuais e visualize os valores rateados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando dados de AVD...</p>
            </div>
          ) : empresas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma fatura encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuária</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Percentual (%)</TableHead>
                  <TableHead className="text-right">Valor Rateado</TableHead>
                  <TableHead className="text-right">Valor Inadimplente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresas.map((empresa) => {
                  const percentualRateio = percentuais[empresa.id] || empresa.percentual || 0;
                  // Valor rateado calculado usando o valor em espécie (não o valor do débito)
                  const valorRateado = (valorEmEspecie * percentualRateio) / 100;
                  // Valor inadimplente vem da API (valorDivergente) - sempre negativo
                  const valorDivergenteBruto = empresa.valorDivergente ?? 0;
                  // Debug: log para verificar valores
                  console.log('🔍 Empresa:', empresa.nome, 'valorDivergente da API:', empresa.valorDivergente, 'valorDivergenteBruto:', valorDivergenteBruto);
                  // Converter para negativo se positivo, manter se já negativo ou zero
                  const valorInadimplente = valorDivergenteBruto > 0 
                    ? -Math.abs(valorDivergenteBruto) 
                    : valorDivergenteBruto;
                  console.log('🔍 valorInadimplente calculado:', valorInadimplente);
                  
                  // Calcular percentual de inadimplência seguindo a mesma lógica do gráfico
                  // Se há valor rateado, a inadimplência após rateio = valorDivergente - valorRateado
                  // Percentual = (inadimplência após rateio / valorDivergente original) * 100
                  const valorInadimplenteAbsoluto = Math.abs(valorInadimplente);
                  const valorInadimplenteAposRateio = Math.max(0, valorInadimplenteAbsoluto - valorRateado);
                  const percentualInadimplencia = valorInadimplenteAbsoluto > 0 
                    ? (valorInadimplenteAposRateio / valorInadimplenteAbsoluto) * 100 
                    : 0;
                  
                  return (
                    <TableRow key={empresa.id}>
                      <TableCell className="font-medium">{empresa.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{empresa.cnpj}</TableCell>
                      <TableCell className="text-sm">{empresa.codigo}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(empresa.valorTotal)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold">{percentualInadimplencia.toFixed(2)}%</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(valorRateado)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${
                        valorInadimplente < 0 ? 'text-red-600' : 'text-foreground'
                      }`}>
                        {formatCurrency(valorInadimplente)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Pagamento Open Finance */}
      <Dialog open={isOpenFinanceDialogOpen} onOpenChange={setIsOpenFinanceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              {/* Logo Open Finance */}
              <img 
                src="/assets/logo_openfinance.png" 
                alt="Open Finance" 
                className="h-12 w-auto object-contain"
              />
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Pagamento via Open Finance com Split
              </DialogTitle>
            </div>
            <DialogDescription>
              Realize o pagamento do rateio distribuindo os valores entre as empresas usando Open Finance
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Valor Total a Pagar:</span>
                <span className="text-sm font-bold">{formatCurrency(valorEmEspecie)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total Rateado:</span>
                <span className="text-sm font-semibold">{formatCurrency(totalCalculado)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Selecione as faturas para liquidar:</h4>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selecionarTodasEmpresas}
                    className="text-xs h-7"
                  >
                    Marcar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={desselecionarTodasEmpresas}
                    className="text-xs h-7"
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {empresas.map((empresa) => {
                  const percentualAtual = percentuais[empresa.id] || empresa.percentual || 0;
                  const valorRateado = (valorEmEspecie * percentualAtual) / 100;
                  const pagamento = pagamentosOpenFinance.get(empresa.id);
                  const isSelecionada = empresasSelecionadasOpenFinance.has(empresa.id);
                  const podeSelecionar = valorRateado > 0;
                  
                  return (
                    <div 
                      key={empresa.id} 
                      className={`border rounded-lg p-3 space-y-2 transition-colors ${
                        isSelecionada ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                      } ${!podeSelecionar ? 'opacity-50' : 'cursor-pointer'}`}
                      onClick={() => podeSelecionar && toggleEmpresaSelecionada(empresa.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelecionada}
                          onCheckedChange={() => podeSelecionar && toggleEmpresaSelecionada(empresa.id)}
                          disabled={!podeSelecionar}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">{empresa.nome}</div>
                              <div className="text-xs text-muted-foreground">{empresa.cnpj}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Código: {empresa.codigo}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold">{formatCurrency(valorRateado)}</div>
                              <div className="text-xs text-muted-foreground">{percentualAtual.toFixed(2)}%</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Total: {formatCurrency(empresa.valorTotal)}
                              </div>
                            </div>
                          </div>
                          {pagamento && (
                            <div className="flex items-center gap-2 text-xs mt-2">
                              <Badge 
                                variant={pagamento.status === 'CONFIRMADO' ? 'default' : pagamento.status === 'FALHOU' ? 'destructive' : 'secondary'}
                              >
                                {pagamento.status === 'CONFIRMADO' ? '✓ Liquidada' : 
                                 pagamento.status === 'FALHOU' ? '✗ Falhou' : 
                                 '⏳ Pendente'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {empresasSelecionadasOpenFinance.size > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm font-medium">
                    {empresasSelecionadasOpenFinance.size} fatura(s) selecionada(s) para liquidação
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenFinanceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePagarRateioViaOpenFinance}
              disabled={loading || empresasSelecionadasOpenFinance.size === 0 || valorEmEspecie <= 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Liquidar {empresasSelecionadasOpenFinance.size > 0 ? `${empresasSelecionadasOpenFinance.size} ` : ''}Fatura(s) Selecionada(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Seleção de Faturas para CNAB */}
      <Dialog open={isCNABDialogOpen} onOpenChange={setIsCNABDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Gerar Remessa de Pagamento (CNAB)
            </DialogTitle>
            <DialogDescription>
              Selecione as faturas que deseja incluir na remessa de pagamento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Valor Total a Incluir:</span>
                <span className="text-sm font-bold">
                  {formatCurrency(
                    empresas
                      .filter(emp => empresasSelecionadasCNAB.has(emp.id))
                      .reduce((sum, emp) => {
                        const percentualAtual = percentuais[emp.id] || emp.percentual || 0;
                        return sum + (valorEmEspecie * percentualAtual) / 100;
                      }, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total de Faturas Selecionadas:</span>
                <span className="text-sm font-semibold">{empresasSelecionadasCNAB.size}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Selecione as faturas para remessa:</h4>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={selecionarTodasEmpresasCNAB}
                    className="text-xs h-7"
                  >
                    Marcar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={desselecionarTodasEmpresasCNAB}
                    className="text-xs h-7"
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {empresas.map((empresa) => {
                  const percentualAtual = percentuais[empresa.id] || empresa.percentual || 0;
                  const valorRateado = (valorEmEspecie * percentualAtual) / 100;
                  const isSelecionada = empresasSelecionadasCNAB.has(empresa.id);
                  const podeSelecionar = valorRateado > 0;
                  
                  return (
                    <div 
                      key={empresa.id} 
                      className={`border rounded-lg p-3 space-y-2 transition-colors ${
                        isSelecionada ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                      } ${!podeSelecionar ? 'opacity-50' : 'cursor-pointer'}`}
                      onClick={() => podeSelecionar && toggleEmpresaSelecionadaCNAB(empresa.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelecionada}
                          onCheckedChange={() => podeSelecionar && toggleEmpresaSelecionadaCNAB(empresa.id)}
                          disabled={!podeSelecionar}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">{empresa.nome}</div>
                              <div className="text-xs text-muted-foreground">{empresa.cnpj}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Código: {empresa.codigo}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold">{formatCurrency(valorRateado)}</div>
                              <div className="text-xs text-muted-foreground">{percentualAtual.toFixed(2)}%</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Total: {formatCurrency(empresa.valorTotal)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {empresasSelecionadasCNAB.size > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm font-medium">
                    {empresasSelecionadasCNAB.size} fatura(s) selecionada(s) para remessa de pagamento
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCNABDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGerarCNAB}
              disabled={loading || empresasSelecionadasCNAB.size === 0 || valorEmEspecie <= 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FileCheck className="h-4 w-4 mr-2" />
              Gerar Remessa com {empresasSelecionadasCNAB.size > 0 ? `${empresasSelecionadasCNAB.size} ` : ''}Fatura(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para processar remessa de retorno CNAB */}
      <Dialog open={isProcessarRetornoDialogOpen} onOpenChange={setIsProcessarRetornoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Processar Remessa de Retorno CNAB</DialogTitle>
            <DialogDescription>
              Faça upload do arquivo CNAB retornado pelo banco para processar os pagamentos em lote
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cnab-retorno-file">Arquivo CNAB de Retorno (.txt)</Label>
              <Input
                id="cnab-retorno-file"
                type="file"
                accept=".txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCnabRetornoFile(file);
                    setProgressoProcessamento(null);
                  }
                }}
                disabled={isProcessingCNABRetorno}
              />
              {cnabRetornoFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Arquivo selecionado: {cnabRetornoFile.name}
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

                {/* Lista de Faturas */}
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
                            Fatura #{item.parcela}
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
                setIsProcessarRetornoDialogOpen(false);
                setCnabRetornoFile(null);
                setProgressoProcessamento(null);
              }}
              disabled={isProcessingCNABRetorno}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProcessarCNABRetorno}
              disabled={!cnabRetornoFile || isProcessingCNABRetorno}
            >
              {isProcessingCNABRetorno ? (
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
    </div>
  );
};

export default Rateio;