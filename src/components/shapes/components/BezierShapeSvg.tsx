import { getColorValue, useEditor, useValue } from '@tldraw/editor'
import type { PathBuilder } from 'tldraw'
import type { BezierShape } from '../BezierShape'
import { useDefaultColorTheme } from '../../../hooks/useDefaultColorTheme'
import { getPathForBezierShape, getPathForHoleRings } from '../utils/bezierPathBuilder'
import { STROKE_SIZES } from '../utils/bezierConstants'

// Import ShapeFill component from tldraw's internal modules
// This component handles pattern fills and other fill styles
import { ShapeFill } from '../utils/ShapeFill'

/**
 * Props for the BezierShapeSvg component.
 * Follows tldraw's pattern for shape SVG rendering components.
 */
interface BezierShapeSvgProps {
  shape: BezierShape
  shouldScale?: boolean
  forceSolid?: boolean
}

/**
 * Renders a bezier shape using tldraw's native PathBuilder system.
 * This component follows the same pattern as LineShapeSvg and GeoShapeBody.
 *
 * Architecture:
 * - Uses PathBuilder for all path generation
 * - Uses ShapeFill for filled shapes (pattern/solid/semi fills)
 * - Uses path.toSvg() for stroke rendering with all dash styles
 * - Supports draw style natively through PathBuilder
 */
export function BezierShapeSvg({
  shape,
  shouldScale = false,
  forceSolid = false,
}: BezierShapeSvgProps) {
  const theme = useDefaultColorTheme()
  const editor = useEditor()

  // Get the main path using PathBuilder
  const path = getPathForBezierShape(shape)
  const { dash, color, size, fill, isClosed, holeRings } = shape.props

  // Calculate stroke width based on size and scale
  const scale = shape.props.scale ?? 1
  const strokeWidth = STROKE_SIZES[size] * scale
  const scaleTransform = shouldScale ? 1 / scale : 1

  // Determine if we should force solid rendering at low zoom levels
  const isZoomedOut = useValue('isZoomedOut', () => editor.getZoomLevel() < 0.2, [editor])
  const shouldForceSolid = forceSolid || isZoomedOut

  // Get fill path (may include hole rings with evenodd fill rule)
  const fillPath = isClosed && fill !== 'none' ? getFillPath(path, holeRings) : null

  return (
    <>
      {/* Fill layer for closed shapes */}
      {fillPath && (
        <ShapeFill
          theme={theme}
          d={fillPath}
          color={color}
          fill={fill}
          scale={scale}
        />
      )}

      {/* Main stroke path */}
      {path.toSvg({
        style: shouldForceSolid && dash === 'draw' ? 'solid' : dash,
        strokeWidth,
        forceSolid: shouldForceSolid,
        randomSeed: shape.id,
        props: {
          transform: `scale(${scaleTransform})`,
          stroke: getColorValue(theme, color, 'solid'),
          fill: 'none',
        },
      })}
    </>
  )
}

/**
 * Gets the fill path including hole rings.
 * Hole rings are rendered as separate sub-paths that create holes using evenodd fill rule.
 */
function getFillPath(mainPath: PathBuilder, holeRings?: BezierShape['props']['holeRings']): string {
  let fillPath = mainPath.toD({ onlyFilled: true })

  // Add hole rings as additional sub-paths
  if (holeRings && holeRings.length > 0) {
    const holePath = getPathForHoleRings(holeRings)
    const holeD = holePath.toD({ onlyFilled: true })
    if (holeD) {
      fillPath += ' ' + holeD
    }
  }

  return fillPath
}
