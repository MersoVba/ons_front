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
// In Vercel, process.cwd() points to /var/task
const distPath = path.join(process.cwd(), "dist/spa");
console.log("📁 Dist path:", distPath);
console.log("📁 Process cwd:", process.cwd());

// Configure MIME types for JavaScript modules
app.use((req, res, next) => {
  // Set correct MIME type for .js files (ES modules)
  if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  }
  // Set correct MIME type for .css files
  if (req.path.endsWith('.css')) {
    res.type('text/css');
  }
  next();
});

// Serve static files (JS, CSS, images, etc.) - MUST be before catch-all
app.use(express.static(distPath, {
  maxAge: "1y",
  etag: true,
  lastModified: true,
  index: false,
  setHeaders: (res, filePath) => {
    // Ensure JavaScript files are served with correct MIME type
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    // Ensure CSS files are served with correct MIME type
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

// SPA fallback - serve index.html for all non-API routes
// This catches routes like /login, /, /dashboard, etc.
// IMPORTANT: This should only catch routes that are NOT static files
app.get("*", (req, res) => {
  // Skip API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Skip static file extensions (these should be handled by express.static above)
  // This prevents unnecessary processing of static files
  const staticExtensions = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".json", ".xml", ".txt", ".webp", ".avif", ".map"];
  if (staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext))) {
    return res.status(404).json({ error: "Static file not found" });
  }

  // Skip assets directory (should be handled by express.static)
  if (req.path.startsWith("/assets/")) {
    return res.status(404).json({ error: "Asset not found" });
  }

  // Serve index.html for SPA routing (React Router will handle client-side routing)
  const indexPath = path.join(distPath, "index.html");
  
  // Set proper headers for HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error serving index.html:", err);
      console.error("   Path requested:", req.path);
      console.error("   Dist path:", distPath);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Internal server error",
          message: err.message 
        });
      }
    } else {
      console.log("✅ Served index.html for:", req.path);
    }
  });
});

// Export serverless handler
const handler = serverless(app);
export default handler;
