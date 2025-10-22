import type { BezierPoint } from './bezierShape'
import { BezierBounds } from './bezierBounds'

/**
 * Convert a single segment to SVG path data for highlighting / selection visuals.
 */
export function bezierSegmentToPath(points: BezierPoint[], segmentIndex: number, isClosed: boolean): string {
  if (segmentIndex < 0 || points.length < 2) return ''

  const startPoint = points[segmentIndex]
  if (!startPoint) return ''

  const isClosingSegment = segmentIndex === points.length - 1 && isClosed
  const endIndex = isClosingSegment ? 0 : segmentIndex + 1
  const endPoint = points[endIndex]
  if (!endPoint) return ''

  const startCommand = `M ${startPoint.x} ${startPoint.y}`

  if (startPoint.cp2 && endPoint.cp1) {
    return `${startCommand} C ${startPoint.cp2.x} ${startPoint.cp2.y} ${endPoint.cp1.x} ${endPoint.cp1.y} ${endPoint.x} ${endPoint.y}`
  }

  if (startPoint.cp2) {
    return `${startCommand} Q ${startPoint.cp2.x} ${startPoint.cp2.y} ${endPoint.x} ${endPoint.y}`
  }

  if (endPoint.cp1) {
    return `${startCommand} Q ${endPoint.cp1.x} ${endPoint.cp1.y} ${endPoint.x} ${endPoint.y}`
  }

  return `${startCommand} L ${endPoint.x} ${endPoint.y}`
}

/**
 * Calculate accurate bounds for Bezier points.
 */
export function getBezierPointBounds(points: BezierPoint[], isClosed: boolean) {
  return BezierBounds.getAccurateBounds(points, isClosed)
}

/**
 * Normalize bezier points to start at origin while preserving control points.
 */
export function normalizeBezierPoints(points: BezierPoint[]) {
  if (points.length === 0) {
    return { normalizedPoints: [], offset: { x: 0, y: 0 } }
  }

  const bounds = BezierBounds.getAccurateBounds(points, false)
  const offset = { x: bounds.minX, y: bounds.minY }

  const normalizedPoints = points.map(point => ({
    x: point.x - offset.x,
    y: point.y - offset.y,
    cp1: point.cp1 ? { x: point.cp1.x - offset.x, y: point.cp1.y - offset.y } : undefined,
    cp2: point.cp2 ? { x: point.cp2.x - offset.x, y: point.cp2.y - offset.y } : undefined
  }))

  return { normalizedPoints, offset }
}
