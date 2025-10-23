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
 * Component to handle edit mode interactions using DOM-level event capture.
 *
 * This is necessary because tldraw's handle system intercepts pointer events
 * on anchor points (which are rendered as handles), preventing the shape's
 * onPointerDown and onDoubleClick handlers from receiving those events.
 *
 * By using DOM event listeners with capture: true, we can intercept events
 * BEFORE tldraw's handle system processes them.
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

      const isTransientShape = Boolean((editingShape.meta as Record<string, unknown> | undefined)?.isTransient)

      // Exit edit mode if tool changed away from select/bezier (only allow bezier tool while creating transient shapes)
      const currentToolId = editor.getCurrentToolId()
      const isAllowedTool = currentToolId === 'select' || (currentToolId === 'bezier' && isTransientShape)
      if (!isAllowedTool) {
        bezierLog('EditMode', 'Tool changed, exiting edit mode')
        BezierStateActions.exitEditMode(editor, editingShape, { deselect: true })
        return
      }

      // Exit edit mode if shape is no longer selected
      const selectedShapes = editor.getSelectedShapes()
      const isStillSelected = selectedShapes.some(s => s.id === editingShape.id)
      if (!isTransientShape && !isStillSelected) {
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
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return
      }

      const editingShape = getEditingShape()

      if (!editingShape) {
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
      const shapePageBounds = editor.getShapePageBounds(editingShape.id)
      if (!shapePageBounds) return

      const zoom = editor.getZoomLevel()

      const localPoint = {
        x: pagePoint.x - shapePageBounds.x,
        y: pagePoint.y - shapePageBounds.y,
      }

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

      // Evaluate control and anchor hits together so we can prefer the anchor when both overlap
      const controlPoint = BezierState.getControlPointAt(
        editingShape.props.points,
        localPoint,
        zoom
      )

      const anchorIndex = BezierState.getAnchorPointAt(
        editingShape.props.points,
        localPoint,
        zoom
      )

      const anchorThreshold = BEZIER_THRESHOLDS.ANCHOR_POINT / zoom
      const anchorDistance =
        anchorIndex !== -1
          ? BezierMath.getDistance(localPoint, editingShape.props.points[anchorIndex])
          : Infinity

      let controlDistance = Infinity
      if (controlPoint) {
        const point = editingShape.props.points[controlPoint.pointIndex]
        const cp = controlPoint.type === 'cp1' ? point.cp1 : point.cp2
        if (cp) {
          controlDistance = BezierMath.getDistance(localPoint, cp)
        }
      }

      const shouldHandleAnchor =
        anchorIndex !== -1 &&
        (controlDistance === Infinity ||
          anchorDistance <= controlDistance ||
          anchorDistance <= anchorThreshold * 0.5)

      if (shouldHandleAnchor) {
        const isDoubleClick = registerClick('anchor', anchorIndex)
        bezierLog('EditMode', 'Clicked on anchor', anchorIndex, {
          isDoubleClick,
          controlDistance,
          anchorDistance
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

      if (controlPoint) {
        bezierLog('EditMode', 'Clicked on control point', controlPoint, {
          anchorDistance,
          controlDistance
        })
        registerClick('control', controlPoint.pointIndex)
        // Let tldraw's handle system manage control point dragging
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
      const shapePageBounds = editor.getShapePageBounds(shape.id)
      if (!shapePageBounds) return

      const localPoint = {
        x: pagePoint.x - shapePageBounds.x,
        y: pagePoint.y - shapePageBounds.y,
      }

      const delta = Vec.Sub(new Vec(localPoint.x, localPoint.y), drag.initialLocalPoint)

      if (drag.initialPoints.length < 2) return

      const startIndex = Math.min(drag.segmentIndex, drag.initialPoints.length - 1)
      const endIndex =
        drag.isClosed && startIndex === drag.initialPoints.length - 1
          ? 0
          : Math.min(startIndex + 1, drag.initialPoints.length - 1)

      const startInitial = drag.initialPoints[startIndex]
      const endInitial = drag.initialPoints[endIndex]
      if (!startInitial || !endInitial) return

      const updatedPoints = drag.initialPoints.map((p: BezierPoint) => ({
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

      editor.updateShape({
        ...shape,
        props: {
          ...shape.props,
          points: updatedPoints,
          selectedSegmentIndex: drag.segmentIndex,
          selectedPointIndices: [],
        },
      })

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
    container.addEventListener('pointerdown', handlePointerDown, { capture: true })
    container.addEventListener('pointermove', handlePointerMove, { capture: false })
    container.addEventListener('pointerup', handlePointerUp, { capture: false })

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      container.removeEventListener('pointermove', handlePointerMove, { capture: false })
      container.removeEventListener('pointerup', handlePointerUp, { capture: false })
    }
  }, [editor])

  return null
}
