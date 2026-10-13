import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import '@/i18n'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { initAuth } from '@/features/auth/lib/session'

const root = createRoot(document.getElementById('root')!)

// Restore the session from the refresh cookie before the first route renders, so guards see the real state.
void initAuth().finally(() => {
  root.render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
})
