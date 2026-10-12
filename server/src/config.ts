import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load .env if present
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '..', '..');

export interface PanelConfigFile {
  $schema?: string;
  port?: number;
  host?: string;
  dataDir?: string;
  openBrowserOnStart?: boolean;
  environment?: string;
  [key: string]: any;
}

// Support custom config file via CONFIG_PATH or default to config.json in root
const configFilePath = process.env.CONFIG_PATH
  ? (path.isAbsolute(process.env.CONFIG_PATH) ? process.env.CONFIG_PATH : path.join(ROOT_DIR, process.env.CONFIG_PATH))
  : path.join(ROOT_DIR, 'config.json');

let fileConfig: PanelConfigFile = {};

if (fs.existsSync(configFilePath)) {
  try {
    const raw = fs.readFileSync(configFilePath, 'utf8');
    fileConfig = JSON.parse(raw);
  } catch (err: any) {
    console.warn(`[MCSPanel] Figyelmeztetés: A config fájl (${configFilePath}) nem érvényes JSON:`, err.message);
  }
} else {
  // If no config file exists yet, generate default config.json
  try {
    const defaultConfig: PanelConfigFile = {
      $schema: './config.schema.json',
      port: 24565,
      host: '0.0.0.0',
      dataDir: 'data',
      openBrowserOnStart: true,
      environment: 'production'
    };
    fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf8');
    fileConfig = defaultConfig;
  } catch {}
}

const rawDataDir = process.env.DATA_DIR || fileConfig.dataDir || 'data';
const DATA_DIR = path.isAbsolute(rawDataDir) 
  ? path.resolve(rawDataDir) 
  : path.join(ROOT_DIR, rawDataDir);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : (fileConfig.port ? Number(fileConfig.port) : 24565),
  HOST: process.env.HOST || fileConfig.host || '0.0.0.0', // Accessible locally and over network
  DATA_DIR,
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, 'mcspanel.db'),
  JWT_SECRET: process.env.JWT_SECRET || (() => {
    // Persistent secret stored in data dir if not provided via env
    const secretFile = path.join(DATA_DIR, '.jwt_secret');
    if (fs.existsSync(secretFile)) {
      return fs.readFileSync(secretFile, 'utf8').trim();
    }
    const newSecret = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync(secretFile, newSecret, { encoding: 'utf8' });
    return newSecret;
  })(),
  IS_PRODUCTION: process.env.NODE_ENV === 'production' || fileConfig.environment === 'production',
  ROOT_DIR,
  CONFIG_PATH: configFilePath,
  RAW_CONFIG: fileConfig
};
