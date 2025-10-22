import { getDefaultColorTheme, useIsDarkMode } from '@tldraw/editor'

/**
 * Hook to get the default color theme based on dark mode setting.
 * Follows tldraw's native pattern.
 *
 * @public
 */
export function useDefaultColorTheme() {
  return getDefaultColorTheme({ isDarkMode: useIsDarkMode() })
}
