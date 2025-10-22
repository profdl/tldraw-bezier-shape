import { WeakCache } from '@tldraw/editor'
import { PathBuilder } from 'tldraw'
import type { BezierPoint, BezierShape } from '../BezierShape'

/**
 * Converts an array of BezierPoints to a PathBuilder instance.
 * This follows tldraw's native pattern for constructing paths.
 *
 * @param points - Array of bezier points with optional control points
 * @param isClosed - Whether the path should be closed
 * @returns PathBuilder instance ready for rendering
 */
export function bezierPointsToPathBuilder(
  points: BezierPoint[],
  isClosed: boolean
): PathBuilder {
  const path = new PathBuilder()
  applyPointsToPath(path, points, isClosed)
  return path
}

/**
 * WeakCache for PathBuilder instances to improve performance.
 * The cache automatically evicts entries when shapes are garbage collected.
 */
const pathCache = new WeakCache<BezierShape, PathBuilder>()

/**
 * Gets a cached PathBuilder for the given BezierShape.
 * This follows tldraw's pattern of caching expensive computations.
 *
 * @param shape - The bezier shape to build a path for
 * @returns Cached or newly created PathBuilder instance
 */
export function getPathForBezierShape(shape: BezierShape): PathBuilder {
  return pathCache.get(shape, () => {
    return bezierPointsToPathBuilder(shape.props.points, shape.props.isClosed)
  })
}

/**
 * Gets a PathBuilder representing hole rings for compound bezier shapes.
 * Hole rings are rendered as separate closed subpaths using the evenodd fill rule.
 */
export function getPathForHoleRings(holeRings: BezierPoint[][] = []): PathBuilder {
  const path = new PathBuilder()

  for (const ring of holeRings) {
    if (!ring || ring.length === 0) continue
    applyPointsToPath(path, ring, true)
  }

  return path
}

function applyPointsToPath(path: PathBuilder, points: BezierPoint[], isClosed: boolean) {
  if (points.length === 0) return

  const first = points[0]
  path.moveTo(first.x, first.y, {
    geometry: { isFilled: isClosed },
  })

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cp1x = prev.cp2?.x ?? prev.x
    const cp1y = prev.cp2?.y ?? prev.y
    const cp2x = curr.cp1?.x ?? curr.x
    const cp2y = curr.cp1?.y ?? curr.y
    path.cubicBezierTo(curr.x, curr.y, cp1x, cp1y, cp2x, cp2y)
  }

  if (isClosed && points.length > 1) {
    const last = points[points.length - 1]
    const firstPoint = points[0]
    const cp1x = last.cp2?.x ?? last.x
    const cp1y = last.cp2?.y ?? last.y
    const cp2x = firstPoint.cp1?.x ?? firstPoint.x
    const cp2y = firstPoint.cp1?.y ?? firstPoint.y
    path.cubicBezierTo(firstPoint.x, firstPoint.y, cp1x, cp1y, cp2x, cp2y)
    path.close()
  }
}
