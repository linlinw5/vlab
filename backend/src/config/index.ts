import dotenv from "dotenv";
dotenv.config();

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || "8800"),
  nodeEnv: process.env.NODE_ENV || "development",

  builtinProxy: {
    enabled: process.env.BUILTIN_PROXY_ENABLED === "true",
    port: parseInt(process.env.BUILTIN_PROXY_PORT || "8843"),
    label: process.env.BUILTIN_PROXY_LABEL || "Builtin proxy",
    sslKeyPath: process.env.SSL_KEY_PATH || "./cert/private.key",
    sslCertPath: process.env.SSL_CERT_PATH || "./cert/certificate.crt",
  },

  nginxProxy: {
    enabled: process.env.NGINX_PROXY_ENABLED === "true",
    port: parseInt(process.env.NGINX_PROXY_PORT || "443"),
    label: process.env.NGINX_PROXY_LABEL || "Nginx proxy",
  },

  jwt: {
    accessSecret: require_env("JWT_ACCESS_SECRET"),
    refreshSecret: require_env("JWT_REFRESH_SECRET"),
    accessExpiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES_IN || "900"),
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || "604800"),
  },

  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "vlab",
    user: process.env.DB_USER || "postgres",
    password: require_env("DB_PASSWORD"),
  },

  vcenter: {
    baseURL: require_env("VCENTER_BASE_URL"),
    username: require_env("VCENTER_USERNAME"),
    password: require_env("VCENTER_PASSWORD"),
    categoryName: process.env.VCENTER_CATEGORY_NAME || "vlab-category",
    defaultGroupName: process.env.DEFAULT_GROUP_NAME || "Administrators",
    linkedClone: process.env.VCENTER_LINKED_CLONE === "true",
  },

  asa: {
    host: process.env.ASA_HOST || "",
    port: parseInt(process.env.ASA_PORT || "22"),
    username: process.env.ASA_HOST ? require_env("ASA_USERNAME") : "",
    password: process.env.ASA_HOST ? require_env("ASA_PASSWORD") : "",
  },

  vmFolder: {
    source: process.env.VM_FOLDER_SOURCE || "",
    target: require_env("VM_FOLDER_TARGET"),
  },

  admin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || "admin@vlab.com",
    username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
    password: require_env("DEFAULT_ADMIN_PASSWORD"),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },

  roles: {
    admin: 1,
    advanced: 2,
    user: 3,
  },

  saltRounds: 10,
} as const;
