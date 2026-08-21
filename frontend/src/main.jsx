import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Kitchen from './Kitchen.tsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Kitchen />
  </StrictMode>,
)
