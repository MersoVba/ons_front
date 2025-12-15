import { RequestHandler } from "express";
import { LoginRequest, AuthenticationResponse } from "../../shared/api.js";
import https from "https";
import http from "http";

// URL da API externa (pode ser configurada via variável de ambiente)
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || "https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api/api/v1";

/**
 * Faz proxy para API externa, ignorando erros de certificado SSL
 */
async function proxyToExternalAPI(endpoint: string, body: any): Promise<any> {
  const url = new URL(`${EXTERNAL_API_URL}${endpoint}`);
  
  return new Promise((resolve, reject) => {
    const requestModule = url.protocol === 'https:' ? https : http;
    
    // Configurar para ignorar certificados SSL inválidos (apenas para desenvolvimento/teste)
    const options: any = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Ignorar erros de certificado SSL (NÃO RECOMENDADO EM PRODUÇÃO)
      rejectUnauthorized: false,
    };

    const req = requestModule.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Endpoint de login - faz proxy para API externa ou usa mock
 */
export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { username, senha, password }: LoginRequest & { senha?: string; password?: string } = req.body;

    if (!username) {
      return res.status(400).json({
        message: "Email/username é obrigatório",
      });
    }

    // Se há senha e EXTERNAL_API_URL está configurada, fazer proxy para API externa
    if ((senha || password) && process.env.EXTERNAL_API_URL) {
      try {
        console.log(`🔄 Fazendo proxy para API externa: ${EXTERNAL_API_URL}/login/autenticacao`);
        const externalResponse = await proxyToExternalAPI("/login/autenticacao", {
          username,
          senha: senha || password,
        });
        
        console.log(`✅ Login via API externa bem-sucedido: ${username}`);
        return res.status(200).json({
          token: externalResponse.token,
          firstAccess: externalResponse.firstAccess,
          mfaRequired: false,
        });
      } catch (error) {
        console.error("❌ Erro ao fazer proxy para API externa:", error);
        // Fallback para mock se proxy falhar
      }
    }

    // Mock local (fallback ou quando não há senha)
    const mockToken = `mock_token_${Buffer.from(username).toString('base64')}_${Date.now()}`;

    const response: AuthenticationResponse = {
      token: mockToken,
      mfaRequired: false,
    };

    console.log(`✅ Login mock bem-sucedido: ${username}`);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Erro ao processar login:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao fazer login",
    });
  }
};

/**
 * Endpoint mock para validar TOTP (MFA)
 */
export const handleValidateTotp: RequestHandler = async (req, res) => {
  try {
    const { username, codigoTotp } = req.body;

    if (!username || !codigoTotp) {
      return res.status(400).json({
        message: "Username e código TOTP são obrigatórios",
      });
    }

    // Aceita qualquer código TOTP de 6 dígitos (apenas para desenvolvimento)
    if (codigoTotp.length !== 6) {
      return res.status(400).json({
        message: "Código TOTP deve ter 6 dígitos",
      });
    }

    const mockToken = `mock_token_${Buffer.from(username).toString('base64')}_${Date.now()}`;

    const response: AuthenticationResponse = {
      token: mockToken,
      mfaRequired: false,
    };

    console.log(`✅ TOTP validado com sucesso para: ${username}`);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Erro ao validar TOTP:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Erro ao validar código",
    });
  }
};

