import serverless from "serverless-http";
import { createServer } from "../server/index";
import path from "path";
import express from "express";

const app = createServer();

// In production, serve the built SPA files
// Use process.cwd() for Vercel serverless environment
const distPath = path.join(process.cwd(), "dist/spa");

// Serve static files
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

// Export the serverless handler for Vercel
const handler = serverless(app);

export default handler;

