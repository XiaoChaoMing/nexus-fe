import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { stripTokenFromAddressBar, tokenFromSearch } from '@/features/account/lib/url-token'

/** The `?token=` the page was opened with; it is removed from the address bar after the first render. */
export function useUrlToken(): string | null {
  const location = useLocation()
  const [token] = useState(() => tokenFromSearch(location.search))

  useEffect(() => {
    stripTokenFromAddressBar()
  }, [])

  return token
}
