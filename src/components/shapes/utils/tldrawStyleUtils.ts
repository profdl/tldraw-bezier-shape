import type { TLDefaultSizeStyle, TLDefaultDashStyle, TLDefaultFillStyle } from '@tldraw/tlschema'

/**
 * Utilities for mapping tldraw's style enums to rendering values
 */

/**
 * Map tldraw size style to stroke width in pixels
 */
export const STROKE_WIDTHS: Record<TLDefaultSizeStyle, number> = {
  's': 2,
  'm': 3.5,
  'l': 5,
  'xl': 10,
}

/**
 * Map tldraw dash style to SVG stroke-dasharray values
 */
export const DASH_ARRAYS: Record<TLDefaultDashStyle, string> = {
  'draw': 'none',   // Hand-drawn style - rendered same as solid for now
  'solid': 'none',
  'dashed': '8 8',
  'dotted': '2 6',
}

/**
 * Map tldraw fill style to opacity values
 */
export const FILL_OPACITY: Record<TLDefaultFillStyle, number> = {
  'none': 0,
  'semi': 0.5,
  'solid': 1,
  'pattern': 1, // Pattern fill uses full opacity with pattern overlay
  'fill': 1, // 'fill' is an alias for 'solid'
}

/**
 * Get stroke width for a given size style
 */
export function getStrokeWidth(size: TLDefaultSizeStyle): number {
  return STROKE_WIDTHS[size]
}

/**
 * Get SVG stroke-dasharray for a given dash style
 */
export function getDashArray(dash: TLDefaultDashStyle): string {
  return DASH_ARRAYS[dash]
}

/**
 * Get fill opacity for a given fill style
 */
export function getFillOpacity(fill: TLDefaultFillStyle): number {
  return FILL_OPACITY[fill]
}

/**
 * Check if a fill style should render fill
 */
export function shouldRenderFill(fill: TLDefaultFillStyle): boolean {
  return fill !== 'none'
}
