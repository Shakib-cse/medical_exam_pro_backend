// src/index.ts
import { createExpressApp } from "./createApp";
import { AppLogger } from "./core/logging/logger";
import { config } from "./core/config";

async function bootstrap() {
  try {
    const expressApp = await createExpressApp();
    const port = config.server.port;

    const server = expressApp.listen(port, () => {
      AppLogger.info(
        `🗲 Ignitor Server running on port ${port} in ${config.server.env} mode`,
      );
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        AppLogger.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });
  } catch (error) {
    AppLogger.error("❌ Unhandled bootstrap error:", { error });
    process.exit(1);
  }
}

// Start the application
bootstrap();

