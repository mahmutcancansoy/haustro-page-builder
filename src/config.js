const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_HAUSTRO_ENV = path.resolve(ROOT, '../HaustroBackend/.env');

function loadEnv() {
  const localEnv = path.join(ROOT, '.env');
  if (fs.existsSync(localEnv)) {
    dotenv.config({ path: localEnv });
  }

  const haustroPath = process.env.HAUSTRO_ENV_PATH || DEFAULT_HAUSTRO_ENV;
  if (fs.existsSync(haustroPath)) {
    dotenv.config({ path: haustroPath, override: true });
  }

  const required = ['DATABASE_IP', 'DB_NAME', 'DB_USER', 'DB_PASS'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Eksik ortam değişkenleri: ${missing.join(', ')}. ` +
        `.env.example dosyasını kopyalayıp HAUSTRO_ENV_PATH ayarlayın.`
    );
  }

  return {
    uri: process.env.DATABASE_IP.replace(/^["']|["']$/g, ''),
    dbName: process.env.DB_NAME.replace(/^["']|["']$/g, ''),
    dbUser: process.env.DB_USER.replace(/^["']|["']$/g, ''),
    dbPass: process.env.DB_PASS.replace(/^["']|["']$/g, ''),
    adminUserId: (process.env.ADMIN_USER_ID || '6036804c31912b10f8cbcf44').replace(
      /^["']|["']$/g,
      ''
    ),
    templatesDir: path.join(ROOT, 'templates'),
    referenceProject: path.resolve(ROOT, '../HaustroBackend'),
  };
}

module.exports = { loadEnv, ROOT };
