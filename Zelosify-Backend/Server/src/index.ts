// Polyfill for pptx-parser browser dependency - must be first import
import "./utils/polyfill.js";

// Core Express and Node.js libraries
import dotenv from "dotenv";

// Database connection utilities
import connectPrisma from "./utils/prisma/connectPrisma.js";

// Application setup
import { setupApp } from "./app.js";

// Load environment variables from .env file
dotenv.config();

/**
 * Main server initialization function
 * Sets up the application, database connection, and starts the server
 */
async function startServer() {
  try {
    // Initialize application middleware, authentication, and routes
    const app = await setupApp();

    // Establish database connections
    await connectPrisma();

    // Start the server on specified port
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}...`);
    });
  } catch (error) {
    // Handle server initialization errors
    console.error("Error during server initialization:", error);
    process.exit(1);
  }
}

// Start the server
await startServer();
