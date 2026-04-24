import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import { GameProvider } from './context/GameContext'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </GameProvider>
  </StrictMode>
)
