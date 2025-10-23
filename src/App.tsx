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
        <TldrawUiMenuItem {...tools['select']} isSelected={useIsToolSelected(tools['select'])} />
        <TldrawUiMenuItem {...tools['hand']} isSelected={useIsToolSelected(tools['hand'])} />
        <TldrawUiMenuItem {...tools['draw']} isSelected={useIsToolSelected(tools['draw'])} />
        <TldrawUiMenuItem {...tools['eraser']} isSelected={useIsToolSelected(tools['eraser'])} />
        <TldrawUiMenuItem {...tools['bezier']} isSelected={isBezierSelected} />
        <TldrawUiMenuItem {...tools['arrow']} isSelected={useIsToolSelected(tools['arrow'])} />
        <TldrawUiMenuItem {...tools['text']} isSelected={useIsToolSelected(tools['text'])} />
        <TldrawUiMenuItem {...tools['note']} isSelected={useIsToolSelected(tools['note'])} />
        <TldrawUiMenuItem {...tools['asset']} isSelected={useIsToolSelected(tools['asset'])} />
        <TldrawUiMenuItem {...tools['rectangle']} isSelected={useIsToolSelected(tools['rectangle'])} />
        <TldrawUiMenuItem {...tools['ellipse']} isSelected={useIsToolSelected(tools['ellipse'])} />
        <TldrawUiMenuItem {...tools['diamond']} isSelected={useIsToolSelected(tools['diamond'])} />
        <TldrawUiMenuItem {...tools['triangle']} isSelected={useIsToolSelected(tools['triangle'])} />
        <TldrawUiMenuItem {...tools['trapezoid']} isSelected={useIsToolSelected(tools['trapezoid'])} />
        <TldrawUiMenuItem {...tools['rhombus']} isSelected={useIsToolSelected(tools['rhombus'])} />
        <TldrawUiMenuItem {...tools['hexagon']} isSelected={useIsToolSelected(tools['hexagon'])} />
        <TldrawUiMenuItem {...tools['cloud']} isSelected={useIsToolSelected(tools['cloud'])} />
        <TldrawUiMenuItem {...tools['star']} isSelected={useIsToolSelected(tools['star'])} />
        <TldrawUiMenuItem {...tools['oval']} isSelected={useIsToolSelected(tools['oval'])} />
        <TldrawUiMenuItem {...tools['x-box']} isSelected={useIsToolSelected(tools['x-box'])} />
        <TldrawUiMenuItem {...tools['check-box']} isSelected={useIsToolSelected(tools['check-box'])} />
        <TldrawUiMenuItem {...tools['arrow-left']} isSelected={useIsToolSelected(tools['arrow-left'])} />
        <TldrawUiMenuItem {...tools['arrow-up']} isSelected={useIsToolSelected(tools['arrow-up'])} />
        <TldrawUiMenuItem {...tools['arrow-down']} isSelected={useIsToolSelected(tools['arrow-down'])} />
        <TldrawUiMenuItem {...tools['arrow-right']} isSelected={useIsToolSelected(tools['arrow-right'])} />
        <TldrawUiMenuItem {...tools['line']} isSelected={useIsToolSelected(tools['line'])} />
        <TldrawUiMenuItem {...tools['highlight']} isSelected={useIsToolSelected(tools['highlight'])} />
        <TldrawUiMenuItem {...tools['laser']} isSelected={useIsToolSelected(tools['laser'])} />
        <TldrawUiMenuItem {...tools['frame']} isSelected={useIsToolSelected(tools['frame'])} />
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
