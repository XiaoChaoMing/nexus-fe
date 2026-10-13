/** Shapes of identity-svc responses (TSD GĐ1 §4.1). */

export type GlobalRole = 'USER' | 'ADMIN'

export type Role = 'VIEWER' | 'CREATOR' | 'ADMIN'

export type User = {
  id: string
  username: string
  displayName: string
  email: string
  emailVerified: boolean
  globalRole: GlobalRole
  /** YYYY-MM-DD, null until set (settings or an approved Creator application). */
  birthDate?: string | null
  locale?: string
  timezone?: string
  isCreator?: boolean
  channelId?: string | null
  createdAt: string
}

export type Session = {
  accessToken: string
  expiresIn: number
  user: User
}

export type Preferences = {
  sidebarCollapsed: boolean
  matureVisible: boolean
}

/** `GET /v1/me`: everything the shell needs about the signed-in account. */
export type Me = {
  user: User
  roles: Role[]
  isCreator: boolean
  channelId: string | null
  unreadNotifications: number
  preferences: Preferences
}

export type MeUpdate = {
  displayName?: string
  birthDate?: string
  locale?: string
  timezone?: string
  preferences?: Partial<Preferences>
}
