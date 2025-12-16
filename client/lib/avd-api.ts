/**
 * API para Aviso de Débito (AVD)
 * Endpoints relacionados a usuárias, parcelas e pagamentos
 */

import { API_BASE_URL, API_BASE_URL_WITHOUT_VERSION } from './api-config';

// Interface para Parcela conforme resposta da API
export interface ParcelaResponse {
  id?: number; // API pode retornar como "id"
  cdParcela?: number; // Ou como "cdParcela"
  numParcela?: number;
  dataVencimento?: string; // Formato: "2025-05-05"
  valor?: number;
  status?: string | null;
  enderecoComprovante?: string | null;
  idPagamento?: number | null;
}

// Interface para Fatura conforme resposta da API
export interface FaturaResponse {
  cdFatura?: number;
  cnpjTransmissora?: string;
  cnpjUsuaria?: string;
  codigoTransmissora?: string;
  codigoUsuaria?: string;
  usuaria?: string;
  statusFatura?: string;
  transmissora?: string;
  tributos?: number;
  valorTotal?: number;
  valorDivergente?: number; // Valor divergente (inadimplência) da fatura
  parcelas?: ParcelaResponse[];
}

export interface IntegracaoUsuariaTransmissoraResponse {
  // Dados da Transmissora
  cdTransmissora?: number;
  transmissora?: string;
  cnpjTransmissora?: string;
  
  // Dados da Usuária
  cdUsuaria?: number;
  usuaria?: string;
  cnpjUsuaria?: string;
  codigoUsuaria?: string;
  tributos?: number;
  valorTotal?: number;
  
  // Dados da Parcela
  cdParcela?: number;
  numParcela?: number;
  dataVencimento?: string; // ISO date string
  valor?: number;
  
  // Dados do Pagamento (opcional)
  cdPagamento?: number;
  beneficiario?: string;
  cnpjBeneficiario?: string;
  dataPagamento?: string; // ISO date string
  diasVencimentoPagamento?: number;
  tipoDocumento?: string;
  valorDivergente?: number;
  valorDocumento?: number;
}

export class AvdAPI {
  /**
   * Busca usuárias com suas parcelas e pagamentos por CNPJ da usuária
   * @param cnpjUsuaria CNPJ da usuária
   * @param pagina Número da página (começando em 0)
   * @param quantidade Quantidade de itens por página
   * @param ordem ASC ou DESC
   * @param ordenarPor Campo para ordenação
   */
  static async obterUsuariaComTransmissorasParcelasEPagamentos(
    cnpjUsuaria: string,
    pagina: number = 0,
    quantidade: number = 5,
    ordem: string = "ASC",
    ordenarPor: string = "transmissora"
  ): Promise<IntegracaoUsuariaTransmissoraResponse[]> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');
    
    const params = new URLSearchParams({
      pagina: pagina.toString(),
      quantidade: quantidade.toString(),
      ordem: ordem.toUpperCase(),
      ordenarPor: ordenarPor
    });

    const response = await fetch(
      `${API_BASE_URL}/integracoes/usuaria/${encodeURIComponent(cnpjUsuaria)}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao buscar faturas" }));
      throw new Error(error.message || "Erro ao buscar faturas");
    }

    return await response.json();
  }

  /**
   * Busca todas as faturas com suas respectivas parcelas
   * Endpoint: GET /ons-api/faturas
   * 
   * @param pagina Número da página (começando em 0)
   * @param quantidade Quantidade de itens por página
   * @param ordem ASC ou DESC
   * @param ordenarPor Campo para ordenação (ex: transmissora)
   */
  static async obterTodasFaturas(
    pagina: number = 0,
    quantidade: number = 5,
    ordem: string = "ASC",
    ordenarPor: string = "transmissora"
  ): Promise<FaturaResponse[]> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');
    
    const params = new URLSearchParams({
      pagina: pagina.toString(),
      quantidade: quantidade.toString(),
      ordem: ordem.toUpperCase(),
      ordenarPor: ordenarPor
    });

    // O endpoint é /ons-api/faturas (sem /api/v1)
    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/faturas?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao buscar faturas" }));
      throw new Error(error.message || "Erro ao buscar faturas");
    }

    return await response.json();
  }

  /**
   * Busca todas as usuárias (método auxiliar, se necessário)
   */
  static async obterTodasUsuarias(
    pagina: number = 0,
    quantidade: number = 100,
    ordem: string = "ASC",
    ordenarPor: string = "transmissora"
  ): Promise<any[]> {
    const token = this.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');
    
    const params = new URLSearchParams({
      pagina: pagina.toString(),
      quantidade: quantidade.toString(),
      ordem: ordem.toUpperCase(),
      ordenarPor: ordenarPor
    });

    const response = await fetch(
      `${API_BASE_URL_WITHOUT_VERSION}/faturas?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cleanToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao buscar usuárias" }));
      throw new Error(error.message || "Erro ao buscar usuárias");
    }

    return await response.json();
  }

  private static getToken(): string | null {
    try {
      const authUser = localStorage.getItem('authUser');
      if (!authUser) return null;
      
      const user = JSON.parse(authUser);
      return user.token || null;
    } catch {
      return null;
    }
  }
}

