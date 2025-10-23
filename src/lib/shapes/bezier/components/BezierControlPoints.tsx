import React from 'react'
import { useEditor, useValue } from '@tldraw/editor'
import { type BezierPoint } from '../shared/bezierShape'
import { BEZIER_STYLES, BEZIER_THRESHOLDS } from '../shared/bezierConstants'

interface BezierControlPointsProps {
  points: BezierPoint[]
  selectedPointIndices: number[]
}

/**
 * Renders control points and connection lines for bezier curve editing
 * Shows anchor points, control point handles, and connection lines
 */
export const BezierControlPoints: React.FC<BezierControlPointsProps> = ({
  points,
  selectedPointIndices
}) => {
  const editor = useEditor()
  const zoom = useValue('bezier control zoom', () => editor.getZoomLevel(), [editor])
  const safeZoom = zoom <= 0 ? 1 : zoom

  // Calculate zoom-compensated sizes to maintain consistent screen size
  const anchorRadius = BEZIER_THRESHOLDS.ANCHOR_RADIUS / safeZoom
  const anchorRadiusSelected = BEZIER_THRESHOLDS.ANCHOR_RADIUS_SELECTED / safeZoom
  const controlRadius = BEZIER_THRESHOLDS.CONTROL_RADIUS / safeZoom
  const controlRadiusSelected = BEZIER_THRESHOLDS.CONTROL_RADIUS_SELECTED / safeZoom

  const controlLineWidth = BEZIER_STYLES.CONTROL_LINE_WIDTH / safeZoom
  const anchorStrokeWidth = BEZIER_STYLES.ANCHOR_STROKE / safeZoom
  const controlStrokeWidth = BEZIER_STYLES.CONTROL_STROKE / safeZoom

  return (
    <g opacity={BEZIER_STYLES.CONTROL_OPACITY}>
      {points.map((point, i) => {
        const isSelected = selectedPointIndices.includes(i)

        return (
          <g key={i}>
          {/* Control point lines - draw these first so they appear behind the circles */}
          {point.cp1 && (
            <line
              x1={point.x}
              y1={point.y}
              x2={point.cp1.x}
              y2={point.cp1.y}
              stroke={BEZIER_STYLES.CONTROL_LINE_COLOR}
              strokeWidth={controlLineWidth}
              strokeDasharray={BEZIER_STYLES.CONTROL_LINE_DASH}
              opacity={0.5}
            />
          )}
          {point.cp2 && (
            <line
              x1={point.x}
              y1={point.y}
              x2={point.cp2.x}
              y2={point.cp2.y}
              stroke={BEZIER_STYLES.CONTROL_LINE_COLOR}
              strokeWidth={controlLineWidth}
              strokeDasharray={BEZIER_STYLES.CONTROL_LINE_DASH}
              opacity={0.5}
            />
          )}

          {/* Control point handles */}
          {point.cp1 && (
            <circle
              cx={point.cp1.x}
              cy={point.cp1.y}
              r={isSelected ? controlRadiusSelected : controlRadius}
              fill={isSelected ? BEZIER_STYLES.CONTROL_POINT_FILL_SELECTED : BEZIER_STYLES.CONTROL_POINT_FILL}
              stroke={isSelected ? BEZIER_STYLES.CONTROL_POINT_STROKE_SELECTED : BEZIER_STYLES.CONTROL_POINT_STROKE}
              strokeWidth={isSelected ? 0 : controlStrokeWidth}
            />
          )}
          {point.cp2 && (
            <circle
              cx={point.cp2.x}
              cy={point.cp2.y}
              r={isSelected ? controlRadiusSelected : controlRadius}
              fill={isSelected ? BEZIER_STYLES.CONTROL_POINT_FILL_SELECTED : BEZIER_STYLES.CONTROL_POINT_FILL}
              stroke={isSelected ? BEZIER_STYLES.CONTROL_POINT_STROKE_SELECTED : BEZIER_STYLES.CONTROL_POINT_STROKE}
              strokeWidth={isSelected ? 0 : controlStrokeWidth}
            />
          )}

          {/* Anchor points - draw these last so they appear on top */}
          <circle
            cx={point.x}
            cy={point.y}
            r={isSelected ? anchorRadiusSelected : anchorRadius}
            fill={isSelected ? BEZIER_STYLES.ANCHOR_POINT_FILL_SELECTED : BEZIER_STYLES.ANCHOR_POINT_FILL}
            stroke={isSelected ? BEZIER_STYLES.ANCHOR_POINT_STROKE_SELECTED : BEZIER_STYLES.ANCHOR_POINT_STROKE}
            strokeWidth={isSelected ? 0 : anchorStrokeWidth}
            style={{ cursor: 'pointer' }}
          />
          </g>
        )
      })}
    </g>
  )
}
