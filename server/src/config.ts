import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load .env if present
dotenv.config();

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR 
  ? path.resolve(process.env.DATA_DIR) 
  : path.join(ROOT_DIR, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const config = {
  PORT: parseInt(process.env.PORT || '24565', 10),
  HOST: process.env.HOST || '0.0.0.0', // Accessible locally and over network
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
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  ROOT_DIR
};
