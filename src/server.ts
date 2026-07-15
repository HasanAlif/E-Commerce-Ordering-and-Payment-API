import { Server } from "http";
import config from "./config/index.js";
import app from "./app.js";
import { prisma } from "./app/lib/prisma.js";
// import console from "./shared/console.js";

let server: Server;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully!");
    server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
  } catch (error) {
    console.error(error, "Failed to connect to the database:");
    process.exit(1);
  }
}

async function main() {
  await startServer();

  const exitHandler = (code: number) => {
    if (server) {
      server.close(() => {
        console.log("Server closed!");
        process.exit(code);
      });
    } else {
      process.exit(code);
    }
  };

  process.on("uncaughtException", (error) => {
    console.error(error, "Uncaught Exception:");
    exitHandler(1);
  });

  process.on("unhandledRejection", (error) => {
    console.error(error, "Unhandled Rejection:");
    exitHandler(1);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received");
    exitHandler(0);
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received");
    exitHandler(0);
  });
}

main();
