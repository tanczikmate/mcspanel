export class VersionDetector {
  /**
   * Cleans a raw version string (e.g. from SLP ping or logs)
   * Strips Minecraft formatting codes (§) and extracts canonical version names.
   */
  static cleanVersion(raw?: string | null): string | null {
    if (!raw) return null;

    // Strip Minecraft formatting codes (e.g. §a, §r, §c)
    let cleaned = raw.replace(/§[0-9a-fk-or]/gi, '').trim();

    // Check if it contains (MC: X.Y.Z)
    const mcMatch = cleaned.match(/\(MC:\s*([^\)]+)\)/i);
    if (mcMatch) {
      const isPaper = /paper/i.test(cleaned);
      const isPurpur = /purpur/i.test(cleaned);
      const prefix = isPurpur ? 'Purpur ' : isPaper ? 'Paper ' : '';
      return `${prefix}${mcMatch[1].trim()}`;
    }

    // If verbose format like: "Paper 1.21.11-132-ver/1.21.11@c5eb079 (2026-05-11T11:43:09Z)"
    const verboseMatch = cleaned.match(/^([a-zA-Z]+)\s+(\d+\.\d+(?:\.\d+)?)/);
    if (verboseMatch) {
      return `${verboseMatch[1]} ${verboseMatch[2]}`;
    }

    // If just verbose build like: "1.21.11-132-c5eb079"
    const semverStart = cleaned.match(/^(\d+\.\d+(?:\.\d+)?)/);
    if (semverStart && cleaned.length > semverStart[1].length + 5) {
      return semverStart[1];
    }

    return cleaned || null;
  }

  /**
   * Parses live stdout lines from the running Minecraft server process.
   */
  static parseLogLine(line: string): string | null {
    if (!line) return null;

    // Loading Paper/Purpur/Fabric/Folia for Minecraft X.Y.Z
    const loadingMatch = line.match(/Loading\s+(Paper|Purpur|Fabric|Folia)\s+.*for Minecraft\s+([\d.]+)/i);
    if (loadingMatch) {
      return `${loadingMatch[1]} ${loadingMatch[2]}`;
    }

    // This server is running Paper/Purpur/Spigot/CraftBukkit/Mohist version X
    const runningMatch = line.match(/This server is running\s+([a-zA-Z0-9_-]+)\s+version\s+([^\s]+)/i);
    if (runningMatch) {
      const serverType = runningMatch[1];
      const v = runningMatch[2];
      const m = v.match(/^(\d+\.\d+(?:\.\d+)?)/);
      return `${serverType} ${m ? m[1] : v}`;
    }

    // Starting minecraft server version X.Y.Z
    const startingMatch = line.match(/Starting minecraft server version\s+([\d.]+)/i);
    if (startingMatch) {
      return startingMatch[1];
    }

    // Fabric Loader
    const fabricMatch = line.match(/Loading Fabric\s+([^\s]+)\s+for Minecraft\s+([\d.]+)/i);
    if (fabricMatch) {
      return `Fabric ${fabricMatch[2]}`;
    }

    // NeoForge / Forge
    const forgeMatch = line.match(/(?:Minecraft Forge|NeoForge)\s+([\d.]+)/i);
    if (forgeMatch) {
      return forgeMatch[0];
    }

    return null;
  }
}
