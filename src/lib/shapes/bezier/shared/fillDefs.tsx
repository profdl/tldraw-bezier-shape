/**
 * Fill definition utilities for bezier shapes.
 * These are used for pattern and other fill types in SVG export.
 */
import {
  DefaultFontStyle,
  SvgExportDef,
  TLDefaultFillStyle,
  TLShapeUtilCanvasSvgDef,
  useUniqueSafeId,
} from '@tldraw/editor'
import { PatternFillDefForCanvas, useGetHashPatternZoomName } from './defaultStyleDefs'
import { useDefaultColorTheme } from '../../../../hooks/useDefaultColorTheme'

function HashPatternForExport() {
  const getHashPatternZoomName = useGetHashPatternZoomName()
  const maskId = useUniqueSafeId()
  const theme = useDefaultColorTheme()
  const t = 8 / 12
  return (
    <>
      <mask id={maskId}>
        <rect x="0" y="0" width="8" height="8" fill="white" />
        <g strokeLinecap="round" stroke="black">
          <line x1={t * 1} y1={t * 3} x2={t * 3} y2={t * 1} />
          <line x1={t * 5} y1={t * 7} x2={t * 7} y2={t * 5} />
          <line x1={t * 9} y1={t * 11} x2={t * 11} y2={t * 9} />
        </g>
      </mask>
      <pattern
        id={getHashPatternZoomName(1, theme.id)}
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
      >
        <rect x="0" y="0" width="8" height="8" fill={theme.solid} mask={`url(#${maskId})`} />
      </pattern>
    </>
  )
}

export function getFillDefForExport(fill: TLDefaultFillStyle): SvgExportDef {
  return {
    key: `${DefaultFontStyle.id}:${fill}`,
    async getElement() {
      if (fill !== 'pattern') return null

      return <HashPatternForExport />
    },
  }
}

export function getFillDefForCanvas(): TLShapeUtilCanvasSvgDef {
  return {
    key: `${DefaultFontStyle.id}:pattern`,
    component: PatternFillDefForCanvas,
  }
}
