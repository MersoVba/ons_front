import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import path from "path";
import { handleDemo } from "./routes/demo.js";
import { handleUploadComprovante, uploadMiddleware } from "./routes/pagamento-boleto.js";
import { handleFakeEnvio } from "./routes/pagamento-boleto-fake.js";
import { handleLogin, handleValidateTotp } from "./routes/login.js";

// Create Express app
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

// In production, serve the built SPA files
// Use process.cwd() for Vercel serverless environment
const distPath = path.join(process.cwd(), "dist/spa");

// Handle React Router - serve index.html for all non-API routes
// Note: Vercel handles static files automatically, so we only need to serve index.html for SPA routing
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Serve index.html for SPA routing
  res.sendFile(path.join(distPath, "index.html"));
});

// Export the serverless handler for Vercel
const handler = serverless(app);

export default handler;
