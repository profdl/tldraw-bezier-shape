/**
 * Simple hook for hash pattern zoom names
 * This is a simplified version - for full pattern support, we'd need to copy
 * more from tldraw's implementation
 */
export function useGetHashPatternZoomName() {
  return (zoom: number, themeId: string) => {
    return `hash-pattern-${themeId}-${zoom.toFixed(2)}`
  }
}
