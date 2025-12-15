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
import { AvdAPI, FaturaResponse } from '@/lib/avd-api';
import { AuthAPI } from '@/lib/auth-api';
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
  Loader2
} from 'lucide-react';

interface Parcela {
  cdParcela?: number;
  numero: number;
  dataPagamento: string;
  valor: number;
  comprovante?: File;
  status: 'aguardando' | 'enviado' | 'pago';
  linkDocumento?: string; // Link para o documento anexado na parcela
}

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  contato: string;
  email: string;
  valorTotal: number;
  parcelas: Parcela[];
}

const AvisoCredito = () => {
  const [selectedCompanyForUpload, setSelectedCompanyForUpload] = useState<Empresa | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Filter states
  const [filterNome, setFilterNome] = useState('');
  const [filterCnpj, setFilterCnpj] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');

  // Get user access type
  const [currentUser] = useState<{email?:string, accessType?:string}>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  });
  const accessType = currentUser?.accessType || 'AVC';

  // Generate fixed installment dates (10, 15, 25)
  const generateParcelasDates = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const date10 = new Date(currentYear, currentMonth, 10);
    const date15 = new Date(currentYear, currentMonth, 15);
    const date25 = new Date(currentYear, currentMonth, 25);

    // If all dates have passed, use next month
    if (date25 < today) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      return [
        new Date(nextYear, nextMonth, 10).toISOString().split('T')[0],
        new Date(nextYear, nextMonth, 15).toISOString().split('T')[0],
        new Date(nextYear, nextMonth, 25).toISOString().split('T')[0]
      ];
    }

    return [
      date10.toISOString().split('T')[0],
      date15.toISOString().split('T')[0],
      date25.toISOString().split('T')[0]
    ];
  };

  const parcelasDates = generateParcelasDates();

  const mockEmpresas: Empresa[] = [
    {
      id: '1',
      nome: 'Empresa Energia ABC Ltda',
      cnpj: '12.345.678/0001-90',
      contato: 'João Silva',
      email: 'joao@energiaabc.com.br',
      valorTotal: 5000,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 1666.67, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 1666.67, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 1666.66, status: 'aguardando' }
      ]
    },
    {
      id: '2',
      nome: 'Transmissora Sul Brasil SA',
      cnpj: '87.654.321/0001-45',
      contato: 'Maria Santos',
      email: 'maria@transmissorasul.com.br',
      valorTotal: 8500,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 2833.33, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 2833.33, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 2833.34, status: 'aguardando' }
      ]
    },
    {
      id: '3',
      nome: 'Distribuidora Norte Energia',
      cnpj: '11.222.333/0001-44',
      contato: 'Carlos Oliveira',
      email: 'carlos@distribuidoranorte.com.br',
      valorTotal: 12000,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 4000, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 4000, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 4000, status: 'aguardando' }
      ]
    },
    {
      id: '4',
      nome: 'Geração Renovável Ltda',
      cnpj: '44.555.666/0001-77',
      contato: 'Ana Costa',
      email: 'ana@geracaorenova vel.com.br',
      valorTotal: 6500,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 2166.67, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 2166.67, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 2166.66, status: 'aguardando' }
      ]
    },
    {
      id: '5',
      nome: 'Tecnologia Elétrica Avançada',
      cnpj: '77.888.999/0001-11',
      contato: 'Pedro Gomes',
      email: 'pedro@tecnologiaeletrica.com.br',
      valorTotal: 9200,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 3066.67, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 3066.67, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 3066.66, status: 'aguardando' }
      ]
    },
    {
      id: '6',
      nome: 'Consultoria Energética Plus',
      cnpj: '22.333.444/0001-55',
      contato: 'Laura Ferreira',
      email: 'laura@consultoriaenergia.com.br',
      valorTotal: 3500,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 1166.67, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 1166.67, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 1166.66, status: 'aguardando' }
      ]
    },
    {
      id: '7',
      nome: 'Serviços de Infraestrutura Nacional',
      cnpj: '55.666.777/0001-88',
      contato: 'Roberto Dias',
      email: 'roberto@infraestrutura.com.br',
      valorTotal: 15000,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 5000, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 5000, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 5000, status: 'aguardando' }
      ]
    },
    {
      id: '8',
      nome: 'Processamento de Dados Inteligente',
      cnpj: '33.444.555/0001-22',
      contato: 'Fernanda Rocha',
      email: 'fernanda@processamentodados.com.br',
      valorTotal: 7800,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 2600, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 2600, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 2600, status: 'aguardando' }
      ]
    },
    {
      id: '9',
      nome: 'Logística Verde Brasil',
      cnpj: '66.777.888/0001-99',
      contato: 'Marcelo Souza',
      email: 'marcelo@logisticaverde.com.br',
      valorTotal: 4200,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 1400, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 1400, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 1400, status: 'aguardando' }
      ]
    },
    {
      id: '10',
      nome: 'Pesquisa e Desenvolvimento Energético',
      cnpj: '99.111.222/0001-66',
      contato: 'Patricia Alves',
      email: 'patricia@pesquisaenergia.com.br',
      valorTotal: 11000,
      parcelas: [
        { numero: 1, dataPagamento: parcelasDates[0], valor: 3666.67, status: 'aguardando' },
        { numero: 2, dataPagamento: parcelasDates[1], valor: 3666.67, status: 'aguardando' },
        { numero: 3, dataPagamento: parcelasDates[2], valor: 3666.66, status: 'aguardando' }
      ]
    }
  ];

  const [empresas, setEmpresas] = useState<Empresa[]>(mockEmpresas);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);

  // Carregar dados do backend usando o endpoint de faturas
  useEffect(() => {
    const carregarFaturas = async () => {
      setLoadingEmpresas(true);
      try {
        // Buscar todas as faturas com suas parcelas
        const faturas: FaturaResponse[] = await AvdAPI.obterTodasFaturas(0, 5, 'ASC', 'transmissora');
        
        // Converter faturas para o formato de empresas (transmissoras)
        const empresasMap = new Map<string, Empresa>();
        
        faturas.forEach((fatura: FaturaResponse) => {
          if (!fatura.cnpjTransmissora || !fatura.transmissora) return;
          
          const empresaKey = fatura.cnpjTransmissora;
          
          if (!empresasMap.has(empresaKey)) {
            // Criar nova empresa (transmissora)
            empresasMap.set(empresaKey, {
              id: fatura.cdFatura?.toString() || empresaKey,
              nome: fatura.transmissora || '',
              cnpj: fatura.cnpjTransmissora || '',
              contato: fatura.transmissora || '', // Usar nome da transmissora como contato
              email: '', // Email não vem na resposta da API
              valorTotal: fatura.valorTotal ? Number(fatura.valorTotal) : 0,
              parcelas: []
            });
          }
          
          // Adicionar parcelas da fatura à empresa
          const empresa = empresasMap.get(empresaKey)!;
          if (fatura.parcelas && fatura.parcelas.length > 0) {
            fatura.parcelas.forEach((parcela) => {
              if (parcela.numParcela && parcela.dataVencimento) {
                // Verificar se a parcela já existe (evitar duplicatas)
                const parcelaExistente = empresa.parcelas.find(p => p.numero === parcela.numParcela);
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
                    status: parcela.status === 'PAGO' ? 'pago' : 
                           parcela.status === 'ENVIADO' ? 'enviado' : 
                           'aguardando',
                    linkDocumento: parcela.enderecoComprovante || undefined
                  });
                } else {
                  // Atualizar linkDocumento e cdParcela se a parcela existente não tiver
                  if (parcela.enderecoComprovante && !parcelaExistente.linkDocumento) {
                    parcelaExistente.linkDocumento = parcela.enderecoComprovante;
                  }
                  const cdParcela = parcela.id || parcela.cdParcela;
                  if (cdParcela && !parcelaExistente.cdParcela) {
                    parcelaExistente.cdParcela = cdParcela;
                  }
                }
              }
            });
          }
        });
        
        // Converter Map para Array e ordenar parcelas de cada empresa
        const empresasComParcelas: Empresa[] = Array.from(empresasMap.values()).map(empresa => ({
          ...empresa,
          parcelas: empresa.parcelas.sort((a, b) => a.numero - b.numero)
        }));

        setEmpresas(empresasComParcelas);
      } catch (error: any) {
        console.error('Erro ao carregar faturas:', error);
        toast({
          title: 'Erro ao carregar dados',
          description: error.message || 'Não foi possível carregar as faturas',
          variant: 'destructive'
        });
        // Em caso de erro, usar dados mockados como fallback
        setEmpresas(mockEmpresas);
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
      const matchesEmail = empresa.email.toLowerCase().includes(filterEmail.toLowerCase());
      const matchesResponsavel = empresa.contato.toLowerCase().includes(filterResponsavel.toLowerCase());

      return matchesNome && matchesCnpj && matchesEmail && matchesResponsavel;
    });
  }, [empresas, filterNome, filterCnpj, filterEmail, filterResponsavel]);

  const handleClearFilters = () => {
    setFilterNome('');
    setFilterCnpj('');
    setFilterEmail('');
    setFilterResponsavel('');
  };

  const hasActiveFilters = filterNome || filterCnpj || filterEmail || filterResponsavel;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleCompanyClick = (empresa: Empresa) => {
    setSelectedCompanyForUpload(empresa);
    setIsUploadModalOpen(true);
  };

  const handleDownloadComprovante = async (comprovante: File | string, parcelaNumero: number) => {
    if (typeof comprovante === 'string') {
      // Se for uma URL (linkDocumento), fazer download do arquivo
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
    } else {
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

  const handlePreviewComprovante = async (comprovante: File | string) => {
    if (typeof comprovante === 'string') {
      // Se for uma URL (linkDocumento), abrir em nova aba
      window.open(comprovante, '_blank');
    } else {
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

  const getParcelaStatusBadge = (parcela: Parcela) => {
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
                Filtre as empresas por nome, CNPJ, email ou responsável
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
                <Label htmlFor="filter-email">E-mail</Label>
                <Input
                  id="filter-email"
                  placeholder="Digite o e-mail..."
                  value={filterEmail}
                  onChange={(e) => setFilterEmail(e.target.value)}
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
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmpresas.map((empresa) => {
                    const totalComprovantes = empresa.parcelas.filter(p => p.comprovante || p.linkDocumento).length;
                    const statusGeral = totalComprovantes === empresa.parcelas.length ? 'completo' : totalComprovantes > 0 ? 'parcial' : 'pendente';

                    return (
                      <TableRow key={empresa.id}>
                        <TableCell className="font-medium">{empresa.nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{empresa.cnpj}</TableCell>
                        <TableCell className="text-sm">{empresa.contato}</TableCell>
                        <TableCell className="text-sm">{empresa.email}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(empresa.valorTotal)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {empresa.parcelas.map((p) => (
                              <Badge key={p.numero} variant="outline" className="text-xs">
                                {new Date(p.dataPagamento).getDate()}/{String(new Date(p.dataPagamento).getMonth() + 1).padStart(2, '0')}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {statusGeral === 'completo' && <Badge className="bg-success">Completo</Badge>}
                          {statusGeral === 'parcial' && <Badge variant="secondary">Parcial ({totalComprovantes}/{empresa.parcelas.length})</Badge>}
                          {statusGeral === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCompanyClick(empresa)}
                            className="h-8 w-8 p-0"
                            title={accessType === 'AVD' ? 'Enviar comprovantes' : 'Visualizar comprovantes'}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
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
            <DialogTitle>{accessType === 'AVD' ? 'Enviar Comprovantes' : 'Visualizar Comprovantes'}</DialogTitle>
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
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium">{selectedCompanyForUpload.email}</p>
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
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => handlePreviewComprovante(parcela.comprovante || parcela.linkDocumento!)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Visualizar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => handleDownloadComprovante(parcela.comprovante || parcela.linkDocumento!, parcela.numero)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
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
    </div>
  );
};

export default AvisoCredito;
