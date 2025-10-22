import { Tldraw } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import './App.css'

function App() {
  return (
    <div className="app">
      <Tldraw autoFocus persistenceKey="tldraw-local-storage" />
    </div>
  )
}

export default App
