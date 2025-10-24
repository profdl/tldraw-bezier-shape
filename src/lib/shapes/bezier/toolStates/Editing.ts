import {
	StateNode,
	type TLKeyboardEventInfo,
	type TLPointerEventInfo,
	type TLShapeId,
} from '@tldraw/editor'
import { type BezierShape } from '../shared/bezierShape'
import { BezierStateActions } from '../shared/bezierState'
import { bezierLog } from '../shared/bezierConstants'

/**
 * Editing state for bezier shapes.
 *
 * NOTE: All pointer and double-click interactions are handled by BezierEditModeHandler
 * using DOM-level event capture. This is necessary to intercept events before tldraw's
 * handle system processes them. This state node only handles:
 * - Entry/exit lifecycle (setting/clearing editMode prop)
 * - Keyboard shortcuts (Escape/Enter to exit)
 */
export class Editing extends StateNode {
	static override id = 'editing'

	private targetShapeId?: TLShapeId
	private targetShape?: BezierShape

	override onEnter(info: TLPointerEventInfo & { target: 'shape'; shape: BezierShape }) {
		bezierLog('Editing', 'onEnter called', {
			shapeId: info.shape.id,
			editMode: info.shape.props.editMode,
			target: info.target
		})
		this.targetShapeId = info.shape.id
		this.targetShape = info.shape

		if (!info.shape.props.editMode) {
			bezierLog('Editing', 'Setting editMode to true')
			this.editor.updateShape({
				id: info.shape.id,
				type: 'bezier',
				props: {
					...info.shape.props,
					editMode: true,
				},
			})
		} else {
			bezierLog('Editing', 'Already in edit mode')
		}
	}


	override onKeyDown(info: TLKeyboardEventInfo) {
		switch (info.key) {
			case 'Escape':
			case 'Enter': {
				this.exitEditMode()
				break
			}
		}
	}


	private exitEditMode() {
		bezierLog('Editing', 'exitEditMode called', { targetShapeId: this.targetShapeId })
		if (!this.targetShapeId) {
			bezierLog('Editing', 'No target shape ID')
			return
		}

		const shape = this.editor.getShape(this.targetShapeId) as BezierShape
		if (shape) {
			bezierLog('Editing', 'Exiting edit mode for shape', shape.id)
			BezierStateActions.exitEditMode(this.editor, shape)
		} else {
			bezierLog('Editing', 'Shape not found')
		}

		this.editor.setCurrentTool('select')
	}

	override onExit() {
		this.targetShapeId = undefined
		this.targetShape = undefined
		this.editor.setCursor({ type: 'pointer' })
	}
}
