import React, { useMemo } from 'react'
import { useDefaultColorTheme, getSvgPathFromPoints } from 'tldraw'
import type { TLDefaultColorStyle, TLDefaultDashStyle, TLDefaultSizeStyle, TLDefaultFillStyle } from '@tldraw/tlschema'
import { getStroke } from 'perfect-freehand'
import { BEZIER_STYLES } from '../utils/bezierConstants'
import { getStrokeWidth, getDashArray, getFillOpacity, shouldRenderFill } from '../utils/tldrawStyleUtils'
import { sampleBezierPath } from '../utils/bezierPathSampling'

interface BezierPathProps {
  pathData: string
  color: TLDefaultColorStyle
  dash: TLDefaultDashStyle
  size: TLDefaultSizeStyle
  fill: TLDefaultFillStyle
  isClosed: boolean
  editMode: boolean
}

/**
 * Renders the main bezier curve path using tldraw's native style system
 * Handles both fill and stroke rendering with appropriate styles,
 * including hand-drawn "draw" style using perfect-freehand
 */
export const BezierPath: React.FC<BezierPathProps> = ({
  pathData,
  color,
  dash,
  size,
  fill,
  isClosed,
  editMode
}) => {
  const theme = useDefaultColorTheme()

  // Map tldraw styles to rendering values (before any early returns)
  const strokeWidth = getStrokeWidth(size)
  const strokeDasharray = getDashArray(dash)
  const strokeColor = theme[color].solid
  const fillColor = theme[color].solid
  const fillOpacity = getFillOpacity(fill)
  const hasFill = isClosed && shouldRenderFill(fill)

  // For "draw" style, use perfect-freehand to create hand-drawn effect
  // IMPORTANT: This useMemo must be called BEFORE any early returns (Rules of Hooks)
  const drawStylePath = useMemo(() => {
    if (dash !== 'draw') return null

    try {
      // Sample points along the bezier path
      const points = sampleBezierPath(pathData, strokeWidth)

      // Generate stroke outline using perfect-freehand
      // getStroke returns number[][] format
      const strokePointsArray = getStroke(points, {
        size: strokeWidth,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5,
        easing: (t) => Math.sin((t * Math.PI) / 2), // Ease out sine
        simulatePressure: true,
        last: !isClosed,
      })

      // Convert [x, y][] format to {x, y}[] format for getSvgPathFromPoints
      const strokePoints = strokePointsArray.map(([x, y]) => ({ x, y }))

      // Convert stroke points to SVG path
      return getSvgPathFromPoints(strokePoints, isClosed)
    } catch (error) {
      console.error('Error generating draw style:', error)
      return null
    }
  }, [dash, pathData, strokeWidth, isClosed])

  // Don't render anything if no path data (after all hooks have been called)
  if (!pathData) return null

  // Use draw style path if available
  if (dash === 'draw' && drawStylePath) {
    return (
      <>
        {/* Fill layer (if needed) */}
        {hasFill && (
          <path
            d={pathData}
            fill={fillColor}
            fillOpacity={fillOpacity}
            fillRule="evenodd"
            opacity={editMode ? BEZIER_STYLES.EDIT_MODE_OPACITY : 1}
          />
        )}
        {/* Draw style stroke */}
        <path
          d={drawStylePath}
          fill={strokeColor}
          stroke="none"
          opacity={editMode ? BEZIER_STYLES.EDIT_MODE_OPACITY : 1}
          style={{ cursor: 'inherit' }}
        />
      </>
    )
  }

  // Regular stroke rendering for solid, dashed, dotted styles
  return (
    <path
      d={pathData}
      fill={hasFill ? fillColor : 'none'}
      fillOpacity={hasFill ? fillOpacity : 0}
      fillRule="evenodd"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={strokeDasharray}
      opacity={editMode ? BEZIER_STYLES.EDIT_MODE_OPACITY : 1}
      style={{ cursor: 'inherit' }}
    />
  )
}
