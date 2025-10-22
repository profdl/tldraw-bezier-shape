import { type BezierPoint, type BezierShape } from './bezierShape'
import { BezierMath } from './bezierMath'

/**
 * Bounds calculation and normalization service for Bezier shapes.
 *
 * This service handles all bounding box calculations and coordinate transformations
 * for bezier paths. It's critical for:
 * - Proper shape rendering and selection
 * - Maintaining correct transform controls
 * - Coordinate system conversions between local and page space
 *
 * Key concepts:
 * - **Accurate bounds**: Uses bezier-js to calculate precise curve bounds, not just anchor points
 * - **Normalization**: Converts absolute page coordinates to local shape coordinates
 * - **Edit vs Normal mode**: Different bounds calculation strategies depending on interaction state
 *
 * Technical notes:
 * - All points in a shape are stored in local coordinates (relative to shape.x, shape.y)
 * - Bounds must account for control points, not just anchor points
 * - Uses bezier-js bbox() method for mathematically accurate curve bounds
 *
 * @example
 * ```ts
 * // Calculate accurate bounds for a path
 * const bounds = BezierBounds.getAccurateBounds(points, isClosed)
 *
 * // Recalculate shape bounds after modifying points
 * const updatedShape = BezierBounds.recalculateShapeBounds(shape, newPoints)
 * ```
 */
export class BezierBounds {

  /**
   * Calculate accurate bounding box for a bezier path using the bezier-js library.
   *
   * This method provides mathematically precise bounds by analyzing the actual curve,
   * not just the anchor points. It handles:
   * - Single point paths (returns point position with control points)
   * - Multi-point paths (analyzes all curve segments)
   * - Closed paths (includes the closing segment)
   *
   * Why this is important:
   * Control points can extend beyond anchor points, so naive min/max of anchor positions
   * would give incorrect bounds. The bezier-js library uses calculus to find the true
   * extrema of each curve segment.
   *
   * @param points - Array of bezier points forming the path
   * @param isClosed - Whether the path forms a closed loop (affects final segment)
   * @returns Bounding box as { minX, minY, maxX, maxY } in the points' coordinate space
   *
   * @example
   * ```ts
   * const bounds = BezierBounds.getAccurateBounds([p1, p2, p3], false)
   * const width = bounds.maxX - bounds.minX
   * const height = bounds.maxY - bounds.minY
   * ```
   */
  static getAccurateBounds(points: BezierPoint[], isClosed: boolean = false) {
    if (points.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    }
    
    if (points.length === 1) {
      const point = points[0]
      // Include control points in single-point bounds calculation
      const allPoints = [{ x: point.x, y: point.y }]
      if (point.cp1) allPoints.push(point.cp1)
      if (point.cp2) allPoints.push(point.cp2)
      
      const xs = allPoints.map(p => p.x)
      const ys = allPoints.map(p => p.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...xs)
      const maxY = Math.max(...ys)
      
      return { minX, minY, maxX, maxY }
    }
    
    // Calculate bounds using bezier.js for accurate curve bounds
    const segments = BezierMath.getAllSegments(points, isClosed)
    
    if (segments.length === 0) {
      // Fallback to basic point bounds
      const xs = points.map(p => p.x)
      const ys = points.map(p => p.y)
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      }
    }
    
    // Use bezier-js bbox method for precise curve bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    for (const segment of segments) {
      const bbox = segment.bbox()
      minX = Math.min(minX, bbox.x.min)
      minY = Math.min(minY, bbox.y.min)
      maxX = Math.max(maxX, bbox.x.max)
      maxY = Math.max(maxY, bbox.y.max)
    }
    
    return { minX, minY, maxX, maxY }
  }

  /**
   * Recalculate shape bounds and normalize points to the new bounding box.
   *
   * This is the primary method for updating a shape after points have changed.
   * It performs three operations in sequence:
   * 1. Calculate accurate bounds for the new points
   * 2. Normalize all points to local coordinates (relative to new bounds origin)
   * 3. Update shape position and dimensions to match new bounds
   *
   * Coordinate transformation:
   * - Input points are in page coordinates (absolute positions)
   * - Output points are in local coordinates (relative to shape.x, shape.y)
   * - shape.x and shape.y are adjusted to maintain the same page position
   *
   * This method is called:
   * - After adding or deleting points
   * - After dragging anchor points or control points
   * - When exiting edit mode
   * - When finishing curve creation
   *
   * @param shape - The bezier shape to update
   * @param newPoints - New points array in page coordinates (will be normalized to local)
   * @returns New shape object with updated bounds, position, and normalized points
   *
   * @example
   * ```ts
   * // After modifying points in page coordinates
   * const modifiedPoints = [...shape.props.points]
   * modifiedPoints[0] = { x: 100, y: 100 } // Page coordinates
   * const updated = BezierBounds.recalculateShapeBounds(shape, modifiedPoints)
   * // updated.props.points[0] is now in local coordinates relative to updated.x, updated.y
   * ```
   */
  static recalculateShapeBounds(
    shape: BezierShape, 
    newPoints: BezierPoint[]
  ): BezierShape {
    const bounds = this.getAccurateBounds(newPoints, shape.props.isClosed)
    
    const w = Math.max(1, bounds.maxX - bounds.minX)
    const h = Math.max(1, bounds.maxY - bounds.minY)

    // Normalize points to new bounds
    const normalizedPoints = newPoints.map(p => ({
      x: p.x - bounds.minX,
      y: p.y - bounds.minY,
      cp1: p.cp1 ? { 
        x: p.cp1.x - bounds.minX, 
        y: p.cp1.y - bounds.minY 
      } : undefined,
      cp2: p.cp2 ? { 
        x: p.cp2.x - bounds.minX, 
        y: p.cp2.y - bounds.minY 
      } : undefined,
    }))

    return {
      ...shape,
      x: shape.x + bounds.minX,
      y: shape.y + bounds.minY,
      props: {
        ...shape.props,
        w,
        h,
        points: normalizedPoints,
      }
    }
  }

  /**
   * Get bounds for editing mode - returns actual curve bounds for proper hit detection
   */
  static getEditModeBounds(shape: BezierShape) {
    const bounds = this.getAccurateBounds(shape.props.points, shape.props.isClosed)
    return {
      x: 0,
      y: 0,
      w: Math.max(1, bounds.maxX - bounds.minX),
      h: Math.max(1, bounds.maxY - bounds.minY),
    }
  }

  /**
   * Get bounds for normal mode - uses stored width and height
   */
  static getNormalModeBounds(shape: BezierShape) {
    return {
      x: 0,
      y: 0,
      w: shape.props.w,
      h: shape.props.h,
    }
  }

  /**
   * Calculate bounds for creation mode with single point
   * Includes padding and handles control point positioning
   */
  static getSinglePointBounds(
    point: BezierPoint, 
    padding: number = 50
  ): {
    bounds: { x: number; y: number; w: number; h: number }
    normalizedPoints: BezierPoint[]
  } {
    // Calculate bounds including any control points from the point
    const allPoints = [{ x: point.x, y: point.y }]
    if (point.cp1) allPoints.push(point.cp1)
    if (point.cp2) allPoints.push(point.cp2)
    
    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    // Use actual bounds for single point to prevent jumping
    const actualMinX = minX - padding
    const actualMinY = minY - padding
    const w = Math.max(1, maxX - minX + padding * 2)
    const h = Math.max(1, maxY - minY + padding * 2)
    
    const normalizedPoints = [{
      x: point.x - actualMinX,
      y: point.y - actualMinY,
      cp1: point.cp1 ? { 
        x: point.cp1.x - actualMinX, 
        y: point.cp1.y - actualMinY 
      } : undefined,
      cp2: point.cp2 ? { 
        x: point.cp2.x - actualMinX, 
        y: point.cp2.y - actualMinY 
      } : undefined,
    }]

    return {
      bounds: { x: actualMinX, y: actualMinY, w, h },
      normalizedPoints
    }
  }

  /**
   * Calculate bounds for creation mode with multiple points
   * Uses stable origin positioning to prevent shifting during creation
   */
  static getMultiPointBounds(
    points: BezierPoint[],
    stableOrigin?: { x: number; y: number }
  ): {
    bounds: { x: number; y: number; w: number; h: number }
    normalizedPoints: BezierPoint[]
  } {
    const origin = stableOrigin || { x: points[0].x, y: points[0].y }
    
    const allPoints = points.flatMap(p => [
      { x: p.x, y: p.y },
      ...(p.cp1 ? [p.cp1] : []),
      ...(p.cp2 ? [p.cp2] : [])
    ])
    
    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)
    
    const leftExtent = origin.x - minX
    const rightExtent = maxX - origin.x
    const topExtent = origin.y - minY
    const bottomExtent = maxY - origin.y
    
    const actualMinX = origin.x - Math.max(leftExtent, rightExtent) - 10
    const actualMinY = origin.y - Math.max(topExtent, bottomExtent) - 10
    const actualMaxX = origin.x + Math.max(leftExtent, rightExtent) + 10
    const actualMaxY = origin.y + Math.max(topExtent, bottomExtent) + 10
    
    const w = Math.max(1, actualMaxX - actualMinX)
    const h = Math.max(1, actualMaxY - actualMinY)
    
    const normalizedPoints = points.map(p => ({
      x: p.x - actualMinX,
      y: p.y - actualMinY,
      cp1: p.cp1 ? { 
        x: p.cp1.x - actualMinX, 
        y: p.cp1.y - actualMinY 
      } : undefined,
      cp2: p.cp2 ? { 
        x: p.cp2.x - actualMinX, 
        y: p.cp2.y - actualMinY 
      } : undefined,
    }))

    return {
      bounds: { x: actualMinX, y: actualMinY, w, h },
      normalizedPoints
    }
  }

  /**
   * Get shape center point calculated from actual bounds
   */
  static getShapeCenter(shape: BezierShape): { x: number; y: number } {
    let bounds: { x: number; y: number; w: number; h: number }
    
    if (shape.props.editMode) {
      bounds = this.getEditModeBounds(shape)
    } else {
      bounds = this.getNormalModeBounds(shape)
    }
    
    return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
    }
  }

  /**
   * Convert shape points to outline points for TLDraw
   */
  static getOutlinePoints(shape: BezierShape): { x: number; y: number }[] {
    return shape.props.points.map(p => ({ x: p.x, y: p.y }))
  }

  /**
   * Check if bounds have changed between two point arrays
   */
  static haveBoundsChanged(
    prevPoints: BezierPoint[], 
    nextPoints: BezierPoint[], 
    isClosed: boolean,
    threshold: number = 0.01
  ): boolean {
    const prevBounds = this.getAccurateBounds(prevPoints, isClosed)
    const nextBounds = this.getAccurateBounds(nextPoints, isClosed)
    
    const widthChanged = Math.abs(
      (prevBounds.maxX - prevBounds.minX) - (nextBounds.maxX - nextBounds.minX)
    ) > threshold
    
    const heightChanged = Math.abs(
      (prevBounds.maxY - prevBounds.minY) - (nextBounds.maxY - nextBounds.minY)
    ) > threshold
    
    const positionChanged = 
      Math.abs(prevBounds.minX - nextBounds.minX) > threshold ||
      Math.abs(prevBounds.minY - nextBounds.minY) > threshold
    
    return widthChanged || heightChanged || positionChanged
  }
}
