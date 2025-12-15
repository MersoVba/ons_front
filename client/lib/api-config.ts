/**
 * Configuração centralizada da API
 * 
 * A URL base da API pode ser configurada através da variável de ambiente VITE_API_BASE_URL
 * 
 * Para desenvolvimento local:
 * VITE_API_BASE_URL=http://localhost:8088/ons-api/api/v1
 * 
 * Para produção (Vercel):
 * - Se não configurado, usa a API local do Vercel (/api/v1)
 * - Ou configure: VITE_API_BASE_URL=https://sua-api-externa.com/api/v1
 */

// Determina a URL base da API
// Em produção no Vercel, SEMPRE usa a API local para evitar problemas de certificado SSL
const getApiBaseUrl = () => {
  // Em produção (Vercel), SEMPRE usa a API local (o backend faz proxy se necessário)
  if (import.meta.env.PROD) {
    return "/api/v1";
  }
  
  // Em desenvolvimento, verifica se há variável de ambiente
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Em desenvolvimento local, usa localhost
  return "http://localhost:8088/ons-api/api/v1";
};

// URL base da API - inclui /api/v1
export const API_BASE_URL = getApiBaseUrl();

// URL base sem /api/v1 (para endpoints que não seguem esse padrão)
export const API_BASE_URL_WITHOUT_VERSION = API_BASE_URL.replace('/api/v1', '');

