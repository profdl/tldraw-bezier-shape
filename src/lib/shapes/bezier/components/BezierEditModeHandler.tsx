import { useCallback, useEffect, useRef } from 'react'
import { useEditor } from '@tldraw/tldraw'
import { Vec, type TLShapeId } from '@tldraw/editor'
import { type BezierShape, type BezierPoint } from '../shared/bezierShape'
import { BezierState, BezierStateActions } from '../shared/bezierState'
import { BezierBounds } from '../shared/bezierBounds'
import { BezierMath } from '../shared/bezierMath'
import { bezierLog, BEZIER_BOUNDS, BEZIER_THRESHOLDS } from '../shared/bezierConstants'

type SegmentDragState = {
  shapeId: TLShapeId
  segmentIndex: number
  initialLocalPoint: Vec
  initialPoints: BezierPoint[]
  isClosed: boolean
}

type ClickTargetType = 'anchor' | 'segment' | 'control' | 'canvas' | 'none'

/**
 * Component to handle ALL edit mode interactions using DOM-level event capture.
 *
 * This is the authoritative interaction handler for bezier shapes in edit mode.
 * It intercepts events BEFORE tldraw's systems process them using capture: true,
 * which is necessary to:
 * - Handle clicks on anchor points (rendered as tldraw handles)
 * - Implement custom double-click detection (300ms threshold, 8px distance)
 * - Prevent tldraw's default behaviors (e.g., text tool on double-click)
 *
 * **Interactions handled:**
 * - Single click: Select anchor points (with shift-to-multi-select)
 * - Double click anchor: Toggle smooth/corner point type
 * - Double click segment: Add new point at position
 * - Click & drag segment: Reshape curve segment
 * - Delete/Backspace: Remove selected points
 * - Escape/Enter: Exit edit mode
 * - Click outside shape: Exit edit mode
 *
 * **Architecture note:**
 * The Editing state (toolStates/Editing.ts) only handles lifecycle (enter/exit)
 * and keyboard shortcuts. All pointer interactions happen here to avoid duplication
 * and race conditions.
 */
export function BezierEditModeHandler() {
  const editor = useEditor()
  const lastClickRef = useRef<{
    time: number
    position: { x: number; y: number }
    type: ClickTargetType
    id: number | null
    count: number
  }>({
    time: 0,
    position: { x: 0, y: 0 },
    type: 'none',
    id: null,
    count: 0,
  })
  const segmentDragRef = useRef<SegmentDragState | null>(null)
  const DOUBLE_CLICK_THRESHOLD = 300 // milliseconds
  const DOUBLE_CLICK_DISTANCE = 8 // pixels

  const getEditingShape = useCallback((): BezierShape | undefined => {
    for (const shape of editor.getCurrentPageShapes()) {
      if (shape.type === 'bezier') {
        const candidate = shape as BezierShape
        if (candidate.props.editMode) {
          return candidate
        }
      }
    }
    return undefined
  }, [editor])

  // Listen for tool changes and selection changes to exit edit mode
  useEffect(() => {
    const handleStoreChange = () => {
      const editingShape = getEditingShape()

      if (!editingShape) return

      // Exit edit mode if tool changed away from select/bezier
      const currentToolId = editor.getCurrentToolId()
      const isAllowedTool = currentToolId === 'select' || currentToolId === 'bezier'
      if (!isAllowedTool) {
        bezierLog('EditMode', 'Tool changed, exiting edit mode')
        BezierStateActions.exitEditMode(editor, editingShape, { deselect: true })
        return
      }

      // Exit edit mode if shape is no longer selected (unless bezier tool is active)
      const selectedShapes = editor.getSelectedShapes()
      const isStillSelected = selectedShapes.some(s => s.id === editingShape.id)
      const isBezierToolActive = currentToolId === 'bezier'
      if (!isBezierToolActive && !isStillSelected) {
        bezierLog('EditMode', 'Shape deselected, exiting edit mode')
        BezierStateActions.exitEditMode(editor, editingShape, { deselect: true })
      }
    }

    return editor.store.listen(handleStoreChange, {
      source: 'user',
      scope: 'all',
    })
  }, [editor, getEditingShape])

  useEffect(() => {
    const container = editor.getContainer()

    const handleKeyDown = (event: KeyboardEvent) => {
      const editingShape = getEditingShape()
      if (!editingShape) {
        return
      }

      // Handle Escape/Enter to exit edit mode
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        bezierLog('EditMode', 'Keyboard exit via', event.key)
        BezierStateActions.exitEditMode(editor, editingShape, { deselect: false })
        return
      }

      // Handle Delete/Backspace to remove selected points
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }

      const selectedIndices = editingShape.props.selectedPointIndices || []
      if (selectedIndices.length === 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const beforeCount = editingShape.props.points.length
      const afterShape = BezierStateActions.deleteSelectedPoints(editor, editingShape)
      const afterCount = afterShape.props.points.length

      bezierLog('Delete', 'Keydown handler removed points', {
        beforeCount,
        afterCount,
        selectedIndices,
        preventedShapeDelete: true,
      })
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, getEditingShape])

  useEffect(() => {
    const container = editor.getContainer()

    const handleContextMenu = (e: MouseEvent) => {
      // Check if we're in edit mode
      const editingShape = getEditingShape()
      if (editingShape) {
        // Prevent context menu from appearing in edit mode
        e.preventDefault()
        e.stopPropagation()
        bezierLog('EditMode', 'Context menu prevented in edit mode')
      }
    }

    const handlePointerDown = (e: PointerEvent) => {
      // Find the bezier shape currently in edit mode
      const editingShape = getEditingShape()

      if (!editingShape) {
        bezierLog('EditMode', 'No shape in edit mode')
        return
      }

      const currentToolId = editor.getCurrentToolId()
      const canSelectSegments = currentToolId === 'select'

      bezierLog('EditMode', 'Pointer down detected in edit mode', {
        currentToolId,
        canSelectSegments
      })

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY })
      const zoom = editor.getZoomLevel()
      const localPoint = editor.getPointInShapeSpace(editingShape, pagePoint)

      const now = Date.now()
      const currentPosition = { x: e.clientX, y: e.clientY }

      const registerClick = (type: ClickTargetType, id: number | null) => {
        const lastClick = lastClickRef.current
        const timeSinceLastClick = now - lastClick.time
        const distanceFromLastClick = Math.hypot(
          currentPosition.x - lastClick.position.x,
          currentPosition.y - lastClick.position.y
        )
        const isSameTarget = lastClick.type === type && lastClick.id === id
        const isWithinThreshold =
          timeSinceLastClick < DOUBLE_CLICK_THRESHOLD &&
          distanceFromLastClick < DOUBLE_CLICK_DISTANCE

        const clickCount = isSameTarget && isWithinThreshold ? lastClick.count + 1 : 1
        const isDoubleClick = clickCount === 2

        lastClickRef.current = {
          time: now,
          position: currentPosition,
          type,
          id,
          count: isDoubleClick ? 0 : clickCount,
        }

        bezierLog('EditMode', 'Click detection:', {
          timeSinceLastClick,
          distanceFromLastClick,
          clickCount,
          isDoubleClick,
          targetType: type,
          targetId: id,
        })

        return isDoubleClick
      }

      // Check for control points first - this must happen before the shape bounds check
      // so that control points extending outside the shape bounds can still be selected
      const controlPoint = BezierState.getControlPointAt(
        editingShape.props.points,
        localPoint,
        zoom
      )

      if (controlPoint) {
        bezierLog('EditMode', 'Clicked on control point', controlPoint)
        registerClick('control', controlPoint.pointIndex)
        // Let tldraw's handle system manage control point dragging
        return
      }

      // Now check for anchor points, with control point distance already known to be Infinity
      const anchorIndex = BezierState.getAnchorPointAt(
        editingShape.props.points,
        localPoint,
        zoom
      )

      if (anchorIndex !== -1) {
        const isDoubleClick = registerClick('anchor', anchorIndex)
        bezierLog('EditMode', 'Clicked on anchor', anchorIndex, {
          isDoubleClick
        })

        if (isDoubleClick) {
          bezierLog('EditMode', 'DOUBLE-CLICK on anchor - toggling point type')
          BezierStateActions.togglePointType(editor, editingShape, anchorIndex)
          // Prevent the event from reaching tldraw's double-click handler (which switches to text tool)
          e.preventDefault()
          e.stopPropagation()
          return
        }

        // Single click - handle point selection
        bezierLog('EditMode', 'Single click on anchor - selecting')
        BezierStateActions.handlePointSelection(editor, editingShape, anchorIndex, e.shiftKey)
        return
      }

      // Check if clicking on a segment (only if not on an anchor point)
      const segmentInfo = BezierState.getSegmentAtPosition(
        editingShape.props.points,
        localPoint,
        zoom,
        editingShape.props.isClosed
      )

      if (segmentInfo) {
        const isDoubleClick = registerClick('segment', segmentInfo.segmentIndex)
        bezierLog('EditMode', 'Clicked on segment', segmentInfo.segmentIndex, {
          isDoubleClick,
          altKey: e.altKey,
          canSelectSegments
        })

        if (isDoubleClick) {
          bezierLog('EditMode', 'DOUBLE-CLICK on segment - adding point')
          const updatedShape = BezierState.addPointToSegment(
            editingShape,
            segmentInfo.segmentIndex,
            segmentInfo.t
          )
          const finalShape = BezierBounds.recalculateShapeBounds(
            updatedShape,
            updatedShape.props.points
          )
          editor.updateShape(finalShape)
          bezierLog('PointAdd', 'New point added at segment', segmentInfo.segmentIndex, 'using double click')
          // Prevent text tool activation
          e.preventDefault()
          e.stopPropagation()
          return
        }

        if (!canSelectSegments) {
          bezierLog('EditMode', 'Ignoring segment click - current tool cannot select segments', {
            currentToolId
          })
          return
        }

        // Drag to reshape segment
        bezierLog('EditMode', 'Starting segment drag')
        segmentDragRef.current = {
          shapeId: editingShape.id,
          segmentIndex: segmentInfo.segmentIndex,
          initialLocalPoint: new Vec(localPoint.x, localPoint.y),
          initialPoints: editingShape.props.points.map((p) => ({
            x: p.x,
            y: p.y,
            cp1: p.cp1 ? { ...p.cp1 } : undefined,
            cp2: p.cp2 ? { ...p.cp2 } : undefined,
          })),
          isClosed: editingShape.props.isClosed,
        }
        BezierStateActions.selectSegment(editor, editingShape, segmentInfo.segmentIndex)
        editor.setCursor({ type: 'grabbing' })
        // Prevent shape from being dragged
        e.preventDefault()
        e.stopPropagation()
        return
      }

      // Click not on any anchor or segment - check if user hit the shape geometry
      const padding = BEZIER_BOUNDS.EDIT_MODE_EXIT_PADDING / zoom
      const shapeHit = editor.getShapeAtPoint(pagePoint, {
        hitInside: true,
        margin: padding,
        filter: (shape) => shape.id === editingShape.id,
      })

      if (!shapeHit) {
        registerClick('canvas', null)
        bezierLog('EditMode', 'Click outside shape geometry, exiting edit mode')
        BezierStateActions.exitEditMode(editor, editingShape, { deselect: true })
        return
      }

      registerClick('canvas', null)
      bezierLog('EditMode', 'Click inside shape area without target - staying in edit mode')
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!segmentDragRef.current) return

      const drag = segmentDragRef.current
      const shape = editor.getShape(drag.shapeId) as BezierShape | undefined
      if (!shape) {
        segmentDragRef.current = null
        return
      }

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY })
      const localPoint = editor.getPointInShapeSpace(shape, pagePoint)
      const delta = Vec.Sub(localPoint, drag.initialLocalPoint)

      // Use centralized segment drag function from BezierState
      const updatedShape = BezierState.updateSegmentDrag(shape, drag.segmentIndex, drag.initialPoints, delta)
      editor.updateShape(updatedShape)

      bezierLog('EditMode', 'Segment drag update, delta:', delta)
    }

    const handlePointerUp = () => {
      if (!segmentDragRef.current) return

      const { shapeId, segmentIndex } = segmentDragRef.current
      const shape = editor.getShape(shapeId) as BezierShape | undefined

      if (shape) {
        bezierLog('EditMode', 'Ending segment drag, recalculating bounds')
        const normalizedShape = BezierBounds.recalculateShapeBounds(shape, shape.props.points)
        editor.updateShape(normalizedShape)
      }

      segmentDragRef.current = null
      editor.setCursor({ type: 'default' })
    }

    // Use capture phase to intercept events before tldraw's handlers
    container.addEventListener('contextmenu', handleContextMenu, { capture: true })
    container.addEventListener('pointerdown', handlePointerDown, { capture: true })
    container.addEventListener('pointermove', handlePointerMove, { capture: false })
    container.addEventListener('pointerup', handlePointerUp, { capture: false })

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu, { capture: true })
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      container.removeEventListener('pointermove', handlePointerMove, { capture: false })
      container.removeEventListener('pointerup', handlePointerUp, { capture: false })
    }
  }, [editor, getEditingShape])

  return null
}
