/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Tipos para Pagamento de Boleto
 */
export enum TipoDocumento {
  BOLETO = "BOLETO",
  TED = "TED",
  TRANSFERECIA = "TRANSFERECIA",
  DOC = "DOC",
}

export interface PagamentoBoleto {
  id?: string;
  agencia?: string;
  conta?: string;
  banco?: string;
  pagador?: string;
  beneficiario?: string;
  cnpjBeneficiario?: string;
  numeroIdentificacao?: string;
  dataVencimento?: string; // ISO date string
  dataPagamento?: string; // ISO date string
  valorDocumento?: number;
  valorCobrado?: number;
  tipoDocumento?: TipoDocumento;
  criadoEm?: string; // ISO datetime string
  // Campos específicos para TED
  bancoDestino?: string; // Nome do banco destino
  bancoDestinoNumero?: string; // Número do banco destino
  bancoDestinoISPB?: string; // ISPB do banco destino
  agenciaDestino?: string; // Agência do banco destino
  contaDestino?: string; // Conta do banco destino
  finalidade?: string; // Finalidade da TED
  controle?: string; // Controle da TED
  dataHoraSolicitacao?: string; // Data/hora da solicitação da TED
}

export interface ProcessarComprovanteRequest {
  pdfBase64: string;
  nomeArquivo: string;
}

export interface ProcessarComprovanteResponse {
  sucesso: boolean;
  dados?: PagamentoBoleto;
  bancoDetectado?: "ITAU" | "BRADESCO" | "SANTANDER" | "BANCO_DO_BRASIL" | "DESCONHECIDO";
  erro?: string;
}

export interface ComprovantePagamentoRequest {
  banco: string;
  tipoDocumento: TipoDocumento;
  numeroIdentificacao?: string;
  agencia?: string;
  conta?: string;
  beneficiario?: string;
  cnpjBeneficiario?: string;
  pagador?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  valorDocumento?: number;
  valorCobrado?: number;
  cnpjPagador: string;
  pdfBase64: string;
  nomeArquivo: string;
  dadosExtraidos?: PagamentoBoleto; // Para campos específicos de TED
}

export interface ComprovantePagamentoResponse {
  mensagem: string;
  dataEnvioComprovante: string;
  linkDocumento?: string;
}

/**
 * Tipos para Autenticação e MFA
 */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthenticationResponse {
  token?: string;
  mfaRequired?: boolean;
  firstAccess?: boolean;
  message?: string;
}

export interface MfaSetupResponse {
  qrCodeBase64: string;
  secret: string;
  manualEntryKey: string;
}

export interface MfaVerificationRequest {
  codigoTotp: string;
  username?: string;
}

export interface MfaEnableRequest {
  codigoTotp: string;
}

export interface MfaDisableRequest {
  username: string;
  codigoTotp: string;
}

export interface MfaStatusResponse {
  habilitado: boolean;
}
