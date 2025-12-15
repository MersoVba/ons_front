import serverless from "serverless-http";
import path from "path";
import { createServer } from "../dist/server/node-build.mjs";

// Create Express app using createServer from compiled server build
const app = createServer();

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

