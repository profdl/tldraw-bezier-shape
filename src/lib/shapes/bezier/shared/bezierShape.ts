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

/**
 * A point on a bezier curve with optional control points.
 *
 * @public
 * @remarks
 * Control points define the curve shape between anchor points:
 * - `cp1`: Incoming control point (affects curve before the point)
 * - `cp2`: Outgoing control point (affects curve after the point)
 * - If both cp1 and cp2 are present and symmetrical, the point is "smooth"
 * - If control points are absent or asymmetric, the point is a "corner"
 *
 * @example
 * ```ts
 * // Corner point (no control points)
 * const corner: BezierPoint = { x: 100, y: 100 }
 *
 * // Smooth point with symmetrical control points
 * const smooth: BezierPoint = {
 *   x: 100,
 *   y: 100,
 *   cp1: { x: 80, y: 100 },
 *   cp2: { x: 120, y: 100 }
 * }
 * ```
 */
export interface BezierPoint {
	/** X coordinate of the anchor point */
	x: number
	/** Y coordinate of the anchor point */
	y: number
	/** Incoming control point (affects curve before this point) */
	cp1?: { x: number; y: number }
	/** Outgoing control point (affects curve after this point) */
	cp2?: { x: number; y: number }
}

/**
 * Shape properties for the Bezier path shape.
 *
 * TODO: [tldraw-handoff] Edit mode storage pattern - review with tldraw team
 *
 * Current implementation: Edit mode UI state stored in shape props
 *
 * **Why this exists:**
 * - Bezier shapes need an "edit mode" where users can select/move/add/delete points
 * - We need to track which points are selected (selectedPointIndices)
 * - We need to track which segment is selected (selectedSegmentIndex)
 * - Storing in props makes the state automatically persist through undo/redo
 *
 * **Current approach:**
 * ```ts
 * interface BezierShapeProps {
 *   // ... standard props
 *   editMode?: boolean                  // Whether shape is in edit mode
 *   selectedPointIndices?: number[]     // Which anchor points are selected
 *   selectedSegmentIndex?: number       // Which segment is selected
 * }
 * ```
 *
 * **Concerns:**
 * - Most tldraw shapes don't store UI interaction state in props
 * - Edit state gets serialized with the shape (persisted, copy/pasted, etc.)
 * - Appears in undo/redo history (is this desirable?)
 * - Multiple shapes could theoretically be in edit mode simultaneously (though we prevent this)
 *
 * **Alternative approaches:**
 * 1. **Separate editing tool**: Create a "bezier-editing" tool that manages selection state
 *    - Pros: Cleaner separation of data vs UI state
 *    - Cons: More complex tool state machine, loses undo/redo for point selection
 *
 * 2. **Editor instance state**: Store in editor.getInstanceState().meta
 *    - Pros: Not persisted with shape, follows tldraw patterns better
 *    - Cons: Lost on page refresh, doesn't survive undo/redo
 *
 * 3. **Hybrid approach**: editMode in props, selection in editor state
 *    - Pros: Best of both worlds
 *    - Cons: Split brain - harder to reason about
 *
 * **Question for tldraw team:**
 * Which pattern do you recommend? Are there examples of other shapes with similar
 * multi-point editing needs we should follow?
 *
 * **Similar shapes in tldraw:**
 * - Line shape: Has multiple points but simpler editing model
 * - Draw shape: Has points but no individual point selection
 * - Arrow shape: Has start/end/mid points but fixed structure
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

/**
 * A bezier path shape with support for smooth and corner points.
 *
 * @public
 * @remarks
 * Bezier shapes are vector paths composed of anchor points connected by
 * cubic Bezier curves. They can be open (path) or closed (shape with fill).
 *
 * Features:
 * - Click-drag to create smooth points
 * - Click without drag for corner points
 * - Double-click to enter edit mode
 * - Full style support (color, dash, size, fill)
 * - Transform operations (resize, rotate, flip)
 *
 * @example
 * ```ts
 * // Create a simple bezier shape
 * editor.createShape({
 *   type: 'bezier',
 *   x: 100,
 *   y: 100,
 *   props: {
 *     w: 200,
 *     h: 200,
 *     points: [
 *       { x: 0, y: 0 },
 *       { x: 100, y: 50, cp1: { x: 50, y: 0 }, cp2: { x: 150, y: 50 } },
 *       { x: 200, y: 0 }
 *     ],
 *     isClosed: false,
 *     color: 'black',
 *     dash: 'solid',
 *     size: 'm',
 *     fill: 'none',
 *     scale: 1
 *   }
 * })
 * ```
 */
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
export function getDefaultBezierProps(editor?: import('@tldraw/editor').Editor): BezierShapeProps {
	// Use current style selections if editor is provided, otherwise use hardcoded defaults
	if (editor) {
		return {
			w: 1,
			h: 1,
			color: editor.getStyleForNextShape(DefaultColorStyle),
			dash: editor.getStyleForNextShape(DefaultDashStyle),
			size: editor.getStyleForNextShape(DefaultSizeStyle),
			fill: editor.getStyleForNextShape(DefaultFillStyle),
			scale: 1,
			points: [],
			isClosed: false,
		}
	}

	// Fallback to defaults when editor is not available
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
