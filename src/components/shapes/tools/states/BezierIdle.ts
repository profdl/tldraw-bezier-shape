import { StateNode, type TLPointerEventInfo, type TLShapeId } from '@tldraw/editor'
import { type BezierShape } from '../../BezierShape'

export class BezierIdle extends StateNode {
  static override id = 'idle'

  override onEnter(info?: { extendingShapeId?: string; extendFromStart?: boolean }) {
    // Set crosshair cursor when entering pen tool
    this.editor.setCursor({ type: 'cross' })

    // Check if we're extending an existing shape
    if (info?.extendingShapeId) {
      const shape = this.editor.getShape(info.extendingShapeId as TLShapeId) as BezierShape | undefined
      if (shape && shape.type === 'bezier') {
        // Transition to creating mode with the existing shape info
        this.parent.transition('creating', {
          extendingShapeId: info.extendingShapeId,
          extendFromStart: info.extendFromStart,
          target: 'canvas'
        })
      }
    }
  }

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.target === 'canvas') {
      this.parent.transition('creating', info)
    } else if (info.target === 'shape' && info.shape.type === 'bezier') {
      // If clicking on a bezier shape that's in edit mode, transition to editing
      const shape = info.shape as BezierShape
      if (shape.props.editMode) {
        this.parent.transition('editing', info)
      }
    }
  }

  override onCancel() {
    this.editor.setCurrentTool('select')
  }

  override onComplete() {
    this.editor.setCurrentTool('select')
  }

  override onInterrupt() {
    this.editor.setCurrentTool('select')
  }
}