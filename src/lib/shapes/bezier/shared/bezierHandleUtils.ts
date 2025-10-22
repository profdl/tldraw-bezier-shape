/**
 * Utilities for parsing and working with bezier handle IDs.
 *
 * TLDraw handles use string IDs to identify which point/control point they represent.
 * Our bezier shapes use the format: "bezier-{index}-{type}"
 *
 * Examples:
 * - "bezier-0-anchor" → Anchor point at index 0
 * - "bezier-2-cp1" → Control point 1 (incoming) at index 2
 * - "bezier-5-cp2" → Control point 2 (outgoing) at index 5
 */

/**
 * Type of handle on a bezier point.
 *
 * @public
 */
export type BezierHandleType = 'anchor' | 'cp1' | 'cp2'

/**
 * Parsed information from a bezier handle ID.
 *
 * @public
 */
export interface ParsedHandleId {
  /** Index of the point in the points array */
  pointIndex: number
  /** Type of handle (anchor, cp1, or cp2) */
  handleType: BezierHandleType
  /** Whether the ID was valid and could be parsed */
  isValid: boolean
}

/**
 * Parse a TLDraw handle ID into its components.
 *
 * Handle ID format: "bezier-{index}-{type}"
 * - index: number (0-based index in points array)
 * - type: "anchor" | "cp1" | "cp2"
 *
 * @param handleId - The handle ID string from TLDraw
 * @returns Parsed handle information, or invalid result if format is wrong
 *
 * @example
 * ```ts
 * const parsed = parseHandleId("bezier-3-cp1");
 * if (parsed.isValid) {
 *   console.log(parsed.pointIndex);  // 3
 *   console.log(parsed.handleType);  // "cp1"
 * }
 * ```
 *
 * @public
 */
export function parseHandleId(handleId: string): ParsedHandleId {
  // Split the handle ID by dashes
  const parts = handleId.split('-')

  // Validate format: must be "bezier-{number}-{type}"
  if (parts.length !== 3 || parts[0] !== 'bezier') {
    return {
      pointIndex: -1,
      handleType: 'anchor',
      isValid: false
    }
  }

  // Parse the point index (second part)
  const pointIndex = parseInt(parts[1], 10)
  if (isNaN(pointIndex) || pointIndex < 0) {
    return {
      pointIndex: -1,
      handleType: 'anchor',
      isValid: false
    }
  }

  // Validate handle type (third part)
  const handleType = parts[2] as BezierHandleType
  if (handleType !== 'anchor' && handleType !== 'cp1' && handleType !== 'cp2') {
    return {
      pointIndex: -1,
      handleType: 'anchor',
      isValid: false
    }
  }

  return {
    pointIndex,
    handleType,
    isValid: true
  }
}

/**
 * Create a handle ID for a bezier point.
 *
 * @param pointIndex - Index of the point in the points array
 * @param handleType - Type of handle (anchor, cp1, or cp2)
 * @returns Formatted handle ID string
 *
 * @example
 * ```ts
 * const id = createHandleId(3, 'cp1');
 * // Returns: "bezier-3-cp1"
 * ```
 *
 * @public
 */
export function createHandleId(pointIndex: number, handleType: BezierHandleType): string {
  return `bezier-${pointIndex}-${handleType}`
}

/**
 * Check if a handle ID represents an anchor point.
 *
 * @param handleId - The handle ID to check
 * @returns True if the handle is an anchor point
 *
 * @public
 */
export function isAnchorHandle(handleId: string): boolean {
  const parsed = parseHandleId(handleId)
  return parsed.isValid && parsed.handleType === 'anchor'
}

/**
 * Check if a handle ID represents a control point (cp1 or cp2).
 *
 * @param handleId - The handle ID to check
 * @returns True if the handle is a control point
 *
 * @public
 */
export function isControlHandle(handleId: string): boolean {
  const parsed = parseHandleId(handleId)
  return parsed.isValid && (parsed.handleType === 'cp1' || parsed.handleType === 'cp2')
}
