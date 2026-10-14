import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Category, CategoryList } from '@/features/categories/types'
import { apiRequest } from '@/lib/api-client'
import { isApiError } from '@/lib/api-error'

export const categoriesApi = {
  list: (sort: 'position' | 'viewers' = 'position') => apiRequest<CategoryList>(`/v1/categories?sort=${sort}`),
  get: (slug: string) => apiRequest<Category>(`/v1/categories/${encodeURIComponent(slug)}`),
}

export const categoryKeys = {
  list: (sort: 'position' | 'viewers') => ['categories', sort] as const,
  one: (slug: string) => ['categories', 'slug', slug] as const,
}

/** The ~24 seeded categories; stream-svc only sends `category: {id}`, names come from here (TSD §3). */
export function useCategories(sort: 'position' | 'viewers' = 'position') {
  return useQuery({
    queryKey: categoryKeys.list(sort),
    queryFn: () => categoriesApi.list(sort),
    select: (d) => d?.items ?? [],
    // The list is fixed; viewer counts only matter for the "popular" order.
    staleTime: sort === 'position' ? 10 * 60_000 : 60_000,
  })
}

/** id → category, for card labels. */
export function useCategoryMap(): Map<string, Category> {
  const { data } = useCategories()

  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data])
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: categoryKeys.one(slug),
    queryFn: () => categoriesApi.get(slug),
    enabled: Boolean(slug),
    retry: (count, err) => !(isApiError(err) && err.status === 404) && count < 1,
    staleTime: 60_000,
  })
}
