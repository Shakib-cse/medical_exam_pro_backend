import dotenv from "dotenv";

// Load environment variables if .env file exists locally
dotenv.config();

// Validate and parse configuration
export const config = {
  server: {
    port: parseInt(process.env.PORT || "3030"),
    env: process.env.NODE_ENV,
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    isTest: process.env.NODE_ENV === "test",
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || "30000"),
  },
  database: {
    url: process.env.DATABASE_URL,
    logging: process.env.DB_LOGGING === "true",
  },
  security: {
    cors: {
      allowedOrigins: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"),
      max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      issuer: process.env.JWT_ISSUER || "ignitor-app",
    },
  },
  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL,
    password: process.env.DEFAULT_ADMIN_PASSWORD,
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    path: process.env.LOG_FILE_PATH || "logs/app.log",
  },
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "465"),
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "Kawan App <no-reply@kawan.com>",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
};

export default config;
