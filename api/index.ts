import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import path from "path";

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

// Handle common static file requests early (BEFORE express.static)
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end(); // No content - browser will use default
});

app.get("/robots.txt", (_req, res) => {
  res.type("text/plain");
  res.send("User-agent: *\nDisallow:");
});

// Serve static files from dist/spa
const distPath = path.join(process.cwd(), "dist/spa");

// Serve static files (JS, CSS, images, etc.)
app.use(express.static(distPath, {
  maxAge: "1y",
  etag: true,
  lastModified: true,
  index: false // Don't serve index.html automatically
}));

// SPA fallback - serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Skip API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Skip static file extensions
  const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".json", ".xml", ".txt"];
  if (staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext))) {
    return res.status(404).json({ error: "Static file not found" });
  }

  // Serve index.html for SPA routing
  const indexPath = path.join(distPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("Error serving index.html:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Export serverless handler
const handler = serverless(app);
export default handler;
