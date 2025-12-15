import {
  LoginRequest,
  AuthenticationResponse,
  MfaSetupResponse,
  MfaVerificationRequest,
  MfaEnableRequest,
  MfaDisableRequest,
  MfaStatusResponse,
} from "@shared/api";

import { API_BASE_URL } from './api-config';

/**
 * Serviço de autenticação e MFA
 */
export class AuthAPI {
  /**
   * Realiza login do usuário
   */
  static async login(credentials: LoginRequest): Promise<AuthenticationResponse> {
    // O backend espera: username, senha
    const response = await fetch(`${API_BASE_URL}/login/autenticacao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: credentials.username,
        senha: credentials.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao fazer login" }));
      throw new Error(error.message || "Erro ao fazer login");
    }

    const data = await response.json();
    // O backend retorna: token, firstAccess
    // Não estamos mais usando 2FA, então sempre retornamos mfaRequired como false
    return {
      token: data.token,
      firstAccess: data.firstAccess,
      mfaRequired: false, // 2FA desabilitado
    };
  }

  /**
   * Valida código 2FA durante o login
   */
  static async validateTotp(request: MfaVerificationRequest): Promise<AuthenticationResponse> {
    // O backend espera: codigo2Fator, timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch(`${API_BASE_URL}/login/validar-codigo-2FA`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codigo2Fator: request.codigoTotp,
        timezone: timezone,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Código inválido" }));
      throw new Error(error.message || "Código inválido");
    }

    const data = await response.json();
    // O backend retorna: token, firstAccess
    return {
      token: data.token,
      firstAccess: data.firstAccess,
    };
  }

  /**
   * Obtém configuração de MFA (QR Code e secret)
   */
  static async getMfaSetup(): Promise<MfaSetupResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Usuário não autenticado");
    }

    const response = await fetch(`${API_BASE_URL}/mfa/setup`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao obter configuração MFA" }));
      throw new Error(error.message || "Erro ao obter configuração MFA");
    }

    return response.json();
  }

  /**
   * Habilita MFA após verificar código TOTP
   */
  static async enableMfa(request: MfaEnableRequest): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Usuário não autenticado");
    }

    const response = await fetch(`${API_BASE_URL}/mfa/enable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao habilitar MFA" }));
      throw new Error(error.message || "Erro ao habilitar MFA");
    }
  }

  /**
   * Desabilita MFA
   */
  static async disableMfa(request: MfaDisableRequest): Promise<void> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Usuário não autenticado");
    }

    const response = await fetch(`${API_BASE_URL}/mfa/disable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao desabilitar MFA" }));
      throw new Error(error.message || "Erro ao desabilitar MFA");
    }
  }

  /**
   * Verifica status do MFA
   */
  static async getMfaStatus(): Promise<MfaStatusResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Usuário não autenticado");
    }

    const response = await fetch(`${API_BASE_URL}/mfa/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao verificar status MFA" }));
      throw new Error(error.message || "Erro ao verificar status MFA");
    }

    return response.json();
  }

  /**
   * Obtém token do localStorage
   */
  static getToken(): string | null {
    try {
      const authUser = JSON.parse(localStorage.getItem("authUser") || "null");
      const token = authUser?.token || null;
      // Validar formato do token (JWT não deve conter dois pontos fora do formato padrão)
      if (token && typeof token === 'string') {
        // JWT tem formato: header.payload.signature (3 partes separadas por ponto)
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.error('Token JWT inválido: formato incorreto');
          return null;
        }
        // Verificar se não há caracteres inválidos (dois pontos podem aparecer apenas em URLs codificadas)
        // Remover qualquer espaço em branco
        return token.trim();
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter token:', error);
      return null;
    }
  }

  /**
   * Salva token no localStorage
   */
  static saveToken(token: string, email: string, accessType?: string): void {
    const authUser = { email, token, accessType };
    localStorage.setItem("authUser", JSON.stringify(authUser));
  }

  /**
   * Remove token do localStorage
   */
  static clearToken(): void {
    localStorage.removeItem("authUser");
  }
}

