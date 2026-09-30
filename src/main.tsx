import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@capra/theme/base.css'
import '@capra/core/styles.css'
import '@capra/icons/styles.css'
import { installThemeBridge } from './host-theme'
import { Toast } from '@capra/core'
import App from './App'
import './App.css'

installThemeBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toast.Provider />
    <App />
  </StrictMode>,
)
