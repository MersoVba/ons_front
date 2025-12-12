import {
  LoginRequest,
  AuthenticationResponse,
  MfaSetupResponse,
  MfaVerificationRequest,
  MfaEnableRequest,
  MfaDisableRequest,
  MfaStatusResponse,
} from "@shared/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

/**
 * Serviço de autenticação e MFA
 */
export class AuthAPI {
  /**
   * Realiza login do usuário
   */
  static async login(credentials: LoginRequest): Promise<AuthenticationResponse> {
    const response = await fetch(`${API_BASE_URL}/login/autenticacao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erro ao fazer login" }));
      throw new Error(error.message || "Erro ao fazer login");
    }

    return response.json();
  }

  /**
   * Valida código TOTP durante o login
   */
  static async validateTotp(request: MfaVerificationRequest): Promise<AuthenticationResponse> {
    const response = await fetch(`${API_BASE_URL}/login/validar-totp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Código inválido" }));
      throw new Error(error.message || "Código inválido");
    }

    return response.json();
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
      return authUser?.token || null;
    } catch {
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

