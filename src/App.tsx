import {
  Tldraw,
  DefaultToolbar,
  DefaultToolbarContent,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  type TLComponents,
  type TLUiOverrides,
  type TLUiAssetUrlOverrides,
} from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'
import { BezierShapeUtil } from './lib/shapes/bezier/BezierShapeUtil'
import { BezierShapeTool } from './lib/shapes/bezier/BezierShapeTool'
import { BezierEditModeHandler } from './lib/shapes/bezier/components/BezierEditModeHandler'

const customShapeUtils = [BezierShapeUtil]
const customTools = [BezierShapeTool]

// UI overrides to add bezier tool to the tools menu
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.bezier = {
      id: 'bezier',
      icon: 'bezier-icon',
      label: 'Bezier',
      kbd: 'b',
      onSelect: () => {
        editor.setCurrentTool('bezier')
      },
    }
    return tools
  },
}

// Custom components to add bezier tool to toolbar and keyboard shortcuts
const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools()
    const isBezierSelected = useIsToolSelected(tools['bezier'])
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools['bezier']} isSelected={isBezierSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    )
  },
  KeyboardShortcutsDialog: (props) => {
    const tools = useTools()
    return (
      <DefaultKeyboardShortcutsDialog {...props}>
        <DefaultKeyboardShortcutsDialogContent />
        <TldrawUiMenuItem {...tools['bezier']} />
      </DefaultKeyboardShortcutsDialog>
    )
  },
  InFrontOfTheCanvas: () => {
    return <BezierEditModeHandler />
  },
}

// Custom asset URLs for bezier icon
export const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    'bezier-icon': '/bezier-icon.svg',
  },
}

function App() {
  return (
    <div className="app">
      <Tldraw
        autoFocus
        persistenceKey="tldraw-local-storage"
        shapeUtils={customShapeUtils}
        tools={customTools}
        overrides={uiOverrides}
        components={components}
        assetUrls={customAssetUrls}
      />
    </div>
  )
}

export default App
