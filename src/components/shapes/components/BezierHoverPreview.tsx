import React from 'react'
import { BEZIER_STYLES, BEZIER_THRESHOLDS } from '../utils/bezierConstants'

interface HoverPreviewPoint {
  x: number
  y: number
  cp1?: { x: number; y: number }
  cp2?: { x: number; y: number }
}

interface BezierHoverPreviewProps {
  hoverPoint: HoverPreviewPoint | undefined
}

/**
 * Renders the hover preview point for click point addition
 * Shows a green dot with pulsing ring when hovering over segments
 */
export const BezierHoverPreview: React.FC<BezierHoverPreviewProps> = ({
  hoverPoint
}) => {
  if (!hoverPoint) return null

  return (
    <g key="hover-preview" opacity={BEZIER_STYLES.CONTROL_OPACITY}>
      {/* Simple preview dot - no control points for better performance */}
      <circle
        cx={hoverPoint.x}
        cy={hoverPoint.y}
        r={BEZIER_THRESHOLDS.HOVER_PREVIEW_RADIUS}
        fill={BEZIER_STYLES.HOVER_PREVIEW_COLOR}
        stroke="white"
        strokeWidth={BEZIER_STYLES.HOVER_PREVIEW_STROKE}
        opacity={BEZIER_STYLES.HOVER_OPACITY}
        style={{ cursor: 'pointer' }}
      />
      {/* Small pulsing ring for visibility */}
      <circle
        cx={hoverPoint.x}
        cy={hoverPoint.y}
        r={BEZIER_THRESHOLDS.HOVER_PREVIEW_RING}
        fill="none"
        stroke={BEZIER_STYLES.HOVER_PREVIEW_COLOR}
        strokeWidth={BEZIER_STYLES.HOVER_RING_STROKE}
        opacity={BEZIER_STYLES.HOVER_RING_OPACITY}
      />
    </g>
  )
}