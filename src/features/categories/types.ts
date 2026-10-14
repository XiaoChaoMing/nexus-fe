/** `GET /v1/categories` (channel-svc, TSD GĐ4 §5.1). */

export type CategoryGroup = 'GAMES' | 'ESPORTS' | 'MUSIC' | 'IRL' | 'CREATIVE'

export const CATEGORY_GROUPS: readonly CategoryGroup[] = ['GAMES', 'ESPORTS', 'MUSIC', 'IRL', 'CREATIVE']

export type Category = {
  id: string
  slug: string
  name: string
  group: CategoryGroup
  posterUrl: string | null
  tags: string[]
  position: number
  /** Sum of the live viewers in the category; null when unknown. */
  viewerCount: number | null
}

export type CategoryList = { items: Category[]; nextCursor: null }
