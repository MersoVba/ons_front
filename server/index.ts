import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleUploadComprovante, uploadMiddleware } from "./routes/pagamento-boleto";
import { handleFakeEnvio } from "./routes/pagamento-boleto-fake";
import { handleLogin, handleValidateTotp } from "./routes/login";

export function createServer() {
  console.log("🚀 Criando servidor Express...");
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Log de todas as requisições
  app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  // Login routes (mock - sem validação de senha)
  console.log("📝 Registrando rota: POST /api/v1/login/autenticacao");
  app.post("/api/v1/login/autenticacao", handleLogin);
  
  console.log("📝 Registrando rota: POST /api/v1/login/validar-totp");
  app.post("/api/v1/login/validar-totp", handleValidateTotp);

  // Pagamento Boleto routes
  console.log("📝 Registrando rota: POST /api/pagamento-boleto/upload");
  app.post("/api/pagamento-boleto/upload", uploadMiddleware, handleUploadComprovante);
  
  console.log("📝 Registrando rota: POST /api/pagamento-boleto/fake");
  app.post("/api/pagamento-boleto/fake", handleFakeEnvio);

  console.log("✅ Servidor Express criado com sucesso!");
  return app;
}
