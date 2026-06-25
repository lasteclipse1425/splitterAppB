import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import { errorHandler } from "./middleware/errorHandler.js";
import friendsRoutes from "./routes/friends.js";
import groupsRoutes from "./routes/groups.js";
import sessionsRoutes from "./routes/sessions.js";
import usersRoutes from "./routes/users.js";
import uploadsRoutes from "./routes/uploads.js";
import { logAuthAttempts } from "./middleware/logAuth.js";
import debugRoutes from "./routes/debug.js";
import { validateBackendEnv } from "./config/env.js";
import {
  getAvatarStorageMode,
  getAvatarUploadsRoot,
} from "./config/avatarStorage.js";

// Load backend/.env for local npm development. Docker Compose injects the same
// variables through its environment block.
dotenv.config();

function maskSecret(value?: string): string {
  if (!value) return "(not set)";
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

console.log(
  `[startup] receipt parsing: GEMINI_API_KEY=${maskSecret(process.env.GEMINI_API_KEY)} DEBUG_PARSE=${process.env.DEBUG_PARSE ?? "0"} model=${process.env.GEMINI_MODEL_PARSE ?? "gemini-2.5-flash"}`
);
if (!process.env.GEMINI_API_KEY) {
  console.warn("[startup] GEMINI_API_KEY missing — /sessions/scan will return MOCK items (Кола/Сервис)");
}

const avatarStorageMode = getAvatarStorageMode();
console.log(
  `[startup] avatar storage: ${avatarStorageMode}${
    avatarStorageMode === "local"
      ? ` (served from ${getAvatarUploadsRoot()} at /media/)`
      : " (Cloudflare R2)"
  }`
);
if (avatarStorageMode === "local") {
  console.warn(
    "[startup] R2 not configured — avatars are stored locally. Set R2_* and CDN_BASE_URL for production CDN uploads."
  );
}

let env;
try {
  env = validateBackendEnv();
} catch (error) {
  console.error("FATAL: invalid backend environment.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const app = express();
// Allow configurable JSON body size (large base64 images for /sessions/scan)
// Default increased from Express ~100kb to 4mb to fit ~3MB binary image (base64 expands ~33%).
const JSON_LIMIT = env.jsonBodyLimit;
app.use(express.json({ limit: JSON_LIMIT }));

// Configure CORS with long preflight caching and multiple origins support
const allowAllCors = env.allowAllCors;
const allowlist = env.corsOrigins;

if (allowAllCors) {
  // Temporary relaxed policy: allow all origins. Note: credentials must be false with '*'.
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: false,
      maxAge: 86400,
    })
  );
  console.warn(
    "CORS is in permissive mode: allowing all origins (*) without credentials"
  );
} else {
  const corsSettings: cors.CorsOptions = {
    // IMPORTANT: with credentials: true we cannot send Access-Control-Allow-Origin: "*".
    // Use a function that reflects the request origin to work correctly with credentials.
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests without origin (e.g., Postman, curl)
      if (!origin) return callback(null, true);

      // In non-production allow all origins (reflecting origin)
      if (process.env.NODE_ENV !== "production") return callback(null, true);

      // In production, only explicitly configured origins are allowed.
      if (allowlist.includes(origin)) return callback(null, true);

      console.warn(`CORS blocked request from: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400, // 24h preflight caching (OPTIONS)
  };

  app.use(cors(corsSettings));
}

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Auth routes with logging
app.use("/auth", logAuthAttempts, authRoutes);
app.use("/user", userRoutes);
app.use("/friends", friendsRoutes);
app.use("/groups", groupsRoutes);
app.use("/sessions", sessionsRoutes);
app.use("/users", usersRoutes);
app.use("/uploads", uploadsRoutes);
app.use("/media", express.static(path.resolve(getAvatarUploadsRoot())));
app.use("/debug", debugRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Global error handler (must be after routes)
app.use(errorHandler);

// Start server
const PORT = env.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
  console.log(
    "CORS allowlist:",
    allowAllCors
      ? "* (permissive)"
      : allowlist.length
      ? allowlist
      : "(none / dev mode)"
  );
});

if (process.env.NODE_ENV !== "production") {
  console.log("ENV check:", {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL ? "OK" : "MISSING",
    JWT_SECRET: process.env.JWT_SECRET ? "OK" : "MISSING",
    JSON_BODY_LIMIT: JSON_LIMIT,
  });
}
