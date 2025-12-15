import { PagamentoBoleto, TipoDocumento } from "../../shared/api.js";

export type BancoDetectado = "ITAU" | "BRADESCO" | "SANTANDER" | "BANCO_DO_BRASIL" | "DESCONHECIDO";

/**
 * Normaliza o texto para facilitar extração (remove espaços extras, normaliza quebras de linha)
 */
function normalizarTexto(texto: string): string {
  return texto
    .replace(/\r/g, "")
    .replace(/[ ]+/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Detecta qual banco é baseado no texto extraído do PDF
 */
export function detectarBanco(texto: string): BancoDetectado {
  const textoUpper = texto.toUpperCase();
  
  if (textoUpper.includes("ITAU") || textoUpper.includes("ITAÚ") || textoUpper.includes("BANCO ITAU")) {
    return "ITAU";
  }
  
  if (textoUpper.includes("BRADESCO") || textoUpper.includes("BANCO BRADESCO")) {
    return "BRADESCO";
  }
  
  if (textoUpper.includes("SANTANDER") || textoUpper.includes("BANCO SANTANDER")) {
    return "SANTANDER";
  }
  
  // Banco do Brasil - detectar por SISBB, BB, ou BANCO DO BRASIL
  if (textoUpper.includes("SISBB") || 
      textoUpper.includes("BANCO DO BRASIL") || 
      textoUpper.includes("BANCO DO BRASIL SA") ||
      (textoUpper.includes(" BB ") && !textoUpper.includes("BRADESCO"))) {
    return "BANCO_DO_BRASIL";
  }
  
  return "DESCONHECIDO";
}

/**
 * Detecta o tipo de documento baseado no texto extraído do PDF
 * Ordem de detecção: Boleto (mais específico) -> TED -> Transferência -> DOC
 */
export function detectarTipoDocumento(texto: string): TipoDocumento {
  const textoUpper = texto.toUpperCase();
  
  // 1. Procurar por BOLETO primeiro (mais específico - "BoletodeCobrança", "Boleto de Cobrança")
  // Prioridade máxima para "BoletodeCobrança" ou "Boleto de Cobrança"
  if (textoUpper.includes("BOLETODECOBRANÇA") || 
      textoUpper.includes("BOLETO DE COBRANÇA") ||
      textoUpper.includes("BOLETODECOBRANCA") ||
      textoUpper.includes("BOLETO DE COBRANCA") ||
      (textoUpper.includes("COMPROVANTE DE PAGAMENTO") && textoUpper.includes("BOLETO")) ||
      textoUpper.includes("VALORDODOCUMENTO") ||
      textoUpper.includes("VALOR COBRADO") ||
      textoUpper.includes("VALORCOBRADO")) {
    console.log("  - ✅ Detectado como BOLETO (padrão 'BoletodeCobrança' ou 'Valor do documento')");
    return TipoDocumento.BOLETO;
  }
  
  // 2. Procurar por TED (específico - não confundir com "TED" dentro de outras palavras)
  // Verificar se "TED" aparece como palavra isolada ou em contexto de TED
  if ((textoUpper.includes(" TED ") || 
       textoUpper.includes("TED C") ||
       textoUpper.includes("TED-") ||
       textoUpper.startsWith("TED") ||
       textoUpper.includes("TRANSFERÊNCIA ELETRÔNICA DISPONÍVEL") ||
       textoUpper.includes("TRANSFERENCIA ELETRONICA DISPONIVEL")) &&
      !textoUpper.includes("BOLETO")) {
    return TipoDocumento.TED;
  }
  
  // 3. Procurar por Transferência de conta corrente para conta corrente
  if ((textoUpper.includes("TRANSFERÊNCIA") || 
       textoUpper.includes("TRANSFERENCIA")) &&
      (textoUpper.includes("DE CONTA CORRENTE PARA CONTA CORRENTE") ||
       textoUpper.includes("COMPROVANTE DE TRANSFERÊNCIA") ||
       textoUpper.includes("COMPROVANTE DE TRANSFERENCIA")) &&
      !textoUpper.includes("BOLETO") &&
      !textoUpper.includes("TED")) {
    return TipoDocumento.TRANSFERECIA;
  }
  
  // 4. Procurar por DOC
  if (textoUpper.includes("DOC") && 
      !textoUpper.includes("BOLETO") &&
      !textoUpper.includes("TED")) {
    return TipoDocumento.DOC;
  }
  
  // Padrão padrão é Boleto
  return TipoDocumento.BOLETO;
}

/**
 * Extrai número de identificação (linha digitável) do texto
 */
function extrairNumeroIdentificacao(texto: string): string | undefined {
  // Padrão: sequência de números com espaços ou pontos
  // Exemplo: "00190 00009 03657 223008 00043 529171 8 12760001482409"
  // ou "34191.09008 02845.122932 85988.080009 4 96060000013296"
  const padrao = /(\d{5}[.\s]?\d{5}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{5}[.\s]?\d{6}[.\s]?\d{1}[.\s]?\d{14})/;
  const match = texto.match(padrao);
  if (match) {
    return match[1].replace(/[\s.]/g, "");
  }
  return undefined;
}

/**
 * Normaliza valor monetário brasileiro para número
 */
function normalizarValor(str: string): number {
  return parseFloat(
    str
      .replace(/\s+/g, '')     // remove espaços internos
      .replace(/\.(?=\d{3})/g, '')  // remove pontos de milhares
      .replace(',', '.')       // vírgula para ponto
  );
}

/**
 * Normaliza valor monetário brasileiro para número (específico para Bradesco)
 */
function normalizarValorBradesco(str: string): number {
  return parseFloat(
    str
      .replace(/\u00A0/g, "")   // remove NBSP (espaço unicode não quebrável)
      .replace(/\.(?=\d{3})/g, "") // remove pontos de milhar
      .replace(",", ".")
      .trim()
  );
}

/**
 * Extrai valor monetário do texto
 */
function extrairValor(texto: string, label: string): number | undefined {
  // Normalizar label para regex
  const labelEscapado = label.replace(/[()]/g, "\\$&");
  
  // Regex muito tolerante para números brasileiros
  const regexValor = /(\d[\d\s\.\,]*\d)/;
  
  // Tentar múltiplos padrões
  const padroes = [
    // Padrão: "(=) Valor do documento: 1.223,02"
    new RegExp(`\\(=\\)\\s*${labelEscapado}[\\s:]*${regexValor.source}`, "i"),
    // Padrão: "Valor do documento: 1.223,02"
    new RegExp(`${labelEscapado}[\\s:]*R\\$?[\\s:]*${regexValor.source}`, "i"),
    // Padrão genérico
    new RegExp(`${labelEscapado}[\\s:]*${regexValor.source}`, "i"),
  ];
  
  for (const regex of padroes) {
    const match = texto.match(regex);
    if (match) {
      const valor = normalizarValor(match[1]);
      if (!isNaN(valor) && valor > 0) {
        return valor;
      }
    }
  }
  return undefined;
}

/**
 * Extrai data do texto (formato DD/MM/YYYY)
 */
function extrairData(texto: string, label: string): string | undefined {
  // Tentar múltiplos padrões
  const padroes = [
    new RegExp(`${label}[\\s:]*([\\d]{2}/[\\d]{2}/[\\d]{4})`, "i"),
    new RegExp(`${label}[\\s:]*([\\d]{2}\\/[\\d]{2}\\/[\\d]{4})`, "i"),
    // Padrão sem label explícito, apenas a data após o label
    new RegExp(`${label.replace(/[()]/g, "\\$&")}[\\s:]*([\\d]{2}/[\\d]{2}/[\\d]{4})`, "i"),
  ];
  
  for (const regex of padroes) {
    const match = texto.match(regex);
    if (match) {
      const [dia, mes, ano] = match[1].split("/");
      return `${ano}-${mes}-${dia}`;
    }
  }
  
  // Se não encontrou, tentar buscar qualquer data próxima ao label
  const labelIndex = texto.toLowerCase().indexOf(label.toLowerCase());
  if (labelIndex !== -1) {
    const textoProximo = texto.substring(labelIndex, labelIndex + 50);
    const regexData = /(\d{2}\/\d{2}\/\d{4})/;
    const match = textoProximo.match(regexData);
    if (match) {
      const [dia, mes, ano] = match[1].split("/");
      return `${ano}-${mes}-${dia}`;
    }
  }
  
  return undefined;
}

/**
 * Extrai CNPJ/CPF do texto
 */
function extrairCNPJ(texto: string, label: string): string | undefined {
  const regex = new RegExp(`${label}[\\s:]*([\\d]{2,3}\\.[\\d]{3}\\.[\\d]{3}/?[\\d]{4}-?[\\d]{2})`, "i");
  const match = texto.match(regex);
  if (match) {
    return match[1];
  }
  return undefined;
}

/**
 * Extrai nome/razão social do texto
 */
function extrairNome(texto: string, label: string): string | undefined {
  // Tentar múltiplos padrões
  const padroes = [
    new RegExp(`${label}[\\s:]*([^\\n\\r]+?)(?:\\s+CPF/CNPJ|\\s+CNPJ|$)`, "i"),
    new RegExp(`${label}[\\s:]*([^\\n\\r]{1,100})`, "i"),
  ];
  
  for (const regex of padroes) {
    const match = texto.match(regex);
    if (match) {
      const nome = match[1].trim();
      if (nome.length > 0 && !nome.match(/^\d+$/)) {
        return nome;
      }
    }
  }
  return undefined;
}

/**
 * Extrai agência e conta do texto
 */
function extrairAgenciaConta(texto: string): { agencia?: string; conta?: string } {
  // Padrão: "Agência: 2372-0 | Conta: 38045-8" ou "Agência/conta: 7499/25739-7"
  // Também: "Conta de débito: Agência: 2372-0 | Conta: 38045-8"
  const padrao1 = /Ag[êe]ncia[:\s]+(\d+[-]?\d*)[\s|]+Conta[:\s]+(\d+[-]?\d*)/i;
  const padrao2 = /Ag[êe]ncia\/conta[:\s]+(\d+)\/(\d+[-]?\d*)/i;
  const padrao3 = /Conta de débito[:\s]+Ag[êe]ncia[:\s]+(\d+[-]?\d*)[\s|]+Conta[:\s]+(\d+[-]?\d*)/i;
  
  let match = texto.match(padrao3);
  if (!match) {
    match = texto.match(padrao1);
  }
  if (!match) {
    match = texto.match(padrao2);
  }
  
  if (match) {
    return {
      agencia: match[1],
      conta: match[2],
    };
  }
  
  return {};
}

/**
 * Parser específico para TED do Itaú
 * Exemplo de formato:
 * Banco Itaú - Comprovante de Pagamento
 * TED C – outra titularidade
 * Identificação no extrato: SISPAG FORNECEDORES TED
 * Dados da conta debitada:
 * Nome: ITIQUIRA ENERGETICA SA
 * Agência: 4015 Conta corrente: 22393 - 8
 * Dados da TED:
 * Nome do favorecido: FUNDO MUNICIPAL DOS DIREITOS D
 * CPF/CNPJ: 12316993000194
 * Número do banco, nome e ISPB: 001 - BANCO DO BRASIL SA - ISPB 00000000
 * Agência: 0230 CAETITE BA
 * Conta corrente: 0000000282022
 * Valor da TED: R$ 11.345,73
 * Finalidade: CREDITO EM CONTA
 * Controle: 041189480000050
 * TED solicitada em 12/12/2019 às 07:06:51 via Sispag.
 */
export function parseItauTED(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse TED Itaú...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "ITAU",
    tipoDocumento: TipoDocumento.TED,
  };
  
  // Identificação no extrato
  const regexIdentificacao = /Identificação\s+no\s+extrato[:\s]+([^\n\r]+)/i;
  let match = texto.match(regexIdentificacao);
  if (match) {
    dados.numeroIdentificacao = match[1].trim();
    console.log("  - ✅ Identificação no extrato:", dados.numeroIdentificacao);
  }
  
  // Dados da conta debitada (pagador)
  const posicaoContaDebitada = texto.toLowerCase().indexOf("dados da conta debitada");
  if (posicaoContaDebitada !== -1) {
    const trechoConta = texto.substring(posicaoContaDebitada, posicaoContaDebitada + 300);
    
    // Nome do pagador
    const regexPagador = /Nome[:\s]+([^\n\r]+)/i;
    match = trechoConta.match(regexPagador);
    if (match) {
      dados.pagador = match[1].trim();
      console.log("  - ✅ Nome (pagador):", dados.pagador);
    }
    
    // Agência e conta da conta debitada
    // Padrão: "Agência: 4015 Conta corrente: 22393 - 8"
    const regexAgenciaConta = /Agência[:\s]+(\d+)\s+Conta\s+corrente[:\s]+([\d\s-]+)/i;
    match = trechoConta.match(regexAgenciaConta);
    if (match) {
      dados.agencia = match[1].trim();
      dados.conta = match[2].trim();
      console.log("  - ✅ Agência/Conta debitada:", dados.agencia, dados.conta);
    }
  }
  
  // Dados da TED (beneficiário)
  const posicaoTED = texto.toLowerCase().indexOf("dados da ted");
  if (posicaoTED !== -1) {
    const trechoTED = texto.substring(posicaoTED, posicaoTED + 800);
    
    // Nome do favorecido
    const regexFavorecido = /Nome\s+do\s+favorecido[:\s]+([^\n\r]+)/i;
    match = trechoTED.match(regexFavorecido);
    if (match) {
      dados.beneficiario = match[1].trim();
      console.log("  - ✅ Nome do favorecido:", dados.beneficiario);
    }
    
    // CPF/CNPJ do favorecido
    const regexCPFCNPJ = /CPF\/CNPJ[:\s]+([\d]{11,14})/i;
    match = trechoTED.match(regexCPFCNPJ);
    if (match) {
      dados.cnpjBeneficiario = match[1];
      console.log("  - ✅ CPF/CNPJ:", dados.cnpjBeneficiario);
    }
    
    // Banco destino: "Número do banco, nome e ISPB: 001 - BANCO DO BRASIL SA - ISPB 00000000"
    const regexBancoDestino = /Número\s+do\s+banco[,\s]+nome\s+e\s+ISPB[:\s]+(\d+)\s*-\s*([^-]+)\s*-\s*ISPB\s+(\d+)/i;
    match = trechoTED.match(regexBancoDestino);
    if (match) {
      dados.bancoDestinoNumero = match[1].trim();
      dados.bancoDestino = match[2].trim();
      dados.bancoDestinoISPB = match[3].trim();
      console.log("  - ✅ Banco destino:", dados.bancoDestino, dados.bancoDestinoNumero, dados.bancoDestinoISPB);
    }
    
    // Agência destino - pode ter cidade após o número: "Agência: 0230 CAETITE BA"
    const regexAgenciaDestino = /Agência[:\s]+(\d+)\s*([A-Z\s]+)?/i;
    match = trechoTED.match(regexAgenciaDestino);
    if (match) {
      dados.agenciaDestino = match[1].trim();
      console.log("  - ✅ Agência destino:", dados.agenciaDestino);
    }
    
    // Conta corrente destino
    const regexContaDestino = /Conta\s+corrente[:\s]+([\d-]+)/i;
    match = trechoTED.match(regexContaDestino);
    if (match) {
      dados.contaDestino = match[1].trim();
      console.log("  - ✅ Conta destino:", dados.contaDestino);
    }
  }
  
  // Valor da TED: "Valor da TED: R$ 11.345,73"
  const regexValorTED = /Valor\s+da\s+TED[:\s]*R?\$?[\s]*([\d\.]+,\d{2})/i;
  match = texto.match(regexValorTED);
  if (match) {
    const valorStr = match[1].replace(/\./g, "").replace(",", ".");
    dados.valorDocumento = parseFloat(valorStr);
    dados.valorCobrado = dados.valorDocumento;
    console.log("  - ✅ Valor da TED:", dados.valorDocumento);
  }
  
  // Finalidade
  const regexFinalidade = /Finalidade[:\s]+([^\n\r]+)/i;
  match = texto.match(regexFinalidade);
  if (match) {
    dados.finalidade = match[1].trim();
    console.log("  - ✅ Finalidade:", dados.finalidade);
  }
  
  // Controle
  const regexControle = /Controle[:\s]+([\d]+)/i;
  match = texto.match(regexControle);
  if (match) {
    dados.controle = match[1].trim();
    console.log("  - ✅ Controle:", dados.controle);
  }
  
  // Data/hora da solicitação: "TED solicitada em 12/12/2019 às 07:06:51 via Sispag."
  // Aceita com ou sem "às" e com ou sem "via Sispag"
  const regexDataHora = /TED\s+solicitada\s+em\s+(\d{2}\/\d{2}\/\d{4})\s+(?:às\s+)?(\d{2}:\d{2}:\d{2})/i;
  match = texto.match(regexDataHora);
  if (match) {
    const [dia, mes, ano] = match[1].split("/");
    const hora = match[2];
    dados.dataHoraSolicitacao = `${ano}-${mes}-${dia}T${hora}`;
    dados.dataPagamento = `${ano}-${mes}-${dia}`;
    console.log("  - ✅ Data/hora solicitação:", dados.dataHoraSolicitacao);
  }
  
  return dados;
}

/**
 * Parser específico para Boleto do Itaú
 */
export function parseItau(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse Boleto Itaú...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "ITAU",
    tipoDocumento: TipoDocumento.BOLETO,
  };

  // Número de identificação
  dados.numeroIdentificacao = extrairNumeroIdentificacao(texto);
  console.log("  - Número identificação:", dados.numeroIdentificacao || "não encontrado");

  // Agência e conta - tentar múltiplos padrões
  const { agencia, conta } = extrairAgenciaConta(texto);
  dados.agencia = agencia;
  dados.conta = conta;
  console.log("  - Agência:", dados.agencia || "não encontrado");
  console.log("  - Conta:", dados.conta || "não encontrado");

  // Beneficiário - tentar múltiplas variações
  dados.beneficiario = extrairNome(texto, "Beneficiário:") || 
                       extrairNome(texto, "Beneficiário") ||
                       extrairNome(texto, "Razão Social:");
  dados.cnpjBeneficiario = extrairCNPJ(texto, "CPF/CNPJ do beneficiário:") ||
                           extrairCNPJ(texto, "CPF/CNPJ do beneficiário") ||
                           extrairCNPJ(texto, "CNPJ/CPF do beneficiário:");
  console.log("  - Beneficiário:", dados.beneficiario || "não encontrado");
  console.log("  - CNPJ Beneficiário:", dados.cnpjBeneficiario || "não encontrado");

  // Pagador
  dados.pagador = extrairNome(texto, "Pagador:") || extrairNome(texto, "Pagador");
  console.log("  - Pagador:", dados.pagador || "não encontrado");

  // Datas
  dados.dataVencimento = extrairData(texto, "Data de vencimento:") ||
                         extrairData(texto, "Data de vencimento");
  dados.dataPagamento = extrairData(texto, "Data de pagamento:") ||
                        extrairData(texto, "Data de pagamento");
  console.log("  - Data vencimento:", dados.dataVencimento || "não encontrado");
  console.log("  - Data pagamento:", dados.dataPagamento || "não encontrado");

  // Valores serão extraídos abaixo com a solução definitiva (linha 349+)
  // TODO: Implementar extração de valores para Itaú
  
  return dados;
}

/**
 * Parser específico para Boleto do Bradesco
 */
export function parseBradescoBoleto(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse Bradesco...");
  console.log("📝 Trecho do texto para debug (datas e valores):");
  // Procurar trecho com datas e valores (aceita com ou sem espaços)
  const trechoDatas = texto.match(/vencimento[^\n]{0,100}/i)?.[0] || "";
  const trechoValores = texto.match(/Valor\s*d[eo]\s*documento[^\n]{0,100}/i)?.[0] || 
                        texto.match(/Valordodocumento[^\n]{0,100}/i)?.[0] || "";
  console.log("  - Trecho vencimento:", trechoDatas);
  console.log("  - Trecho valores:", trechoValores);
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "BRADESCO",
    tipoDocumento: TipoDocumento.BOLETO,
  };

  // Número de identificação
  dados.numeroIdentificacao = extrairNumeroIdentificacao(texto);
  console.log("  - Número identificação:", dados.numeroIdentificacao || "não encontrado");

  // Agência e conta
  const { agencia, conta } = extrairAgenciaConta(texto);
  dados.agencia = agencia;
  dados.conta = conta;
  console.log("  - Agência:", dados.agencia || "não encontrado");
  console.log("  - Conta:", dados.conta || "não encontrado");

  // Beneficiário - tentar múltiplas variações
  // Padrão: "Beneficiário:\nVEREDAS TRANSMISSORA\nDE ELETRI CNPJ/CPF: 23.776.376/0001-98"
  const regexBeneficiario = /Beneficiário[:\s]*\n?([^\n\r]+(?:\s+[^\n\r]+)*?)\s+CNPJ\/CPF[:\s]*([\d]{2,3}\.[\d]{3}\.[\d]{3}\/?[\d]{4}-?[\d]{2})/i;
  let match = texto.match(regexBeneficiario);
  if (match) {
    dados.beneficiario = match[1].trim().replace(/\s+/g, " ");
    dados.cnpjBeneficiario = match[2];
  } else {
    // Fallback para padrões anteriores
    dados.beneficiario = extrairNome(texto, "Beneficiário:") || 
                         extrairNome(texto, "Beneficiário") ||
                         extrairNome(texto, "Razão Social:");
    dados.cnpjBeneficiario = extrairCNPJ(texto, "CNPJ/CPF:") ||
                             extrairCNPJ(texto, "CNPJ/CPF") ||
                             extrairCNPJ(texto, "CNPJ/CPF do beneficiário:") ||
                             extrairCNPJ(texto, "CPF/CNPJ:");
  }
  console.log("  - Beneficiário:", dados.beneficiario || "não encontrado");
  console.log("  - CNPJ Beneficiário:", dados.cnpjBeneficiario || "não encontrado");

  // Pagador - padrão: "Pagador: VISTA ALEGRE XIX ENERGIA SPE L | CNPJ: 48.177.875/0001-90"
  const regexPagador = /Pagador[:\s]+([^\n\r|]+?)\s*[|\s]*CNPJ[:\s]*([\d]{2,3}\.[\d]{3}\.[\d]{3}\/?[\d]{4}-?[\d]{2})/i;
  match = texto.match(regexPagador);
  if (match) {
    dados.pagador = match[1].trim();
  } else {
    dados.pagador = extrairNome(texto, "Pagador:") || extrairNome(texto, "Pagador");
  }
  console.log("  - Pagador:", dados.pagador || "não encontrado");

  // Datas - tentar múltiplas variações e padrões mais flexíveis
  dados.dataVencimento = extrairData(texto, "Data de vencimento:") ||
                         extrairData(texto, "Data de vencimento") ||
                         extrairData(texto, "vencimento:");
  
  dados.dataPagamento = extrairData(texto, "Data de pagamento:") ||
                        extrairData(texto, "Data de pagamento") ||
                        extrairData(texto, "pagamento:");
  
  // Se ainda não encontrou, tentar padrão mais genérico (apenas "vencimento:" ou "pagamento:")
  if (!dados.dataVencimento) {
    const regexVencimento = /vencimento[:\s]+(\d{2}\/\d{2}\/\d{4})/i;
    const match = texto.match(regexVencimento);
    if (match) {
      const [dia, mes, ano] = match[1].split("/");
      dados.dataVencimento = `${ano}-${mes}-${dia}`;
    }
  }
  
  if (!dados.dataPagamento) {
    const regexPagamento = /pagamento[:\s]+(\d{2}\/\d{2}\/\d{4})/i;
    const match = texto.match(regexPagamento);
    if (match) {
      const [dia, mes, ano] = match[1].split("/");
      dados.dataPagamento = `${ano}-${mes}-${dia}`;
    }
  }
  
  console.log("  - Data vencimento:", dados.dataVencimento || "não encontrado");
  console.log("  - Data pagamento:", dados.dataPagamento || "não encontrado");

  // Valores - Solução definitiva para Bradesco (texto colado sem espaços)
  console.log("  - ========================================");
  console.log("  - 🎯 INICIANDO EXTRAÇÃO DE VALORES (BRADESCO)");
  console.log("  - ========================================");
  
  // Log do trecho do texto que contém "Valor" para debug
  const trechoValor = texto.match(/.{0,300}Valor.{0,300}/gi);
  if (trechoValor) {
    console.log("  - 📋 Trecho do texto contendo 'Valor':", JSON.stringify(trechoValor[0]));
  } else {
    console.log("  - ⚠️ Nenhum trecho com 'Valor' encontrado");
  }
  
  // Função para normalizar valor (remove pontos de milhar e converte vírgula para ponto)
  function parseValor(str: string): number {
    return parseFloat(
      str.replace(/\./g, "").replace(",", ".")
    );
  }
  
  // Regex específico para o formato exato do Bradesco: (=)Valordodocumento:402,52
  // O texto está colado sem espaços: "Valordodocumento" (não "Valor do documento")
  // IMPORTANTE: O texto pode estar em qualquer case, então usamos flag 'i' (case-insensitive)
  // O padrão é: (=)Valordodocumento:402,52 (sem espaço após os parênteses)
  const regexValorDocumento = /\(=\)\s*Valordodocumento[:\s]*([\d\.]+,\d{2})/i;
  const regexValorCobrado = /\(=\)\s*Valorcobrado[:\s]*([\d\.]+,\d{2})/i;
  
  console.log("  - 🔍 Testando regex no texto...");
  console.log("  - 📏 Tamanho do texto:", texto.length);
  
  // Buscar "Valor do documento"
  let m = texto.match(regexValorDocumento);
  if (m && m[1]) {
    console.log("  - ✅ Match encontrado para 'Valor do documento':", JSON.stringify(m[0]));
    console.log("  - Valor capturado (raw):", JSON.stringify(m[1]));
    dados.valorDocumento = parseValor(m[1]);
    console.log("  - ✅ Valor documento normalizado:", dados.valorDocumento);
  } else {
    console.log("  - ⚠️ Regex não encontrou 'Valor do documento'");
    // Debug: verificar se o texto contém a string exata
    const index = texto.toLowerCase().indexOf("valordodocumento");
    if (index !== -1) {
      console.log("  - ✅ Encontrado 'valordodocumento' na posição:", index);
      const trecho = texto.substring(Math.max(0, index - 5), index + 50);
      console.log("  - Trecho completo encontrado:", JSON.stringify(trecho));
      // Tentar extrair manualmente - procurar o padrão (=)Valordodocumento:402,52
      const valorMatch = trecho.match(/\(=\)\s*Valordodocumento[:\s]*([\d\.]+,\d{2})/i);
      if (valorMatch && valorMatch[1]) {
        console.log("  - ✅ Valor encontrado manualmente:", JSON.stringify(valorMatch[1]));
        dados.valorDocumento = parseValor(valorMatch[1]);
        console.log("  - ✅ Valor documento extraído manualmente:", dados.valorDocumento);
      } else {
        // Tentar apenas o número após os dois pontos
        const valorMatch2 = trecho.match(/[:\s]+([\d\.]+,\d{2})/);
        if (valorMatch2 && valorMatch2[1]) {
          console.log("  - ✅ Valor encontrado (fallback):", JSON.stringify(valorMatch2[1]));
          dados.valorDocumento = parseValor(valorMatch2[1]);
          console.log("  - ✅ Valor documento extraído (fallback):", dados.valorDocumento);
        }
      }
    } else {
      console.log("  - ❌ 'valordodocumento' não encontrado no texto");
    }
  }
  
  // Buscar "Valor cobrado"
  m = texto.match(regexValorCobrado);
  if (m && m[1]) {
    console.log("  - ✅ Match encontrado para 'Valor cobrado':", JSON.stringify(m[0]));
    console.log("  - Valor capturado (raw):", JSON.stringify(m[1]));
    dados.valorCobrado = parseValor(m[1]);
    console.log("  - ✅ Valor cobrado normalizado:", dados.valorCobrado);
  } else {
    console.log("  - ⚠️ Regex não encontrou 'Valor cobrado'");
    // Debug: verificar se o texto contém a string exata
    const index = texto.toLowerCase().indexOf("valorcobrado");
    if (index !== -1) {
      console.log("  - ✅ Encontrado 'valorcobrado' na posição:", index);
      const trecho = texto.substring(Math.max(0, index - 5), index + 50);
      console.log("  - Trecho completo encontrado:", JSON.stringify(trecho));
      // Tentar extrair manualmente - procurar o padrão (=)Valorcobrado:402,52
      const valorMatch = trecho.match(/\(=\)\s*Valorcobrado[:\s]*([\d\.]+,\d{2})/i);
      if (valorMatch && valorMatch[1]) {
        console.log("  - ✅ Valor encontrado manualmente:", JSON.stringify(valorMatch[1]));
        dados.valorCobrado = parseValor(valorMatch[1]);
        console.log("  - ✅ Valor cobrado extraído manualmente:", dados.valorCobrado);
      } else {
        // Tentar apenas o número após os dois pontos
        const valorMatch2 = trecho.match(/[:\s]+([\d\.]+,\d{2})/);
        if (valorMatch2 && valorMatch2[1]) {
          console.log("  - ✅ Valor encontrado (fallback):", JSON.stringify(valorMatch2[1]));
          dados.valorCobrado = parseValor(valorMatch2[1]);
          console.log("  - ✅ Valor cobrado extraído (fallback):", dados.valorCobrado);
        }
      }
    } else {
      console.log("  - ❌ 'valorcobrado' não encontrado no texto");
    }
  }
  
  console.log("  - Valor documento final:", dados.valorDocumento || "❌ não encontrado");
  console.log("  - Valor cobrado final:", dados.valorCobrado || "❌ não encontrado");

  return dados;
}

/**
 * Parser específico para Transferência do Bradesco
 */
export function parseBradescoTransferencia(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse Transferência Bradesco...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "BRADESCO",
    tipoDocumento: TipoDocumento.TRANSFERECIA,
  };
  
  // TODO: Implementar quando tivermos o layout do Bradesco
  console.log("  - ⚠️ Parser Transferência Bradesco - Aguardando layout");
  
  return dados;
}

/**
 * Parser específico para TED do Bradesco
 */
export function parseBradescoTED(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse TED Bradesco...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "BRADESCO",
    tipoDocumento: TipoDocumento.TED,
  };
  
  // TODO: Implementar quando tivermos o layout do Bradesco
  console.log("  - ⚠️ Parser TED Bradesco - Aguardando layout");
  
  return dados;
}

/**
 * Parser específico para Transferência do Santander
 */
export function parseSantanderTransferencia(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse Transferência Santander...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "SANTANDER",
    tipoDocumento: TipoDocumento.TRANSFERECIA,
  };
  
  // TODO: Implementar quando tivermos o layout do Santander
  console.log("  - ⚠️ Parser Transferência Santander - Aguardando layout");
  
  return dados;
}

/**
 * Parser específico para TED do Santander
 */
export function parseSantanderTED(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse TED Santander...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "SANTANDER",
    tipoDocumento: TipoDocumento.TED,
  };
  
  // TODO: Implementar quando tivermos o layout do Santander
  console.log("  - ⚠️ Parser TED Santander - Aguardando layout");
  
  return dados;
}

/**
 * Parser específico para Boleto do Santander
 */
export function parseSantanderBoleto(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse Boleto Santander...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "SANTANDER",
    tipoDocumento: TipoDocumento.BOLETO,
  };
  
  // TODO: Implementar quando tivermos o layout do Santander
  console.log("  - ⚠️ Parser Boleto Santander - Aguardando layout");
  
  return dados;
}

/**
 * Parser específico para documentos do Banco do Brasil (SISBB)
 * Formato exemplo:
 * FAVORECIDO: SANDRA DOS SANTOS FERREIRA LIMA 001
 * CPF/CNPJ: 25.204.641/0001-99
 * VALOR: R$ 112,00
 * DEBITO EM: 11/02/2022
 * DOCUMENTO: 021101
 * AUTENTICACAO SISBB: 9.6A6.CE6.12C.710.D24
 */
export function parseBancoDoBrasil(texto: string): Partial<PagamentoBoleto> {
  console.log("🔍 Iniciando parse Banco do Brasil (SISBB)...");
  
  const dados: Partial<PagamentoBoleto> = {
    banco: "BANCO_DO_BRASIL",
  };
  
  // Detectar tipo de documento (DOC, TED, Transferência)
  const tipoDocumento = detectarTipoDocumento(texto);
  dados.tipoDocumento = tipoDocumento;
  console.log("  - ✅ Tipo documento:", tipoDocumento);
  
  // FAVORECIDO: SANDRA DOS SANTOS FERREIRA LIMA 001
  const regexFavorecido = /FAVORECIDO[:\s]+([^\n\r]+)/i;
  let match = texto.match(regexFavorecido);
  if (match) {
    dados.beneficiario = match[1].trim();
    console.log("  - ✅ Favorecido:", dados.beneficiario);
  }
  
  // CPF/CNPJ: 25.204.641/0001-99
  const regexCPFCNPJ = /CPF\/CNPJ[:\s]+([\d.\/\-]+)/i;
  match = texto.match(regexCPFCNPJ);
  if (match) {
    dados.cnpjBeneficiario = match[1].trim();
    console.log("  - ✅ CPF/CNPJ:", dados.cnpjBeneficiario);
  }
  
  // VALOR: R$ 112,00
  const regexValor = /VALOR[:\s]*R?\$?[\s]*([\d\.]+,\d{2})/i;
  match = texto.match(regexValor);
  if (match) {
    const valorStr = match[1].replace(/\./g, "").replace(",", ".");
    dados.valorDocumento = parseFloat(valorStr);
    dados.valorCobrado = dados.valorDocumento;
    console.log("  - ✅ Valor:", dados.valorDocumento);
  }
  
  // DEBITO EM: 11/02/2022
  const regexDataDebito = /DEBITO\s+EM[:\s]+(\d{2}\/\d{2}\/\d{4})/i;
  match = texto.match(regexDataDebito);
  if (match) {
    const [dia, mes, ano] = match[1].split("/");
    dados.dataPagamento = `${ano}-${mes}-${dia}`;
    console.log("  - ✅ Data de débito:", dados.dataPagamento);
  }
  
  // DOCUMENTO: 021101
  const regexDocumento = /DOCUMENTO[:\s]+([\d]+)/i;
  match = texto.match(regexDocumento);
  if (match) {
    dados.numeroIdentificacao = match[1].trim();
    console.log("  - ✅ Número do documento:", dados.numeroIdentificacao);
  }
  
  // AUTENTICACAO SISBB: 9.6A6.CE6.12C.710.D24
  const regexAutenticacao = /AUTENTICACAO\s+SISBB[:\s]+([^\n\r]+)/i;
  match = texto.match(regexAutenticacao);
  if (match) {
    // Armazenar autenticação no controle se disponível
    dados.controle = match[1].trim();
    console.log("  - ✅ Autenticação SISBB:", dados.controle);
  }
  
  return dados;
}

/**
 * Função principal para processar texto extraído do PDF
 * Lógica: 1) Detectar banco, 2) Detectar tipo de documento, 3) Extrair dados específicos
 */
export function processarTextoPDF(texto: string): {
  banco: BancoDetectado;
  dados: Partial<PagamentoBoleto>;
} {
  console.log("=".repeat(80));
  console.log("🔎 PROCESSANDO TEXTO DO PDF");
  console.log("=".repeat(80));
  console.log("📝 Primeiros 1000 caracteres do texto:");
  console.log(texto.substring(0, 1000));
  console.log("=".repeat(80));
  
  // PASSO 1: Detectar o banco
  const banco = detectarBanco(texto);
  console.log("🏦 PASSO 1 - Banco detectado:", banco);
  
  // PASSO 2: Detectar o tipo de documento
  const tipoDocumento = detectarTipoDocumento(texto);
  console.log("📄 PASSO 2 - Tipo de documento detectado:", tipoDocumento);
  
  // Debug: verificar se o texto contém palavras-chave
  const textoUpper = texto.toUpperCase();
  console.log("  - Contém 'BOLETODECOBRANÇA'?", textoUpper.includes("BOLETODECOBRANÇA") || textoUpper.includes("BOLETODECOBRANCA"));
  console.log("  - Contém 'VALORDODOCUMENTO'?", textoUpper.includes("VALORDODOCUMENTO"));
  console.log("  - Contém 'TED'?", textoUpper.includes("TED"));
  console.log("  - Contém 'TRANSFERENCIA'?", textoUpper.includes("TRANSFERENCIA") || textoUpper.includes("TRANSFERÊNCIA"));
  console.log("  - Contém 'SISBB'?", textoUpper.includes("SISBB"));
  
  // PASSO 3: Extrair dados específicos baseado em banco + tipo
  let dados: Partial<PagamentoBoleto>;
  
  if (banco === "ITAU") {
    if (tipoDocumento === TipoDocumento.TED) {
      dados = parseItauTED(texto);
    } else if (tipoDocumento === TipoDocumento.BOLETO) {
      dados = parseItau(texto);
    } else {
      // Fallback para outros tipos
      dados = parseItau(texto);
      dados.tipoDocumento = tipoDocumento;
    }
  } else if (banco === "BRADESCO") {
    if (tipoDocumento === TipoDocumento.TED) {
      dados = parseBradescoTED(texto);
    } else if (tipoDocumento === TipoDocumento.TRANSFERECIA) {
      dados = parseBradescoTransferencia(texto);
    } else if (tipoDocumento === TipoDocumento.BOLETO) {
      dados = parseBradescoBoleto(texto);
    } else {
      // Fallback para DOC ou outros tipos
      dados = parseBradescoBoleto(texto);
      dados.tipoDocumento = tipoDocumento;
    }
  } else if (banco === "BANCO_DO_BRASIL") {
    dados = parseBancoDoBrasil(texto);
  } else {
    console.log("⚠️ Banco desconhecido, tentando extrair dados genéricos...");
    dados = {
      tipoDocumento: tipoDocumento,
      banco: "DESCONHECIDO",
    };
    // Tentar extrair dados mesmo sem banco específico
    dados.numeroIdentificacao = extrairNumeroIdentificacao(texto);
    const { agencia, conta } = extrairAgenciaConta(texto);
    dados.agencia = agencia;
    dados.conta = conta;
    dados.beneficiario = extrairNome(texto, "Beneficiário");
    dados.pagador = extrairNome(texto, "Pagador");
    dados.dataVencimento = extrairData(texto, "vencimento");
    dados.dataPagamento = extrairData(texto, "pagamento");
    dados.valorDocumento = extrairValor(texto, "valor");
    dados.valorCobrado = extrairValor(texto, "cobrado");
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ EXTRAÇÃO DE DADOS CONCLUÍDA");
  console.log("=".repeat(80));
  console.log("📊 Resumo dos dados extraídos:");
  console.log("  • Banco:", banco);
  console.log("  • Tipo Documento:", dados.tipoDocumento || "não informado");
  console.log("  • Agência:", dados.agencia || "não encontrado");
  console.log("  • Conta:", dados.conta || "não encontrado");
  console.log("  • Número Identificação:", dados.numeroIdentificacao || "não encontrado");
  console.log("  • Beneficiário:", dados.beneficiario || "não encontrado");
  console.log("  • CNPJ Beneficiário:", dados.cnpjBeneficiario || "não encontrado");
  console.log("  • Pagador:", dados.pagador || "não encontrado");
  console.log("  • Data Vencimento:", dados.dataVencimento || "não encontrado");
  console.log("  • Data Pagamento:", dados.dataPagamento || "não encontrado");
  console.log("  • Valor Documento:", dados.valorDocumento || "não encontrado");
  console.log("  • Valor Cobrado:", dados.valorCobrado || "não encontrado");
  console.log("=".repeat(80));
  console.log("📦 JSON completo dos dados:");
  console.log(JSON.stringify(dados, null, 2));
  console.log("=".repeat(80) + "\n");
  
  return { banco, dados };
}


