import { buildApp } from './app';
import { config } from './config';
import { getDb, closeDb } from './db';
import { ProcessManager } from './services/processManager';

async function start() {
  // Ensure database tables exist
  getDb();

  const app = buildApp();

  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await ProcessManager.stopAll();
      await app.close();
      closeDb();
      app.log.info('MCSPanel stopped.');
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST
    });
    console.log(`\n======================================================`);
    console.log(`  MCSPanel Backend is running!`);
    console.log(`  Local URL:    http://localhost:${config.PORT}`);
    console.log(`  Network URL:  http://${config.HOST}:${config.PORT}`);
    console.log(`  Data folder:  ${config.DATA_DIR}`);
    console.log(`======================================================\n`);

    // Auto-start instances configured with start_on_boot
    try {
      const db = getDb();
      const bootInstances = db.prepare('SELECT id, name FROM instances WHERE start_on_boot = 1').all() as { id: string; name: string }[];
      if (bootInstances.length > 0) {
        console.log(`[MCSPanel] ${bootInstances.length} automatikusan induló szerver indítása...`);
        for (const inst of bootInstances) {
          ProcessManager.start(inst.id, 'Rendszer (autostart)').catch((e) => {
            console.error(`[MCSPanel] Nem sikerült automatikusan elindítani: ${inst.name} (${e.message})`);
          });
        }
      }
    } catch (e: any) {
      console.error('[MCSPanel] Hiba az autostart szerverek indításakor:', e.message);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
