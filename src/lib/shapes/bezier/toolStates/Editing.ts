import {
  StateNode,
  type TLPointerEventInfo,
  type TLKeyboardEventInfo,
  type TLShapeId,
} from '@tldraw/editor'
import { type BezierShape } from '../BezierShapeUtil'
import { BezierState, BezierStateActions } from '../shared/bezierState'
import { BezierBounds } from '../shared/bezierBounds'
import { bezierLog } from '../shared/bezierConstants'

export class Editing extends StateNode {
  static override id = 'editing'

  private targetShapeId?: TLShapeId
  private targetShape?: BezierShape
  private pendingCanvasExit = false

  override onEnter(info: TLPointerEventInfo & { target: 'shape'; shape: BezierShape }) {
    // Store the shape we're editing
    this.targetShapeId = info.shape.id
    this.targetShape = info.shape
    
    // Ensure the shape is in edit mode
    if (!info.shape.props.editMode) {
      this.editor.updateShape({
        id: info.shape.id,
        type: 'bezier',
        props: {
          ...info.shape.props,
          editMode: true,
        },
      })
    }
  }


  override onPointerDown(info: TLPointerEventInfo) {
    if (!this.targetShape || !this.targetShapeId) {
      return
    }

    const shape = this.editor.getShape(this.targetShapeId!) as BezierShape
    if (!shape || !shape.props.editMode) return

    // Convert page point to local shape coordinates
    const pagePoint = this.editor.inputs.currentPagePoint.clone()
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Check if clicking on an existing anchor point - handle selection directly
    const anchorPointIndex = BezierState.getAnchorPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (anchorPointIndex !== -1) {
      bezierLog('Selection', 'BezierEditing detected anchor point click:', anchorPointIndex, 'shiftKey:', this.editor.inputs.shiftKey)
      BezierStateActions.handlePointSelection(this.editor, shape, anchorPointIndex, this.editor.inputs.shiftKey)
      return // Selection handled, don't continue with other logic
    }

    // Check if clicking on a control point (do nothing - let handle system manage it)
    const controlPointInfo = BezierState.getControlPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (controlPointInfo) {
      return // Let TLDraw's handle system manage control points
    }

    // Check if clicking on a path segment to add a point
    const segmentInfo = BezierState.getSegmentAtPosition(shape.props.points, localPoint, this.editor.getZoomLevel(), shape.props.isClosed)
    if (segmentInfo) {
      this.addPointToSegment(shape, segmentInfo)
      return // Point added, don't continue with other logic
    }

    // If clicking elsewhere, clear point selection
    BezierStateActions.clearPointSelection(this.editor, shape)

    if (info.target === 'canvas') {
      // Defer exit until pointer up to ensure we are not starting a drag
      this.pendingCanvasExit = true
      return
    }

    this.pendingCanvasExit = false
    this.exitEditMode()
  }

  override onPointerMove() {
    if (this.pendingCanvasExit && this.editor.inputs.isDragging) {
      this.pendingCanvasExit = false
    }
  }

  override onPointerUp() {
    if (this.pendingCanvasExit && !this.editor.inputs.isDragging) {
      this.exitEditMode()
    }
    this.pendingCanvasExit = false
  }

  override onDoubleClick() {
    if (!this.targetShape || !this.targetShapeId) return

    const shape = this.editor.getShape(this.targetShapeId!) as BezierShape
    if (!shape || !shape.props.editMode) return

    // Convert page point to local shape coordinates
    const pagePoint = this.editor.inputs.currentPagePoint.clone()
    const shapePageBounds = this.editor.getShapePageBounds(shape.id)
    if (!shapePageBounds) return

    const localPoint = {
      x: pagePoint.x - shapePageBounds.x,
      y: pagePoint.y - shapePageBounds.y
    }

    // Check if double-clicking on an anchor point to toggle its type
    const anchorPointIndex = BezierState.getAnchorPointAt(shape.props.points, localPoint, this.editor.getZoomLevel())
    if (anchorPointIndex !== -1) {
      BezierStateActions.togglePointType(this.editor, shape, anchorPointIndex)
    }
  }

  override onKeyDown(info: TLKeyboardEventInfo) {
    switch (info.key) {
      case 'Escape':
        this.exitEditMode()
        break
      case 'Enter':
        this.exitEditMode()
        break
    }
  }





  private addPointToSegment(shape: BezierShape, segmentInfo: { segmentIndex: number; t: number }) {
    const { segmentIndex, t } = segmentInfo
    // Use BezierState service for point addition
    const updatedShape = BezierState.addPointToSegment(shape, segmentIndex, t)
    // Recalculate bounds after addition
    const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)
    
    this.editor.updateShape(finalShape)
    bezierLog('PointAdd', 'New point added at segment', segmentIndex, 'using click')
  }




  private exitEditMode() {
    if (!this.targetShapeId) {
      return
    }

    // Use BezierState service to exit edit mode
    const shape = this.editor.getShape(this.targetShapeId!) as BezierShape
    if (shape) {
      BezierStateActions.exitEditMode(this.editor, shape)
    }

    // Return to select tool
    this.editor.setCurrentTool('select')
  }

  override onExit() {
    // Clean up
    this.targetShapeId = undefined
    this.targetShape = undefined
    this.pendingCanvasExit = false
  }
}
