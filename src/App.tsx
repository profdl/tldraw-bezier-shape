import { useEffect, useRef } from 'react'
import {
  Tldraw,
  DefaultToolbar,
  DefaultToolbarContent,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
  useEditor,
  type TLComponents,
  type TLUiOverrides,
  type TLUiAssetUrlOverrides,
} from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'
import { BezierShapeUtil } from './lib/shapes/bezier/BezierShapeUtil'
import { BezierShapeTool } from './lib/shapes/bezier/BezierShapeTool'
import { BezierEditModeService } from './lib/shapes/bezier/tooling/BezierEditModeService'

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

// Component to initialize BezierEditModeService
function BezierEditModeInitializer() {
  const editor = useEditor()
  const serviceRef = useRef<BezierEditModeService | null>(null)

  useEffect(() => {
    // Initialize the service once the editor is ready
    if (!serviceRef.current) {
      serviceRef.current = new BezierEditModeService(editor)
    }

    // Cleanup on unmount
    return () => {
      if (serviceRef.current) {
        serviceRef.current.destroy()
        serviceRef.current = null
      }
    }
  }, [editor])

  return null
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
    return <BezierEditModeInitializer />
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
