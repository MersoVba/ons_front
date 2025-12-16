/**
 * Configuração centralizada da API
 * 
 * A URL base da API pode ser configurada através da variável de ambiente VITE_API_BASE_URL
 * 
 * Para desenvolvimento local:
 * VITE_API_BASE_URL=http://localhost:8088/ons-api/api/v1
 * 
 * Para produção (Vercel):
 * - Usa a API externa diretamente (sem proxy Express)
 * - Configure: VITE_API_BASE_URL=https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api/api/v1
 */

// Determina a URL base da API
// Em produção, chama a API externa diretamente (sem proxy)
const getApiBaseUrl = () => {
  // Sempre verifica variável de ambiente primeiro (tanto dev quanto prod)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Em produção, usa a API externa padrão
  if (import.meta.env.PROD) {
    return "https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api/";
  }
  
  // Em desenvolvimento local, usa localhost
  return "http://localhost:8088/ons-api/api/v1";
};

// URL base da API - inclui /api/v1
export const API_BASE_URL = getApiBaseUrl();

// URL base sem /api/v1 (para endpoints que não seguem esse padrão)
export const API_BASE_URL_WITHOUT_VERSION = API_BASE_URL.replace('/api/v1', '');

