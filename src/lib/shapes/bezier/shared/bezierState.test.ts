import { describe, it, expect } from 'vitest'
import { BezierState } from './bezierState'
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
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ],
      isClosed: false,
      editMode: false,
      selectedPointIndices: [],
      ...overrides,
    },
  }
}

describe('BezierState - Edit Mode', () => {
  it('should enter edit mode', () => {
    const shape = createTestShape()
    const result = BezierState.enterEditMode(shape)

    expect(result.props.editMode).toBe(true)
    expect(result.props.selectedSegmentIndex).toBeUndefined()
  })

  it('should not change shape if already in edit mode', () => {
    const shape = createTestShape({ editMode: true })
    const result = BezierState.enterEditMode(shape)

    expect(result).toBe(shape) // Same reference = no change
  })

  it('should exit edit mode and clear selections', () => {
    const shape = createTestShape({
      editMode: true,
      selectedPointIndices: [0, 1],
      selectedSegmentIndex: 1
    })
    const result = BezierState.exitEditMode(shape)

    expect(result.props.editMode).toBe(false)
    expect(result.props.selectedPointIndices).toEqual([])
    expect(result.props.selectedSegmentIndex).toBeUndefined()
  })

  it('should not change shape if already out of edit mode', () => {
    const shape = createTestShape({ editMode: false })
    const result = BezierState.exitEditMode(shape)

    expect(result).toBe(shape)
  })

  it('should toggle edit mode on', () => {
    const shape = createTestShape({ editMode: false, selectedPointIndices: [1] })
    const result = BezierState.toggleEditMode(shape)

    expect(result.props.editMode).toBe(true)
    expect(result.props.selectedPointIndices).toEqual([1]) // Preserved
    expect(result.props.selectedSegmentIndex).toBeUndefined()
  })

  it('should toggle edit mode off and clear selections', () => {
    const shape = createTestShape({ editMode: true, selectedPointIndices: [0, 1] })
    const result = BezierState.toggleEditMode(shape)

    expect(result.props.editMode).toBe(false)
    expect(result.props.selectedPointIndices).toEqual([])
  })
})

describe('BezierState - Point Selection', () => {
  it('should select a single point without shift', () => {
    const shape = createTestShape()
    const result = BezierState.handlePointSelection(shape, 1, false)

    expect(result.props.selectedPointIndices).toEqual([1])
    expect(result.props.selectedSegmentIndex).toBeUndefined()
  })

  it('should deselect when clicking the same point again', () => {
    const shape = createTestShape({ selectedPointIndices: [1] })
    const result = BezierState.handlePointSelection(shape, 1, false)

    expect(result.props.selectedPointIndices).toEqual([])
  })

  it('should replace selection when clicking different point without shift', () => {
    const shape = createTestShape({ selectedPointIndices: [0] })
    const result = BezierState.handlePointSelection(shape, 2, false)

    expect(result.props.selectedPointIndices).toEqual([2])
  })

  it('should add to selection with shift key', () => {
    const shape = createTestShape({ selectedPointIndices: [0] })
    const result = BezierState.handlePointSelection(shape, 2, true)

    expect(result.props.selectedPointIndices).toEqual([0, 2])
  })

  it('should remove from selection with shift key if already selected', () => {
    const shape = createTestShape({ selectedPointIndices: [0, 1, 2] })
    const result = BezierState.handlePointSelection(shape, 1, true)

    expect(result.props.selectedPointIndices).toEqual([0, 2])
  })

  it('should clear point selection', () => {
    const shape = createTestShape({ selectedPointIndices: [0, 1] })
    const result = BezierState.clearPointSelection(shape)

    expect(result.props.selectedPointIndices).toEqual([])
    expect(result.props.selectedSegmentIndex).toBeUndefined()
  })

  it('should not change shape when clearing empty selection', () => {
    const shape = createTestShape({ selectedPointIndices: [] })
    const result = BezierState.clearPointSelection(shape)

    expect(result).toBe(shape)
  })
})

describe('BezierState - Segment Selection', () => {
  it('should select a segment', () => {
    const shape = createTestShape()
    const result = BezierState.selectSegment(shape, 1)

    expect(result.props.selectedSegmentIndex).toBe(1)
    expect(result.props.selectedPointIndices).toEqual([]) // Clears point selection
  })

  it('should not select negative segment index', () => {
    const shape = createTestShape()
    const result = BezierState.selectSegment(shape, -1)

    expect(result).toBe(shape)
  })

  it('should clear segment selection', () => {
    const shape = createTestShape({ selectedSegmentIndex: 1 })
    const result = BezierState.clearSegmentSelection(shape)

    expect(result.props.selectedSegmentIndex).toBeUndefined()
  })

  it('should not change shape when clearing undefined segment', () => {
    const shape = createTestShape({ selectedSegmentIndex: undefined })
    const result = BezierState.clearSegmentSelection(shape)

    expect(result).toBe(shape)
  })
})

describe('BezierState - Delete Points', () => {
  it('should delete selected points', () => {
    const shape = createTestShape({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 },
        { x: 150, y: 50 }
      ],
      selectedPointIndices: [1, 3]
    })
    const result = BezierState.deleteSelectedPoints(shape)

    expect(result.props.points).toHaveLength(2)
    expect(result.props.points[0]).toEqual({ x: 0, y: 0 })
    expect(result.props.points[1]).toEqual({ x: 100, y: 100 })
    expect(result.props.selectedPointIndices).toEqual([])
  })

  it('should not delete if no points selected', () => {
    const shape = createTestShape({ selectedPointIndices: [] })
    const result = BezierState.deleteSelectedPoints(shape)

    expect(result).toBe(shape)
  })

  it('should not delete if would leave fewer than 2 points', () => {
    const shape = createTestShape({
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      selectedPointIndices: [0]
    })
    const result = BezierState.deleteSelectedPoints(shape)

    expect(result).toBe(shape)
    expect(result.props.points).toHaveLength(2)
  })

  it('should handle out-of-range indices gracefully', () => {
    const shape = createTestShape({
      points: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 100 }, { x: 150, y: 150 }],
      selectedPointIndices: [1, 99]
    })
    const result = BezierState.deleteSelectedPoints(shape)

    // Even though index 99 is out of range, the function counts it when checking
    // if deletion would leave < 2 points: 4 - 2 = 2, which passes the check
    // Then only valid indices are actually deleted
    expect(result.props.points).toHaveLength(3)
    expect(result.props.points[0]).toEqual({ x: 0, y: 0 })
    expect(result.props.points[1]).toEqual({ x: 100, y: 100 })
    expect(result.props.points[2]).toEqual({ x: 150, y: 150 })
  })
})

describe('BezierState - Toggle Point Type', () => {
  it('should convert smooth point to corner point', () => {
    const shape = createTestShape({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50, cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } },
        { x: 100, y: 0 }
      ]
    })
    const result = BezierState.togglePointType(shape, 1)

    expect(result.props.points[1].cp1).toBeUndefined()
    expect(result.props.points[1].cp2).toBeUndefined()
    expect(result.props.points[1].x).toBe(50)
    expect(result.props.points[1].y).toBe(50)
  })

  it('should convert corner point to smooth point', () => {
    const shape = createTestShape({
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 0 }
      ]
    })
    const result = BezierState.togglePointType(shape, 1)

    expect(result.props.points[1].cp1).toBeDefined()
    expect(result.props.points[1].cp2).toBeDefined()
  })

  it('should not change shape for invalid index', () => {
    const shape = createTestShape()
    const result = BezierState.togglePointType(shape, 99)

    expect(result).toBe(shape)
  })

  it('should not change shape for negative index', () => {
    const shape = createTestShape()
    const result = BezierState.togglePointType(shape, -1)

    expect(result).toBe(shape)
  })
})

describe('BezierState - Point Detection', () => {
  it('should find anchor point within threshold', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 }
    ]

    // At zoom 1.0, threshold is 10 pixels
    const result = BezierState.getAnchorPointAt(points, { x: 52, y: 48 }, 1.0)
    expect(result).toBe(1)
  })

  it('should not find anchor point outside threshold', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 }
    ]

    const result = BezierState.getAnchorPointAt(points, { x: 70, y: 70 }, 1.0)
    expect(result).toBe(-1)
  })

  it('should find control point within threshold', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50, cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } },
      { x: 100, y: 0 }
    ]

    const result = BezierState.getControlPointAt(points, { x: 61, y: 59 }, 1.0)
    expect(result).toEqual({ pointIndex: 1, type: 'cp2' })
  })

  it('should not find control point outside threshold', () => {
    const points: BezierPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50, cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } },
      { x: 100, y: 0 }
    ]

    const result = BezierState.getControlPointAt(points, { x: 80, y: 80 }, 1.0)
    expect(result).toBeNull()
  })
})

describe('BezierState - Handle Drag', () => {
  it('should move anchor point and its control points', () => {
    const points: BezierPoint[] = [
      { x: 50, y: 50, cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } }
    ]

    const handle = { id: 'bezier-0-anchor', type: 'vertex' as const, x: 70, y: 70, index: 'a1' as any }
    const result = BezierState.updatePointsFromHandleDrag(points, handle, false)

    expect(result[0].x).toBe(70)
    expect(result[0].y).toBe(70)
    expect(result[0].cp1).toEqual({ x: 60, y: 60 }) // Moved by delta (20, 20)
    expect(result[0].cp2).toEqual({ x: 80, y: 80 })
  })

  it('should update control point with symmetry', () => {
    const points: BezierPoint[] = [
      { x: 50, y: 50, cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } }
    ]

    const handle = { id: 'bezier-0-cp2', type: 'vertex' as const, x: 70, y: 80, index: 'a1' as any }
    const result = BezierState.updatePointsFromHandleDrag(points, handle, false)

    expect(result[0].cp2).toEqual({ x: 70, y: 80 })
    // cp1 should mirror the new cp2
    expect(result[0].cp1).toEqual({ x: 30, y: 20 })
  })

  it('should update control point without symmetry when ctrl pressed', () => {
    const points: BezierPoint[] = [
      { x: 50, y: 50, cp1: { x: 40, y: 40 }, cp2: { x: 60, y: 60 } }
    ]

    const handle = { id: 'bezier-0-cp2', type: 'vertex' as const, x: 70, y: 80, index: 'a1' as any }
    const result = BezierState.updatePointsFromHandleDrag(points, handle, true)

    expect(result[0].cp2).toEqual({ x: 70, y: 80 })
    expect(result[0].cp1).toEqual({ x: 40, y: 40 }) // Unchanged
  })

  it('should handle invalid handle ID gracefully', () => {
    const points: BezierPoint[] = [{ x: 50, y: 50 }]

    const handle = { id: 'invalid-id', type: 'vertex' as const, x: 70, y: 70, index: 'a1' as any }
    const result = BezierState.updatePointsFromHandleDrag(points, handle, false)

    expect(result).toEqual(points)
  })

  it('should handle out of range point index gracefully', () => {
    const points: BezierPoint[] = [{ x: 50, y: 50 }]

    const handle = { id: 'bezier-99-anchor', type: 'vertex' as const, x: 70, y: 70, index: 'a1' as any }
    const result = BezierState.updatePointsFromHandleDrag(points, handle, false)

    expect(result).toEqual(points)
  })
})
