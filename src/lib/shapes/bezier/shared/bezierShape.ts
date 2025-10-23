import { T, type RecordProps, type TLBaseShape } from '@tldraw/editor'
import {
	DefaultColorStyle,
	DefaultDashStyle,
	DefaultFillStyle,
	DefaultSizeStyle,
	createShapePropsMigrationIds,
	createShapePropsMigrationSequence,
	type TLDefaultColorStyle,
	type TLDefaultDashStyle,
	type TLDefaultFillStyle,
	type TLDefaultSizeStyle,
} from '@tldraw/tlschema'

/** @public */
export interface BezierPoint {
	x: number
	y: number
	cp1?: { x: number; y: number }
	cp2?: { x: number; y: number }
}

/**
 * TODO: [tldraw-handoff] Edit mode storage pattern - review with tldraw team
 * This shape stores edit mode state (editMode, selectedPointIndices, selectedSegmentIndex)
 * directly in shape props rather than in tool state or editor state.
 * Question for tldraw team: Is this pattern acceptable, or should we use a separate
 * "editing tool" state to manage these UI concerns? Most tldraw shapes don't store
 * interaction state in props.
 *
 * @public
 */
export interface BezierShapeProps {
	w: number
	h: number
	color: TLDefaultColorStyle
	dash: TLDefaultDashStyle
	size: TLDefaultSizeStyle
	fill: TLDefaultFillStyle
	scale: number
	points: BezierPoint[]
	isClosed: boolean
	holeRings?: BezierPoint[][]
	editMode?: boolean
	selectedPointIndices?: number[]
	selectedSegmentIndex?: number
}

/** @public */
export type BezierShape = TLBaseShape<'bezier', BezierShapeProps>

/** @public */
export const bezierShapeProps: RecordProps<BezierShape> = {
	w: T.number,
	h: T.number,
	color: DefaultColorStyle,
	dash: DefaultDashStyle,
	size: DefaultSizeStyle,
	fill: DefaultFillStyle,
	scale: T.nonZeroNumber,
	points: T.arrayOf(
		T.object({
			x: T.number,
			y: T.number,
			cp1: T.optional(
				T.object({
					x: T.number,
					y: T.number,
				})
			),
			cp2: T.optional(
				T.object({
					x: T.number,
					y: T.number,
				})
			),
		})
	),
	isClosed: T.boolean,
	holeRings: T.optional(
		T.arrayOf(
			T.arrayOf(
				T.object({
					x: T.number,
					y: T.number,
					cp1: T.optional(
						T.object({
							x: T.number,
							y: T.number,
						})
					),
					cp2: T.optional(
						T.object({
							x: T.number,
							y: T.number,
						})
					),
				})
			)
		)
	),
	editMode: T.optional(T.boolean),
	selectedPointIndices: T.optional(T.arrayOf(T.number)),
	selectedSegmentIndex: T.optional(T.number),
}

const Versions = createShapePropsMigrationIds('bezier', {
	AddScale: 1,
})

/** @public */
export const bezierShapeMigrations = createShapePropsMigrationSequence({
	sequence: [
		{
			id: Versions.AddScale,
			up: (props: BezierShapeProps) => {
				if (props.scale === undefined || props.scale === 0) {
					props.scale = 1
				}
			},
			down: (props: BezierShapeProps) => {
				props.scale = 1
			},
		},
	],
})

/** @public */
export function getDefaultBezierProps(): BezierShapeProps {
	return {
		w: 1,
		h: 1,
		color: 'black',
		dash: 'solid',
		size: 'm',
		fill: 'none',
		scale: 1,
		points: [],
		isClosed: false,
	}
}
