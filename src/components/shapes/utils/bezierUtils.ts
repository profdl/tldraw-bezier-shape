import { type Bezier } from 'bezier-js'
import { type TLHandle, type IndexKey } from 'tldraw'
import { type BezierPoint, type BezierShape } from '../BezierShape'
import { BEZIER_THRESHOLDS, bezierLog } from './bezierConstants'
import { BezierMath } from '../services/BezierMath'
import { createHandleId } from './bezierHandleUtils'

/**
 * Utility functions for converting between our BezierPoint format and bezier-js Bezier objects
 */

// Re-export core math helpers through BezierMath for compatibility
export function segmentToBezier(p1: BezierPoint, p2: BezierPoint) {
  return BezierMath.segmentToBezier(p1, p2)
}

export function bezierToSegmentControlPoints(bezier: Bezier) {
  return BezierMath.bezierToSegmentControlPoints(bezier)
}

export function getClosestPointOnSegment(
  p1: BezierPoint,
  p2: BezierPoint,
  targetPoint: { x: number; y: number }
) {
  return BezierMath.getClosestPointOnSegment(p1, p2, targetPoint)
}

export function splitSegmentAtT(p1: BezierPoint, p2: BezierPoint, t: number) {
  return BezierMath.splitSegmentAtT(p1, p2, t)
}

export function getAllSegments(points: BezierPoint[], isClosed: boolean = false) {
  return BezierMath.getAllSegments(points, isClosed)
}

export function getAccurateBounds(points: BezierPoint[], isClosed: boolean = false) {
  return BezierMath.getAccurateBounds(points, isClosed)
}

/**
 * Point selection utilities - shared between BezierShape and BezierEditing
 */

/**
 * Find anchor point at given local coordinates
 * @param points Array of bezier points to search
 * @param localPoint Point in shape's local coordinate space
 * @param zoomLevel Current editor zoom level for threshold scaling
 * @returns Index of anchor point or -1 if none found
 */
export function getAnchorPointAt(
  points: BezierPoint[], 
  localPoint: { x: number; y: number }, 
  zoomLevel: number
): number {
  const threshold = BEZIER_THRESHOLDS.ANCHOR_POINT / zoomLevel
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const distance = Math.sqrt(
      Math.pow(localPoint.x - point.x, 2) + 
      Math.pow(localPoint.y - point.y, 2)
    )
    
    if (distance < threshold) {
      return i
    }
  }
  
  return -1
}

/**
 * Find control point at given local coordinates
 * @param points Array of bezier points to search
 * @param localPoint Point in shape's local coordinate space
 * @param zoomLevel Current editor zoom level for threshold scaling
 * @returns Control point info or null if none found
 */
export function getControlPointAt(
  points: BezierPoint[], 
  localPoint: { x: number; y: number }, 
  zoomLevel: number
): { pointIndex: number; type: 'cp1' | 'cp2' } | null {
  const threshold = BEZIER_THRESHOLDS.CONTROL_POINT / zoomLevel
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    
    // Check cp1
    if (point.cp1) {
      const distance = Math.sqrt(
        Math.pow(localPoint.x - point.cp1.x, 2) + 
        Math.pow(localPoint.y - point.cp1.y, 2)
      )
      if (distance < threshold) {
        return { pointIndex: i, type: 'cp1' }
      }
    }
    
    // Check cp2
    if (point.cp2) {
      const distance = Math.sqrt(
        Math.pow(localPoint.x - point.cp2.x, 2) + 
        Math.pow(localPoint.y - point.cp2.y, 2)
      )
      if (distance < threshold) {
        return { pointIndex: i, type: 'cp2' }
      }
    }
  }
  
  return null
}

/**
 * Find segment at given position for point insertion
 * @param points Array of bezier points 
 * @param localPoint Point in shape's local coordinate space
 * @param zoomLevel Current editor zoom level for threshold scaling
 * @param isClosed Whether the path is closed
 * @returns Segment info or null if none found
 */
export function getSegmentAtPosition(
  points: BezierPoint[], 
  localPoint: { x: number; y: number }, 
  zoomLevel: number,
  isClosed: boolean = false
): { segmentIndex: number; t: number } | null {
  const threshold = BEZIER_THRESHOLDS.SEGMENT_CLICK / zoomLevel
  const anchorThreshold = BEZIER_THRESHOLDS.SEGMENT_ANCHOR_EXCLUSION / zoomLevel

  // First check if we're too close to an existing anchor point
  for (let i = 0; i < points.length; i++) {
    const point = points[i]
    const distance = Math.sqrt(
      Math.pow(localPoint.x - point.x, 2) + 
      Math.pow(localPoint.y - point.y, 2)
    )
    
    if (distance < anchorThreshold) {
      return null // Too close to existing anchor point
    }
  }

  // Check each segment using precise bezier curve distance
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]
    const p2 = points[i + 1]
    
    const result = getClosestPointOnSegment(p1, p2, localPoint)
    
    if (result.distance < threshold) {
      return { segmentIndex: i, t: result.t }
    }
  }

  // Check closing segment if the path is closed
  if (isClosed && points.length > 2) {
    const p1 = points[points.length - 1]
    const p2 = points[0]
    const result = getClosestPointOnSegment(p1, p2, localPoint)
    
    if (result.distance < threshold) {
      return { segmentIndex: points.length - 1, t: result.t }
    }
  }

  return null
}

/**
 * Calculate new selection indices based on point selection interaction
 * @param currentSelected Currently selected point indices
 * @param pointIndex Index of clicked point
 * @param shiftKey Whether shift key was held during click
 * @returns New selection indices array
 */
export function calculateNewSelection(
  currentSelected: number[], 
  pointIndex: number, 
  shiftKey: boolean
): number[] {
  let newSelected: number[]

  if (shiftKey) {
    // Shift-click: toggle selection
    if (currentSelected.includes(pointIndex)) {
      // Remove from selection
      newSelected = currentSelected.filter(i => i !== pointIndex)
      bezierLog('Selection', 'Removed point', pointIndex, 'from selection. New selection:', newSelected)
    } else {
      // Add to selection
      newSelected = [...currentSelected, pointIndex]
      bezierLog('Selection', 'Added point', pointIndex, 'to selection. New selection:', newSelected)
    }
  } else {
    // Regular click: select only this point
    newSelected = [pointIndex]
    bezierLog('Selection', 'Single-selected point', pointIndex)
  }

  return newSelected
}

/**
 * Create updated BezierShape with new point selection
 * @param shape Current shape
 * @param newSelectedIndices New selection indices
 * @returns Updated shape object for editor.updateShape()
 */
export function updateShapeSelection(
  shape: BezierShape, 
  newSelectedIndices: number[]
): Partial<BezierShape> {
  return {
    id: shape.id,
    type: 'bezier' as const,
    props: {
      ...shape.props,
      selectedPointIndices: newSelectedIndices
    }
  }
}

/**
 * Handle complete point selection interaction
 * @param shape Current shape
 * @param pointIndex Index of clicked point
 * @param shiftKey Whether shift was held
 * @returns Updated shape object for editor.updateShape()
 */
export function handlePointSelection(
  shape: BezierShape, 
  pointIndex: number, 
  shiftKey: boolean
): Partial<BezierShape> {
  const currentSelected = shape.props.selectedPointIndices || []
  const newSelected = calculateNewSelection(currentSelected, pointIndex, shiftKey)
  
  bezierLog('Selection', 'Updating shape with selectedPointIndices:', newSelected)
  return updateShapeSelection(shape, newSelected)
}

/**
 * Handle generation utilities for TLDraw interaction
 */

/**
 * Generate TLDraw handles for bezier shape interaction
 * Only generates handles when in edit mode for performance
 * @param shape BezierShape to generate handles for
 * @returns Array of TLHandle objects for TLDraw
 */
export function generateBezierHandles(shape: BezierShape): TLHandle[] {
  // Only show basic handles for point and control point dragging in edit mode
  if (!shape.props.editMode) return []
  
  const handles: TLHandle[] = []
  
  shape.props.points.forEach((point, i) => {
    // Anchor point handle - needed for dragging functionality
    // Visual rendering is handled by BezierControlPoints component
    handles.push({
      id: createHandleId(i, 'anchor'),
      type: 'vertex',
      index: `a${i}` as IndexKey,
      x: point.x,
      y: point.y,
      canSnap: true,
    })

    // Control point handles (cp1 = incoming, cp2 = outgoing)
    if (point.cp1) {
      handles.push({
        id: createHandleId(i, 'cp1'),
        type: 'virtual',
        index: `cp1-${i}` as IndexKey,
        x: point.cp1.x,
        y: point.cp1.y,
        canSnap: true,
      })
    }

    if (point.cp2) {
      handles.push({
        id: createHandleId(i, 'cp2'),
        type: 'virtual',
        index: `cp2-${i}` as IndexKey,
        x: point.cp2.x,
        y: point.cp2.y,
        canSnap: true,
      })
    }
  })
  
  return handles
}

/**
 * Create a memoization key for handle generation
 * Handles should only regenerate when points or edit mode changes
 * @param shape BezierShape to create key for
 * @returns String key for memoization
 */
export function createHandleMemoKey(shape: BezierShape): string {
  if (!shape.props.editMode) return 'no-handles'
  
  // Create key based on points structure and edit mode
  const pointsKey = shape.props.points.map((p, i) => {
    const cp1Key = p.cp1 ? `${p.cp1.x.toFixed(1)},${p.cp1.y.toFixed(1)}` : 'null'
    const cp2Key = p.cp2 ? `${p.cp2.x.toFixed(1)},${p.cp2.y.toFixed(1)}` : 'null'
    return `${i}:${p.x.toFixed(1)},${p.y.toFixed(1)}|${cp1Key}|${cp2Key}`
  }).join('|')
  
  return `edit-${pointsKey}`
}

/**
 * Update bezier points based on handle drag
 * This contains the core logic for updating points when handles are moved
 * @param points Current bezier points array
 * @param handle The handle being dragged
 * @param altKey Whether Alt key is pressed (breaks symmetry)
 * @returns Updated points array
 */
export function updatePointsFromHandleDrag(
  points: BezierPoint[], 
  handle: TLHandle, 
  altKey: boolean
): BezierPoint[] {
  const newPoints = [...points]
  
  // Parse handle ID to determine what we're updating
  if (handle.id.startsWith('anchor-')) {
    const pointIndex = parseInt(handle.id.split('-')[1])
    if (pointIndex >= 0 && pointIndex < newPoints.length) {
      // Move the anchor point and mirror both control points relative to the new position
      const oldPoint = newPoints[pointIndex]
      const deltaX = handle.x - oldPoint.x
      const deltaY = handle.y - oldPoint.y
      
      newPoints[pointIndex] = {
        ...oldPoint,
        x: handle.x,
        y: handle.y,
        cp1: oldPoint.cp1 ? { x: oldPoint.cp1.x + deltaX, y: oldPoint.cp1.y + deltaY } : undefined,
        cp2: oldPoint.cp2 ? { x: oldPoint.cp2.x + deltaX, y: oldPoint.cp2.y + deltaY } : undefined,
      }
    }
  } else if (handle.id.startsWith('cp1-')) {
    const pointIndex = parseInt(handle.id.split('-')[1])
    if (pointIndex >= 0 && pointIndex < newPoints.length) {
      const anchorPoint = newPoints[pointIndex]
      
      // Update cp1
      newPoints[pointIndex] = {
        ...anchorPoint,
        cp1: { x: handle.x, y: handle.y },
      }
      
      // Mirror cp2 if it exists and Alt key is not pressed (Illustrator-style symmetric handles)
      if (anchorPoint.cp2 && !altKey) {
        const cp1Vector = { x: handle.x - anchorPoint.x, y: handle.y - anchorPoint.y }
        newPoints[pointIndex].cp2 = {
          x: anchorPoint.x - cp1Vector.x,
          y: anchorPoint.y - cp1Vector.y,
        }
      }
    }
  } else if (handle.id.startsWith('cp2-')) {
    const pointIndex = parseInt(handle.id.split('-')[1])
    if (pointIndex >= 0 && pointIndex < newPoints.length) {
      const anchorPoint = newPoints[pointIndex]
      
      // Update cp2
      newPoints[pointIndex] = {
        ...anchorPoint,
        cp2: { x: handle.x, y: handle.y },
      }
      
      // Mirror cp1 if it exists and Alt key is not pressed (Illustrator-style symmetric handles)
      if (anchorPoint.cp1 && !altKey) {
        const cp2Vector = { x: handle.x - anchorPoint.x, y: handle.y - anchorPoint.y }
        newPoints[pointIndex].cp1 = {
          x: anchorPoint.x - cp2Vector.x,
          y: anchorPoint.y - cp2Vector.y,
        }
      }
    }
  }
  
  return newPoints
}
