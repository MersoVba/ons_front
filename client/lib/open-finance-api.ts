/**
 * API para Open Finance - Simulação de Pagamentos
 */

import { API_BASE_URL, API_BASE_URL_WITHOUT_VERSION } from './api-config';
import { AuthAPI } from './auth-api';

export interface IniciarPagamentoParcelaRequest {
  parcelaId: number;
  tipoPagamento?: "BOLETO" | "PIX" | "TED" | "DOC" | "DEBITO_AUTOMATICO" | "TRANSFERENCIA_INTERNA";
  valor?: number;
}

export interface IniciarPagamentoParcelaResponse {
  pagamentoId: number;
  externalPaymentId: string;
  tipoPagamento: string;
  status: "PENDENTE_BANCO" | "CONFIRMADO" | "FALHOU" | "CRIADO";
}

export interface FaturaComValor {
  faturaId: number;
  valorDocumento: number;
}

export interface IniciarPagamentoFaturasRequest {
  faturaIds: number[];
  faturasComValor: FaturaComValor[];
}

export interface IniciarPagamentoFaturasResponse {
  pagamentoId: number;
  externalPaymentId: string;
  tipoPagamento: string;
  status: "PENDENTE_BANCO" | "CONFIRMADO" | "FALHOU" | "CRIADO";
  faturasProcessadas: number;
}

export interface StatusSimulacao {
  enabled: boolean;
  tempoProcessamentoSegundos: number;
  taxaSucesso: number;
  intervaloSchedulerSegundos: number;
  cenarioPadrao: string;
}

export class OpenFinanceAPI {
  /**
   * Inicia um pagamento de parcela via Open Finance
   */
  static async iniciarPagamento(
    request: IniciarPagamentoParcelaRequest
  ): Promise<IniciarPagamentoParcelaResponse> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(`${API_BASE_URL_WITHOUT_VERSION}/openfinance/parcelas/pagar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro ao iniciar pagamento' }));
      throw new Error(error.message || 'Erro ao iniciar pagamento');
    }

    return await response.json();
  }

  /**
   * Processa um pagamento manualmente
   */
  static async processarPagamentoManual(externalPaymentId: string): Promise<string> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/openfinance/simulacao/processar/${externalPaymentId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao processar pagamento');
    }

    return await response.text();
  }

  /**
   * Processa um pagamento com cenário específico
   */
  static async processarComCenario(
    externalPaymentId: string,
    cenario: string
  ): Promise<string> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/openfinance/simulacao/processar/${externalPaymentId}/cenario/${cenario}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao processar pagamento com cenário');
    }

    return await response.text();
  }

  /**
   * Processa todos os pagamentos pendentes
   */
  static async processarTodos(): Promise<{ processados: number }> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/openfinance/simulacao/processar-todos`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao processar todos os pagamentos');
    }

    return await response.json();
  }

  /**
   * Obtém o status da simulação
   */
  static async obterStatusSimulacao(): Promise<StatusSimulacao> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/openfinance/simulacao/status`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao obter status da simulação');
    }

    return await response.json();
  }

  /**
   * Lista os cenários disponíveis
   */
  static async listarCenarios(): Promise<string[]> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/openfinance/simulacao/cenarios`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao listar cenários');
    }

    return await response.json();
  }

  /**
   * Inicia pagamento de faturas via Open Finance
   * Endpoint: POST /api/openfinance/faturas/pagar
   * Body: { "faturaIds": [0] }
   */
  static async pagarFaturas(
    request: IniciarPagamentoFaturasRequest
  ): Promise<IniciarPagamentoFaturasResponse> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    // Endpoint: POST /api/openfinance/faturas/pagar
    // API_BASE_URL já inclui /api/v1, então precisamos usar a URL base sem /api/v1 e adicionar /api
    // Ou usar API_BASE_URL que já tem /api/v1 e o endpoint será /api/v1/openfinance/faturas/pagar
    // Mas o endpoint correto é /api/openfinance/faturas/pagar
    // Vamos usar API_BASE_URL_WITHOUT_VERSION e adicionar /api
    const baseUrl = API_BASE_URL_WITHOUT_VERSION.endsWith('/') 
      ? API_BASE_URL_WITHOUT_VERSION.slice(0, -1) 
      : API_BASE_URL_WITHOUT_VERSION;
    const url = `${baseUrl}/api/openfinance/faturas/pagar`;
    
    console.log('🔗 URL do pagamento de faturas:', url);
    console.log('📦 Body enviado:', { 
      faturaIds: request.faturaIds,
      faturasComValor: request.faturasComValor 
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanToken}`,
      },
      body: JSON.stringify({
        faturaIds: request.faturaIds,
        faturasComValor: request.faturasComValor
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro ao iniciar pagamento de faturas' }));
      throw new Error(error.message || 'Erro ao iniciar pagamento de faturas');
    }

    return await response.json();
  }

  /**
   * Verifica o status de um pagamento (polling)
   * Nota: Este endpoint precisa ser implementado no backend ou usar o endpoint de pagamentos existente
   */
  static async verificarStatusPagamento(pagamentoId: number): Promise<any> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    // Assumindo que existe um endpoint para buscar pagamento por ID
    const response = await fetch(
      `${API_BASE_URL}/pagamentos/${pagamentoId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erro ao verificar status do pagamento');
    }

    return await response.json();
  }
}

