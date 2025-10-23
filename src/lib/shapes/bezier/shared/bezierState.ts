import { type Editor, type TLHandle } from '@tldraw/editor'
import { type BezierPoint, type BezierShape } from './bezierShape'
import { BezierMath } from './bezierMath'
import { BEZIER_THRESHOLDS, bezierLog } from './bezierConstants'
import { BezierBounds } from './bezierBounds'
import { parseHandleId } from './bezierHandleUtils'

/**
 * State management service for Bezier shape editing operations.
 *
 * This service centralizes all state transitions and point manipulation operations
 * for bezier shapes. It provides a pure functional API where all methods return
 * new shape objects rather than mutating existing shapes.
 *
 * Key responsibilities:
 * - Managing edit mode state transitions (enter/exit/toggle)
 * - Handling point and segment selection state
 * - Adding, deleting, and modifying bezier points
 * - Converting points between smooth and corner types
 * - Detecting points and segments at specific positions (hit testing)
 * - Updating points based on handle drag operations
 *
 * All methods are static and pure - they take a shape and return a new modified shape.
 * This makes the code easier to test and reason about, and integrates cleanly with
 * TLDraw's immutable update model.
 *
 * @example
 * ```ts
 * // Enter edit mode
 * const editedShape = BezierState.enterEditMode(shape)
 *
 * // Select a point with shift-click
 * const selectedShape = BezierState.handlePointSelection(shape, pointIndex, true)
 *
 * // Delete selected points
 * const updatedShape = BezierState.deleteSelectedPoints(shape)
 * ```
 */
export class BezierState {

  /**
   * Toggle edit mode for a bezier shape between on and off.
   *
   * When transitioning from normal mode to edit mode:
   * - Preserves existing point selection
   * - Clears segment selection state
   *
   * When transitioning from edit mode to normal mode:
   * - Clears all selection state
   *
   * @param shape - The bezier shape to toggle edit mode for
   * @returns New shape object with edit mode toggled
   */
  static toggleEditMode(
    shape: BezierShape
  ): BezierShape {
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: !shape.props.editMode,
        selectedPointIndices: shape.props.editMode ? [] : (shape.props.selectedPointIndices || []),
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Enter edit mode for a shape
   */
  static enterEditMode(
    shape: BezierShape
  ): BezierShape {
    if (shape.props.editMode) return shape

    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: true,
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Exit edit mode for a shape
   */
  static exitEditMode(
    shape: BezierShape
  ): BezierShape {
    if (!shape.props.editMode) return shape
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        editMode: false,
        selectedPointIndices: [], // Clear selection when exiting
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Handle point selection with shift-click support
   */
  static handlePointSelection(
    shape: BezierShape,
    pointIndex: number,
    shiftKey: boolean
  ): BezierShape {
    const currentSelected = shape.props.selectedPointIndices || []
    let newSelected: number[]
    
    if (shiftKey) {
      // Add to selection or remove if already selected
      if (currentSelected.includes(pointIndex)) {
        newSelected = currentSelected.filter(i => i !== pointIndex)
      } else {
        newSelected = [...currentSelected, pointIndex]
      }
    } else {
      // Single selection (or deselect if clicking the same point)
      newSelected = currentSelected.length === 1 && currentSelected[0] === pointIndex 
        ? [] 
        : [pointIndex]
    }
    
    bezierLog('Selection', 'Point selection changed:', { 
      pointIndex, 
      shiftKey, 
      newSelected 
    })
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        selectedPointIndices: newSelected,
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Clear point selection
   */
  static clearPointSelection(
    shape: BezierShape
  ): BezierShape {
    if (!shape.props.selectedPointIndices || shape.props.selectedPointIndices.length === 0) {
      return shape
    }
    
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        selectedPointIndices: [],
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Select a segment by index
   */
  static selectSegment(
    shape: BezierShape,
    segmentIndex: number
  ): BezierShape {
    if (segmentIndex < 0) return shape

    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        selectedSegmentIndex: segmentIndex,
        selectedPointIndices: [],
      }
    }
    return updatedShape
  }

  /**
   * Clear selected segment state
   */
  static clearSegmentSelection(
    shape: BezierShape
  ): BezierShape {
    if (typeof shape.props.selectedSegmentIndex !== 'number') {
      return shape
    }

    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Delete all currently selected points from the shape.
   *
   * Safety constraints:
   * - Will not delete points if it would leave fewer than 2 points total
   * - Sorts indices in descending order to prevent index shifting bugs during deletion
   * - Automatically clears point and segment selection after deletion
   *
   * @param shape - The bezier shape with points to delete
   * @returns New shape with selected points removed, or unchanged shape if deletion would be invalid
   *
   * @example
   * ```ts
   * // Shape has points [A, B, C, D] with B and D selected (indices [1, 3])
   * const updated = BezierState.deleteSelectedPoints(shape)
   * // Result: points [A, C] with selection cleared
   * ```
   */
  static deleteSelectedPoints(
    shape: BezierShape
  ): BezierShape {
    const selectedIndices = shape.props.selectedPointIndices || []
    if (selectedIndices.length === 0) return shape
    
    const currentPoints = [...shape.props.points]
    
    // Don't allow deletion if it would leave less than 2 points
    if (currentPoints.length - selectedIndices.length < 2) {
      bezierLog('Delete', 'Cannot delete points - would leave < 2 points')
      return shape
    }
    
    // Sort indices in descending order to avoid index shifting during deletion
    const sortedIndices = [...selectedIndices].sort((a, b) => b - a)
    
    // Remove points from highest index to lowest
    for (const index of sortedIndices) {
      if (index >= 0 && index < currentPoints.length) {
        currentPoints.splice(index, 1)
      }
    }
    
    bezierLog('Delete', 'Deleted selected points:', selectedIndices)
    
    // Return updated shape with cleared selection - bounds will be recalculated in BezierBounds
    return {
      ...shape,
      props: {
        ...shape.props,
        points: currentPoints,
        selectedPointIndices: [], // Clear selection after deletion
        selectedSegmentIndex: undefined,
      }
    }
  }

  /**
   * Toggle point type between smooth and corner
   */
  static togglePointType(
    shape: BezierShape,
    pointIndex: number
  ): BezierShape {
    bezierLog('PointType', 'togglePointType called for point', pointIndex)
    if (pointIndex < 0 || pointIndex >= shape.props.points.length) {
      bezierLog('PointType', 'togglePointType: invalid index', pointIndex)
      return shape
    }

    const newPoints = [...shape.props.points]
    const point = newPoints[pointIndex]

    // Check if the point currently has control points (smooth) or not (corner)
    const hasControlPoints = point.cp1 || point.cp2
    bezierLog('PointType', 'point has control points?', hasControlPoints)

    if (hasControlPoints) {
      // Convert smooth point to corner point (remove control points)
      newPoints[pointIndex] = {
        x: point.x,
        y: point.y,
      }
      bezierLog('PointType', 'Converted to corner point:', pointIndex)
    } else {
      // Convert corner point to smooth point (add control points)
      const prevIndex = pointIndex === 0 ?
        (shape.props.isClosed ? shape.props.points.length - 1 : -1) :
        pointIndex - 1
      const nextIndex = pointIndex === shape.props.points.length - 1 ?
        (shape.props.isClosed ? 0 : -1) :
        pointIndex + 1

      const prevPoint = prevIndex >= 0 ? shape.props.points[prevIndex] : null
      const nextPoint = nextIndex >= 0 ? shape.props.points[nextIndex] : null

      bezierLog('PointType', 'Creating smooth control points')
      const controlPoints = BezierMath.createSmoothControlPoints(prevPoint, point, nextPoint)

      newPoints[pointIndex] = {
        x: point.x,
        y: point.y,
        cp1: controlPoints.cp1,
        cp2: controlPoints.cp2,
      }
      bezierLog('PointType', 'Converted to smooth point:', pointIndex)
    }

    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints,
        selectedSegmentIndex: undefined,
      }
    }
    return updatedShape
  }

  /**
   * Add point to curve at specific segment position
   */
  static addPointToSegment(
    shape: BezierShape,
    segmentIndex: number,
    t: number
  ): BezierShape {
    const newPoints = [...shape.props.points]
    const p1 = newPoints[segmentIndex]
    const p2 = segmentIndex === newPoints.length - 1 && shape.props.isClosed 
      ? newPoints[0] 
      : newPoints[segmentIndex + 1]

    // Use BezierMath service for precise segment splitting
    const splitResult = BezierMath.splitSegmentAtT(p1, p2, t)
    
    // Update the original points with new control points
    newPoints[segmentIndex] = splitResult.leftSegment.p1
    
    // Insert the new point with calculated control points
    const insertIndex = segmentIndex + 1
    let newPointIndex: number
    
    if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
      // Inserting in closing segment - update first point instead
      newPoints[0] = splitResult.rightSegment.p2
      newPoints.push(splitResult.splitPoint)
      newPointIndex = newPoints.length - 1
    } else {
      newPoints[insertIndex] = splitResult.rightSegment.p2
      newPoints.splice(insertIndex, 0, splitResult.splitPoint)
      newPointIndex = insertIndex
    }
    
    bezierLog('PointAdd', 'Added point at segment', segmentIndex, 'index', newPointIndex)
    
    // Return updated shape with new point selected - bounds will be recalculated by BezierBounds
    return {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints,
        selectedPointIndices: [newPointIndex], // Auto-select the new point
        selectedSegmentIndex: undefined,
      }
    }
  }

  // === Point Detection ===

  /**
   * Find anchor point at local coordinates
   */
  static getAnchorPointAt(
    points: BezierPoint[],
    localPoint: { x: number; y: number },
    zoomLevel: number
  ): number {
    const threshold = BEZIER_THRESHOLDS.ANCHOR_POINT / zoomLevel
    bezierLog('HitTest', 'getAnchorPointAt: checking', points.length, 'points with threshold', threshold)

    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      const distance = BezierMath.getDistance(localPoint, point)

      if (distance < threshold) {
        bezierLog('HitTest', 'Found anchor at index', i, 'distance', distance)
        return i
      }
    }
    bezierLog('HitTest', 'No anchor found')

    return -1
  }

  /**
   * Find control point at local coordinates
   */
  static getControlPointAt(
    points: BezierPoint[], 
    localPoint: { x: number; y: number }, 
    zoomLevel: number
  ): { pointIndex: number; type: 'cp1' | 'cp2' } | null {
    const threshold = BEZIER_THRESHOLDS.CONTROL_POINT / zoomLevel
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      
      if (point.cp1) {
        const distance = BezierMath.getDistance(localPoint, point.cp1)
        if (distance < threshold) {
          return { pointIndex: i, type: 'cp1' }
        }
      }
      
      if (point.cp2) {
        const distance = BezierMath.getDistance(localPoint, point.cp2)
        if (distance < threshold) {
          return { pointIndex: i, type: 'cp2' }
        }
      }
    }
    
    return null
  }

  /**
   * Find segment at position for point insertion
   */
  static getSegmentAtPosition(
    points: BezierPoint[],
    localPoint: { x: number; y: number },
    zoomLevel: number,
    isClosed: boolean = false
  ): { segmentIndex: number; t: number } | null {
    const threshold = BEZIER_THRESHOLDS.PATH_SEGMENT / zoomLevel
    const anchorExclusionRadius = BEZIER_THRESHOLDS.SEGMENT_ANCHOR_EXCLUSION / zoomLevel

    // Check if we're too close to any anchor point
    // If so, don't return a segment hit - prioritize anchor points
    for (const point of points) {
      const distanceToAnchor = BezierMath.getDistance(localPoint, point)
      if (distanceToAnchor < anchorExclusionRadius) {
        bezierLog('HitTest', 'getSegmentAtPosition: Too close to anchor point, excluding segment hit')
        return null
      }
    }

    const segments = BezierMath.getAllSegments(points, isClosed)

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const projected = segment.project(localPoint)

      if ((projected.d || 0) < threshold) {
        return { segmentIndex: i, t: projected.t || 0 }
      }
    }

    return null
  }

  // === Handle Management ===

  /**
   * Update points from handle drag operation.
   *
   * This is called by TLDraw's handle system when a user drags a bezier handle.
   * It updates the appropriate point or control point based on the handle ID.
   *
   * Symmetry behavior:
   * - By default, dragging one control point mirrors the opposite control point
   * - Holding Ctrl/Alt breaks symmetry for asymmetric curves
   *
   * @param points - Current points array
   * @param handle - The TLDraw handle being dragged (contains ID and new position)
   * @param ctrlKey - Whether Ctrl/Alt is pressed (breaks symmetry)
   * @returns Updated points array
   */
  static updatePointsFromHandleDrag(
    points: BezierPoint[],
    handle: TLHandle,
    ctrlKey: boolean
  ): BezierPoint[] {
    const newPoints = [...points]

    // Parse handle ID using centralized utility
    const parsed = parseHandleId(handle.id)
    if (!parsed.isValid) {
      bezierLog('HandleDrag', 'Invalid handle ID format:', handle.id)
      return newPoints // Invalid handle ID, return unchanged
    }

    const { pointIndex, handleType } = parsed

    // Validate point index is in range
    if (pointIndex >= newPoints.length) {
      bezierLog('HandleDrag', 'Point index out of range:', pointIndex, 'max:', newPoints.length - 1)
      return newPoints
    }

    const point = newPoints[pointIndex]

    if (handleType === 'anchor') {
      // Moving anchor point - move the entire point and its control points
      const deltaX = handle.x - point.x
      const deltaY = handle.y - point.y
      
      newPoints[pointIndex] = {
        ...point,
        x: handle.x,
        y: handle.y,
        cp1: point.cp1 ? { 
          x: point.cp1.x + deltaX, 
          y: point.cp1.y + deltaY 
        } : undefined,
        cp2: point.cp2 ? { 
          x: point.cp2.x + deltaX, 
          y: point.cp2.y + deltaY 
        } : undefined,
      }
    } else if (handleType === 'cp1' || handleType === 'cp2') {
      // Moving control point
      const updatedPoint = { ...point }
      
      if (handleType === 'cp1') {
        updatedPoint.cp1 = { x: handle.x, y: handle.y }
        
        // Update symmetric control point unless Ctrl is pressed (break symmetry)
        if (!ctrlKey && point.cp2) {
          const deltaX = handle.x - point.x
          const deltaY = handle.y - point.y
          updatedPoint.cp2 = {
            x: point.x - deltaX,
            y: point.y - deltaY
          }
        }
      } else if (handleType === 'cp2') {
        updatedPoint.cp2 = { x: handle.x, y: handle.y }
        
        // Update symmetric control point unless Ctrl is pressed (break symmetry)  
        if (!ctrlKey && point.cp1) {
          const deltaX = handle.x - point.x
          const deltaY = handle.y - point.y
          updatedPoint.cp1 = {
            x: point.x - deltaX,
            y: point.y - deltaY
          }
        }
      }
      
      newPoints[pointIndex] = updatedPoint
    }

    return newPoints
  }

  /**
   * Update segment during drag operation.
   *
   * This is a centralized function for segment dragging that updates the control
   * points of the start and end points of a segment based on a delta movement.
   *
   * @param shape - The bezier shape being edited
   * @param segmentIndex - Index of the segment being dragged
   * @param initialPoints - The points array at the start of the drag
   * @param delta - The movement delta from the initial drag position
   * @returns New shape with updated segment control points
   */
  static updateSegmentDrag(
    shape: BezierShape,
    segmentIndex: number,
    initialPoints: BezierPoint[],
    delta: { x: number; y: number }
  ): BezierShape {
    if (initialPoints.length < 2) return shape

    const startIndex = Math.min(segmentIndex, initialPoints.length - 1)
    const endIndex =
      shape.props.isClosed && startIndex === initialPoints.length - 1
        ? 0
        : Math.min(startIndex + 1, initialPoints.length - 1)

    const startInitial = initialPoints[startIndex]
    const endInitial = initialPoints[endIndex]
    if (!startInitial || !endInitial) return shape

    const updatedPoints = initialPoints.map((p) => ({
      x: p.x,
      y: p.y,
      cp1: p.cp1 ? { ...p.cp1 } : undefined,
      cp2: p.cp2 ? { ...p.cp2 } : undefined,
    }))

    const startPoint = { ...updatedPoints[startIndex] }
    const endPoint = { ...updatedPoints[endIndex] }

    const baseStartHandle = startInitial.cp2 ? { ...startInitial.cp2 } : { x: startInitial.x, y: startInitial.y }
    const baseEndHandle = endInitial.cp1 ? { ...endInitial.cp1 } : { x: endInitial.x, y: endInitial.y }

    startPoint.cp2 = {
      x: baseStartHandle.x + delta.x,
      y: baseStartHandle.y + delta.y,
    }

    endPoint.cp1 = {
      x: baseEndHandle.x + delta.x,
      y: baseEndHandle.y + delta.y,
    }

    updatedPoints[startIndex] = startPoint
    updatedPoints[endIndex] = endPoint

    return {
      ...shape,
      props: {
        ...shape.props,
        points: updatedPoints,
        selectedSegmentIndex: segmentIndex,
        selectedPointIndices: [],
      },
    }
  }
}

export const BezierStateActions = {
  enterEditMode(editor: Editor, shape: BezierShape) {
    const updatedShape = BezierState.enterEditMode(shape)
    editor.updateShape(updatedShape)
    editor.setSelectedShapes([shape.id])
    return updatedShape
  },

  exitEditMode(editor: Editor, shape: BezierShape, options?: { deselect?: boolean }) {
    const updatedShape = BezierState.exitEditMode(shape)
    editor.updateShape(updatedShape)
    if (options?.deselect) {
      editor.setSelectedShapes([])
    } else {
      editor.setSelectedShapes([shape.id])
    }
    return updatedShape
  },

  toggleEditMode(editor: Editor, shape: BezierShape) {
    const updatedShape = BezierState.toggleEditMode(shape)
    editor.updateShape(updatedShape)
    editor.setSelectedShapes([shape.id])
    return updatedShape
  },

  handlePointSelection(editor: Editor, shape: BezierShape, pointIndex: number, shiftKey: boolean) {
    const updatedShape = BezierState.handlePointSelection(shape, pointIndex, shiftKey)
    if (updatedShape !== shape) {
      editor.updateShape(updatedShape)
    }
    return updatedShape
  },

  clearPointSelection(editor: Editor, shape: BezierShape) {
    const updatedShape = BezierState.clearPointSelection(shape)
    if (updatedShape !== shape) {
      editor.updateShape(updatedShape)
    }
    return updatedShape
  },

  selectSegment(editor: Editor, shape: BezierShape, segmentIndex: number) {
    const updatedShape = BezierState.selectSegment(shape, segmentIndex)
    if (updatedShape !== shape) {
      editor.updateShape(updatedShape)
    }
    return updatedShape
  },

  clearSegmentSelection(editor: Editor, shape: BezierShape) {
    const updatedShape = BezierState.clearSegmentSelection(shape)
    if (updatedShape !== shape) {
      editor.updateShape(updatedShape)
    }
    return updatedShape
  },

  deleteSelectedPoints(editor: Editor, shape: BezierShape) {
    const updatedShape = BezierState.deleteSelectedPoints(shape)
    if (updatedShape === shape) {
      return shape
    }

    const normalizedShape = BezierBounds.recalculateShapeBounds(
      updatedShape,
      updatedShape.props.points
    )
    editor.updateShape(normalizedShape)
    return normalizedShape
  },

  togglePointType(editor: Editor, shape: BezierShape, pointIndex: number) {
    const updatedShape = BezierState.togglePointType(shape, pointIndex)
    if (updatedShape !== shape) {
      editor.updateShape(updatedShape)
    }
    return updatedShape
  },
}
