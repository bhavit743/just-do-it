import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'

// ⬇️ add this:
import ShareIngestor from './ShareInjestor'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        {/* Headless component that ingests shared screenshots on app open */}
        <ShareIngestor />
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
