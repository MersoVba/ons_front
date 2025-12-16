/**
 * Gerador de arquivo CNAB 240 (Formato FEBRABAN)
 * Gera arquivo de remessa para pagamentos em lote
 */

interface DadosParcelaCNAB {
  cdParcela: number;
  valor: number;
  dataVencimento: string;
  beneficiario: string;
  cnpjBeneficiario: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string; // '01' = Conta Corrente, '02' = Poupança
  finalidade: string;
  nossoNumero?: string;
}

interface DadosEmpresaCNAB {
  nome: string;
  cnpj: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
}

/**
 * Formata número com zeros à esquerda
 */
function formatarNumero(numero: number | string, tamanho: number): string {
  return String(numero).padStart(tamanho, '0');
}

/**
 * Formata texto com espaços à direita
 */
function formatarTexto(texto: string, tamanho: number): string {
  return texto.substring(0, tamanho).padEnd(tamanho, ' ');
}

/**
 * Formata data no formato DDMMAAAA
 */
function formatarData(data: string): string {
  const date = new Date(data);
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = String(date.getFullYear());
  return dia + mes + ano;
}

/**
 * Calcula dígito verificador usando módulo 11
 */
function calcularDigitoVerificador(numero: string): string {
  let soma = 0;
  let multiplicador = 2;
  
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += parseInt(numero[i]) * multiplicador;
    multiplicador = multiplicador === 9 ? 2 : multiplicador + 1;
  }
  
  const resto = soma % 11;
  if (resto === 0 || resto === 1) {
    return '0';
  }
  return String(11 - resto);
}

/**
 * Gera registro header do arquivo (tipo 0)
 */
function gerarHeaderArquivo(empresa: DadosEmpresaCNAB, sequencial: number): string {
  const linha: string[] = [];
  
  linha.push('0'); // 001-001: Código do registro
  linha.push('1'); // 002-002: Código de remessa
  linha.push('REMESSA'); // 003-009: Literal remessa
  linha.push('01'); // 010-011: Código do serviço
  linha.push(formatarTexto('COBRANCA', 15)); // 012-026: Literal de serviço
  linha.push(formatarNumero(empresa.cnpj.replace(/\D/g, ''), 20)); // 027-046: Código da empresa
  linha.push(formatarTexto(empresa.nome, 30)); // 047-076: Nome da empresa
  linha.push('341'); // 077-079: Código do banco (Itaú como padrão)
  linha.push(formatarTexto('BANCO ITAU', 15)); // 080-094: Nome do banco
  linha.push(formatarData(new Date().toISOString())); // 095-100: Data de geração
  linha.push(formatarNumero(sequencial, 6)); // 101-106: Número sequencial
  linha.push(formatarNumero('', 69)); // 107-175: Brancos
  linha.push(formatarNumero('', 6)); // 176-181: Brancos
  linha.push(formatarNumero('', 6)); // 182-187: Brancos
  linha.push(formatarNumero('', 53)); // 188-240: Brancos
  
  return linha.join('');
}

/**
 * Gera registro header do lote (tipo 1)
 */
function gerarHeaderLote(empresa: DadosEmpresaCNAB, sequencial: number, lote: number): string {
  const linha: string[] = [];
  
  linha.push('1'); // 001-001: Código do registro
  linha.push(formatarNumero(lote, 4)); // 002-005: Lote de serviço
  linha.push('01'); // 006-007: Tipo de operação
  linha.push('03'); // 008-009: Tipo de serviço
  linha.push('00'); // 010-011: Forma de lançamento
  linha.push('040'); // 012-013: Layout do lote
  linha.push(formatarNumero('', 1)); // 014-014: Branco
  linha.push('2'); // 015-015: Tipo de inscrição (2 = CNPJ)
  linha.push(formatarNumero(empresa.cnpj.replace(/\D/g, ''), 15)); // 016-030: CNPJ
  linha.push(formatarTexto(empresa.nome, 30)); // 031-060: Nome da empresa
  linha.push(formatarTexto('', 30)); // 061-090: Mensagem 1
  linha.push(formatarTexto('', 30)); // 091-120: Mensagem 2
  linha.push(formatarNumero(sequencial, 8)); // 121-128: Número remessa/retorno
  linha.push(formatarData(new Date().toISOString())); // 129-136: Data de gravação
  linha.push(formatarNumero('', 8)); // 137-144: Data de crédito
  linha.push(formatarNumero('', 33)); // 145-177: Brancos
  linha.push(formatarNumero('', 63)); // 178-240: Brancos
  
  return linha.join('');
}

/**
 * Gera registro de detalhe segmento A (tipo 3, segmento A)
 */
function gerarSegmentoA(parcela: DadosParcelaCNAB, empresa: DadosEmpresaCNAB, lote: number, sequencial: number): string {
  const linha: string[] = [];
  const valorFormatado = formatarNumero(Math.round(parcela.valor * 100), 15);
  
  linha.push('3'); // 001-001: Código do registro
  linha.push(formatarNumero(lote, 4)); // 002-005: Lote de serviço
  linha.push(formatarNumero(sequencial, 5)); // 006-010: Número sequencial do registro
  linha.push('A'); // 011-011: Código do segmento
  linha.push('000'); // 012-013: Tipo de movimento
  linha.push('0000'); // 014-017: Código da câmara centralizadora
  linha.push('000'); // 018-020: Código do banco
  linha.push(formatarNumero(empresa.agencia, 5)); // 021-025: Agência mantenedora
  linha.push(formatarNumero('', 1)); // 026-026: Dígito da agência
  linha.push(formatarNumero(empresa.conta, 12)); // 027-038: Conta corrente
  linha.push(formatarNumero('', 1)); // 039-039: Dígito da conta
  linha.push(formatarNumero('', 1)); // 040-040: Dígito da agência/conta
  linha.push(formatarTexto(parcela.beneficiario, 30)); // 041-070: Nome do favorecido
  linha.push(formatarNumero(parcela.cnpjBeneficiario.replace(/\D/g, ''), 18)); // 071-088: Número do documento
  linha.push(formatarData(parcela.dataVencimento)); // 089-096: Data do pagamento
  linha.push('REA'); // 097-099: Tipo da moeda
  linha.push(formatarNumero('', 15)); // 100-114: Quantidade da moeda
  linha.push(valorFormatado); // 115-129: Valor do pagamento
  linha.push(formatarNumero(parcela.nossoNumero || '', 20)); // 130-149: Nosso número
  linha.push(formatarData(new Date().toISOString())); // 150-157: Data real/efetiva
  linha.push(formatarNumero('', 15)); // 158-172: Valor real/efetivo
  linha.push(formatarTexto('', 40)); // 173-212: Informações complementares
  linha.push(formatarTexto('', 2)); // 213-214: Finalidade DOC/TED
  linha.push(formatarTexto('', 5)); // 215-217: Brancos
  linha.push(formatarNumero('', 18)); // 218-219: Aviso ao favorecido
  linha.push(formatarNumero('', 2)); // 220-220: Código das ocorrências
  linha.push(formatarNumero('', 20)); // 221-240: Brancos
  
  return linha.join('');
}

/**
 * Gera registro de detalhe segmento B (tipo 3, segmento B)
 */
function gerarSegmentoB(parcela: DadosParcelaCNAB, empresa: DadosEmpresaCNAB, lote: number, sequencial: number): string {
  const linha: string[] = [];
  
  linha.push('3'); // 001-001: Código do registro
  linha.push(formatarNumero(lote, 4)); // 002-005: Lote de serviço
  linha.push(formatarNumero(sequencial, 5)); // 006-010: Número sequencial
  linha.push('B'); // 011-011: Código do segmento
  linha.push(formatarNumero('', 3)); // 012-013: Brancos
  linha.push(formatarNumero(parcela.banco, 3)); // 014-016: Código do banco favorecido
  linha.push(formatarNumero(parcela.agencia, 5)); // 017-021: Agência do favorecido
  linha.push(formatarNumero('', 1)); // 022-022: Dígito da agência
  linha.push(formatarNumero(parcela.conta, 12)); // 023-034: Conta corrente
  linha.push(formatarNumero('', 1)); // 035-035: Dígito da conta
  linha.push(formatarNumero('', 1)); // 036-036: Dígito da agência/conta
  linha.push(formatarTexto(parcela.beneficiario, 30)); // 037-066: Nome do favorecido
  linha.push(formatarTexto('', 200)); // 067-266: Brancos
  linha.push(formatarNumero('', 8)); // 267-274: Data de vencimento
  linha.push(formatarNumero('', 15)); // 275-289: Valor do documento
  linha.push(formatarNumero('', 15)); // 290-304: Valor do abatimento
  linha.push(formatarNumero('', 15)); // 305-319: Valor do desconto
  linha.push(formatarNumero('', 15)); // 320-334: Valor da mora
  linha.push(formatarNumero('', 15)); // 335-349: Valor da multa
  linha.push(formatarTexto('', 15)); // 350-364: Código/documento do favorecido
  linha.push(formatarNumero('', 5)); // 365-369: Brancos
  linha.push(formatarNumero('', 15)); // 370-384: Valor da retenção
  linha.push(formatarNumero('', 15)); // 385-399: Outras deduções
  linha.push(formatarNumero('', 15)); // 400-414: Abatimento não aproveitado
  linha.push(formatarNumero('', 15)); // 415-429: Valor do IOF
  linha.push(formatarNumero('', 15)); // 430-444: Valor do abatimento
  linha.push(formatarNumero('', 15)); // 445-459: Valor do desconto
  linha.push(formatarNumero('', 15)); // 460-474: Valor líquido
  linha.push(formatarNumero('', 15)); // 475-489: Valor de outras deduções
  linha.push(formatarNumero('', 15)); // 490-504: Valor de outros acréscimos
  linha.push(formatarNumero('', 15)); // 505-519: Valor líquido a pagar
  linha.push(formatarTexto('', 15)); // 520-534: Código de barras
  linha.push(formatarNumero('', 106)); // 535-640: Brancos
  
  return linha.join('');
}

/**
 * Gera registro trailer do lote (tipo 5)
 */
function gerarTrailerLote(lote: number, totalRegistros: number, totalValor: number): string {
  const linha: string[] = [];
  const valorFormatado = formatarNumero(Math.round(totalValor * 100), 15);
  
  linha.push('5'); // 001-001: Código do registro
  linha.push(formatarNumero(lote, 4)); // 002-005: Lote de serviço
  linha.push(formatarNumero('', 9)); // 006-014: Brancos
  linha.push(formatarNumero(totalRegistros, 6)); // 015-020: Quantidade de registros
  linha.push(formatarNumero('', 18)); // 021-038: Brancos
  linha.push(valorFormatado); // 039-053: Valor total
  linha.push(formatarNumero('', 18)); // 054-071: Brancos
  linha.push(formatarNumero('', 169)); // 072-240: Brancos
  
  return linha.join('');
}

/**
 * Gera registro trailer do arquivo (tipo 9)
 */
function gerarTrailerArquivo(totalLotes: number, totalRegistros: number): string {
  const linha: string[] = [];
  
  linha.push('9'); // 001-001: Código do registro
  linha.push(formatarNumero('', 9)); // 002-010: Brancos
  linha.push(formatarNumero(totalLotes, 6)); // 011-016: Total de lotes
  linha.push(formatarNumero(totalRegistros, 6)); // 017-022: Total de registros
  linha.push(formatarNumero('', 211)); // 023-233: Brancos
  linha.push(formatarNumero('', 7)); // 234-240: Brancos
  
  return linha.join('');
}

/**
 * Gera arquivo CNAB 240 completo
 */
export function gerarArquivoCNAB(
  empresa: DadosEmpresaCNAB,
  parcelas: DadosParcelaCNAB[]
): string {
  const linhas: string[] = [];
  let sequencialArquivo = 1;
  let sequencialLote = 1;
  const lote = 1;
  let totalValor = 0;
  
  // Header do arquivo
  linhas.push(gerarHeaderArquivo(empresa, sequencialArquivo++));
  
  // Header do lote
  linhas.push(gerarHeaderLote(empresa, sequencialLote++, lote));
  
  // Detalhes das parcelas
  parcelas.forEach((parcela) => {
    totalValor += parcela.valor;
    linhas.push(gerarSegmentoA(parcela, empresa, lote, sequencialLote++));
    linhas.push(gerarSegmentoB(parcela, empresa, lote, sequencialLote++));
  });
  
  // Trailer do lote
  const totalRegistrosLote = 1 + 1 + (parcelas.length * 2) + 1; // header lote + detalhes + trailer lote
  linhas.push(gerarTrailerLote(lote, totalRegistrosLote, totalValor));
  
  // Trailer do arquivo
  const totalRegistrosArquivo = linhas.length + 1; // +1 para o trailer
  linhas.push(gerarTrailerArquivo(1, totalRegistrosArquivo));
  
  return linhas.join('\r\n');
}

/**
 * Faz download do arquivo CNAB gerado
 */
export function downloadArquivoCNAB(conteudo: string, nomeArquivo: string = 'remessa_cnab.txt'): void {
  const blob = new Blob([conteudo], { type: 'text/plain;charset=windows-1252' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

