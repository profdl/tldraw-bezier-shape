import {
  StateNode,
  type TLPointerEventInfo,
  type TLKeyboardEventInfo,
  createShapeId,
  Vec,
  type TLShapePartial,
} from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../shared/bezierShape'
import {
  BEZIER_THRESHOLDS,
  BEZIER_HANDLES,
  BEZIER_TIMING,
  BEZIER_BOUNDS
} from '../shared/bezierConstants'
import { DEFAULT_SHAPE_PROPS } from '../shared/defaultShapeProps'
import { useTransientShapeStore } from '../../../../store/transientShapeStore'

interface DragHandleOptions {
  startPoint: Vec
  currentPoint: Vec
  dragDistance: number
  threshold: number
  isCtrlPressed: boolean
  isShiftPressed: boolean
  constrainAngle: (offset: Vec) => Vec
}

interface DragHandleResult {
  cp1?: Vec
  cp2?: Vec
  hasHandles: boolean
}

function computeDragHandles({
  startPoint,
  currentPoint,
  dragDistance,
  threshold,
  isCtrlPressed,
  isShiftPressed,
  constrainAngle
}: DragHandleOptions): DragHandleResult {
  if (dragDistance <= threshold) {
    return { hasHandles: false }
  }

  let offset = Vec.Sub(currentPoint, startPoint)

  if (isShiftPressed) {
    offset = constrainAngle(offset)
  }

  if (isCtrlPressed) {
    const controlPoint2 = Vec.Add(startPoint, offset)
    return {
      cp2: controlPoint2,
      hasHandles: true
    }
  }

  const controlPoint1 = Vec.Add(startPoint, Vec.Neg(offset))
  const controlPoint2 = Vec.Add(startPoint, offset)
  return {
    cp1: controlPoint1,
    cp2: controlPoint2,
    hasHandles: true
  }
}

export class Creating extends StateNode {
  static override id = 'creating'

  info = {} as TLPointerEventInfo
  shapeId = createShapeId()
  points: BezierPoint[] = []
  isDragging = false
  startPoint?: Vec
  currentPoint?: Vec
  dragDistance = 0
  isHoveringStart = false
  isSnappedToStart = false
  originalPreviewPoint?: Vec
  isCreatingFirstPoint = false
  initialDragOccurred = false
  stableOrigin?: Vec // Fixed origin point based on first point placement
  isExtendingShape = false // True when extending an existing shape
  extendFromStart = false // True if extending from start, false if from end
  markId?: string // History mark for undo/redo
  readonly CORNER_POINT_THRESHOLD = BEZIER_THRESHOLDS.CORNER_POINT_DRAG // pixels
  readonly SNAP_THRESHOLD = BEZIER_THRESHOLDS.SNAP_TO_START // pixels for entering snap zone
  readonly RELEASE_THRESHOLD = BEZIER_THRESHOLDS.SNAP_RELEASE // pixels for exiting snap zone

  override onEnter(info: TLPointerEventInfo & { extendingShapeId?: string; extendFromStart?: boolean }) {
    this.info = info
    this.markId = undefined

    // Check if we're extending an existing shape
    const extendingShapeId = info.extendingShapeId
    const extendFromStart = info.extendFromStart

    if (extendingShapeId) {
      // Create history mark for extending shape
      this.markId = this.editor.markHistoryStoppingPoint(`extending_bezier:${extendingShapeId}`)

      const existingShape = this.editor.getShape(extendingShapeId as import('@tldraw/editor').TLShapeId) as BezierShape | undefined
      if (existingShape && existingShape.type === 'bezier') {
        // We're extending an existing shape
        this.isExtendingShape = true
        this.extendFromStart = extendFromStart || false
        this.shapeId = existingShape.id

        // Convert existing points from local to page coordinates
        const shapeX = existingShape.x
        const shapeY = existingShape.y
        const existingPointsLocal = existingShape.props.points || []

        const existingPointsPage = existingPointsLocal.map(p => ({
          x: p.x + shapeX,
          y: p.y + shapeY,
          cp1: p.cp1 ? { x: p.cp1.x + shapeX, y: p.cp1.y + shapeY } : undefined,
          cp2: p.cp2 ? { x: p.cp2.x + shapeX, y: p.cp2.y + shapeY } : undefined,
        }))

        // Copy existing points in page coordinates - reverse if extending from start
        this.points = extendFromStart
          ? this.reversePoints([...existingPointsPage])
          : [...existingPointsPage]

        // Set up for adding new points
        this.isDragging = false
        this.isHoveringStart = false
        this.isSnappedToStart = false
        this.originalPreviewPoint = undefined
        this.isCreatingFirstPoint = false
        this.initialDragOccurred = false

        // Get the endpoint we're extending from (now the last point after potential reversal)
        // The first point in the array is the stable origin (since we may have reversed)
        const firstPoint = this.points[0]
        this.stableOrigin = new Vec(firstPoint.x, firstPoint.y)

        this.editor.setCursor({ type: 'cross' })
        return
      }
    }

    // Normal creation mode (not extending)
    this.isExtendingShape = false
    this.extendFromStart = false
    const { startSession } = useTransientShapeStore.getState()
    this.shapeId = startSession('bezier', 'bezier')
    this.points = []
    this.isDragging = false
    this.isHoveringStart = false
    this.isSnappedToStart = false
    this.originalPreviewPoint = undefined
    this.isCreatingFirstPoint = false
    this.initialDragOccurred = false
    this.stableOrigin = undefined

    // Set initial cursor
    this.editor.setCursor({ type: 'cross' })

    // If we're entering from a canvas click, immediately create the first point
    if (info.target === 'canvas') {
      const point = this.editor.inputs.currentPagePoint.clone()

      // Create shape ID and history mark for new shape
      if (!this.markId) {
        this.markId = this.editor.markHistoryStoppingPoint(`creating_bezier:${this.shapeId}`)
      }

      this.addPoint({ x: point.x, y: point.y })
      this.isDragging = true
      this.startPoint = point.clone()
      this.currentPoint = point.clone()
      this.dragDistance = 0
      this.initialDragOccurred = false
    } else {
      // Fallback - defer first point creation for other entry scenarios
      this.isCreatingFirstPoint = true
      const point = this.editor.inputs.currentPagePoint.clone()
      this.startPoint = point.clone()
      this.currentPoint = point.clone()
      this.dragDistance = 0
    }
  }

  override onPointerMove() {
    const currentPoint = this.editor.inputs.currentPagePoint.clone()

    // Check proximity to start point for snapping/hovering behavior
    let hoveringStart = false
    let shouldSnapToStart = false

    // Only enable snap-to-start when we have enough points to close (3+)
    if (this.points.length > 2) {
      const firstPoint = this.points[0]
      const distToFirst = Vec.Dist(currentPoint, { x: firstPoint.x, y: firstPoint.y })

      // Scale thresholds by zoom level for consistent behavior at any zoom
      const snapThreshold = this.SNAP_THRESHOLD / this.editor.getZoomLevel()
      const releaseThreshold = this.RELEASE_THRESHOLD / this.editor.getZoomLevel()

      // Show hover highlight when near start point
      hoveringStart = distToFirst < BEZIER_THRESHOLDS.CLOSE_CURVE / this.editor.getZoomLevel()

      /**
       * Snap logic with hysteresis to prevent flickering
       *
       * Hysteresis: Different thresholds for entering vs exiting snap state
       * - Enter snap zone: when distance < snapThreshold (12px)
       * - Exit snap zone: when distance > releaseThreshold (15px)
       *
       * This creates a "dead zone" (12-15px) where the state doesn't change,
       * preventing rapid on/off flickering when the mouse hovers near the boundary.
       *
       * Example with mouse at 13px from start:
       * 1. Not snapped, distance 13px: 13 > 12, stay unsnapped
       * 2. Mouse moves to 11px: 11 < 12, SNAP (save original position)
       * 3. Mouse moves to 13px: 13 < 15, stay snapped (hysteresis prevents release)
       * 4. Mouse moves to 16px: 16 > 15, RELEASE snap
       */
      if (!this.isSnappedToStart && distToFirst < snapThreshold) {
        // Entering snap zone
        shouldSnapToStart = true
        this.isSnappedToStart = true
        // Save where the mouse was when we started snapping
        // Used to calculate release threshold distance
        this.originalPreviewPoint = currentPoint.clone()
        // Set preview point to exact first point position
        this.currentPoint = new Vec(firstPoint.x, firstPoint.y)
      } else if (this.isSnappedToStart && this.originalPreviewPoint) {
        // Currently snapped - check if we should release
        const distFromOriginalSnap = Vec.Dist(currentPoint, this.originalPreviewPoint)

        if (distFromOriginalSnap > releaseThreshold) {
          // Exiting snap zone - mouse moved far enough away
          this.isSnappedToStart = false
          this.originalPreviewPoint = undefined
          this.currentPoint = currentPoint
        } else {
          // Still in hysteresis zone - stay snapped
          shouldSnapToStart = true
          this.currentPoint = new Vec(firstPoint.x, firstPoint.y)
        }
      } else {
        // Not near start point - normal preview
        this.currentPoint = currentPoint
      }
    } else {
      // Not enough points to close - normal preview
      this.currentPoint = currentPoint
    }
    
    // Update cursor based on state
    let cursorType = 'cross'
    if (this.isSnappedToStart) {
      cursorType = 'pointer' // Could use a different cursor to indicate snapping
    } else if (hoveringStart) {
      cursorType = 'pointer'
    }
    
    if (this.isHoveringStart !== hoveringStart || shouldSnapToStart) {
      this.isHoveringStart = hoveringStart
      this.editor.setCursor({ type: cursorType as 'cross' | 'default' })
    }
    
    if (this.isDragging) {
      // Calculate drag distance for corner point detection
      if (this.startPoint) {
        this.dragDistance = Vec.Dist(currentPoint, this.startPoint) * this.editor.getZoomLevel()
      }
      
      if (this.points.length === 1 && !this.initialDragOccurred) {
        // Handle first point dragging - special case to ensure edit mode is active
        this.handleFirstPointDrag(currentPoint)
      } else if (this.points.length > 0) {
        // Handle normal point dragging
        this.handleNormalPointDrag(currentPoint)
      }
      
      this.updateShape()
    } else if (this.points.length > 0 && !hoveringStart && !this.isSnappedToStart) {
      // Show preview of next segment (but not when hovering over start point or snapped)
      this.showPreview()
    } else if (this.points.length > 0 && this.isSnappedToStart) {
      // Show preview snapped to start point
      this.showPreview()
    }
  }

  override onPointerUp() {
    if (this.isDragging) {
      this.isDragging = false
      this.startPoint = undefined
    }
  }

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.target === 'canvas') {
      const currentPoint = this.editor.inputs.currentPagePoint.clone()
      
      // Handle first point creation
      if (this.isCreatingFirstPoint) {
        // Create the first point and start dragging it immediately
        this.addPoint({ x: currentPoint.x, y: currentPoint.y })
        this.isCreatingFirstPoint = false
        this.isDragging = true
        this.startPoint = currentPoint.clone()
        this.dragDistance = 0
        this.initialDragOccurred = false // Mark that this is the initial first point drag
        return
      }
      
      // Check if we're currently snapped to start - if so, close immediately
      if (this.isSnappedToStart && this.points.length > 2) {
        this.closeCurve()
        return
      }
      
      // Check if clicking near the first point to close the curve (fallback for edge cases)
      if (this.points.length > 2 && !this.isSnappedToStart) {
        const firstPoint = this.points[0]
        const distToFirst = Vec.Dist(currentPoint, { x: firstPoint.x, y: firstPoint.y })
        
        if (distToFirst < BEZIER_THRESHOLDS.CLOSE_CURVE / this.editor.getZoomLevel()) {
          // Close the curve immediately (no drag)
          this.closeCurve()
          return
        }
      }
      
      // Add new point (normal case)
      this.addPoint({ x: currentPoint.x, y: currentPoint.y })
      this.isDragging = true
      this.startPoint = currentPoint.clone()
      this.dragDistance = 0
    }
  }

  override onDoubleClick() {
    // Finish the curve without closing
    this.completeCurve()
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    switch (info.key) {
      case 'Enter':
        this.completeCurve()
        break
      case 'Escape':
        this.cancel()
        break
      case 'c':
        if (this.points.length > 2) {
          this.closeCurve()
        }
        break
    }
  }

  private handleFirstPointDrag(currentPoint: Vec) {
    const firstPoint = this.points[0]
    const startPoint = this.startPoint!

    const handles = computeDragHandles({
      startPoint,
      currentPoint,
      dragDistance: this.dragDistance,
      threshold: this.CORNER_POINT_THRESHOLD,
      isCtrlPressed: this.editor.inputs.ctrlKey,
      isShiftPressed: this.editor.inputs.shiftKey,
      constrainAngle: this.constrainAngle.bind(this)
    })

    firstPoint.cp1 = handles.cp1 ? { x: handles.cp1.x, y: handles.cp1.y } : undefined
    firstPoint.cp2 = handles.cp2 ? { x: handles.cp2.x, y: handles.cp2.y } : undefined

    if (handles.hasHandles) {
      this.initialDragOccurred = true
    }
  }

  private handleNormalPointDrag(currentPoint: Vec) {
    const lastPoint = this.points[this.points.length - 1]
    const startPoint = this.startPoint!

    const handles = computeDragHandles({
      startPoint,
      currentPoint,
      dragDistance: this.dragDistance,
      threshold: this.CORNER_POINT_THRESHOLD,
      isCtrlPressed: this.editor.inputs.ctrlKey,
      isShiftPressed: this.editor.inputs.shiftKey,
      constrainAngle: this.constrainAngle.bind(this)
    })

    lastPoint.cp1 = handles.cp1 ? { x: handles.cp1.x, y: handles.cp1.y } : undefined
    lastPoint.cp2 = handles.cp2 ? { x: handles.cp2.x, y: handles.cp2.y } : undefined

    if (handles.hasHandles && this.points.length === 1) {
      this.initialDragOccurred = true
    }
  }


  private constrainAngle(offset: Vec): Vec {
    // Constrain to 45-degree increments (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
    const angle = Math.atan2(offset.y, offset.x)
    const constrainedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
    const magnitude = Vec.Len(offset)
    
    return new Vec(
      Math.cos(constrainedAngle) * magnitude,
      Math.sin(constrainedAngle) * magnitude
    )
  }

  private addPoint(point: { x: number; y: number }) {
    // Set stable origin on first point
    if (this.points.length === 0) {
      this.stableOrigin = new Vec(point.x, point.y)
    }
    
    this.points.push({
      x: point.x,
      y: point.y,
    })
    
    this.updateShape()
  }

  private updateShape() {
    // Force edit mode when creating/dragging the first point or during any drag operation
    const shouldForceEditMode = (this.points.length === 1 && !this.initialDragOccurred) || this.isDragging
    const editModeOverride = shouldForceEditMode || undefined // avoid forcing false to prevent edit-mode flicker
    
    // During drag operations, show preview of the curve being formed
    if (this.isDragging && this.points.length > 0 && this.currentPoint) {
      // Create preview points that include the current drag position
      const previewPoints = [...this.points]
      
      // Only add preview segment for subsequent points (not the first point)
      // For first point drag, we just show the single point with its handles (no preview line)
      if (this.points.length > 1) {
        // Add a preview point at the current mouse position
        previewPoints.push({
          x: this.currentPoint.x,
          y: this.currentPoint.y,
        })
      }
      
      this.updateShapeWithPointsAndClosed(previewPoints, false, editModeOverride)
    } else {
      // Normal update without preview
      this.updateShapeWithPointsAndClosed(this.points, false, editModeOverride)
    }
  }

  private updateShapeWithPoints(points: BezierPoint[]) {
    this.updateShapeWithPointsAndClosed(points, false)
  }

  /**
   * Calculate bounds and normalized points for a single-point shape.
   *
   * Used during initial creation when only one point exists. Includes padding
   * to prevent the shape from jumping when control points are added via dragging.
   *
   * @param point - The single point (may have control points)
   * @returns Bounds rectangle and normalized points
   */
  private calculateSinglePointBounds(point: BezierPoint): {
    x: number
    y: number
    w: number
    h: number
    normalizedPoints: BezierPoint[]
  } {
    const padding = BEZIER_BOUNDS.SINGLE_POINT_PADDING

    // Include control points in bounds calculation
    const allPoints = [{ x: point.x, y: point.y }]
    if (point.cp1) allPoints.push(point.cp1)
    if (point.cp2) allPoints.push(point.cp2)

    const xs = allPoints.map(p => p.x)
    const ys = allPoints.map(p => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs)
    const maxY = Math.max(...ys)

    // Add padding to prevent jumping when handles appear
    const actualMinX = minX - padding
    const actualMinY = minY - padding
    const w = Math.max(1, maxX - minX + padding * 2)
    const h = Math.max(1, maxY - minY + padding * 2)

    // Normalize point to local coordinates
    const normalizedPoints = [{
      x: point.x - actualMinX,
      y: point.y - actualMinY,
      cp1: point.cp1 ? { x: point.cp1.x - actualMinX, y: point.cp1.y - actualMinY } : undefined,
      cp2: point.cp2 ? { x: point.cp2.x - actualMinX, y: point.cp2.y - actualMinY } : undefined,
    }]

    return { x: actualMinX, y: actualMinY, w, h, normalizedPoints }
  }

  /**
   * Calculate bounds and normalized points for a multi-point shape.
   *
   * Uses stable origin positioning to prevent the shape from shifting during
   * creation as new points are added. The origin stays fixed at the first point.
   *
   * @param points - Array of points forming the path
   * @returns Bounds rectangle and normalized points
   */
  private calculateMultiPointBounds(points: BezierPoint[]): {
    x: number
    y: number
    w: number
    h: number
    normalizedPoints: BezierPoint[]
  } {
    // Use stable origin (first point) for consistent positioning
    const shapeX = this.stableOrigin?.x ?? points[0].x
    const shapeY = this.stableOrigin?.y ?? points[0].y

    // Flatten all points and control points for bounds calculation
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

    // Calculate extents from stable origin (prevents shifting)
    const leftExtent = shapeX - minX
    const rightExtent = maxX - shapeX
    const topExtent = shapeY - minY
    const bottomExtent = maxY - shapeY

    // Use symmetric bounds around origin + padding
    const padding = BEZIER_BOUNDS.MULTI_POINT_PADDING
    const actualMinX = shapeX - Math.max(leftExtent, rightExtent) - padding
    const actualMinY = shapeY - Math.max(topExtent, bottomExtent) - padding
    const actualMaxX = shapeX + Math.max(leftExtent, rightExtent) + padding
    const actualMaxY = shapeY + Math.max(topExtent, bottomExtent) + padding

    const w = Math.max(1, actualMaxX - actualMinX)
    const h = Math.max(1, actualMaxY - actualMinY)

    // Normalize points to local coordinates
    const normalizedPoints = points.map(p => ({
      x: p.x - actualMinX,
      y: p.y - actualMinY,
      cp1: p.cp1 ? { x: p.cp1.x - actualMinX, y: p.cp1.y - actualMinY } : undefined,
      cp2: p.cp2 ? { x: p.cp2.x - actualMinX, y: p.cp2.y - actualMinY } : undefined,
    }))

    return { x: actualMinX, y: actualMinY, w, h, normalizedPoints }
  }

  /**
   * Update or create the shape with given points and closed state.
   *
   * Handles both single-point and multi-point cases with appropriate bounds
   * calculation. Creates the shape if it doesn't exist, updates if it does.
   *
   * @param points - Points array (in page coordinates)
   * @param isClosed - Whether the path is closed
   * @param forceEditMode - Optional: force edit mode on/off
   */
  private updateShapeWithPointsAndClosed(
    points: BezierPoint[],
    isClosed: boolean,
    forceEditMode?: boolean
  ): void {
    if (points.length === 0) return

    // Initialize stable origin on first point
    if (!this.stableOrigin && points.length > 0) {
      this.stableOrigin = new Vec(points[0].x, points[0].y)
    }

    // Calculate bounds based on the points array being rendered (not this.points)
    // This is important for preview mode where points.length may be > this.points.length
    const bounds = points.length <= 1
      ? this.calculateSinglePointBounds(points[0])
      : this.calculateMultiPointBounds(points)

    // Determine edit mode state
    const editMode = forceEditMode !== undefined ? forceEditMode : !isClosed

    // Build shape partial
    const partial: TLShapePartial<BezierShape> = {
      id: this.shapeId,
      type: 'bezier',
      x: bounds.x,
      y: bounds.y,
      props: {
        w: bounds.w,
        h: bounds.h,
        points: bounds.normalizedPoints,
        isClosed,
        editMode,
        ...DEFAULT_SHAPE_PROPS,
      },
    }

    // Update existing shape or create new one
    if (this.editor.getShape(this.shapeId)) {
      this.editor.updateShape(partial)
    } else {
      this.editor.createShape({
        ...partial,
        meta: {
          isTransient: true,
          transientToolId: 'bezier'
        }
      })
      const { bindShape } = useTransientShapeStore.getState()
      bindShape(this.shapeId)
    }
  }


  private showPreview() {
    if (this.points.length === 0 || !this.currentPoint) return
    
    // Create a temporary points array with the preview segment
    const previewPoints = [...this.points]
    
    // Add a preview point at the current mouse position (without control points for a straight line)
    previewPoints.push({
      x: this.currentPoint.x,
      y: this.currentPoint.y,
    })
    
    // Update the shape with the preview
    this.updateShapeWithPoints(previewPoints)
  }

  private closeCurve() {
    if (this.points.length < 3) return
    
    // Add smooth closing handles before closing the curve
    this.addSmoothClosingHandles()
    
    // Use the actual user-created points directly (not from shape which includes preview)
    this.updateShapeWithPointsAndClosed(this.points, true)
    
    this.editor.setCurrentTool('select')
    this.editor.setSelectedShapes([this.shapeId])

    /**
     * TODO: [tldraw-handoff] Transform control workaround - review with tldraw team
     *
     * Current implementation: setTimeout + selection toggle to refresh transform controls
     *
     * **Why this exists:**
     * - When closing a bezier curve, the shape's geometry changes significantly
     * - Transform controls don't automatically update to match the new closed path bounds
     * - Toggling selection (deselect then reselect) forces controls to recalculate
     * - 50ms delay ensures tldraw's selection state propagates through update cycle
     *
     * **Problem:**
     * - Timing-dependent code is fragile and hard to test
     * - May break with future tldraw internal changes
     * - Causes brief visual flicker of selection handles
     *
     * **Question for tldraw team:**
     * What's the proper way to signal that a shape's bounds have changed and transform
     * controls need to refresh? Options we've considered:
     * 1. editor.batch() for atomic shape updates
     * 2. Specific lifecycle hook after shape modification
     * 3. Different shape creation pattern that avoids this issue
     *
     * **Reproduction:**
     * Without this code, closing a curve leaves transform handles positioned for the
     * open path, not accounting for the closing segment's contribution to bounds.
     *
     * @see Creating.ts:813 for similar workaround in curve completion
     */
    setTimeout(() => {
      this.editor.setSelectedShapes([])
      this.editor.setSelectedShapes([this.shapeId])
    }, BEZIER_TIMING.TRANSFORM_CONTROLS_DELAY)
  }

  private addSmoothClosingHandles() {
    const firstPoint = this.points[0]
    const lastPoint = this.points[this.points.length - 1]

    // Ensure smooth curve continuity when closing the path by adding appropriate control points.
    // This maintains C1 continuity (matching tangent directions) at the closing segment endpoints.

    // If the last point has an outgoing handle (cp2), ensure the first point
    // has an incoming handle (cp1) to create a cubic bezier for the closing segment
    if (lastPoint.cp2) {
      // If first point already has cp2, mirror it to create cp1
      if (firstPoint.cp2) {
        firstPoint.cp1 = {
          x: firstPoint.x - (firstPoint.cp2.x - firstPoint.x),
          y: firstPoint.y - (firstPoint.cp2.y - firstPoint.y)
        }
      } else {
        // If first point has no handles, create a minimal incoming handle
        // that maintains the curve direction from the last point
        const direction = {
          x: firstPoint.x - lastPoint.x,
          y: firstPoint.y - lastPoint.y
        }
        const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
        const normalizedDirection = {
          x: direction.x / length,
          y: direction.y / length
        }
        // Place the control point using CONTROL_POINT_SCALE (typically 0.3) for smooth curvature
        // This value maintains visual continuity with the rest of the bezier curve
        firstPoint.cp1 = {
          x: firstPoint.x - normalizedDirection.x * (length * BEZIER_HANDLES.CONTROL_POINT_SCALE),
          y: firstPoint.y - normalizedDirection.y * (length * BEZIER_HANDLES.CONTROL_POINT_SCALE)
        }
      }
    }
    
    // Similarly, if the first point has an outgoing handle (cp2), ensure the last point
    // has a matching outgoing handle (cp2) for the closing segment
    if (firstPoint.cp2 && !lastPoint.cp2) {
      if (lastPoint.cp1) {
        lastPoint.cp2 = {
          x: lastPoint.x - (lastPoint.cp1.x - lastPoint.x),
          y: lastPoint.y - (lastPoint.cp1.y - lastPoint.y)
        }
      } else {
        // Create a minimal outgoing handle pointing toward the first point
        const direction = {
          x: firstPoint.x - lastPoint.x,
          y: firstPoint.y - lastPoint.y
        }
        const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
        const normalizedDirection = {
          x: direction.x / length,
          y: direction.y / length
        }
        // Use CONTROL_POINT_SCALE for consistent handle length throughout the curve
        lastPoint.cp2 = {
          x: lastPoint.x + normalizedDirection.x * (length * BEZIER_HANDLES.CONTROL_POINT_SCALE),
          y: lastPoint.y + normalizedDirection.y * (length * BEZIER_HANDLES.CONTROL_POINT_SCALE)
        }
      }
    }
  }

  private completeCurve() {
    this.complete()
  }

  private complete() {
    if (this.points.length < 2) {
      // Delete incomplete shape
      this.editor.deleteShape(this.shapeId)
    } else {
      // If we were extending from start, reverse points back to original order
      if (this.isExtendingShape && this.extendFromStart) {
        const finalPoints = this.reversePoints(this.points)
        const shape = this.editor.getShape(this.shapeId) as BezierShape
        if (shape) {
          this.editor.updateShape({
            id: this.shapeId,
            type: 'bezier',
            props: {
              ...shape.props,
              points: finalPoints,
              editMode: false,
            },
          })
        }
      } else {
        // Disable edit mode when completing the curve
        const shape = this.editor.getShape(this.shapeId) as BezierShape
        if (shape) {
          this.editor.updateShape({
            id: this.shapeId,
            type: 'bezier',
            props: {
              ...shape.props,
              editMode: false,
            },
          })
        }
      }
    }

    if (!this.isExtendingShape) {
      const transientStore = useTransientShapeStore.getState()
      const shape = this.editor.getShape(this.shapeId) as BezierShape | undefined
      if (shape) {
        const nextMeta = { ...(shape.meta ?? {}) }
        delete (nextMeta as Record<string, unknown>).isTransient
        delete (nextMeta as Record<string, unknown>).transientToolId

        this.editor.updateShape({
          id: this.shapeId,
          type: 'bezier',
          meta: nextMeta
        })
      }

      if (transientStore.session && transientStore.session.shapeId === this.shapeId) {
        transientStore.finalizeSession()
      }
    }

    this.editor.setCurrentTool('select')

    // Select the created shape and ensure transform controls are properly initialized
    if (this.points.length >= 2) {
      this.editor.setSelectedShapes([this.shapeId])

      /**
       * TODO: [tldraw-handoff] Transform control workaround - review with tldraw team
       *
       * Current implementation: setTimeout + selection toggle for transform control initialization
       *
       * **Why this exists:**
       * - Newly completed bezier shapes need transform controls to initialize
       * - Immediate selection after shape completion doesn't always show handles
       * - Toggling selection with small delay (10ms) forces proper initialization
       * - This is the same issue as curve closing but with shorter delay
       *
       * **Problem:**
       * - Timing-dependent code is fragile
       * - Different timeout values for different operations (10ms vs 50ms) suggests guesswork
       * - May cause race conditions with other selection-dependent features
       *
       * **Question for tldraw team:**
       * Is there a shape finalization callback or lifecycle event we should use instead?
       * Should we be using editor.batch() or a different pattern for multi-step shape creation?
       *
       * **Reproduction:**
       * Without this code, completing a path via Enter or double-click leaves the shape
       * selected but without visible transform handles until you click elsewhere and back.
       *
       * @see Creating.ts:695 for similar workaround in curve closing
       */
      setTimeout(() => {
        this.editor.setSelectedShapes([])
        this.editor.setSelectedShapes([this.shapeId])
      }, BEZIER_TIMING.TRANSFORM_CONTROLS_INIT)
    }
  }

  /**
   * Reverse the order of bezier points, swapping cp1 and cp2 for each point
   */
  private reversePoints(points: BezierPoint[]): BezierPoint[] {
    return points.reverse().map(point => ({
      x: point.x,
      y: point.y,
      cp1: point.cp2,  // Swap control points
      cp2: point.cp1,
    }))
  }

  private cancel() {
    // Delete the shape being created
    this.editor.deleteShape(this.shapeId)
    const transientStore = useTransientShapeStore.getState()
    if (!this.isExtendingShape && transientStore.session && transientStore.session.shapeId === this.shapeId) {
      transientStore.cancelSession()
    }
    this.parent.transition('idle')
  }

  override onInterrupt() {
    // Clean up and bail to mark if interrupted
    if (this.markId && this.points.length < 2) {
      this.editor.bailToMark(this.markId)
    }
    this.parent.transition('idle')
  }

  override onExit() {
    // Reset cursor to default
    this.editor.setCursor({ type: 'default' })
    // Clean up any preview state
    this.markId = undefined
  }
}
