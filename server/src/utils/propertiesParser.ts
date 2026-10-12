import fs from 'fs';
import path from 'path';

export interface ServerProperties {
  serverPort: number;
  motd?: string;
  maxPlayers?: number;
  onlineMode?: boolean;
  levelName?: string;
  raw: Record<string, string>;
}

export class PropertiesParser {
  /**
   * Reads and parses a server.properties file in the given directory.
   * If the file does not exist or is invalid, returns defaults without throwing.
   */
  static read(serverDir: string): ServerProperties {
    const filePath = path.join(serverDir, 'server.properties');
    const defaultResult: ServerProperties = {
      serverPort: 25565,
      raw: {}
    };

    if (!fs.existsSync(filePath)) {
      return defaultResult;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parse(content);
    } catch {
      return defaultResult;
    }
  }

  /**
   * Parses the string content of a server.properties file.
   */
  static parse(content: string): ServerProperties {
    const raw: Record<string, string> = {};
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        continue;
      }

      const separatorIdx = trimmed.indexOf('=');
      if (separatorIdx === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIdx).trim();
      const value = trimmed.slice(separatorIdx + 1).trim();
      raw[key] = value;
    }

    const portString = raw['server-port'] || raw['query.port'] || '25565';
    const parsedPort = parseInt(portString, 10);
    const serverPort = isNaN(parsedPort) ? 25565 : parsedPort;

    const maxPlayersStr = raw['max-players'];
    const maxPlayers = maxPlayersStr ? parseInt(maxPlayersStr, 10) : undefined;

    return {
      serverPort,
      motd: raw['motd'],
      maxPlayers: isNaN(maxPlayers!) ? undefined : maxPlayers,
      onlineMode: raw['online-mode'] !== undefined ? raw['online-mode'].toLowerCase() === 'true' : undefined,
      levelName: raw['level-name'],
      raw
    };
  }
}
