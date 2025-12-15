import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    strictPort: true, // Falha se a porta estiver ocupada ao invés de usar outra
  },
  build: {
    outDir: "dist/spa",
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React e React DOM
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Separar bibliotecas de UI grandes
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          // Separar React Query
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  optimizeDeps: {
    exclude: ["./server/index.ts"],
  },
}));

function expressPlugin(): Plugin {
  let appInstance: any = null;
  
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      // Usar Vite's ssrLoadModule para processar TypeScript
      try {
        console.log("🔧 Carregando servidor Express...");
        console.log("📂 Diretório atual:", __dirname);
        console.log("🌐 Servidor rodando na porta:", server.config.server?.port || 8080);
        
        // Tentar primeiro com caminho relativo
        let serverModule;
        try {
          console.log("📦 Tentando carregar com caminho relativo...");
          serverModule = await server.ssrLoadModule("./server/index.ts");
        } catch (relError) {
          console.log("⚠️ Caminho relativo falhou, tentando com pathToFileURL...");
          const serverPath = pathToFileURL(path.resolve(__dirname, "./server/index.ts")).href;
          console.log("📂 Caminho absoluto do servidor:", serverPath);
          serverModule = await server.ssrLoadModule(serverPath);
        }
        
        console.log("✅ Módulo do servidor carregado!");
        appInstance = serverModule.createServer();
        console.log("✅ Servidor Express carregado com sucesso!");
        console.log("📋 Rotas disponíveis:");
        console.log("  - GET /api/ping");
        console.log("  - GET /api/demo");
        console.log("  - POST /api/pagamento-boleto/upload");
        console.log("  - POST /api/pagamento-boleto/fake");
        
        // Adicionar o servidor Express como middleware do Vite
        // IMPORTANTE: Registrar ANTES de qualquer outro middleware do Vite
        // Isso garante que rotas /api/* sejam processadas pelo Express primeiro
        
        // Log de teste para verificar se o middleware está sendo registrado
        console.log("🔧 Registrando middleware do Express...");
        
        const expressMiddleware = (req: any, res: any, next: any) => {
          // Log TODAS as requisições para debug
          console.log(`🔍 [MIDDLEWARE] Recebida requisição: ${req.method} ${req.url}`);
          
          // Normalizar a URL (remover query string para verificação)
          const urlPath = req.url?.split('?')[0] || '';
          
          // Se for uma rota de API, processar com Express
          if (urlPath.startsWith("/api/")) {
            console.log(`✅ [MIDDLEWARE] É uma rota de API, processando com Express`);
            console.log(`   Método: ${req.method}, URL: ${urlPath}`);
            
            if (appInstance) {
              console.log(`✅ [MIDDLEWARE] appInstance disponível, chamando Express`);
              // O Express app é um middleware compatível
              appInstance(req, res, (err?: any) => {
                if (err) {
                  console.error(`❌ [MIDDLEWARE] Erro no Express:`, err);
                  if (!res.headersSent) {
                    res.status(500).json({ error: "Erro interno do servidor" });
                  }
                } else if (!res.headersSent) {
                  // Se o Express não respondeu (não encontrou a rota), passar adiante
                  console.warn(`⚠️ [MIDDLEWARE] Express não respondeu para ${req.url}`);
                  next();
                } else {
                  console.log(`✅ [MIDDLEWARE] Express respondeu com sucesso`);
                }
              });
            } else {
              console.error("❌ [MIDDLEWARE] appInstance NÃO está disponível!");
              res.status(500).json({ error: "Servidor não disponível" });
            }
          } else {
            // Não é uma rota de API, deixar o Vite processar
            console.log(`⏭️ [MIDDLEWARE] Não é rota de API, passando para Vite`);
            next();
          }
        };
        
        // Registrar o middleware ANTES de todos os outros
        server.middlewares.use(expressMiddleware);
        console.log("✅ Middleware do Express registrado com sucesso!");
      } catch (error) {
        console.error("❌ Erro ao carregar servidor Express:", error);
        console.error("Tipo do erro:", error instanceof Error ? error.constructor.name : typeof error);
        console.error("Mensagem:", error instanceof Error ? error.message : String(error));
        console.error("Stack:", error instanceof Error ? error.stack : "N/A");
      }
    },
  };
}
