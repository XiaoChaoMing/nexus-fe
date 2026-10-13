import { useTranslation } from 'react-i18next'
import { CheckIcon, LanguagesIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { changeLanguage, currentLanguage } from '@/i18n'
import { SUPPORTED_LANGUAGES } from '@/i18n/resources'

/** Switches the UI language; the choice is remembered in this browser. */
export function LanguageMenu() {
  const { t } = useTranslation()
  const active = currentLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${t('language.label')}: ${t(`language.${active}`)}`}>
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem key={lng} lang={lng} onSelect={() => void changeLanguage(lng)} aria-current={lng === active || undefined}>
            <span className="flex-1">{t(`language.${lng}`)}</span>
            {lng === active && <CheckIcon className="text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
