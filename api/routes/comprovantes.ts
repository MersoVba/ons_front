import { RequestHandler, Response } from "express";
import https from "https";
import http from "http";
import multer from "multer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const FormData = require('form-data');

// URL da API externa (pode ser configurada via variável de ambiente)
// Para comprovantes, usar apenas /ons-api (sem /api/v1)
const getExternalApiUrl = () => {
  const baseUrl = process.env.EXTERNAL_API_URL || "https://projeto-ons-backendons-f5u22n-2dd318-147-93-32-227.traefik.me/ons-api";
  // Remove /api/v1 se existir, pois comprovantes usa apenas /ons-api
  return baseUrl.replace('/api/v1', '');
};
const EXTERNAL_API_URL = getExternalApiUrl();

// Configurar multer para armazenar em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // Aceitar PDF e imagens
    if (file.mimetype === "application/pdf" || 
        file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF e imagens são permitidos"));
    }
  },
});

/**
 * Faz proxy para API externa de comprovantes, ignorando erros de certificado SSL
 */
async function proxyToExternalAPI(endpoint: string, res: Response) {
  const url = new URL(`${EXTERNAL_API_URL}${endpoint}`);
  
  return new Promise<void>((resolve, reject) => {
    const requestModule = url.protocol === 'https:' ? https : http;
    
    // Configurar para ignorar certificados SSL inválidos
    const options: any = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': '*/*',
      },
      // Ignorar erros de certificado SSL
      rejectUnauthorized: false,
    };

    const req = requestModule.request(options, (proxyRes) => {
      // Copiar status code
      res.status(proxyRes.statusCode || 200);
      
      // Copiar headers
      Object.keys(proxyRes.headers).forEach(key => {
        const value = proxyRes.headers[key];
        if (value) {
          res.setHeader(key, value);
        }
      });
      
      // Pipe da resposta
      proxyRes.pipe(res);
      
      proxyRes.on('end', () => {
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro ao fazer proxy para API externa:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao buscar documento' });
      }
      reject(error);
    });

    req.end();
  });
}

/**
 * Middleware para upload de arquivo
 */
export const uploadMiddleware = upload.single('arquivo');

/**
 * Endpoint para obter URL do comprovante por ID da parcela
 * Retorna a URL diretamente para abrir no navegador
 */
export const handleGetComprovante: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "ID da parcela é obrigatório",
      });
    }

    console.log(`🔄 Buscando URL do comprovante para parcela ${id} via API externa`);
    console.log(`🌐 URL completa: ${EXTERNAL_API_URL}/comprovantes/link/${id}`);

    // Fazer proxy para API externa e obter a URL
    // Endpoint: ons-api/comprovantes/link (sem /api/v1)
    const url = new URL(`${EXTERNAL_API_URL}/comprovantes/link/${id}`);
    const requestModule = url.protocol === 'https:' ? https : http;
    
    const options: any = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': '*/*',
      },
      rejectUnauthorized: false,
    };

    const proxyReq = requestModule.request(options, (proxyRes) => {
      let data = '';
      
      console.log(`📥 Status da resposta da API externa: ${proxyRes.statusCode}`);
      console.log(`📥 Content-Type: ${proxyRes.headers['content-type']}`);
      
      // Verificar se a resposta é um erro
      if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
        console.error(`❌ Erro HTTP da API externa: ${proxyRes.statusCode}`);
        return res.status(proxyRes.statusCode).json({
          error: `Erro ao buscar comprovante: ${proxyRes.statusCode}`
        });
      }
      
      proxyRes.on('data', (chunk) => {
        data += chunk.toString();
      });
      
      proxyRes.on('end', () => {
        try {
          const contentType = proxyRes.headers['content-type'] || '';
          
          // Se a resposta for HTML, é um erro
          if (contentType.includes('text/html') || data.trim().startsWith('<!')) {
            console.error('❌ API externa retornou HTML em vez de URL:', data.substring(0, 200));
            return res.status(500).json({
              error: 'API externa retornou resposta inválida (HTML)'
            });
          }
          
          // A API retorna JSON com { link: "...", mensagem: "..." }
          let urlComprovante: string;
          
          try {
            // Tentar parsear como JSON primeiro
            const jsonResponse = JSON.parse(data.trim());
            
            // Extrair o link do JSON
            if (jsonResponse.link) {
              urlComprovante = jsonResponse.link;
            } else if (jsonResponse.url) {
              urlComprovante = jsonResponse.url;
            } else {
              // Se não tiver link nem url, tentar usar a string diretamente
              urlComprovante = typeof jsonResponse === 'string' ? jsonResponse : data.trim();
            }
          } catch (parseError) {
            // Se não for JSON, tratar como string
            urlComprovante = data.trim();
            
            // Remover aspas se for JSON string
            if (urlComprovante.startsWith('"') && urlComprovante.endsWith('"')) {
              urlComprovante = JSON.parse(urlComprovante);
            }
          }
          
          // Se estiver vazio, pode ser que a resposta seja 304 e não tenha body
          if (!urlComprovante) {
            console.warn('⚠️ Resposta vazia da API externa (possível 304)');
            return res.status(404).json({
              error: 'URL do comprovante não encontrada na resposta'
            });
          }
          
          // Validar se é uma URL válida
          try {
            new URL(urlComprovante);
          } catch (urlError) {
            console.error('❌ URL inválida recebida:', urlComprovante);
            console.error('❌ Erro de validação:', urlError);
            return res.status(500).json({
              error: `URL do comprovante inválida: ${urlComprovante.substring(0, 100)}`
            });
          }
          
          console.log(`✅ URL do comprovante obtida: ${urlComprovante}`);
          
          // Adicionar headers para evitar cache
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Content-Type', 'application/json');
          
          res.status(200).json({
            url: urlComprovante
          });
        } catch (error) {
          console.error('❌ Erro ao processar resposta:', error);
          console.error('❌ Dados recebidos:', data.substring(0, 500));
          
          return res.status(500).json({
            error: 'Erro ao processar resposta da API externa',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      });
    });

    proxyReq.on('error', (error) => {
      console.error('❌ Erro ao fazer proxy para API externa:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao buscar URL do comprovante' });
      }
    });

    proxyReq.end();
  } catch (error) {
    console.error("❌ Erro ao buscar comprovante:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao buscar comprovante",
      });
    }
  }
};

/**
 * Endpoint para alterar comprovante (PUT /comprovantes/alterar)
 * Recebe multipart/form-data com arquivo e id da parcela
 */
export const handleAlterarComprovante: RequestHandler = async (req, res) => {
  try {
    // O arquivo vem no req.file (via multer) e o id no body
    const { idParcela } = req.body;
    const file = (req as any).file;

    if (!idParcela) {
      return res.status(400).json({
        error: "ID da parcela é obrigatório",
      });
    }

    if (!file) {
      return res.status(400).json({
        error: "Arquivo é obrigatório",
      });
    }

    console.log(`🔄 Alterando comprovante para parcela ${idParcela} via API externa`);
    console.log(`🌐 URL completa: ${EXTERNAL_API_URL}/comprovantes/alterar`);

    // Fazer proxy para API externa
    // Endpoint: ons-api/comprovantes/alterar (sem /api/v1)
    const url = new URL(`${EXTERNAL_API_URL}/comprovantes/alterar`);
    const requestModule = url.protocol === 'https:' ? https : http;
    
    // Criar FormData para enviar
    const formData = new FormData();
    formData.append('arquivo', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });
    formData.append('idParcela', idParcela);

    const options: any = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'PUT',
      headers: {
        ...formData.getHeaders(),
      },
      rejectUnauthorized: false,
    };

    const proxyReq = requestModule.request(options, (proxyRes: any) => {
      res.status(proxyRes.statusCode || 200);
      
      Object.keys(proxyRes.headers).forEach(key => {
        const value = proxyRes.headers[key];
        if (value && key.toLowerCase() !== 'content-length') {
          res.setHeader(key, value);
        }
      });
      
      proxyRes.pipe(res);
      
      proxyRes.on('end', () => {
        console.log(`✅ Comprovante alterado com sucesso para parcela ${idParcela}`);
      });
    });

    proxyReq.on('error', (error: Error) => {
      console.error('❌ Erro ao fazer proxy para API externa:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao alterar comprovante' });
      }
    });

    formData.pipe(proxyReq);
  } catch (error) {
    console.error("❌ Erro ao alterar comprovante:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Erro ao alterar comprovante",
      });
    }
  }
};

