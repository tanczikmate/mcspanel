import Database from 'better-sqlite3';
import { config } from '../config';
import { initializeDatabase } from './schema';

let dbInstance: Database.Database | null = null;

export function getDb(customPath?: string): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(customPath || config.DB_PATH);
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
