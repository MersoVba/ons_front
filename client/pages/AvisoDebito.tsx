import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ProcessarComprovanteResponse, PagamentoBoleto } from '@shared/api';
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
  Trash2
} from 'lucide-react';

interface ParcelaDebito {
  numParcela: number;
  data: string;
  valor: number;
  comprovante?: File;
  status: 'aguardando' | 'enviado' | 'pago';
  dadosExtraidos?: PagamentoBoleto;
}

interface Usuaria {
  id: string;
  usuaria: string;
  cnpj: string;
  codigoUsuaria: string;
  tributos: number;
  valorTotal: number;
  parcelas: ParcelaDebito[];
}

const AvisoDebito = () => {
  const [selectedUsuariaForUpload, setSelectedUsuariaForUpload] = useState<Usuaria | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [dadosExtraidosModal, setDadosExtraidosModal] = useState<{
    parcelaNumero: number;
    dados: PagamentoBoleto;
    banco: string;
    arquivo?: File;
  } | null>(null);

  // Filter states
  const [filterUsuaria, setFilterUsuaria] = useState('');
  const [filterCnpj, setFilterCnpj] = useState('');
  const [filterCodigo, setFilterCodigo] = useState('');

  // Get user access type (opcional - não requer login)
  const [currentUser] = useState<{email?:string, accessType?:string}>(() => {
    try { return JSON.parse(localStorage.getItem('authUser') || 'null'); } catch (e) { return null; }
  });
  const accessType = currentUser?.accessType || 'AVD';

  // Verificação de autenticação removida - acesso liberado

  // Mock data for Aviso de Débito
  const mockUsuarias: Usuaria[] = [
    {
      id: '1',
      usuaria: 'RGE SUL (AES-SUL)',
      cnpj: '02.016.440/0001-62',
      codigoUsuaria: '2001',
      tributos: 2075.95,
      valorTotal: 56875.29,
      parcelas: [
        { numParcela: 1, data: '2025-04-15T00:00:00-03:00', valor: 0, status: 'aguardando' },
        { numParcela: 2, data: '2025-04-25T00:00:00-03:00', valor: 56875.29, status: 'aguardando' },
        { numParcela: 3, data: '2025-05-05T00:00:00-03:00', valor: 0, status: 'aguardando' }
      ]
    },
    {
      id: '2',
      usuaria: 'Empresa Energia Norte Ltda',
      cnpj: '12.345.678/0001-90',
      codigoUsuaria: '2002',
      tributos: 1500.00,
      valorTotal: 45000.00,
      parcelas: [
        { numParcela: 1, data: '2025-04-15T00:00:00-03:00', valor: 15000.00, status: 'aguardando' },
        { numParcela: 2, data: '2025-04-25T00:00:00-03:00', valor: 15000.00, status: 'aguardando' },
        { numParcela: 3, data: '2025-05-05T00:00:00-03:00', valor: 15000.00, status: 'aguardando' }
      ]
    },
    {
      id: '3',
      usuaria: 'Transmissora Centro-Oeste SA',
      cnpj: '87.654.321/0001-45',
      codigoUsuaria: '2003',
      tributos: 3200.50,
      valorTotal: 78900.75,
      parcelas: [
        { numParcela: 1, data: '2025-04-15T00:00:00-03:00', valor: 26300.25, status: 'aguardando' },
        { numParcela: 2, data: '2025-04-25T00:00:00-03:00', valor: 26300.25, status: 'aguardando' },
        { numParcela: 3, data: '2025-05-05T00:00:00-03:00', valor: 26300.25, status: 'aguardando' }
      ]
    },
    {
      id: '4',
      usuaria: 'Distribuidora Vale Energia',
      cnpj: '11.222.333/0001-44',
      codigoUsuaria: '2004',
      tributos: 950.00,
      valorTotal: 32500.00,
      parcelas: [
        { numParcela: 1, data: '2025-04-15T00:00:00-03:00', valor: 10833.33, status: 'aguardando' },
        { numParcela: 2, data: '2025-04-25T00:00:00-03:00', valor: 10833.33, status: 'aguardando' },
        { numParcela: 3, data: '2025-05-05T00:00:00-03:00', valor: 10833.34, status: 'aguardando' }
      ]
    },
    {
      id: '5',
      usuaria: 'Geração Solar Brasil',
      cnpj: '44.555.666/0001-77',
      codigoUsuaria: '2005',
      tributos: 1200.00,
      valorTotal: 40000.00,
      parcelas: [
        { numParcela: 1, data: '2025-04-15T00:00:00-03:00', valor: 13333.33, status: 'aguardando' },
        { numParcela: 2, data: '2025-04-25T00:00:00-03:00', valor: 13333.33, status: 'aguardando' },
        { numParcela: 3, data: '2025-05-05T00:00:00-03:00', valor: 13333.34, status: 'aguardando' }
      ]
    }
  ];

  const [usuarias, setUsuarias] = useState<Usuaria[]>(mockUsuarias);

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

  const handleDownloadComprovante = (comprovante: File, parcelaNumero: number) => {
    const url = URL.createObjectURL(comprovante);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedUsuariaForUpload?.usuaria}-parcela-${parcelaNumero}-${comprovante.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreviewComprovante = (comprovante: File) => {
    const url = URL.createObjectURL(comprovante);
    window.open(url, '_blank');
  };

  const processarPDF = async (file: File, parcelaNumero: number) => {
    setIsProcessingPDF(true);
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

        // Atualizar parcela com dados extraídos
        setUsuarias(prev => prev.map(usr => {
          if (usr.id === selectedUsuariaForUpload?.id) {
            return {
              ...usr,
              parcelas: usr.parcelas.map(parc => {
                if (parc.numParcela === parcelaNumero) {
                  return {
                    ...parc,
                    comprovante: file,
                    dadosExtraidos: result.dados,
                    status: 'enviado' as const
                  };
                }
                return parc;
              })
            };
          }
          return usr;
        }));

        // Não abrir modal automaticamente - o usuário pode abrir manualmente se quiser
        // setDadosExtraidosModal({
        //   parcelaNumero,
        //   dados: result.dados,
        //   banco: result.bancoDetectado || 'DESCONHECIDO',
        //   arquivo: file
        // });

        const tipoDoc = result.dados.tipoDocumento || 'BOLETO';
        const tipoDocLabel = tipoDoc === 'BOLETO' ? 'Boleto' : 
                            tipoDoc === 'TED' ? 'TED' : 
                            tipoDoc === 'TRANSFERECIA' ? 'Transferência' : 
                            tipoDoc === 'DOC' ? 'DOC' : tipoDoc;

        toast({
          title: 'PDF processado com sucesso',
          description: `Comprovante ${tipoDocLabel} processado${result.bancoDetectado ? ` (${result.bancoDetectado})` : ''}. Dados extraídos com sucesso.`
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

  const handleUploadFile = async (parcelaNumero: number, file: File) => {
    // Se for PDF, processar automaticamente
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await processarPDF(file, parcelaNumero);
    } else {
      // Para outros tipos de arquivo, apenas salvar
      console.log('=== COMPROVANTE ANEXADO (NÃO PDF) ===');
      console.log('Parcela:', parcelaNumero);
      console.log('Arquivo:', file.name);
      console.log('Tipo:', file.type);
      console.log('Tamanho:', (file.size / 1024).toFixed(2), 'KB');
      console.log('======================================');

      setUsuarias(prev => prev.map(usr => {
        if (usr.id === selectedUsuariaForUpload?.id) {
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
    if (parcela.comprovante) {
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
            <div className="text-2xl font-bold">{formatCurrency(filteredUsuarias.reduce((sum, u) => sum + u.valorTotal, 0))}</div>
            <p className="text-xs text-muted-foreground">Débitos pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Usuárias - Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Aviso de Débito</CardTitle>
          <CardDescription>
            {hasActiveFilters ? `Exibindo ${filteredUsuarias.length} de ${usuarias.length} usuárias` : `Total de ${filteredUsuarias.length} usuárias`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredUsuarias.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma usuária encontrada com os filtros aplicados.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuária</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Tributos</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-center">Parcelas</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsuarias.map((usuaria) => {
                    const totalComprovantes = usuaria.parcelas.filter(p => p.comprovante).length;
                    const statusGeral = totalComprovantes === usuaria.parcelas.length ? 'completo' : totalComprovantes > 0 ? 'parcial' : 'pendente';

                    return (
                      <TableRow key={usuaria.id}>
                        <TableCell className="font-medium">{usuaria.usuaria}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{usuaria.cnpj}</TableCell>
                        <TableCell className="text-sm">{usuaria.codigoUsuaria}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(usuaria.tributos)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(usuaria.valorTotal)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {usuaria.parcelas.map((p) => (
                              <Badge key={p.numParcela} variant="outline" className="text-xs">
                                {new Date(p.data).getDate()}/{String(new Date(p.data).getMonth() + 1).padStart(2, '0')}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {statusGeral === 'completo' && <Badge className="bg-success">Completo</Badge>}
                          {statusGeral === 'parcial' && <Badge variant="secondary">Parcial ({totalComprovantes}/{usuaria.parcelas.length})</Badge>}
                          {statusGeral === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUsuariaClick(usuaria)}
                            className="h-8 w-8 p-0"
                            title="Gerenciar comprovantes"
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
                        
                        {/* Comprovante Anexado */}
                        {parcela.comprovante ? (
                          <div className="border rounded-lg p-4 bg-muted/50 mb-3">
                            <div className="flex items-center gap-3 mb-3">
                              <FileText className="h-6 w-6 text-success flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium truncate">{parcela.comprovante.name}</p>
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
                                <p className="text-xs text-muted-foreground">{(parcela.comprovante.size / 1024).toFixed(2)} KB</p>
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
                                    banco: parcela.dadosExtraidos.banco || 'DESCONHECIDO'
                                  })}
                                >
                                  <FileCheck className="h-4 w-4 mr-2" />
                                  Ver Dados
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePreviewComprovante(parcela.comprovante!)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadComprovante(parcela.comprovante!, parcela.numParcela)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRemoverComprovante(parcela.numParcela)}
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {/* Área de Upload */}
                        {!parcela.comprovante && (
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
                        {parcela.comprovante && (
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
    </div>
  );
};

export default AvisoDebito;

