import { CompassIcon, HeartIcon, HouseIcon, SearchIcon, SettingsIcon, UserIcon, type LucideIcon } from 'lucide-react'

type NavLabelKey = 'nav.home' | 'nav.browse' | 'nav.following' | 'nav.search' | 'nav.profile' | 'nav.accountSettings'

export type NavItem = {
  to: string
  /** Key in the common namespace. */
  label: NavLabelKey
  icon: LucideIcon
  /** Guests get the login modal (with this page remembered) instead of a plain navigation. */
  gated?: boolean
}

// NXL-C BR29: Home, Browse, Following. Leaderboard, History, Favorites join when their features exist.
export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'nav.home', icon: HouseIcon },
  { to: '/browse', label: 'nav.browse', icon: CompassIcon },
  { to: '/following', label: 'nav.following', icon: HeartIcon, gated: true },
]

export const SETTINGS_NAV: NavItem = { to: '/settings/account', label: 'nav.accountSettings', icon: SettingsIcon }

// NXL-C BR33: five tabs on mobile.
export const BOTTOM_NAV: NavItem[] = [
  { to: '/', label: 'nav.home', icon: HouseIcon },
  { to: '/browse', label: 'nav.browse', icon: CompassIcon },
  { to: '/following', label: 'nav.following', icon: HeartIcon, gated: true },
  { to: '/search', label: 'nav.search', icon: SearchIcon },
  { to: '/settings/account', label: 'nav.profile', icon: UserIcon, gated: true },
]
