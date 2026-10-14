import { CATEGORY_GROUPS, type Category, type CategoryGroup } from '@/features/categories/types'

/**
 * Khám phá state in the URL (K1: shareable, back button works): `?group=GAMES&view=categories&sort=newest
 * &lang=vi&tags=lol,fps`. Defaults are left out of the URL.
 */
export type BrowseView = 'live' | 'categories'
export type LiveSort = 'viewers' | 'newest'
export type BrowseLanguage = 'vi' | 'en'

export type BrowseParams = {
  group: CategoryGroup | null
  view: BrowseView
  sort: LiveSort
  language: BrowseLanguage | null
  tags: string[]
}

/** stream-svc matches every tag and accepts at most five (TSD §5.3 `tags = TAG_COUNT`). */
export const BROWSE_TAGS_MAX = 5

export function parseBrowseParams(sp: URLSearchParams): BrowseParams {
  const group = sp.get('group')?.toUpperCase() ?? ''
  const lang = sp.get('lang')
  const tags: string[] = []
  for (const raw of (sp.get('tags') ?? '').split(',')) {
    const t = raw.trim()
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t)
  }

  return {
    group: (CATEGORY_GROUPS as readonly string[]).includes(group) ? (group as CategoryGroup) : null,
    view: sp.get('view') === 'categories' ? 'categories' : 'live',
    sort: sp.get('sort') === 'newest' ? 'newest' : 'viewers',
    language: lang === 'vi' || lang === 'en' ? lang : null,
    tags: tags.slice(0, BROWSE_TAGS_MAX),
  }
}

export function browseSearch(p: BrowseParams): string {
  const sp = new URLSearchParams()
  if (p.group) sp.set('group', p.group)
  if (p.view === 'categories') sp.set('view', 'categories')
  if (p.sort !== 'viewers') sp.set('sort', p.sort)
  if (p.language) sp.set('lang', p.language)
  if (p.tags.length > 0) sp.set('tags', p.tags.join(','))
  const s = sp.toString()

  return s ? `?${s}` : ''
}

/** Filters that narrow the live list (the "Xóa bộ lọc" button clears them; the group pill stays). */
export function hasFilters(p: BrowseParams): boolean {
  return p.language !== null || p.tags.length > 0
}

export function addTag(p: BrowseParams, tag: string): BrowseParams {
  const t = tag.trim()
  if (!t || p.tags.some((x) => x.toLowerCase() === t.toLowerCase()) || p.tags.length >= BROWSE_TAGS_MAX) return p

  return { ...p, view: 'live', tags: [...p.tags, t] }
}

/** Category ids sent to `GET /v1/streams?category=` for a group pill (stream-svc filters by id only). */
export function categoryIdsOf(categories: Category[] | undefined, group: CategoryGroup | null): string[] | null {
  if (!group) return null

  return (categories ?? []).filter((c) => c.group === group).map((c) => c.id)
}
