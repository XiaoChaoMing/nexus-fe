import { useTranslation } from 'react-i18next'
import type { CategoryGroup } from '@/features/categories/types'

/** Label of a group pill ("Games", "IRL/Trò chuyện"); 'ALL' is the "Tất cả" pill. */
export function useGroupLabel() {
  const { t } = useTranslation('discover')

  return (g: CategoryGroup | 'ALL') => t(`browse.groups.${g}`)
}
