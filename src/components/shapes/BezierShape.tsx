import {
  SVGContainer,
  SvgExportContext,
  T,
  TLShapeUtilCanvasSvgDef,
  type TLBaseShape,
  type RecordProps,
  type TLHandle,
  type TLResizeInfo,
  type TLShapePartial,
} from 'tldraw'
import {
  type TLDefaultColorStyle,
  type TLDefaultDashStyle,
  type TLDefaultSizeStyle,
  type TLDefaultFillStyle,
  DefaultColorStyle,
  DefaultDashStyle,
  DefaultSizeStyle,
  DefaultFillStyle,
} from '@tldraw/tlschema'
import { FlippableShapeUtil } from './utils/FlippableShapeUtil'
import { BezierBounds } from './services/BezierBounds'
import { BezierState, BezierStateActions } from './services/BezierState'
import {
  generateBezierHandles,
  createHandleMemoKey
} from './utils/bezierUtils'
import { BEZIER_STYLES, bezierLog, STROKE_SIZES } from './utils/bezierConstants'
import { BezierShapeSvg } from './components/BezierShapeSvg'
import { BezierControlPoints } from './components/BezierControlPoints'
import { BezierHoverPreview } from './components/BezierHoverPreview'
import { LRUCache } from '../../utils/LRUCache'
import { debugLog } from '../../utils/debug'
import { bezierSegmentToPath } from './utils/bezierPathHelpers'
import { getPathForBezierShape } from './utils/bezierPathBuilder'
import { getFillDefForExport, getFillDefForCanvas } from './utils/fillDefs'

/**
 * A point on a bezier curve with optional control points.
 *
 * @public
 */
export interface BezierPoint {
  x: number
  y: number
  cp1?: { x: number; y: number } // Control point 1 (incoming)
  cp2?: { x: number; y: number } // Control point 2 (outgoing)
}

/**
 * Bezier shape type for creating curved paths with bezier control points.
 * Now uses tldraw's native style system for consistent rendering.
 *
 * @public
 */
export type BezierShape = TLBaseShape<
  'bezier',
  {
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
    hoverPoint?: { x: number; y: number; cp1?: { x: number; y: number }; cp2?: { x: number; y: number } }
    hoverSegmentIndex?: number
  }
>


/**
 * Shape utility for bezier path shapes.
 *
 * @public
 */
export class BezierShapeUtil extends FlippableShapeUtil<BezierShape> {
  static override type = 'bezier' as const

  static override props: RecordProps<BezierShape> = {
    w: T.number,
    h: T.number,
    color: DefaultColorStyle,
    dash: DefaultDashStyle,
    size: DefaultSizeStyle,
    fill: DefaultFillStyle,
    scale: T.number,
    points: T.arrayOf(T.object({
      x: T.number,
      y: T.number,
      cp1: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
      cp2: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
    })),
    isClosed: T.boolean,
    holeRings: T.optional(T.arrayOf(T.arrayOf(T.object({
      x: T.number,
      y: T.number,
      cp1: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
      cp2: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
    })))),
    editMode: T.optional(T.boolean),
    selectedPointIndices: T.optional(T.arrayOf(T.number)),
    selectedSegmentIndex: T.optional(T.number),
    hoverPoint: T.optional(T.object({
      x: T.number,
      y: T.number,
      cp1: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
      cp2: T.optional(T.object({
        x: T.number,
        y: T.number,
      })),
    })),
    hoverSegmentIndex: T.optional(T.number),
  }

  override getDefaultProps(): BezierShape['props'] {
    return {
      w: 1,
      h: 1,
      scale: 1,
      points: [],
      isClosed: false,
      ...this.getCommonDefaultProps(),
    }
  }

  override component(shape: BezierShape) {
    const { points, editMode, selectedPointIndices = [], selectedSegmentIndex, hoverPoint, isClosed } = shape.props

    // Render using tldraw's native PathBuilder system
    return (
      <>
        <SVGContainer>
          <BezierShapeSvg shape={shape} shouldScale={true} />

          {/* Edit mode overlays (rendered in edit mode only) */}
          {editMode && (
            <>
              {/* Highlight selected segment */}
              {typeof selectedSegmentIndex === 'number' && (
                <path
                  d={bezierSegmentToPath(points, selectedSegmentIndex, isClosed)}
                  fill="none"
                  stroke={BEZIER_STYLES.SEGMENT_HIGHLIGHT_COLOR}
                  strokeWidth={BEZIER_STYLES.SEGMENT_HIGHLIGHT_WIDTH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={BEZIER_STYLES.SEGMENT_HIGHLIGHT_OPACITY}
                  strokeDasharray={BEZIER_STYLES.SEGMENT_HIGHLIGHT_DASH}
                />
              )}

              {/* Hover preview for Alt+click point addition */}
              <BezierHoverPreview hoverPoint={hoverPoint} />

              {/* Control points and anchor points */}
              <BezierControlPoints
                points={points}
                selectedPointIndices={selectedPointIndices}
              />
            </>
          )}
        </SVGContainer>
      </>
    )
  }

  override indicator(shape: BezierShape) {
    // Don't show any selection indicator in edit mode to prevent blue rectangle
    if (shape.props.editMode) {
      return null
    }

    // Use PathBuilder for indicator, following tldraw's native pattern
    const path = getPathForBezierShape(shape)
    const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale

    return path.toSvg({
      style: shape.props.dash === 'draw' ? 'draw' : 'solid',
      strokeWidth: 1,
      passes: 1,
      randomSeed: shape.id,
      offset: 0,
      roundness: strokeWidth * 2,
      props: { strokeWidth: undefined },
    })
  }

  getBounds(shape: BezierShape) {
    // Use BezierBounds service for consistent bounds calculation
    if (shape.props.editMode) {
      return BezierBounds.getEditModeBounds(shape)
    } else {
      return BezierBounds.getNormalModeBounds(shape)
    }
  }

  getCenter(shape: BezierShape) {
    // Use BezierBounds service for center calculation
    return BezierBounds.getShapeCenter(shape)
  }

  getOutline(shape: BezierShape) {
    // Use BezierBounds service for outline points
    return BezierBounds.getOutlinePoints(shape)
  }

  getGeometry(shape: BezierShape) {
    // Use PathBuilder's native geometry system
    return getPathForBezierShape(shape).toGeometry()
  }

  override toSvg(shape: BezierShape, ctx: SvgExportContext) {
    // Add fill definitions for export
    ctx.addExportDef(getFillDefForExport(shape.props.fill))

    const scale = shape.props.scale

    return (
      <g transform={`scale(${1/scale})`}>
        <BezierShapeSvg shape={shape} shouldScale={false} forceSolid={false} />
      </g>
    )
  }

  override getCanvasSvgDefs(): TLShapeUtilCanvasSvgDef[] {
    return [getFillDefForCanvas()]
  }

  // LRU cache for handle generation performance optimization
  private handleCache = new LRUCache<string, TLHandle[]>(100) // Increase capacity from 50 to 100
  
  // Handle management for interactive bezier points
  override getHandles(shape: BezierShape): TLHandle[] {
    // Create memoization key based on points and edit mode
    const cacheKey = createHandleMemoKey(shape)

    // Check if we have cached handles for this configuration
    const cachedHandles = this.handleCache.get(cacheKey)
    if (cachedHandles) {
      return cachedHandles
    }

    // Generate new handles using utility function
    const handles = generateBezierHandles(shape)

    // Cache the result using LRU cache (automatic eviction of least recently used)
    this.handleCache.set(cacheKey, handles)

    return handles
  }


  // Handle updates when handles are moved
  override onHandleDrag = (shape: BezierShape, { handle }: { handle: TLHandle }) => {
    bezierLog('Drag', 'onHandleDrag called for handle:', handle.id, 'shiftKey:', this.editor.inputs.shiftKey)
    
    const isSelectTool = this.editor.getCurrentToolId() === 'select'
    const instanceMeta = this.editor.getInstanceState().meta as { bezierAltKeyActive?: boolean } | undefined
    const altKeyForBezier = Boolean(instanceMeta?.bezierAltKeyActive)
    const altBreaksSymmetry = isSelectTool && (this.editor.inputs.altKey || altKeyForBezier)
    const ctrlKey = this.editor.inputs.ctrlKey || altBreaksSymmetry

    // Use BezierState service for handle drag updates
    const newPoints = BezierState.updatePointsFromHandleDrag(shape.props.points, handle, ctrlKey)

    // For normal point dragging, just update points without recalculating bounds
    // Bounds will be recalculated in onBeforeUpdate when the drag operation completes
    return {
      ...shape,
      props: {
        ...shape.props,
        points: newPoints,
      }
    }
  }

  // Recalculate bounds when exiting edit mode or when points change outside edit mode
  override onBeforeUpdate = (prev: BezierShape, next: BezierShape) => {
    // If transitioning from edit mode to normal mode, ALWAYS recalculate bounds
    // This includes custom shape instances that are being edited
    if (prev.props.editMode && !next.props.editMode) {
      return BezierBounds.recalculateShapeBounds(next, next.props.points)
    }

    // If not in edit mode and points changed, also recalculate (for other operations)
    if (!next.props.editMode && prev.props.points !== next.props.points) {
      // Skip bounds recalculation for custom shape instances during live updates
      // The position compensation is handled by useCustomShapeInstances.updateAllInstances
      const isCustomShapeInstance = next.meta?.isCustomShapeInstance === true
      if (isCustomShapeInstance) {
        // Custom shape instances accept normalized points with manual position compensation
        return next
      }

      // For regular bezier shapes (not custom shape instances), check if bounds changed
      const boundsChanged = BezierBounds.haveBoundsChanged(
        prev.props.points,
        next.props.points,
        next.props.isClosed
      )

      if (boundsChanged) {
        return BezierBounds.recalculateShapeBounds(next, next.props.points)
      }
    }

    return next
  }


  // Delete selected points - now delegated to BezierState service
  private deleteSelectedPoints(shape: BezierShape): BezierShape {
    const updatedShape = BezierState.deleteSelectedPoints(shape)
    // Recalculate bounds after deletion
    return BezierBounds.recalculateShapeBounds(updatedShape, updatedShape.props.points)
  }
  




  // Helper method to add a point to the bezier curve
  static addPoint(shape: BezierShape, point: BezierPoint): BezierShape {
    const newPoints = [...shape.props.points, point]
    // Use BezierBounds service for consistent bounds calculation
    return BezierBounds.recalculateShapeBounds(shape, newPoints)
  }

  // Custom flip behavior for Bezier curves
  protected override onFlipCustom(
    shape: BezierShape,
    direction: 'horizontal' | 'vertical',
    isFlippedX: boolean,
    isFlippedY: boolean
  ): BezierShape {
    debugLog('BezierFlip', 'onFlipCustom', {
      shapeId: shape.id,
      direction,
      isFlippedX,
      isFlippedY,
    })

    const scaleX = direction === 'horizontal' ? -1 : 1
    const scaleY = direction === 'vertical' ? -1 : 1

    const transformedPoints = this.transformPointsWithScale(
      this.cloneBezierPoints(shape.props.points),
      {
        scaleX,
        scaleY,
        targetWidth: shape.props.w,
        targetHeight: shape.props.h,
      }
    )

    return {
      ...shape,
      props: {
        ...shape.props,
        points: transformedPoints
      }
    }
  }


  // Double-click to enter edit mode when using the select tool
  override onDoubleClick = (shape: BezierShape) => {
    // Check if this is a custom shape instance
    const isCustomShapeInstance = shape.meta?.isCustomShapeInstance === true

    if (isCustomShapeInstance) {
      // Show notification that editing will affect all instances
      const customShapeId = shape.meta?.customShapeId
      if (customShapeId) {
        bezierLog('Edit', `Editing custom shape instance - changes will affect all instances of "${customShapeId}"`)
      }
    }

    const currentToolId = this.editor.getCurrentToolId()

    if (currentToolId !== 'select') {
      this.editor.setCurrentTool('select')
    }

    return BezierStateActions.enterEditMode(this.editor, shape)
  }

  // Handle key events for shapes in edit mode
  onKeyDown = (shape: BezierShape, info: { key: string; code: string }) => {
    if (shape.props.editMode) {
      switch (info.key) {
        case 'Delete':
        case 'Backspace': {
          // Delete selected points if any are selected
          const selectedIndices = shape.props.selectedPointIndices || []
          if (selectedIndices.length > 0) {
            bezierLog('Delete', 'Deleting selected points:', selectedIndices)
            return this.deleteSelectedPoints(shape)
          }
          // If no points selected, don't delete the shape - let TldrawCanvas handle this
          bezierLog('Delete', 'No points selected, not deleting anything')
          return shape
        }

        case 'Escape':
        case 'Enter':
          // Use BezierState service to exit edit mode
          return BezierStateActions.exitEditMode(this.editor, shape)
      }
    }
    return shape
  }



  // Handle resize operations for transform controls
  override onResize = (shape: BezierShape, info: TLResizeInfo<BezierShape>) => {
    const baseShape = shape.props.editMode
      ? {
          ...shape,
          props: {
            ...shape.props,
            editMode: false,
            selectedPointIndices: [],
            selectedSegmentIndex: undefined,
            hoverSegmentIndex: undefined,
            hoverPoint: undefined,
          },
        }
      : shape

    if (shape.props.editMode) {
      this.editor.updateShape(baseShape)
    }

    // First, let the parent FlippableShapeUtil handle the resize properly
    // This ensures correct transform handle behavior, including flips
    const resizedShape = super.onResize(baseShape, info) as BezierShape
    const initialShape = info.initialShape as BezierShape

    const transformedPoints = this.transformPointsWithScale(
      this.cloneBezierPoints(initialShape.props.points),
      {
        scaleX: info.scaleX,
        scaleY: info.scaleY,
        targetWidth: resizedShape.props.w,
        targetHeight: resizedShape.props.h,
      }
    )

    debugLog('BezierFlip', 'onResize', {
      shapeId: shape.id,
      scaleX: info.scaleX,
      scaleY: info.scaleY,
      initialWidth: initialShape.props.w,
      initialHeight: initialShape.props.h,
      targetWidth: resizedShape.props.w,
      targetHeight: resizedShape.props.h,
      prevFlippedX: Boolean(initialShape.meta?.isFlippedX),
      prevFlippedY: Boolean(initialShape.meta?.isFlippedY),
      nextFlippedX: Boolean(resizedShape.meta?.isFlippedX),
      nextFlippedY: Boolean(resizedShape.meta?.isFlippedY),
    })

    return {
      ...resizedShape,
      props: {
        ...resizedShape.props,
        points: transformedPoints,
      },
    }
  }

  // Handle rotation - prevent rotation in edit mode only
  override onRotate(initial: BezierShape, current: BezierShape) {
    const baseResult = super.onRotate?.(initial, current)
    if (baseResult) {
      return baseResult
    }

    if (initial.props.editMode || current.props.editMode) {
      return {
        rotation: initial.rotation ?? 0
      } as TLShapePartial<BezierShape>
    }

    return undefined
  }

  // Disable transform controls during edit mode but allow basic interaction
  override canResize(shape: BezierShape) {
    if (shape.props.editMode) {
      return false
    }
    return super.canResize(shape)
  }
  override canBind = () => true
  
  // Override hideSelectionBoundsFg to hide selection bounds in edit mode
  override hideSelectionBoundsFg = (shape: BezierShape) => !!shape.props.editMode
  override hideSelectionBoundsBg = (shape: BezierShape) => !!shape.props.editMode

  private transformPointsWithScale(
    points: BezierPoint[] | undefined,
    options: {
      scaleX: number
      scaleY: number
      targetWidth: number
      targetHeight: number
    }
  ): BezierPoint[] {
    if (!points || points.length === 0) {
      return []
    }

    const { scaleX, scaleY, targetWidth, targetHeight } = options

    const clampedScaleX = Number.isFinite(scaleX) ? scaleX : 1
    const clampedScaleY = Number.isFinite(scaleY) ? scaleY : 1

    const offsetX = clampedScaleX < 0 ? targetWidth : 0
    const offsetY = clampedScaleY < 0 ? targetHeight : 0

    return points.map(point => this.applySignedScaleToPoint(point, clampedScaleX, clampedScaleY, offsetX, offsetY))
  }

  private applySignedScaleToPoint(
    point: BezierPoint,
    scaleX: number,
    scaleY: number,
    offsetX: number,
    offsetY: number
  ): BezierPoint {
    const scaledPoint: BezierPoint = {
      x: point.x * scaleX + offsetX,
      y: point.y * scaleY + offsetY,
    }

    if (point.cp1) {
      scaledPoint.cp1 = {
        x: point.cp1.x * scaleX + offsetX,
        y: point.cp1.y * scaleY + offsetY,
      }
    }

    if (point.cp2) {
      scaledPoint.cp2 = {
        x: point.cp2.x * scaleX + offsetX,
        y: point.cp2.y * scaleY + offsetY,
      }
    }

    return scaledPoint
  }

  private cloneBezierPoints(points: BezierPoint[] | undefined): BezierPoint[] {
    if (!points || points.length === 0) {
      return []
    }

    return points.map(point => ({
      x: point.x,
      y: point.y,
      cp1: point.cp1 ? { x: point.cp1.x, y: point.cp1.y } : undefined,
      cp2: point.cp2 ? { x: point.cp2.x, y: point.cp2.y } : undefined,
    }))
  }
}
