import { type Editor } from '@tldraw/editor'
import { type BezierPoint, type BezierShape } from '../BezierShapeUtil'
import { BEZIER_THRESHOLDS } from './bezierConstants'

/**
 * Context information about where the user clicked/hovered on a bezier shape.
 *
 * Used to determine what action to take in response to pointer events.
 *
 * @public
 */
export interface InteractionContext {
  /** True if clicking on any handle (anchor or control point) */
  clickingOnHandle: boolean
  /** True if clicking specifically on an anchor point */
  clickingOnAnchorPoint: boolean
  /** The click position in shape-local coordinates */
  localPoint: { x: number; y: number }
  /** Index of the anchor point clicked, or -1 if not clicking an anchor */
  anchorPointIndex: number
}

/**
 * Service for detecting what the user is interacting with on a bezier shape.
 *
 * This service provides hit-testing functionality to determine whether pointer
 * events are targeting:
 * - Anchor points (the points the curve passes through)
 * - Control points (bezier handles)
 * - Nothing (empty space)
 *
 * All detection uses zoom-scaled thresholds to maintain consistent hit targets
 * regardless of canvas zoom level.
 *
 * @example
 * ```ts
 * const context = BezierInteractionDetector.getInteractionContext(
 *   editor,
 *   shape,
 *   pagePoint
 * );
 *
 * if (context.clickingOnAnchorPoint) {
 *   // Handle anchor point selection
 * } else if (context.clickingOnHandle) {
 *   // Handle control point drag
 * }
 * ```
 *
 * @public
 */
export class BezierInteractionDetector {
  /**
   * Get interaction context for a pointer position on a bezier shape.
   *
   * This method converts page coordinates to local coordinates and checks
   * what the pointer is near (anchor points, control points, or nothing).
   *
   * @param editor - TLDraw editor instance (for zoom level and bounds)
   * @param shape - The bezier shape to check interaction with
   * @param pagePoint - Pointer position in page coordinates
   * @returns Interaction context describing what the pointer is over
   */
  static getInteractionContext(
    editor: Editor,
    shape: BezierShape,
    pagePoint: { x: number; y: number }
  ): InteractionContext {
    const shapePageBounds = editor.getShapePageBounds(shape.id)

    if (!shapePageBounds) {
      return {
        clickingOnHandle: false,
        clickingOnAnchorPoint: false,
        localPoint: { x: 0, y: 0 },
        anchorPointIndex: -1
      }
    }

    // Convert page coordinates to shape-local coordinates
    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Scale threshold by zoom level to maintain consistent hit targets
    const threshold = BEZIER_THRESHOLDS.ANCHOR_POINT / editor.getZoomLevel()
    const points = shape.props.points || []

    let clickingOnHandle = false
    let clickingOnAnchorPoint = false
    let anchorPointIndex = -1

    // Check anchor points and control points
    // Priority order: anchor points first, then control points
    for (let i = 0; i < points.length; i++) {
      const point = points[i]

      // Check anchor point (the point the curve passes through)
      const anchorDist = Math.sqrt(
        Math.pow(localPoint.x - point.x, 2) + Math.pow(localPoint.y - point.y, 2)
      )

      if (anchorDist < threshold) {
        clickingOnHandle = true
        clickingOnAnchorPoint = true
        anchorPointIndex = i
        break  // Found anchor, no need to check control points
      }

      // Check control point 1 (incoming handle)
      if (point.cp1) {
        const cp1Dist = Math.sqrt(
          Math.pow(localPoint.x - point.cp1.x, 2) + Math.pow(localPoint.y - point.cp1.y, 2)
        )
        if (cp1Dist < threshold) {
          clickingOnHandle = true
          break  // Found control point
        }
      }

      // Check control point 2 (outgoing handle)
      if (point.cp2) {
        const cp2Dist = Math.sqrt(
          Math.pow(localPoint.x - point.cp2.x, 2) + Math.pow(localPoint.y - point.cp2.y, 2)
        )
        if (cp2Dist < threshold) {
          clickingOnHandle = true
          break  // Found control point
        }
      }
    }

    return {
      clickingOnHandle,
      clickingOnAnchorPoint,
      localPoint,
      anchorPointIndex
    }
  }

  /**
   * Check if a point in page coordinates is inside the shape's bounds.
   *
   * This is a quick bounding-box test before doing more expensive
   * segment-level hit detection.
   *
   * @param editor - TLDraw editor instance
   * @param shape - The bezier shape to test
   * @param pagePoint - Point to test in page coordinates
   * @returns True if point is within the shape's bounding box
   */
  static isPointInShapeBounds(
    editor: Editor,
    shape: BezierShape,
    pagePoint: { x: number; y: number }
  ): boolean {
    const bounds = editor.getShapePageBounds(shape.id)
    if (!bounds) return false

    return (
      pagePoint.x >= bounds.x &&
      pagePoint.x <= bounds.x + bounds.w &&
      pagePoint.y >= bounds.y &&
      pagePoint.y <= bounds.y + bounds.h
    )
  }

  /**
   * Calculate distance between two points using Euclidean distance formula.
   *
   * @param p1 - First point
   * @param p2 - Second point
   * @returns Distance in pixels
   */
  static getDistance(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Clone a bezier points array (deep copy).
   *
   * Creates a completely new array with new point objects, so modifications
   * to the clone don't affect the original.
   *
   * @param points - Points array to clone
   * @returns Deep copy of the points array
   */
  static clonePoints(points: BezierPoint[]): BezierPoint[] {
    return points.map(point => ({
      x: point.x,
      y: point.y,
      cp1: point.cp1 ? { x: point.cp1.x, y: point.cp1.y } : undefined,
      cp2: point.cp2 ? { x: point.cp2.x, y: point.cp2.y } : undefined,
    }))
  }
}
