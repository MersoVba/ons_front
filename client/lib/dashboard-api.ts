/**
 * API para Dashboard - Métricas AVC e AVD
 */

import { API_BASE_URL } from './api-config';
import { AuthAPI } from './auth-api';

export interface DashboardAvcResponse {
  totalReceber: number;
  totalRecebido: number;
  totalEmAtraso: number;
}

export interface DashboardAvdResponse {
  totalPagar: number;
  totalPago: number;
  totalEmAtraso: number;
}

export interface DashboardCompletoResponse {
  avc: DashboardAvcResponse;
  avd: DashboardAvdResponse;
}

export class DashboardAPI {
  /**
   * Busca métricas AVC (A Receber)
   */
  static async obterMetricasAvc(): Promise<DashboardAvcResponse> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(`${API_BASE_URL}/dashboard/avc`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro ao buscar métricas AVC' }));
      throw new Error(error.message || 'Erro ao buscar métricas AVC');
    }

    return await response.json();
  }

  /**
   * Busca métricas AVD (A Pagar)
   */
  static async obterMetricasAvd(): Promise<DashboardAvdResponse> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(`${API_BASE_URL}/dashboard/avd`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro ao buscar métricas AVD' }));
      throw new Error(error.message || 'Erro ao buscar métricas AVD');
    }

    return await response.json();
  }

  /**
   * Busca todas as métricas (AVC + AVD)
   */
  static async obterMetricasCompletas(): Promise<DashboardCompletoResponse> {
    const token = AuthAPI.getToken();
    if (!token) {
      throw new Error('Usuário não autenticado');
    }

    const cleanToken = token.trim().replace(/[\r\n]/g, '');

    const response = await fetch(`${API_BASE_URL}/dashboard/completo`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro ao buscar métricas completas' }));
      throw new Error(error.message || 'Erro ao buscar métricas completas');
    }

    return await response.json();
  }
}

