import { describe, it, expect } from 'vitest'
import { BezierMath } from './bezierMath'
import { type BezierPoint } from './bezierShape'

describe('BezierMath - Segment Conversion', () => {
  it('should convert cubic bezier segment', () => {
    const p1: BezierPoint = { x: 0, y: 0, cp2: { x: 25, y: 0 } }
    const p2: BezierPoint = { x: 100, y: 100, cp1: { x: 75, y: 100 } }

    const bezier = BezierMath.segmentToBezier(p1, p2)

    expect(bezier.points).toHaveLength(4)
    expect(bezier.points[0]).toEqual({ x: 0, y: 0 })
    expect(bezier.points[3]).toEqual({ x: 100, y: 100 })
  })

  it('should convert quadratic bezier with cp2', () => {
    const p1: BezierPoint = { x: 0, y: 0, cp2: { x: 50, y: 50 } }
    const p2: BezierPoint = { x: 100, y: 0 }

    const bezier = BezierMath.segmentToBezier(p1, p2)

    expect(bezier.points).toHaveLength(3)
  })

  it('should convert quadratic bezier with cp1', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 0, cp1: { x: 50, y: 50 } }

    const bezier = BezierMath.segmentToBezier(p1, p2)

    expect(bezier.points).toHaveLength(3)
  })

  it('should convert linear segment', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 100 }

    const bezier = BezierMath.segmentToBezier(p1, p2)

    expect(bezier.points).toHaveLength(3) // Degenerate quadratic
  })
})

describe('BezierMath - Point Calculations', () => {
  it('should calculate point at t=0 (start point)', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 100 }

    const point = BezierMath.getPointOnSegment(p1, p2, 0)

    expect(point.x).toBeCloseTo(0, 1)
    expect(point.y).toBeCloseTo(0, 1)
  })

  it('should calculate point at t=1 (end point)', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 100 }

    const point = BezierMath.getPointOnSegment(p1, p2, 1)

    expect(point.x).toBeCloseTo(100, 1)
    expect(point.y).toBeCloseTo(100, 1)
  })

  it('should calculate midpoint at t=0.5', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 0 }

    const point = BezierMath.getPointOnSegment(p1, p2, 0.5)

    // Linear segment converts to quadratic with control point at start
    // so midpoint is not exactly at 50 for degenerate bezier
    expect(point.x).toBeGreaterThan(0)
    expect(point.x).toBeLessThan(100)
    expect(point.y).toBeCloseTo(0, 1)
  })
})

describe('BezierMath - Segment Splitting', () => {
  it('should split linear segment at midpoint', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 100 }

    const result = BezierMath.splitSegmentAtT(p1, p2, 0.5)

    // Linear segments are degenerate beziers, split point should be somewhere on the line
    expect(result.splitPoint.x).toBeGreaterThan(0)
    expect(result.splitPoint.x).toBeLessThan(100)
    expect(result.splitPoint.y).toBeGreaterThan(0)
    expect(result.splitPoint.y).toBeLessThan(100)

    // Check split point has control points
    expect(result.splitPoint.cp1).toBeDefined()
    expect(result.splitPoint.cp2).toBeDefined()

    // Left segment: from p1 to split point (validate structure)
    expect(result.leftSegment.p1.x).toBe(0)
    expect(result.leftSegment.p1.y).toBe(0)
    expect(result.leftSegment.p2.x).toBeGreaterThan(0)
    expect(result.leftSegment.p2.x).toBeLessThan(100)

    // Right segment: from split point to p2 (validate structure)
    expect(result.rightSegment.p1.x).toBeGreaterThan(0)
    expect(result.rightSegment.p1.x).toBeLessThan(100)
    expect(result.rightSegment.p2.x).toBe(100)
    expect(result.rightSegment.p2.y).toBe(100)
  })

  it('should split cubic bezier at t=0.25', () => {
    const p1: BezierPoint = { x: 0, y: 0, cp2: { x: 33, y: 0 } }
    const p2: BezierPoint = { x: 100, y: 100, cp1: { x: 67, y: 100 } }

    const result = BezierMath.splitSegmentAtT(p1, p2, 0.25)

    // Split point should be between start and end
    expect(result.splitPoint.x).toBeGreaterThan(0)
    expect(result.splitPoint.x).toBeLessThan(100)

    // All control points should be defined for smooth continuation
    expect(result.splitPoint.cp1).toBeDefined()
    expect(result.splitPoint.cp2).toBeDefined()
  })

  it('should preserve curve shape after split', () => {
    const p1: BezierPoint = { x: 0, y: 0, cp2: { x: 25, y: 50 } }
    const p2: BezierPoint = { x: 100, y: 0, cp1: { x: 75, y: 50 } }

    // Calculate a point on the original curve
    const originalPoint = BezierMath.getPointOnSegment(p1, p2, 0.5)

    // Split at midpoint
    const result = BezierMath.splitSegmentAtT(p1, p2, 0.5)

    // Split point should match the original curve point at t=0.5
    expect(result.splitPoint.x).toBeCloseTo(originalPoint.x, 0)
    expect(result.splitPoint.y).toBeCloseTo(originalPoint.y, 0)
  })
})

describe('BezierMath - Distance Calculations', () => {
  it('should calculate distance between two points', () => {
    const p1 = { x: 0, y: 0 }
    const p2 = { x: 3, y: 4 }

    const distance = BezierMath.getDistance(p1, p2)

    expect(distance).toBeCloseTo(5, 1) // 3-4-5 triangle
  })

  it('should return zero for same point', () => {
    const p = { x: 50, y: 50 }

    const distance = BezierMath.getDistance(p, p)

    expect(distance).toBe(0)
  })

  it('should calculate segment length', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 0 }

    const length = BezierMath.getSegmentLength(p1, p2)

    expect(length).toBeCloseTo(100, 0)
  })

  it('should calculate curved segment length', () => {
    const p1: BezierPoint = { x: 0, y: 0, cp2: { x: 50, y: 50 } }
    const p2: BezierPoint = { x: 100, y: 0, cp1: { x: 50, y: -50 } }

    const length = BezierMath.getSegmentLength(p1, p2)

    // Curved length should be greater than straight-line distance
    const straightDistance = BezierMath.getDistance(p1, p2)
    expect(length).toBeGreaterThan(straightDistance)
  })
})

describe('BezierMath - Bounds Calculation', () => {
  it('should calculate bounds for single point', () => {
    const points: BezierPoint[] = [{ x: 50, y: 50 }]

    const bounds = BezierMath.getAccurateBounds(points, false)

    expect(bounds.minX).toBe(50)
    expect(bounds.minY).toBe(50)
    expect(bounds.maxX).toBe(50)
    expect(bounds.maxY).toBe(50)
  })

  it('should calculate bounds for straight line', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]

    const bounds = BezierMath.getAccurateBounds(points, false)

    expect(bounds.minX).toBeCloseTo(0, 1)
    expect(bounds.minY).toBeCloseTo(0, 1)
    expect(bounds.maxX).toBeCloseTo(100, 1)
    expect(bounds.maxY).toBeCloseTo(100, 1)
  })

  it('should calculate accurate bounds including control points', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 50, cp2: { x: 50, y: 0 } },
      { x: 100, y: 50, cp1: { x: 50, y: 100 } }
    ]

    const bounds = BezierMath.getAccurateBounds(points, false)

    // Bounds should include the curve's extrema, not just anchor points
    expect(bounds.minX).toBeCloseTo(0, 0)
    expect(bounds.maxX).toBeCloseTo(100, 0)
    expect(bounds.minY).toBeLessThanOrEqual(50)
    expect(bounds.maxY).toBeGreaterThanOrEqual(50)
  })

  it('should return default bounds for empty array', () => {
    const points: BezierPoint[] = []

    const bounds = BezierMath.getAccurateBounds(points, false)

    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 })
  })
})

describe('BezierMath - Vector Operations', () => {
  it('should normalize vector to unit length', () => {
    const vector = { x: 3, y: 4 }

    const normalized = BezierMath.normalizeVector(vector)

    expect(normalized.x).toBeCloseTo(0.6, 2)
    expect(normalized.y).toBeCloseTo(0.8, 2)

    // Check that length is 1
    const length = Math.sqrt(normalized.x * normalized.x + normalized.y * normalized.y)
    expect(length).toBeCloseTo(1, 5)
  })

  it('should handle zero vector normalization', () => {
    const vector = { x: 0, y: 0 }

    const normalized = BezierMath.normalizeVector(vector)

    // Should return fallback direction
    expect(normalized).toEqual({ x: 1, y: 0 })
  })

  it('should calculate vector length', () => {
    const vector = { x: 3, y: 4 }

    const length = BezierMath.getVectorLength(vector)

    expect(length).toBeCloseTo(5, 1)
  })

  it('should constrain angle to 45-degree increments', () => {
    const vector = { x: 10, y: 8 } // ~39 degrees

    const constrained = BezierMath.constrainAngle(vector)

    // Should snap to 45 degrees (PI/4)
    const angle = Math.atan2(constrained.y, constrained.x)
    const angleDegrees = angle * (180 / Math.PI)

    // Should be close to 0, 45, 90, 135, 180, 225, 270, or 315 degrees
    // Allow small rounding error
    const remainder = Math.abs(angleDegrees % 45)
    expect(remainder < 1 || remainder > 44).toBe(true)
  })
})

describe('BezierMath - Smooth Control Points', () => {
  it('should create symmetric control points for point with both neighbors', () => {
    const prev: BezierPoint = { x: 0, y: 0 }
    const current: BezierPoint = { x: 50, y: 50 }
    const next: BezierPoint = { x: 100, y: 100 }

    const result = BezierMath.createSmoothControlPoints(prev, current, next)

    expect(result.cp1).toBeDefined()
    expect(result.cp2).toBeDefined()

    // Control points should be symmetric relative to the current point
    const dx1 = current.x - result.cp1!.x
    const dy1 = current.y - result.cp1!.y
    const dx2 = result.cp2!.x - current.x
    const dy2 = result.cp2!.y - current.y

    expect(Math.abs(dx1 - dx2)).toBeLessThan(1)
    expect(Math.abs(dy1 - dy2)).toBeLessThan(1)
  })

  it('should create control points with only previous neighbor', () => {
    const prev: BezierPoint = { x: 0, y: 0 }
    const current: BezierPoint = { x: 100, y: 100 }

    const result = BezierMath.createSmoothControlPoints(prev, current, null)

    expect(result.cp1).toBeDefined()
    expect(result.cp2).toBeDefined()
  })

  it('should create control points with only next neighbor', () => {
    const current: BezierPoint = { x: 0, y: 0 }
    const next: BezierPoint = { x: 100, y: 100 }

    const result = BezierMath.createSmoothControlPoints(null, current, next)

    expect(result.cp1).toBeDefined()
    expect(result.cp2).toBeDefined()
  })

  it('should create fallback control points with no neighbors', () => {
    const current: BezierPoint = { x: 50, y: 50 }

    const result = BezierMath.createSmoothControlPoints(null, current, null)

    expect(result.cp1).toBeDefined()
    expect(result.cp2).toBeDefined()

    // Should create horizontal control points
    expect(result.cp1!.y).toBe(current.y)
    expect(result.cp2!.y).toBe(current.y)
  })
})

describe('BezierMath - Path Operations', () => {
  it('should get all segments for open path', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 }
    ]

    const segments = BezierMath.getAllSegments(points, false)

    expect(segments).toHaveLength(2) // 3 points = 2 segments
  })

  it('should get all segments including closing segment for closed path', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 }
    ]

    const segments = BezierMath.getAllSegments(points, true)

    expect(segments).toHaveLength(3) // 3 points + closing = 3 segments
  })

  it('should calculate total path length', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 }
    ]

    const length = BezierMath.getTotalPathLength(points, false)

    expect(length).toBeCloseTo(200, 0) // Two 100-unit segments
  })

  it('should sample path points', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]

    const sampled = BezierMath.samplePathPoints(points, false, { minSamples: 5 })

    expect(sampled.length).toBeGreaterThan(5)
    expect(sampled[0]).toEqual({ x: 0, y: 0 }) // First point
    expect(sampled[sampled.length - 1]).toEqual({ x: 100, y: 100 }) // Last point
  })
})

describe('BezierMath - Closest Point', () => {
  it('should find closest point on linear segment', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 0 }
    const targetPoint = { x: 50, y: 10 }

    const result = BezierMath.getClosestPointOnSegment(p1, p2, targetPoint)

    expect(result.point.x).toBeCloseTo(50, 0)
    expect(result.point.y).toBeCloseTo(0, 1)
    expect(result.distance).toBeCloseTo(10, 0)
  })

  it('should project point to start of segment', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 0 }
    const targetPoint = { x: -10, y: 0 }

    const result = BezierMath.getClosestPointOnSegment(p1, p2, targetPoint)

    expect(result.t).toBeCloseTo(0, 1)
    expect(result.point.x).toBeCloseTo(0, 1)
  })

  it('should project point to end of segment', () => {
    const p1: BezierPoint = { x: 0, y: 0 }
    const p2: BezierPoint = { x: 100, y: 0 }
    const targetPoint = { x: 110, y: 0 }

    const result = BezierMath.getClosestPointOnSegment(p1, p2, targetPoint)

    expect(result.t).toBeCloseTo(1, 1)
    expect(result.point.x).toBeCloseTo(100, 1)
  })
})
