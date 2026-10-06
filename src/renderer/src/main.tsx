import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import QuickCapture from './components/QuickCapture'

const isQuick = window.location.hash === '#quick'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isQuick ? <QuickCapture /> : <App />}</StrictMode>
)