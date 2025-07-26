export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const PREFIX = '[trackkit]';
const STYLES = {
  debug: 'color: #888',
  info: 'color: #0066cc',
  warn: 'color: #ff9800',
  error: 'color: #f44336',
};

/**
 * Safe error logger that handles circular references
 */
export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function createLogger(enabled: boolean): Logger {
  if (!enabled || typeof console === 'undefined') {
    // No-op logger
    const noop = () => undefined;
    return { debug: noop, info: noop, warn: noop, error: noop };
  }
  
  return {
    debug(...args) {
      console.log(`%c${PREFIX}`, STYLES.debug, ...args);
    },
    
    info(...args) {
      console.info(`%c${PREFIX}`, STYLES.info, ...args);
    },
    
    warn(...args) {
      console.warn(`%c${PREFIX}`, STYLES.warn, ...args);
    },
    
    error(...args) {
      const formatted = args.map(arg => 
        arg instanceof Error ? stringifyError(arg) : arg
      );
      console.error(`%c${PREFIX}`, STYLES.error, ...formatted);
    },
  };
}

// Global logger instance, configured during init
export let logger: Logger = createLogger(false);

export function setGlobalLogger(newLogger: Logger): void {
  logger = newLogger;
}