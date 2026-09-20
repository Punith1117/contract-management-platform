// Core Express and Node.js libraries
import express from "express";

// Authentication and session management
import { setupKeycloakConfig } from "./config/keycloak/keycloak.js";
import session from "express-session";

// Security and middleware libraries
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

// Application route handlers organized by feature domain
import authRoutes from "./routers/auth/authRoute.js";
import awsRouter from "./routers/aws/awsRoute.js";
import vendorRoutes from "./routers/vendor/vendorRoutes.js";
import hiringManagerRoutes from "./routers/hiring/hiringManagerRoutes.js";

// Initialize Express application
const app = express();

/**
 * Main application setup function
 * Configures middleware, authentication, routes, and error handling
 */
export async function setupApp() {
  // Initialize Keycloak authentication and session store
  const { keycloak, memoryStore } = await setupKeycloakConfig();

  // Security middleware for headers and protection
  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser());

  // Cross-Origin Resource Sharing configuration
  // Allows requests from specified frontend origins during development
  app.use(
    cors({
      origin: ["http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      exposedHeaders: ["set-cookie"],
    })
  );

  // Session configuration for Keycloak authentication
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "my-secret",
      resave: false,
      saveUninitialized: true,
      store: memoryStore,
    })
  );

  // Initialize Keycloak middleware for authentication
  app.use(keycloak.middleware());

  // Mount API route handlers with versioned endpoints

  // User authentication and authorization
  app.use("/api/v1/auth", authRoutes);

  // AWS integration
  app.use("/api/v1/aws", awsRouter);

  // Handles vendor-specific routes
  app.use("/api/v1/vendor", vendorRoutes);

  // Hiring manager routes
  app.use("/api/v1/hiring-manager", hiringManagerRoutes);

  // Request debugging middleware - logs all incoming requests
  app.use((req, _, next) => {
    console.log("[Server] Incoming request:", {
      method: req.method,
      path: req.path,
      body: req.body,
      headers: req.headers,
    });
    next();
  });

  // Health check endpoint
  app.get("/", (_, res) => {
    res.send("Server Connected!");
  });

  // Global error handling middleware
  // Catches and handles all unhandled errors
  app.use(
    (
      err: Error,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      console.error("Global error handler:", err);
      res.status(500).json({
        error: "Internal Server Error",
        message: err.message,
      });
    }
  );

  return app;
}

export default app;
