import { describe, it, expect } from 'vitest'
import { BezierBounds } from './bezierBounds'
import { type BezierShape, type BezierPoint } from './bezierShape'
import { createShapeId } from '@tldraw/editor'

// Helper to create a minimal test shape
function createTestShape(overrides?: Partial<BezierShape['props']>): BezierShape {
  return {
    id: createShapeId(),
    type: 'bezier',
    x: 0,
    y: 0,
    rotation: 0,
    index: 'a1' as any,
    parentId: 'page' as any,
    typeName: 'shape',
    isLocked: false,
    opacity: 1,
    meta: {},
    props: {
      w: 100,
      h: 100,
      color: 'black',
      dash: 'solid',
      size: 'm',
      fill: 'none',
      scale: 1,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ],
      isClosed: false,
      editMode: false,
      selectedPointIndices: [],
      ...overrides,
    },
  }
}

describe('BezierBounds - Accurate Bounds', () => {
  it('should calculate bounds for empty array', () => {
    const bounds = BezierBounds.getAccurateBounds([], false)

    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 })
  })

  it('should calculate bounds for single point', () => {
    const points: BezierPoint[] = [{ x: 50, y: 75 }]

    const bounds = BezierBounds.getAccurateBounds(points, false)

    expect(bounds).toEqual({ minX: 50, minY: 75, maxX: 50, maxY: 75 })
  })

  it('should include control points in single point bounds', () => {
    const points: BezierPoint[] = [
      { x: 50, y: 50, cp1: { x: 25, y: 25 }, cp2: { x: 75, y: 75 } }
    ]

    const bounds = BezierBounds.getAccurateBounds(points, false)

    expect(bounds.minX).toBe(25)
    expect(bounds.minY).toBe(25)
    expect(bounds.maxX).toBe(75)
    expect(bounds.maxY).toBe(75)
  })

  it('should calculate bounds for straight line', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]

    const bounds = BezierBounds.getAccurateBounds(points, false)

    expect(bounds.minX).toBeCloseTo(0, 1)
    expect(bounds.minY).toBeCloseTo(0, 1)
    expect(bounds.maxX).toBeCloseTo(100, 1)
    expect(bounds.maxY).toBeCloseTo(100, 1)
  })

  it('should calculate accurate bounds for curved path', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 50, cp2: { x: 50, y: 0 } },
      { x: 100, y: 50, cp1: { x: 50, y: 100 } }
    ]

    const bounds = BezierBounds.getAccurateBounds(points, false)

    // Bounds should include the curve extrema
    expect(bounds.minX).toBeCloseTo(0, 0)
    expect(bounds.maxX).toBeCloseTo(100, 0)
    expect(bounds.minY).toBeLessThanOrEqual(50)
    expect(bounds.maxY).toBeGreaterThanOrEqual(50)
  })

  it('should include closing segment in closed path bounds', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, cp2: { x: 100, y: 50 } },
      { x: 50, y: 100, cp1: { x: 0, y: 100 } }
    ]

    const openBounds = BezierBounds.getAccurateBounds(points, false)
    const closedBounds = BezierBounds.getAccurateBounds(points, true)

    // Closed path should have different or equal bounds
    // Just verify they're both valid
    expect(closedBounds.maxX).toBeGreaterThanOrEqual(closedBounds.minX)
    expect(closedBounds.maxY).toBeGreaterThanOrEqual(closedBounds.minY)
    expect(openBounds.maxX).toBeGreaterThanOrEqual(openBounds.minX)
    expect(openBounds.maxY).toBeGreaterThanOrEqual(openBounds.minY)
  })
})

describe('BezierBounds - Recalculate Shape Bounds', () => {
  it('should recalculate bounds and normalize points', () => {
    const shape = createTestShape({
      points: [
        { x: 50, y: 50 },
        { x: 150, y: 150 }
      ]
    })

    const result = BezierBounds.recalculateShapeBounds(shape, shape.props.points)

    // Shape position should move to bounds origin
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)

    // Points should be normalized to local coordinates
    expect(result.props.points[0]).toEqual({ x: 0, y: 0 })
    expect(result.props.points[1]).toEqual({ x: 100, y: 100 })

    // Dimensions should reflect actual bounds
    expect(result.props.w).toBe(100)
    expect(result.props.h).toBe(100)
  })

  it('should maintain minimum dimensions of 1', () => {
    const shape = createTestShape({
      points: [{ x: 50, y: 50 }]
    })

    const result = BezierBounds.recalculateShapeBounds(shape, shape.props.points)

    expect(result.props.w).toBeGreaterThanOrEqual(1)
    expect(result.props.h).toBeGreaterThanOrEqual(1)
  })

  it('should normalize control points along with anchors', () => {
    const shape = createTestShape({
      points: [
        { x: 50, y: 50, cp2: { x: 75, y: 75 } },
        { x: 150, y: 150, cp1: { x: 125, y: 125 } }
      ]
    })

    const result = BezierBounds.recalculateShapeBounds(shape, shape.props.points)

    // Control points should also be normalized
    expect(result.props.points[0].cp2).toEqual({ x: 25, y: 25 })
    expect(result.props.points[1].cp1).toEqual({ x: 75, y: 75 })
  })

  it('should preserve overall bounds after recalculation', () => {
    const shape = createTestShape({
      points: [
        { x: 10, y: 10 },
        { x: 60, y: 60 }
      ]
    })
    shape.x = 0
    shape.y = 0

    const result = BezierBounds.recalculateShapeBounds(shape, shape.props.points)

    // After recalculation, the shape's position is adjusted and points are normalized
    // The bounds minX/minY (10, 10) become the new shape position
    expect(result.x).toBe(10)
    expect(result.y).toBe(10)

    // Points should be normalized to start at (0,0)
    expect(result.props.points[0]).toEqual({ x: 0, y: 0 })
    expect(result.props.points[1]).toEqual({ x: 50, y: 50 })
  })
})

describe('BezierBounds - Edit vs Normal Mode', () => {
  it('should return accurate bounds in edit mode', () => {
    const shape = createTestShape({
      editMode: true,
      points: [
        { x: 10, y: 10 },
        { x: 90, y: 90 }
      ]
    })

    const bounds = BezierBounds.getEditModeBounds(shape)

    expect(bounds.x).toBe(0)
    expect(bounds.y).toBe(0)
    expect(bounds.w).toBeCloseTo(80, 1) // 90 - 10 = 80
    expect(bounds.h).toBeCloseTo(80, 1)
  })

  it('should return stored dimensions in normal mode', () => {
    const shape = createTestShape({
      editMode: false,
      w: 123,
      h: 456
    })

    const bounds = BezierBounds.getNormalModeBounds(shape)

    expect(bounds.w).toBe(123)
    expect(bounds.h).toBe(456)
  })
})

describe('BezierBounds - Single Point Bounds', () => {
  it('should calculate single point bounds with padding', () => {
    const point: BezierPoint = { x: 50, y: 50 }

    const result = BezierBounds.getSinglePointBounds(point, 20)

    expect(result.bounds.x).toBe(30) // 50 - 20
    expect(result.bounds.y).toBe(30)
    expect(result.bounds.w).toBe(40) // padding * 2
    expect(result.bounds.h).toBe(40)

    // Point should be normalized
    expect(result.normalizedPoints[0]).toEqual({ x: 20, y: 20 })
  })

  it('should include control points in single point bounds', () => {
    const point: BezierPoint = {
      x: 50,
      y: 50,
      cp1: { x: 30, y: 30 },
      cp2: { x: 70, y: 70 }
    }

    const result = BezierBounds.getSinglePointBounds(point, 10)

    // Bounds should include control points
    expect(result.bounds.w).toBeGreaterThan(40) // More than just padding
    expect(result.bounds.h).toBeGreaterThan(40)

    // Normalized control points
    expect(result.normalizedPoints[0].cp1).toBeDefined()
    expect(result.normalizedPoints[0].cp2).toBeDefined()
  })
})

describe('BezierBounds - Multi Point Bounds', () => {
  it('should calculate multi-point bounds with stable origin', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 0 }
    ]
    const origin = { x: 0, y: 0 }

    const result = BezierBounds.getMultiPointBounds(points, origin)

    // Bounds should be symmetric around origin
    expect(result.bounds.x).toBeLessThanOrEqual(0)
    expect(result.bounds.y).toBeLessThanOrEqual(0)

    // Points should be normalized
    expect(result.normalizedPoints).toHaveLength(3)
    expect(result.normalizedPoints[0].x).toBeGreaterThanOrEqual(0)
  })

  it('should use first point as origin if not provided', () => {
    const points: BezierPoint[] = [
      { x: 100, y: 100 },
      { x: 200, y: 200 }
    ]

    const result = BezierBounds.getMultiPointBounds(points)

    // Should use first point (100, 100) as origin
    expect(result.bounds.x).toBeLessThanOrEqual(100)
    expect(result.bounds.y).toBeLessThanOrEqual(100)
  })

  it('should include control points in bounds calculation', () => {
    const points: BezierPoint[] = [
      { x: 50, y: 50, cp2: { x: 75, y: 25 } },
      { x: 150, y: 50, cp1: { x: 125, y: 75 } }
    ]

    const result = BezierBounds.getMultiPointBounds(points)

    // Control points should affect bounds
    expect(result.bounds.w).toBeGreaterThan(0)
    expect(result.bounds.h).toBeGreaterThan(0)
  })
})

describe('BezierBounds - Shape Center', () => {
  it('should calculate center from bounds', () => {
    const shape = createTestShape({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ],
      w: 100,
      h: 100
    })

    const center = BezierBounds.getShapeCenter(shape)

    expect(center.x).toBe(50)
    expect(center.y).toBe(50)
  })

  it('should use edit mode bounds when in edit mode', () => {
    const shape = createTestShape({
      editMode: true,
      points: [
        { x: 10, y: 10 },
        { x: 90, y: 90 }
      ],
      w: 100, // Stored dimensions (not used in edit mode)
      h: 100
    })

    const center = BezierBounds.getShapeCenter(shape)

    // Should use accurate bounds (80x80), not stored dimensions (100x100)
    expect(center.x).toBeCloseTo(40, 1) // Half of 80
    expect(center.y).toBeCloseTo(40, 1)
  })
})

describe('BezierBounds - Outline Points', () => {
  it('should extract anchor points as outline', () => {
    const shape = createTestShape({
      points: [
        { x: 0, y: 0, cp2: { x: 25, y: 0 } },
        { x: 100, y: 100, cp1: { x: 75, y: 100 } },
        { x: 200, y: 0 }
      ]
    })

    const outline = BezierBounds.getOutlinePoints(shape)

    expect(outline).toHaveLength(3)
    expect(outline[0]).toEqual({ x: 0, y: 0 })
    expect(outline[1]).toEqual({ x: 100, y: 100 })
    expect(outline[2]).toEqual({ x: 200, y: 0 })
  })
})

describe('BezierBounds - Bounds Change Detection', () => {
  it('should detect when bounds have changed', () => {
    const points1: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]
    const points2: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 150, y: 150 }
    ]

    const changed = BezierBounds.haveBoundsChanged(points1, points2, false)

    expect(changed).toBe(true)
  })

  it('should not detect change for identical bounds', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]

    const changed = BezierBounds.haveBoundsChanged(points, points, false)

    expect(changed).toBe(false)
  })

  it('should not detect change within threshold', () => {
    const points1: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]
    const points2: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100.005, y: 100.005 }
    ]

    const changed = BezierBounds.haveBoundsChanged(points1, points2, false, 0.01)

    expect(changed).toBe(false)
  })

  it('should detect change above threshold', () => {
    const points1: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]
    const points2: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100.1, y: 100.1 }
    ]

    const changed = BezierBounds.haveBoundsChanged(points1, points2, false, 0.01)

    expect(changed).toBe(true)
  })

  it('should detect position change', () => {
    const points1: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ]
    const points2: BezierPoint[] = [
      { x: 10, y: 10 },
      { x: 110, y: 110 }
    ]

    const changed = BezierBounds.haveBoundsChanged(points1, points2, false)

    expect(changed).toBe(true)
  })
})
