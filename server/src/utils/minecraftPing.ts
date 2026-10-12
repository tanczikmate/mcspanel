import net from 'net';

function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  while (true) {
    if ((value & 0xffffff80) === 0) {
      bytes.push(value);
      return Buffer.from(bytes);
    }
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
}

function readVarInt(buffer: Buffer, offset = 0): { value: number; size: number } {
  let value = 0;
  let size = 0;
  let byte = 0;

  while (true) {
    if (offset + size >= buffer.length) break;
    byte = buffer[offset + size];
    value |= (byte & 0x7f) << (size * 7);
    size++;
    if ((byte & 0x80) !== 0x80) break;
  }

  return { value, size };
}

export interface MinecraftServerStatus {
  online: boolean;
  playersOnline: number;
  playersMax: number;
  playerNames: string[];
  version?: string;
  latencyMs?: number;
}

/**
 * Pings a local Minecraft server using the Server List Ping (SLP) protocol
 * to retrieve real-time online player count and player list.
 */
export function pingMinecraftServer(host = '127.0.0.1', port = 25565, timeoutMs = 1200): Promise<MinecraftServerStatus | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startTime = Date.now();
    let receivedData = Buffer.alloc(0);
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      try {
        const hostBuf = Buffer.from(host, 'utf-8');
        const hostLen = writeVarInt(hostBuf.length);
        const portBuf = Buffer.alloc(2);
        portBuf.writeUInt16BE(port, 0);

        // Handshake packet (ID: 0x00, protocol: 765, host, port, nextState: 1)
        const handshakePayload = Buffer.concat([
          Buffer.from([0x00]),
          writeVarInt(765),
          hostLen,
          hostBuf,
          portBuf,
          writeVarInt(1) // Next state: Status
        ]);

        const handshakePacket = Buffer.concat([
          writeVarInt(handshakePayload.length),
          handshakePayload
        ]);

        // Request packet (Length: 1, ID: 0x00)
        const requestPacket = Buffer.from([0x01, 0x00]);

        socket.write(Buffer.concat([handshakePacket, requestPacket]));
      } catch {
        cleanup();
        resolve(null);
      }
    });

    socket.on('data', (chunk) => {
      receivedData = Buffer.concat([receivedData, chunk]);

      try {
        const { value: packetLen, size: lenSize } = readVarInt(receivedData, 0);
        if (receivedData.length >= lenSize + packetLen) {
          const { value: packetId, size: idSize } = readVarInt(receivedData, lenSize);
          if (packetId === 0x00) {
            const strOffset = lenSize + idSize;
            const { value: strLen, size: strLenSize } = readVarInt(receivedData, strOffset);
            const jsonStart = strOffset + strLenSize;
            const jsonBuf = receivedData.subarray(jsonStart, jsonStart + strLen);
            const jsonStr = jsonBuf.toString('utf-8');

            const parsed = JSON.parse(jsonStr);
            const latencyMs = Date.now() - startTime;
            const players = parsed.players || {};
            const playerNames = Array.isArray(players.sample)
              ? players.sample.map((p: any) => p.name).filter(Boolean)
              : [];

            cleanup();
            resolve({
              online: true,
              playersOnline: typeof players.online === 'number' ? players.online : 0,
              playersMax: typeof players.max === 'number' ? players.max : 20,
              playerNames,
              version: parsed.version?.name,
              latencyMs
            });
            return;
          }
        }
      } catch {
        // Wait for additional packets
      }
    });

    socket.on('timeout', () => {
      cleanup();
      resolve(null);
    });

    socket.on('error', () => {
      cleanup();
      resolve(null);
    });

    socket.on('close', () => {
      cleanup();
      resolve(null);
    });

    try {
      socket.connect(port, host);
    } catch {
      cleanup();
      resolve(null);
    }
  });
}
