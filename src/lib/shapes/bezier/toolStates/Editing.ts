import {
	StateNode,
	Vec,
	type VecLike,
	type TLClickEventInfo,
	type TLKeyboardEventInfo,
	type TLPointerEventInfo,
	type TLShapeId,
} from '@tldraw/editor'
import { type BezierPoint, type BezierShape } from '../shared/bezierShape'
import { BezierBounds } from '../shared/bezierBounds'
import { BezierState, BezierStateActions } from '../shared/bezierState'
import { bezierLog } from '../shared/bezierConstants'

type SegmentDragState = {
	shapeId: TLShapeId
	segmentIndex: number
	initialLocalPoint: Vec
	initialPoints: BezierPoint[]
	isClosed: boolean
}

export class Editing extends StateNode {
	static override id = 'editing'

	private targetShapeId?: TLShapeId
	private targetShape?: BezierShape
	private pendingCanvasExit = false
	private segmentDrag: SegmentDragState | null = null

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

	override onPointerDown(info: TLPointerEventInfo) {
		bezierLog('Editing', 'onPointerDown called', { target: info.target, altKey: info.altKey })
		const shape = this.getEditingShape()
		if (!shape) {
			bezierLog('Editing', 'No editing shape found')
			return
		}

		const localPoint = this.getLocalPoint(shape, info.point)
		const zoom = this.editor.getZoomLevel()
		bezierLog('Editing', 'onPointerDown localPoint:', localPoint, 'zoom:', zoom)

		// Anchor selection
		const anchorIndex = BezierState.getAnchorPointAt(shape.props.points, localPoint, zoom)
		bezierLog('Editing', 'anchorIndex:', anchorIndex)
		if (anchorIndex !== -1) {
			bezierLog(
				'Selection',
				'BezierEditing detected anchor point click:',
				anchorIndex,
				'shiftKey:',
				this.editor.inputs.shiftKey
			)
			BezierStateActions.handlePointSelection(this.editor, shape, anchorIndex, this.editor.inputs.shiftKey)
			return
		}

		// Control handles handled by TLDraw
		const controlInfo = BezierState.getControlPointAt(shape.props.points, localPoint, zoom)
		bezierLog('Editing', 'controlInfo:', controlInfo)
		if (controlInfo) return

		// Segment selection / drag
		const canSelectSegments = this.editor.getCurrentToolId() === 'select'
		const segmentInfo = BezierState.getSegmentAtPosition(shape.props.points, localPoint, zoom, shape.props.isClosed)
		bezierLog('Editing', 'segmentInfo:', segmentInfo, 'canSelectSegments:', canSelectSegments)
		if (segmentInfo && canSelectSegments) {
			if (info.altKey) {
				bezierLog('Editing', 'Starting segment drag')
				this.beginSegmentDrag(shape, segmentInfo.segmentIndex, localPoint)
			} else {
				bezierLog('Editing', 'Selecting segment', segmentInfo.segmentIndex)
				BezierStateActions.selectSegment(this.editor, shape, segmentInfo.segmentIndex)
			}
			return
		}

		bezierLog('Editing', 'No anchor/control/segment hit')
		// Click outside shape -> clear selection and possibly exit
		BezierStateActions.clearPointSelection(this.editor, shape)
		BezierStateActions.clearSegmentSelection(this.editor, shape)

		if (info.target === 'canvas') {
			bezierLog('Editing', 'Canvas click, pending exit')
			this.pendingCanvasExit = true
			return
		}

		bezierLog('Editing', 'Exiting edit mode')
		this.pendingCanvasExit = false
		this.exitEditMode()
	}

	override onPointerMove(info: TLPointerEventInfo) {
		if (this.segmentDrag) {
			const shape = this.editor.getShape<BezierShape>(this.segmentDrag.shapeId)
			if (!shape) {
				this.segmentDrag = null
			} else {
				const bounds = this.editor.getShapePageBounds(shape.id)
				if (bounds) {
					const localPoint = {
						x: info.point.x - bounds.x,
						y: info.point.y - bounds.y,
					}
					this.updateSegmentDrag(shape, localPoint)
				}
			}
		}

		if (this.pendingCanvasExit && this.editor.inputs.isDragging) {
			this.pendingCanvasExit = false
		}
	}

	override onPointerUp() {
		bezierLog('Editing', 'onPointerUp', {
			hasSegmentDrag: !!this.segmentDrag,
			pendingCanvasExit: this.pendingCanvasExit,
			isDragging: this.editor.inputs.isDragging
		})
		if (this.segmentDrag) {
			bezierLog('Editing', 'Ending segment drag')
			this.segmentDrag = null
			this.editor.setCursor({ type: 'pointer' })
		}

		if (this.pendingCanvasExit && !this.editor.inputs.isDragging) {
			bezierLog('Editing', 'Exiting edit mode due to canvas click')
			this.exitEditMode()
		}
		this.pendingCanvasExit = false
	}

	override onDoubleClick(info: TLClickEventInfo) {
		bezierLog('Editing', 'onDoubleClick called', { target: info.target })
		const shape = this.getEditingShape()
		if (!shape) {
			bezierLog('Editing', 'No editing shape found')
			return
		}

		const localPoint = this.getLocalPoint(shape, info.point)
		const zoom = this.editor.getZoomLevel()
		bezierLog('Editing', 'onDoubleClick localPoint:', localPoint, 'zoom:', zoom)

		const anchorIndex = BezierState.getAnchorPointAt(shape.props.points, localPoint, zoom)
		bezierLog('Editing', 'anchorIndex:', anchorIndex)
		if (anchorIndex !== -1) {
			bezierLog('Editing', 'Toggling point type for anchor', anchorIndex)
			BezierStateActions.togglePointType(this.editor, shape, anchorIndex)
			return
		}

		const segmentInfo = BezierState.getSegmentAtPosition(shape.props.points, localPoint, zoom, shape.props.isClosed)
		bezierLog('Editing', 'segmentInfo:', segmentInfo)
		if (segmentInfo) {
			bezierLog('Editing', 'Adding point to segment', segmentInfo.segmentIndex)
			this.addPointToSegment(shape, segmentInfo)
		} else {
			bezierLog('Editing', 'No segment hit')
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

	private getEditingShape(): BezierShape | null {
		if (!this.targetShapeId) return null
		const shape = this.editor.getShape(this.targetShapeId) as BezierShape | undefined
		if (!shape || !shape.props.editMode) return null
		return shape
	}

	private getLocalPoint(shape: BezierShape, point: VecLike) {
		const local = this.editor.getPointInShapeSpace(shape, point as Vec)
		return local.toJson()
	}

	private beginSegmentDrag(shape: BezierShape, segmentIndex: number, localPoint: { x: number; y: number }) {
		this.segmentDrag = {
			shapeId: shape.id,
			segmentIndex,
			initialLocalPoint: new Vec(localPoint.x, localPoint.y),
			initialPoints: shape.props.points.map((p) => ({
				x: p.x,
				y: p.y,
				cp1: p.cp1 ? { ...p.cp1 } : undefined,
				cp2: p.cp2 ? { ...p.cp2 } : undefined,
			})),
			isClosed: shape.props.isClosed,
		}

		BezierStateActions.selectSegment(this.editor, shape, segmentIndex)
		this.editor.setCursor({ type: 'grabbing' })
	}

	private updateSegmentDrag(shape: BezierShape, localPoint: { x: number; y: number }) {
		if (!this.segmentDrag) return

		const { initialLocalPoint, initialPoints, segmentIndex } = this.segmentDrag
		const delta = Vec.Sub(new Vec(localPoint.x, localPoint.y), initialLocalPoint)

		// Use centralized segment drag function from BezierState
		const updatedShape = BezierState.updateSegmentDrag(shape, segmentIndex, initialPoints, delta)
		this.editor.updateShape(updatedShape)
	}

	private addPointToSegment(shape: BezierShape, segmentInfo: { segmentIndex: number; t: number }) {
		const { segmentIndex, t } = segmentInfo
		const updatedShape = BezierState.addPointToSegment(shape, segmentIndex, t)
		const finalShape = BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)

		this.editor.updateShape(finalShape)
		bezierLog('PointAdd', 'New point added at segment', segmentIndex, 'using double click')
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

		this.segmentDrag = null
		this.editor.setCurrentTool('select')
	}

	override onExit() {
		this.targetShapeId = undefined
		this.targetShape = undefined
		this.pendingCanvasExit = false
		this.segmentDrag = null
		this.editor.setCursor({ type: 'pointer' })
	}
}
