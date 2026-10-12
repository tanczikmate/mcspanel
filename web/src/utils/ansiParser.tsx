import React from 'react';

export interface AnsiSegment {
  text: string;
  color?: string;
  bgColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

// 16 Standard Terminal Colors (High-contrast, vibrant Pterodactyl / Alacritty theme)
const STANDARD_COLORS: Record<number, string> = {
  30: '#64748B', // Black / Slate
  31: '#F87171', // Red
  32: '#34D399', // Green
  33: '#FBBF24', // Yellow
  34: '#60A5FA', // Blue
  35: '#C084FC', // Magenta
  36: '#38BDF8', // Cyan
  37: '#F3F4F6', // White
  90: '#94A3B8', // Bright Black / Gray
  91: '#EF4444', // Bright Red
  92: '#10B981', // Bright Green
  93: '#F59E0B', // Bright Yellow
  94: '#3B82F6', // Bright Blue
  95: '#A855F7', // Bright Magenta
  96: '#0EA5E9', // Bright Cyan
  97: '#FFFFFF'  // Bright White
};

const STANDARD_BG_COLORS: Record<number, string> = {
  40: '#1E293B',
  41: '#991B1B',
  42: '#065F46',
  43: '#854D0E',
  44: '#1E40AF',
  45: '#86198F',
  46: '#155E75',
  47: '#CBD5E1',
  100: '#334155',
  101: '#B91C1C',
  102: '#047857',
  103: '#A16207',
  104: '#1D4ED8',
  105: '#A21CAF',
  106: '#0E7490',
  107: '#F1F5F9'
};

// Authentic vibrant Minecraft section sign (§) color palette
const MC_COLORS: Record<string, string> = {
  '0': '#4B5563', // Black
  '1': '#2563EB', // Dark Blue
  '2': '#16A34A', // Dark Green
  '3': '#0891B2', // Dark Aqua
  '4': '#DC2626', // Dark Red
  '5': '#9333EA', // Dark Purple
  '6': '#D97706', // Gold
  '7': '#9CA3AF', // Gray
  '8': '#6B7280', // Dark Gray
  '9': '#3B82F6', // Blue
  'a': '#22C55E', // Bright Green
  'b': '#06B6D4', // Bright Aqua
  'c': '#EF4444', // Bright Red
  'd': '#EC4899', // Light Purple / Pink
  'e': '#FACC15', // Yellow
  'f': '#FFFFFF'  // White
};

function get256Color(index: number): string {
  if (index >= 0 && index <= 7) {
    return STANDARD_COLORS[30 + index] || '#E2E2E6';
  }
  if (index >= 8 && index <= 15) {
    return STANDARD_COLORS[90 + (index - 8)] || '#FFFFFF';
  }
  if (index >= 16 && index <= 231) {
    index -= 16;
    const r = Math.floor(index / 36);
    const g = Math.floor((index % 36) / 6);
    const b = index % 6;
    const toHex = (c: number) => (c === 0 ? 0 : 55 + c * 40);
    return `rgb(${toHex(r)}, ${toHex(g)}, ${toHex(b)})`;
  }
  if (index >= 232 && index <= 255) {
    const gray = 8 + (index - 232) * 10;
    return `rgb(${gray}, ${gray}, ${gray})`;
  }
  return '#E2E2E6';
}

/**
 * Strips all ANSI escape codes and Minecraft section sign codes from text.
 */
export function stripAnsi(text: string): string {
  if (!text) return '';
  return text
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/§[0-9a-fk-or]/gi, '')
    .replace(/\r/g, '');
}

/**
 * Parses raw text containing ANSI escape sequences or Minecraft (§) codes.
 */
export function parseAnsi(rawText: string): AnsiSegment[] {
  if (!rawText) return [];

  // Normalize Minecraft § codes into custom escape tokens
  const normalized = rawText
    .replace(/\r/g, '')
    .replace(/§([0-9a-f])/gi, (_, c) => `\x1b[MC_${c.toLowerCase()}m`)
    .replace(/§r/gi, '\x1b[0m')
    .replace(/§l/gi, '\x1b[1m')
    .replace(/§o/gi, '\x1b[3m')
    .replace(/§n/gi, '\x1b[4m')
    .replace(/§m/gi, '\x1b[9m');

  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[(?:MC_([0-9a-f])|([0-9;]*))([a-zA-Z])/g;

  let lastIndex = 0;
  let currentColor: string | undefined = undefined;
  let currentBgColor: string | undefined = undefined;
  let bold = false;
  let dim = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;

  const pushSegment = (text: string) => {
    if (!text) return;
    segments.push({
      text,
      color: currentColor,
      bgColor: currentBgColor,
      bold,
      dim,
      italic,
      underline,
      strikethrough
    });
  };

  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const textChunk = normalized.substring(lastIndex, match.index);
    if (textChunk) {
      pushSegment(textChunk);
    }
    lastIndex = regex.lastIndex;

    const mcColorCode = match[1];
    const paramsStr = match[2];
    const command = match[3];

    if (mcColorCode) {
      currentColor = MC_COLORS[mcColorCode];
      continue;
    }

    if (command !== 'm') {
      continue;
    }

    if (!paramsStr || paramsStr === '' || paramsStr === '0') {
      currentColor = undefined;
      currentBgColor = undefined;
      bold = false;
      dim = false;
      italic = false;
      underline = false;
      strikethrough = false;
      continue;
    }

    const params = paramsStr.split(';').map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < params.length; i++) {
      const code = params[i];
      if (code === 0) {
        currentColor = undefined;
        currentBgColor = undefined;
        bold = false;
        dim = false;
        italic = false;
        underline = false;
        strikethrough = false;
      } else if (code === 1) {
        bold = true;
      } else if (code === 2) {
        dim = true;
      } else if (code === 3) {
        italic = true;
      } else if (code === 4) {
        underline = true;
      } else if (code === 9) {
        strikethrough = true;
      } else if (code === 22) {
        bold = false;
        dim = false;
      } else if (code === 23) {
        italic = false;
      } else if (code === 24) {
        underline = false;
      } else if (code === 29) {
        strikethrough = false;
      } else if (STANDARD_COLORS[code]) {
        currentColor = STANDARD_COLORS[code];
      } else if (STANDARD_BG_COLORS[code]) {
        currentBgColor = STANDARD_BG_COLORS[code];
      } else if (code === 39) {
        currentColor = undefined;
      } else if (code === 49) {
        currentBgColor = undefined;
      } else if (code === 38 || code === 48) {
        const isFg = code === 38;
        const mode = params[i + 1];
        if (mode === 5 && i + 2 < params.length) {
          const color = get256Color(params[i + 2]);
          if (isFg) currentColor = color;
          else currentBgColor = color;
          i += 2;
        } else if (mode === 2 && i + 4 < params.length) {
          const r = params[i + 2];
          const g = params[i + 3];
          const b = params[i + 4];
          const color = `rgb(${r}, ${g}, ${b})`;
          if (isFg) currentColor = color;
          else currentBgColor = color;
          i += 4;
        }
      }
    }
  }

  if (lastIndex < normalized.length) {
    pushSegment(normalized.substring(lastIndex));
  }

  return segments;
}

/**
 * Pterodactyl-style smart log syntax highlighter.
 * Turns raw Minecraft server log streams into a richly colored, readable experience.
 */
function highlightMinecraftLine(line: string): React.ReactNode {
  // 1. MCSPanel system messages
  if (line.startsWith('[MCSPanel]')) {
    return (
      <>
        <span className="text-emerald-400 font-bold">[MCSPanel]</span>
        <span className="text-emerald-200/90">{line.slice(10)}</span>
      </>
    );
  }
  if (line.startsWith('[MCSPanel Figyelem]')) {
    return (
      <>
        <span className="text-amber-400 font-bold">[MCSPanel Figyelem]</span>
        <span className="text-amber-200">{line.slice(19)}</span>
      </>
    );
  }
  if (line.startsWith('[MCSPanel Hiba]')) {
    return (
      <>
        <span className="text-rose-400 font-bold">[MCSPanel Hiba]</span>
        <span className="text-rose-200">{line.slice(15)}</span>
      </>
    );
  }
  if (line.startsWith('[STDERR]')) {
    const rest = line.slice(8).trim();
    return (
      <>
        <span className="text-rose-500 font-bold mr-1.5 select-none">[STDERR]</span>
        {highlightMinecraftLine(rest)}
      </>
    );
  }

  // 2. Exception & Stack traces
  if (/^\s*(?:at\s+|Caused by:|\.\.\.\s*\d+\s*more)/i.test(line)) {
    const isCausedBy = line.trim().startsWith('Caused by:');
    if (isCausedBy) {
      return <span className="text-rose-400 font-bold">{line}</span>;
    }
    // Match: at com.example.Class.method(Class.java:123)
    const atMatch = line.match(/^(\s*at\s+)([a-zA-Z0-9_$.]+)(\(.*?\))(.*)$/);
    if (atMatch) {
      return (
        <span>
          <span className="text-slate-500">{atMatch[1]}</span>
          <span className="text-rose-300 font-medium">{atMatch[2]}</span>
          <span className="text-slate-400">{atMatch[3]}</span>
          {atMatch[4] && <span className="text-slate-500">{atMatch[4]}</span>}
        </span>
      );
    }
    return <span className="text-rose-300/80">{line}</span>;
  }

  // Common Java Exception Class at start of line
  if (/^[a-zA-Z0-9_.]+(?:Exception|Error|Throwable):/.test(line)) {
    const colonIdx = line.indexOf(':');
    return (
      <span>
        <span className="text-rose-400 font-bold">{line.slice(0, colonIdx + 1)}</span>
        <span className="text-rose-200 font-medium">{line.slice(colonIdx + 1)}</span>
      </span>
    );
  }

  // 3. Batch / Shell echoes
  if (/^[a-zA-Z]:\\.*>/i.test(line)) {
    const gtIdx = line.indexOf('>');
    return (
      <span>
        <span className="text-slate-500 font-mono">{line.slice(0, gtIdx + 1)}</span>
        <span className="text-purple-400 font-semibold">{line.slice(gtIdx + 1)}</span>
      </span>
    );
  }
  if (line.toLowerCase().includes('press any key to continue') || line.toLowerCase().includes('folytatáshoz nyomjon')) {
    return <span className="text-amber-400 font-semibold italic">{line}</span>;
  }

  // 4. Milestone: Done!
  if (line.includes('Done (') && line.includes('help')) {
    return <span className="text-emerald-400 font-bold">{line}</span>;
  }

  // 5. Standard Minecraft Log Format:
  // Examples:
  // [23:14:06 INFO]: [bootstrap] Running Java 25...
  // 2026-10-10T21:14:06.650502Z ServerMain WARN ...
  // [23:14:06] [Server thread/INFO]: ...
  const logMatch = line.match(
    /^(\[?\d{2}:\d{2}:\d{2}(?:\.\d+)?\]?|\d{4}-\d{2}-\d{2}T[0-9:.]+Z?)\s*(?:\[([^\]]+)\])?\s*(?:\[([^\]]+)\])?(?::\s*|\s+)(.*)$/
  );

  if (logMatch) {
    const rawTime = logMatch[1];
    const tag1 = logMatch[2]; // e.g. "Server thread/INFO" or "INFO" or "bootstrap"
    const tag2 = logMatch[3]; // e.g. "PluginName" or "INFO"
    let message = logMatch[4] ?? '';

    let level = 'INFO';
    let thread = '';
    let plugin = '';

    if (tag1) {
      if (tag1.includes('/')) {
        const parts = tag1.split('/');
        thread = parts[0];
        level = parts[1].toUpperCase();
      } else if (/^(?:INFO|WARN|WARNING|ERROR|SEVERE|FATAL|DEBUG|TRACE)$/i.test(tag1)) {
        level = tag1.toUpperCase();
      } else {
        plugin = tag1;
      }
    }

    if (tag2) {
      if (/^(?:INFO|WARN|WARNING|ERROR|SEVERE|FATAL|DEBUG|TRACE)$/i.test(tag2)) {
        level = tag2.toUpperCase();
      } else {
        plugin = tag2;
      }
    }

    // Level badge colors (Pterodactyl style)
    let levelColor = 'text-cyan-400 font-semibold';
    let msgColor = 'text-[#E2E2E6]';

    if (level === 'WARN' || level === 'WARNING') {
      levelColor = 'text-amber-400 font-bold';
      msgColor = 'text-amber-200/95';
    } else if (level === 'ERROR' || level === 'SEVERE' || level === 'FATAL') {
      levelColor = 'text-rose-400 font-bold';
      msgColor = 'text-rose-200 font-medium';
    } else if (level === 'DEBUG') {
      levelColor = 'text-indigo-400 font-medium';
      msgColor = 'text-slate-400';
    } else if (level === 'TRACE') {
      levelColor = 'text-purple-400 font-medium';
      msgColor = 'text-slate-400';
    }

    // Format special messages inside the body
    let renderedMsg: React.ReactNode = message;

    // Check for player join / leave
    const joinMatch = message.match(/^([a-zA-Z0-9_]{2,16})\s+(joined the game.*)$/i);
    const leaveMatch = message.match(/^([a-zA-Z0-9_]{2,16})\s+(left the game.*|lost connection.*)$/i);
    const chatMatch = message.match(/^<([a-zA-Z0-9_]{2,16})>\s+(.*)$/);

    if (joinMatch) {
      renderedMsg = (
        <span>
          <span className="text-yellow-300 font-bold">{joinMatch[1]}</span>{' '}
          <span className="text-emerald-400 font-bold">{joinMatch[2]}</span>
        </span>
      );
    } else if (leaveMatch) {
      renderedMsg = (
        <span>
          <span className="text-yellow-300 font-bold">{leaveMatch[1]}</span>{' '}
          <span className="text-rose-400 font-semibold">{leaveMatch[2]}</span>
        </span>
      );
    } else if (chatMatch) {
      renderedMsg = (
        <span>
          <span className="text-amber-400 font-bold">&lt;{chatMatch[1]}&gt;</span>{' '}
          <span className="text-white">{chatMatch[2]}</span>
        </span>
      );
    } else if (message.includes('Done (') && message.includes('help')) {
      renderedMsg = <span className="text-emerald-400 font-bold">{message}</span>;
    }

    return (
      <>
        {/* Timestamp */}
        <span className="text-slate-500 font-mono select-none mr-2">{rawTime}</span>

        {/* Thread info */}
        {thread && <span className="text-slate-400 font-mono mr-1.5">[{thread}]</span>}

        {/* Level badge */}
        <span className={`${levelColor} mr-1.5`}>[{level}]</span>

        {/* Plugin / Component tag */}
        {plugin && <span className="text-purple-400 font-semibold mr-1.5">[{plugin}]</span>}

        {/* Colon separator if neither thread nor plugin */}
        {!plugin && !thread && <span className="text-slate-500 mr-1.5">:</span>}

        {/* Message body */}
        <span className={msgColor}>{renderedMsg}</span>
      </>
    );
  }

  // 6. Generic player chat or join without full timestamp prefix
  const rawJoin = line.match(/^([a-zA-Z0-9_]{2,16})\s+(joined the game.*)$/i);
  if (rawJoin) {
    return (
      <span>
        <span className="text-yellow-300 font-bold">{rawJoin[1]}</span>{' '}
        <span className="text-emerald-400 font-bold">{rawJoin[2]}</span>
      </span>
    );
  }

  const rawChat = line.match(/^<([a-zA-Z0-9_]{2,16})>\s+(.*)$/);
  if (rawChat) {
    return (
      <span>
        <span className="text-amber-400 font-bold">&lt;{rawChat[1]}&gt;</span>{' '}
        <span className="text-white">{rawChat[2]}</span>
      </span>
    );
  }

  // Default clean output
  return <span className="text-[#E2E2E6]">{line}</span>;
}

/**
 * React Component to render a parsed ANSI or syntax-highlighted log line.
 */
export const AnsiLine: React.FC<{ text: string }> = React.memo(({ text }) => {
  const hasFormatting = text.includes('\x1b') || text.includes('§');

  if (!hasFormatting) {
    // Apply Pterodactyl-style smart log highlighting for rich colors
    return <>{highlightMinecraftLine(text)}</>;
  }

  const segments = React.useMemo(() => parseAnsi(text), [text]);

  if (segments.length === 0) {
    return <span className="inline-block h-[18px]">&nbsp;</span>;
  }

  return (
    <>
      {segments.map((seg, i) => {
        const style: React.CSSProperties = {};
        if (seg.color) style.color = seg.color;
        if (seg.bgColor) style.backgroundColor = seg.bgColor;
        if (seg.bold) style.fontWeight = 'bold';
        if (seg.italic) style.fontStyle = 'italic';
        if (seg.dim) style.opacity = 0.65;
        if (seg.underline || seg.strikethrough) {
          const decs: string[] = [];
          if (seg.underline) decs.push('underline');
          if (seg.strikethrough) decs.push('line-through');
          style.textDecoration = decs.join(' ');
        }

        return (
          <span key={i} style={style}>
            {seg.text}
          </span>
        );
      })}
    </>
  );
});

AnsiLine.displayName = 'AnsiLine';
