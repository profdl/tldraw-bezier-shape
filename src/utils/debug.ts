/**
 * Simple debug logging utility
 */

const DEBUG_ENABLED = import.meta.env.DEV

export function debugLog(category: string, message: string, data?: unknown): void {
  if (DEBUG_ENABLED) {
    console.log(`[${category}] ${message}`, data !== undefined ? data : '')
  }
}

export function debugWarn(category: string, message: string, data?: unknown): void {
  if (DEBUG_ENABLED) {
    console.warn(`[${category}] ${message}`, data !== undefined ? data : '')
  }
}

export function debugError(category: string, message: string, error?: unknown): void {
  if (DEBUG_ENABLED) {
    console.error(`[${category}] ${message}`, error)
  }
}
