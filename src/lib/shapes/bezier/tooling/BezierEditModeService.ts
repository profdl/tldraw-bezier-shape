import { type Editor, type TLShapeId } from '@tldraw/editor'
import { type BezierPoint, type BezierShape } from '../shared/bezierShape'
import { BezierState, BezierStateActions } from '../shared/bezierState'
import { BezierBounds } from '../shared/bezierBounds'
import { BezierInteractionDetector, type InteractionContext } from '../shared/bezierInteractionDetector'
import { bezierLog, BEZIER_TIMING, BEZIER_THRESHOLDS } from '../shared/bezierConstants'
import type { JsonObject } from '@tldraw/utils'

/**
 * Service for managing global bezier edit mode interactions.
 *
 * This service handles pointer and keyboard events for shapes in edit mode.
 * It provides:
 * - Double-click detection for toggling point types (smooth/corner)
 * - Anchor point selection with shift-key multi-select
 * - Segment selection and dragging (Alt+drag curve segments)
 * - Point insertion via click or hover preview
 * - Keyboard shortcuts (Delete, Escape, Cmd/Ctrl+J to close path)
 *
 * Architecture:
 * - Initialized once per editor instance in TldrawCanvas
 * - Listens to pointer/keyboard events at the container level (with capture)
 * - Delegates state updates to BezierState service
 * - Manages temporary interaction state (drag, hover, double-click detection)
 *
 * @see BezierState for pure state transformation functions
 * @see BezierBounds for bounds recalculation after point modifications
 */
export class BezierEditModeService {
  private editor: Editor
  private lastClickTime = 0
  private lastClickPosition = { x: 0, y: 0 }
  private readonly DOUBLE_CLICK_THRESHOLD = BEZIER_TIMING.DOUBLE_CLICK_THRESHOLD
  private readonly DOUBLE_CLICK_DISTANCE = BEZIER_TIMING.DOUBLE_CLICK_DISTANCE
  private cleanupFunctions: (() => void)[] = []
  private activeSegmentDrag: {
    shapeId: TLShapeId
    segmentIndex: number
    initialLocalPoint: { x: number; y: number }
    initialPoints: BezierPoint[]
    isClosed: boolean
  } | null = null
  private altKeyActiveForEditMode = false

  constructor(editor: Editor) {
    this.editor = editor
    this.initialize()
  }

  /**
   * Initialize the service with event listeners
   */
  private initialize() {
    const container = this.editor.getContainer()

    const handlePointerDown = (e: PointerEvent) => this.handlePointerDown(e)
    const handlePointerMove = (e: PointerEvent) => this.handlePointerMove(e)
    const handlePointerUp = () => this.handlePointerUp()
    const handleKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e)
    const handleKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e)

    container.addEventListener('pointerdown', handlePointerDown, { capture: true })
    container.addEventListener('pointermove', handlePointerMove, { capture: false })
    container.addEventListener('pointerup', handlePointerUp, { capture: false })
    container.addEventListener('pointerleave', handlePointerUp, { capture: false })
    container.addEventListener('pointercancel', handlePointerUp, { capture: false })
    container.addEventListener('keydown', handleKeyDown, { capture: false })
    container.addEventListener('keyup', handleKeyUp, { capture: false })

    // Store cleanup functions
    this.cleanupFunctions.push(() => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      container.removeEventListener('pointermove', handlePointerMove, { capture: false })
      container.removeEventListener('pointerup', handlePointerUp, { capture: false })
      container.removeEventListener('pointerleave', handlePointerUp, { capture: false })
      container.removeEventListener('pointercancel', handlePointerUp, { capture: false })
      container.removeEventListener('keydown', handleKeyDown, { capture: false })
      container.removeEventListener('keyup', handleKeyUp, { capture: false })
    })

    bezierLog('Service', 'BezierEditModeService initialized')
  }

  /**
   * Handle pointer down events for bezier edit mode
   */
  private handlePointerDown(e: PointerEvent) {
    const editingBezierShape = this.findEditingBezierShape()

    if (!editingBezierShape) {
      this.activeSegmentDrag = null
      return
    }

    const currentToolId = this.editor.getCurrentToolId()
    this.activeSegmentDrag = null

    const screenPoint = { x: e.clientX, y: e.clientY }
    const pagePoint = this.editor.screenToPage(screenPoint)

    const shapesAtPointer = this.editor.getShapesAtPoint(pagePoint)
    const clickingOnEditingShape = shapesAtPointer.some(shape => shape.id === editingBezierShape.id)

    const interactionContext = BezierInteractionDetector.getInteractionContext(
      this.editor,
      editingBezierShape,
      pagePoint
    )
    const isDoubleClick = this.detectDoubleClick(e)

    if (isDoubleClick && interactionContext.clickingOnAnchorPoint) {
      this.handleDoubleClickOnAnchor(editingBezierShape, pagePoint, interactionContext)
      this.clearSegmentSelectionState(editingBezierShape)
      return
    }

    if (interactionContext.clickingOnAnchorPoint && !isDoubleClick) {
      this.handleAnchorPointSelection(editingBezierShape, pagePoint, interactionContext, e)
      this.clearSegmentSelectionState(editingBezierShape)
      return
    }

    if (interactionContext.clickingOnHandle) {
      if (this.editor.inputs.altKey && currentToolId === 'select') {
        this.setAltKeyActive(true)
        this.editor.inputs.altKey = false
      }
      this.clearSegmentSelectionState(editingBezierShape)
      if (currentToolId === 'bezier') {
        this.editor.setCursor({ type: 'pointer' })
      }
      return
    }

    if (clickingOnEditingShape) {
      if (currentToolId === 'bezier') {
        if (this.handleHoverPreviewClick(editingBezierShape, pagePoint)) {
          this.clearSegmentSelectionState(editingBezierShape)
          return
        }

        if (this.handleDirectSegmentClick(editingBezierShape, pagePoint)) {
          this.clearSegmentSelectionState(editingBezierShape)
          return
        }

        this.clearSelections(editingBezierShape)
        return
      }

      if (currentToolId === 'select') {
        const segmentInfo = BezierState.getSegmentAtPosition(
          editingBezierShape.props.points,
          interactionContext.localPoint,
          this.editor.getZoomLevel(),
          editingBezierShape.props.isClosed
        )

        if (segmentInfo && isDoubleClick) {
          const updatedShape = BezierState.addPointToSegment(
            editingBezierShape,
            segmentInfo.segmentIndex,
            segmentInfo.t
          )

          const finalShape = BezierBounds.recalculateShapeBounds(
            updatedShape,
            updatedShape.props.points
          )

          this.editor.updateShape({
            ...finalShape,
            props: {
              ...finalShape.props,
              selectedSegmentIndex: undefined,
              hoverSegmentIndex: undefined,
            },
          })
          return
        }

        if (segmentInfo) {
          BezierStateActions.selectSegment(this.editor, editingBezierShape, segmentInfo.segmentIndex)
          if (e.button === 0) {
            e.preventDefault()
            e.stopImmediatePropagation()
            this.beginSegmentDrag(editingBezierShape, segmentInfo.segmentIndex, interactionContext.localPoint)
          }
          return
        }

        this.clearSelections(editingBezierShape)
        return
      }

      this.clearSelections(editingBezierShape)
      return
    }

    if (!clickingOnEditingShape && !interactionContext.clickingOnHandle) {
      // Check if the click is on a UI element (toolbar, panels, etc.)
      // Don't exit edit mode if clicking on UI - only exit if clicking on canvas/other shapes
      const target = e.target as HTMLElement
      const isClickOnUI = target.closest('.tlui-toolbar') ||
                          target.closest('.tlui-menu') ||
                          target.closest('.tlui-button') ||
                          target.closest('[data-testid^="tools."]')

      if (!isClickOnUI) {
        this.exitEditMode(editingBezierShape)
      }
    }
  }

  private handlePointerMove(e: PointerEvent) {
    if (this.activeSegmentDrag) {
      this.updateSegmentDrag(e)
      return
    }

    const editingBezierShape = this.findEditingBezierShape()
    if (!editingBezierShape) return

    if (this.editor.inputs.isDragging) return

    const currentToolId = this.editor.getCurrentToolId()
    if (currentToolId === 'bezier') {
      const pagePoint = this.editor.screenToPage({ x: e.clientX, y: e.clientY })
      const context = BezierInteractionDetector.getInteractionContext(
        this.editor,
        editingBezierShape,
        pagePoint
      )
      this.editor.setCursor({ type: context.clickingOnHandle ? 'pointer' : 'cross' })
    } else if (currentToolId === 'select') {
      this.editor.setCursor({ type: 'default' })
    }
  }

  private handlePointerUp() {
    if (!this.activeSegmentDrag) return

    const { shapeId, segmentIndex } = this.activeSegmentDrag
    this.activeSegmentDrag = null

    const shape = this.editor.getShape(shapeId) as BezierShape | undefined
    if (!shape) return

    const normalizedShape = BezierBounds.recalculateShapeBounds(shape, shape.props.points)

    this.editor.updateShape({
      ...normalizedShape,
      props: {
        ...normalizedShape.props,
        selectedSegmentIndex: segmentIndex,
        hoverSegmentIndex: segmentIndex,
        selectedPointIndices: [],
      },
    })
  }

  private beginSegmentDrag(shape: BezierShape, segmentIndex: number, localPoint: { x: number; y: number }) {
    this.activeSegmentDrag = {
      shapeId: shape.id,
      segmentIndex,
      initialLocalPoint: { ...localPoint },
      initialPoints: BezierInteractionDetector.clonePoints(shape.props.points),
      isClosed: shape.props.isClosed,
    }
  }

  /**
   * Update the shape during an active segment drag operation.
   *
   * This implements the "Alt+drag curve" feature where users can directly
   * manipulate the shape of a bezier segment by dragging any point on the curve.
   * It works by adjusting both control points of the segment by the same delta,
   * effectively "pushing" or "pulling" the curve while maintaining tangent continuity.
   *
   * Algorithm:
   * 1. Calculate delta from initial click to current mouse position
   * 2. Find the two control points that define the dragged segment (cp2 of start, cp1 of end)
   * 3. Add the delta to both control points (parallel translation)
   * 4. Update the shape with modified control points
   *
   * @param e - Pointer move event
   */
  private updateSegmentDrag(e: PointerEvent): void {
    const drag = this.activeSegmentDrag
    if (!drag) return

    const shape = this.editor.getShape(drag.shapeId) as BezierShape | undefined
    if (!shape) {
      this.activeSegmentDrag = null
      return
    }

    // Convert screen coordinates to page coordinates
    const pagePoint = this.editor.screenToPage({ x: e.clientX, y: e.clientY })
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return

    // Convert page coordinates to shape-local coordinates
    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y,
    }

    // Calculate how far we've dragged from the initial click position
    const delta = {
      x: localPoint.x - drag.initialLocalPoint.x,
      y: localPoint.y - drag.initialLocalPoint.y,
    }

    // Clone the initial points (from drag start) to avoid incremental drift
    const updatedPoints = BezierInteractionDetector.clonePoints(drag.initialPoints)

    // Safety: ensure segment index is valid
    const clampedIndex = Math.min(Math.max(drag.segmentIndex, 0), updatedPoints.length - 1)
    if (updatedPoints.length < 2) return

    // Handle closed paths: the last segment connects last point to first point
    const isClosingSegment = drag.isClosed && clampedIndex === updatedPoints.length - 1
    const endIndex = isClosingSegment ? 0 : Math.min(clampedIndex + 1, updatedPoints.length - 1)

    // Get the original (initial) points for this segment
    const startInitial = drag.initialPoints[clampedIndex]
    const endInitial = drag.initialPoints[endIndex]
    if (!startInitial || !endInitial) return

    // Clone the points we'll modify
    const startPoint = { ...updatedPoints[clampedIndex] }
    const endPoint = { ...updatedPoints[endIndex] }

    // Get base control points (fallback to anchor position if no handle exists)
    // This allows dragging linear segments (which have no control points)
    const baseStartHandle = startInitial.cp2 ? { ...startInitial.cp2 } : { x: startInitial.x, y: startInitial.y }
    const baseEndHandle = endInitial.cp1 ? { ...endInitial.cp1 } : { x: endInitial.x, y: endInitial.y }

    // Apply the drag delta to both control points
    // This moves both handles by the same amount, which "pushes" the curve
    startPoint.cp2 = {
      x: baseStartHandle.x + delta.x,
      y: baseStartHandle.y + delta.y,
    }

    endPoint.cp1 = {
      x: baseEndHandle.x + delta.x,
      y: baseEndHandle.y + delta.y,
    }

    // Update the points array with modified points
    updatedPoints[clampedIndex] = startPoint
    updatedPoints[endIndex] = endPoint

    // Create updated shape with new points and selection state
    const updatedShape = {
      ...shape,
      props: {
        ...shape.props,
        points: updatedPoints,
        selectedSegmentIndex: drag.segmentIndex,
        hoverSegmentIndex: drag.segmentIndex,
        hoverPoint: undefined,
        selectedPointIndices: [],
      },
    }

    this.editor.updateShape(updatedShape)
  }


  private clearSelections(shape: BezierShape) {
    const hasPointSelection = shape.props.selectedPointIndices && shape.props.selectedPointIndices.length > 0
    const hasSegmentSelection = typeof shape.props.selectedSegmentIndex === 'number'

    if (!hasPointSelection && !hasSegmentSelection) {
      return
    }

    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        selectedPointIndices: [],
        selectedSegmentIndex: undefined,
        hoverSegmentIndex: undefined,
      },
    })
  }

  private clearSegmentSelectionState(shape: BezierShape) {
    BezierStateActions.clearSegmentSelection(this.editor, shape)
  }

  private togglePathClosed(shape: BezierShape) {
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        isClosed: !shape.props.isClosed,
      },
    })
  }

  /**
   * Handle keyboard events for bezier edit mode
   */
  private handleKeyDown(e: KeyboardEvent) {
    const editingBezierShape = this.findEditingBezierShape()
    if (!editingBezierShape) return

    if (e.key === 'Alt') {
      if (this.editor.getCurrentToolId() === 'select') {
        this.setAltKeyActive(true)
        this.editor.inputs.altKey = false
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
      }
      return
    }

    const bezierProps = editingBezierShape.props as {
      editMode?: boolean
      selectedPointIndices?: number[]
      points?: BezierPoint[]
    }

    if (!bezierProps.editMode) return

    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        this.handlePointDeletion(editingBezierShape, bezierProps)
        e.preventDefault()
        break
      case 'j':
        // Command-J (Mac) or Ctrl-J (Windows/Linux) to toggle path closed/open
        if (e.metaKey || e.ctrlKey) {
          this.togglePathClosed(editingBezierShape)
          e.preventDefault()
        }
        break
      case 'Escape':
      case 'Enter':
        this.exitEditMode(editingBezierShape)
        break
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    if (e.key !== 'Alt') return
    if (!this.altKeyActiveForEditMode) return

    this.setAltKeyActive(false)
  }

  private setAltKeyActive(active: boolean) {
    if (this.altKeyActiveForEditMode === active) {
      return
    }

    this.altKeyActiveForEditMode = active

    const instanceState = this.editor.getInstanceState()
    const prevMeta = (instanceState.meta ?? {}) as JsonObject
    const nextMeta = { ...prevMeta }

    if (active) {
      nextMeta.bezierAltKeyActive = true
    } else {
      delete nextMeta.bezierAltKeyActive
    }

    this.editor.updateInstanceState({ meta: nextMeta })
  }

  /**
   * Find the bezier shape currently in edit mode
   */
  private findEditingBezierShape(): BezierShape | null {
    const allShapes = this.editor.getCurrentPageShapes()
    return allShapes.find(shape =>
      shape.type === 'bezier' && 'editMode' in shape.props && shape.props.editMode
    ) as BezierShape | null
  }


  /**
   * Detect double-click events with temporal and spatial constraints.
   *
   * A double-click is registered when:
   * 1. Time between clicks < DOUBLE_CLICK_THRESHOLD (300ms)
   * 2. Distance between clicks < DOUBLE_CLICK_DISTANCE (5px)
   *
   * Why both time AND distance?
   * - Time: prevents accidental double-clicks from slow users
   * - Distance: allows for minor hand tremor/mouse jitter between clicks
   *
   * Note: This is needed because TLDraw's onDoubleClick doesn't work reliably
   * for our edit mode interactions due to event capture/bubbling complexities.
   *
   * @param e - Pointer event to check
   * @returns true if this click completes a double-click gesture
   */
  private detectDoubleClick(e: PointerEvent): boolean {
    const currentTime = Date.now()
    const currentPosition = { x: e.clientX, y: e.clientY }

    // Check both time and distance constraints
    const isDoubleClick =
      currentTime - this.lastClickTime < this.DOUBLE_CLICK_THRESHOLD &&
      Math.abs(currentPosition.x - this.lastClickPosition.x) < this.DOUBLE_CLICK_DISTANCE &&
      Math.abs(currentPosition.y - this.lastClickPosition.y) < this.DOUBLE_CLICK_DISTANCE

    // Always update tracking state for next click
    this.lastClickTime = currentTime
    this.lastClickPosition = currentPosition

    return isDoubleClick
  }

  /**
   * Handle double-click on anchor point to toggle point type
   */
  private handleDoubleClickOnAnchor(
    shape: BezierShape,
    _pagePoint: { x: number; y: number },
    context: InteractionContext
  ) {
    if (context.anchorPointIndex === -1) return

    const newPoints = [...shape.props.points]
    const targetPoint = newPoints[context.anchorPointIndex]
    const hasControlPoints = targetPoint.cp1 || targetPoint.cp2

    if (hasControlPoints) {
      // Convert smooth to corner (remove control points)
      newPoints[context.anchorPointIndex] = {
        x: targetPoint.x,
        y: targetPoint.y,
      }
    } else {
      // Convert corner to smooth (add control points)
      const controlOffset = 100
      let cp1: { x: number; y: number } | undefined
      let cp2: { x: number; y: number } | undefined

      // Calculate control points based on neighbors
      const points = shape.props.points
      const i = context.anchorPointIndex
      const prevIndex = i === 0 ? (shape.props.isClosed ? points.length - 1 : -1) : i - 1
      const nextIndex = i === points.length - 1 ? (shape.props.isClosed ? 0 : -1) : i + 1

      if (prevIndex >= 0 && nextIndex >= 0) {
        const prevPoint = points[prevIndex]
        const nextPoint = points[nextIndex]
        const dirX = nextPoint.x - prevPoint.x
        const dirY = nextPoint.y - prevPoint.y
        const length = Math.sqrt(dirX * dirX + dirY * dirY)

        if (length > 0) {
          const normalizedDirX = (dirX / length) * controlOffset
          const normalizedDirY = (dirY / length) * controlOffset

          cp1 = {
            x: targetPoint.x - normalizedDirX * 0.3,
            y: targetPoint.y - normalizedDirY * 0.3,
          }
          cp2 = {
            x: targetPoint.x + normalizedDirX * 0.3,
            y: targetPoint.y + normalizedDirY * 0.3,
          }
        }
      }

      if (!cp1 || !cp2) {
        cp1 = { x: targetPoint.x - controlOffset, y: targetPoint.y }
        cp2 = { x: targetPoint.x + controlOffset, y: targetPoint.y }
      }

      newPoints[context.anchorPointIndex] = {
        x: targetPoint.x,
        y: targetPoint.y,
        cp1,
        cp2,
      }
    }

    // Update the shape
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        points: newPoints,
        selectedSegmentIndex: undefined,
        hoverSegmentIndex: undefined,
      },
    })

    bezierLog('DoubleClick', 'Toggled point type for anchor', context.anchorPointIndex)
  }

  /**
   * Handle anchor point selection with shift key support
   */
  private handleAnchorPointSelection(
    shape: BezierShape,
    _pagePoint: { x: number; y: number },
    context: InteractionContext,
    e: PointerEvent
  ) {
    if (context.anchorPointIndex === -1) return

    const currentSelected = shape.props.selectedPointIndices || []
    let newSelected: number[]

    if (e.shiftKey) {
      // Shift-click: toggle selection
      if (currentSelected.includes(context.anchorPointIndex)) {
        newSelected = currentSelected.filter(idx => idx !== context.anchorPointIndex)
      } else {
        newSelected = [...currentSelected, context.anchorPointIndex]
      }
    } else {
      // Regular click: select only this point
      newSelected = [context.anchorPointIndex]
    }

    // Update the shape with new selection
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        selectedPointIndices: newSelected,
        selectedSegmentIndex: undefined,
        hoverSegmentIndex: undefined,
      }
    })

    bezierLog('Selection', 'Updated point selection:', newSelected)
  }

  /**
   * Handle clicking on hover preview to add points
   */
  private handleHoverPreviewClick(shape: BezierShape, pagePoint: { x: number; y: number }): boolean {
    if (this.editor.getCurrentToolId() !== 'bezier') {
      return false
    }

    const hoverPoint = shape.props.hoverPoint
    const hoverSegmentIndex = shape.props.hoverSegmentIndex

    if (!hoverPoint || typeof hoverSegmentIndex !== 'number') {
      return false
    }

    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return false

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Check if clicking near the hover preview point
    const distanceToHoverPoint = Math.sqrt(
      Math.pow(localPoint.x - hoverPoint.x, 2) +
      Math.pow(localPoint.y - hoverPoint.y, 2)
    )

    const clickThreshold = 12 / this.editor.getZoomLevel()

    if (distanceToHoverPoint < clickThreshold) {
      this.addPointAtHoverPreview(shape, hoverPoint, hoverSegmentIndex)
      return true
    }

    return false
  }

  /**
   * Handle direct clicking on path segments to add points
   */
  private handleDirectSegmentClick(shape: BezierShape, pagePoint: { x: number; y: number }): boolean {
    if (this.editor.getCurrentToolId() !== 'bezier') {
      return false
    }

    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return false

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Use BezierState service to find segment at position
    const segmentInfo = BezierState.getSegmentAtPosition(
      shape.props.points,
      localPoint,
      this.editor.getZoomLevel(),
      shape.props.isClosed
    )

    if (segmentInfo) {
      // Add point using BezierState service
      const updatedShape = BezierState.addPointToSegment(shape, segmentInfo.segmentIndex, segmentInfo.t)
      // Recalculate bounds after addition
      const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)

      this.editor.updateShape({
        ...finalShape,
        props: {
          ...finalShape.props,
          selectedSegmentIndex: undefined,
          hoverSegmentIndex: undefined,
        },
      })
      bezierLog('PointAdd', 'Added point at segment', segmentInfo.segmentIndex, 'using direct click')
      return true
    }

    return false
  }

  /**
   * Add a point at the hover preview location
   */
  private addPointAtHoverPreview(shape: BezierShape, hoverPoint: BezierPoint, segmentIndex: number) {
    const newPoints = [...shape.props.points]

    // Insert the new point
    const insertIndex = segmentIndex + 1
    if (segmentIndex === newPoints.length - 1 && shape.props.isClosed) {
      newPoints.push(hoverPoint)
    } else {
      newPoints.splice(insertIndex, 0, hoverPoint)
    }

    // Recalculate bounds using BezierBounds service
    const updatedShape = { ...shape, props: { ...shape.props, points: newPoints } }
    const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, newPoints)

    // Update shape and clear hover preview
    this.editor.updateShape({
      ...finalShape,
      props: {
        ...finalShape.props,
        hoverPoint: undefined,
        hoverSegmentIndex: undefined,
        selectedSegmentIndex: undefined,
      }
    })

    bezierLog('PointAdd', 'Added point at hover preview, segment:', segmentIndex)
  }

  /**
   * Handle point deletion via keyboard
   */
  private handlePointDeletion(shape: BezierShape, props: { selectedPointIndices?: number[]; points?: BezierPoint[] }) {
    const selectedIndices = props.selectedPointIndices || []
    const currentPoints = props.points || []

    if (selectedIndices.length === 0) return

    // Don't allow deletion if it would leave less than 2 points
    if (currentPoints.length - selectedIndices.length < 2) {
      return
    }

    // Use BezierState service for point deletion
    const updatedShape = BezierState.deleteSelectedPoints(shape)
    // Recalculate bounds after deletion
    const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)

    this.editor.updateShape({
      ...finalShape,
      props: {
        ...finalShape.props,
        selectedSegmentIndex: undefined,
        hoverSegmentIndex: undefined,
      },
    })

    bezierLog('Delete', 'Deleted selected points:', selectedIndices)
  }

  /**
   * Exit edit mode for the shape
   */
  private exitEditMode(shape: BezierShape) {
    this.editor.updateShape({
      id: shape.id,
      type: 'bezier',
      props: {
        ...shape.props,
        editMode: false,
        selectedPointIndices: [],
        selectedSegmentIndex: undefined,
        hoverSegmentIndex: undefined,
        hoverPoint: undefined,
      },
    })

    // Select the shape to show transform controls
    this.editor.setSelectedShapes([shape.id])

    bezierLog('EditMode', 'Exited edit mode for shape:', shape.id)

    this.setAltKeyActive(false)
  }

  /**
   * Cleanup the service and remove event listeners
   */
  destroy() {
    this.setAltKeyActive(false)
    this.cleanupFunctions.forEach(cleanup => cleanup())
    this.cleanupFunctions = []
    bezierLog('Service', 'BezierEditModeService destroyed')
  }
}
