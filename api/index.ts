import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Import route handlers
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

// Log requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// API Routes
app.get("/api/ping", (_req, res) => {
  res.json({ message: "Hello from Vercel API!" });
});

app.get("/api/demo", handleDemo);

app.post("/api/v1/login/autenticacao", handleLogin);
app.post("/api/v1/login/validar-totp", handleValidateTotp);

app.post("/api/pagamento-boleto/upload", uploadMiddleware, handleUploadComprovante);
app.post("/api/pagamento-boleto/fake", handleFakeEnvio);

// Serve static files from dist/spa
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(process.cwd(), "dist/spa");

app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Skip API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Serve index.html for SPA routing
  const indexPath = path.join(distPath, "index.html");
  res.sendFile(indexPath);
});

// Export serverless handler
const handler = serverless(app);
export default handler;
