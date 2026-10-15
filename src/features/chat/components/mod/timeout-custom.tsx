import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlertIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useChatMod, type Anchor } from '@/features/chat/components/mod/context'
import type { ModTarget } from '@/features/chat/hooks/use-chat-moderation'
import { customTimeout, TIMEOUT_UNITS, type TimeoutUnit } from '@/features/moderation/lib/duration'
import { cn } from '@/lib/utils'

/**
 * Popover/Timeout Custom: an amount, a unit (Giây · Phút · Giờ · Ngày), an optional reason; "Tối đa 14 ngày" is
 * shown in place while typing, and checked again on submit.
 */
export function TimeoutCustomPopover({ user, anchor, onClose }: { user: ModTarget; anchor: Anchor; onClose: () => void }) {
  const { t } = useTranslation('moderation')
  const { mod } = useChatMod()
  const [amount, setAmount] = useState('10')
  const [unit, setUnit] = useState<TimeoutUnit>('min')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const id = useId()
  const check = customTimeout(amount, unit)
  const error = !check.ok && amount.trim() !== '' ? check.error : null

  const submit = () => {
    if (!check.ok) return
    setPending(true)
    void mod.timeout(user, check.sec, reason.trim() || undefined).finally(() => {
      setPending(false)
      onClose()
    })
  }

  return (
    <Popover open onOpenChange={(o) => !o && onClose()}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent side="left" align="start" className="flex w-70 flex-col gap-3 bg-surface p-4" data-testid="timeout-custom">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <h3 className="text-[15px] font-semibold text-foreground">{t('timeout.customTitle')}</h3>
          <div className="flex gap-2">
            <Input
              id={`${id}-amount`}
              inputMode="numeric"
              aria-label={t('timeout.amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 7))}
              aria-invalid={error !== null}
              aria-describedby={error ? `${id}-err` : undefined}
              className={cn('h-10 min-w-0 flex-1 bg-background', error && 'border-destructive')}
              autoFocus
            />
            <select
              aria-label={t('timeout.unit')}
              value={unit}
              onChange={(e) => setUnit(e.target.value as TimeoutUnit)}
              className="h-10 rounded-lg border border-input bg-surface px-3 text-[13px] font-semibold text-foreground outline-none focus-visible:border-primary"
            >
              {TIMEOUT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`timeout.units.${u}`)}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p id={`${id}-err`} className="flex items-center gap-1.5 text-label-sm font-normal text-destructive" role="alert">
              <CircleAlertIcon className="size-3.5" aria-hidden />
              {t(error === 'max' ? 'timeout.max' : 'timeout.min')}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-reason`} className="text-[13px] font-medium text-foreground">
              {t('timeout.reason')}
            </label>
            <Input id={`${id}-reason`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder={t('timeout.reasonPlaceholder')} className="bg-background" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" className="h-9 font-medium" onClick={onClose} disabled={pending}>
              {t('timeout.cancel')}
            </Button>
            <Button type="submit" size="sm" className="h-9" loading={pending}>
              {t('timeout.submit')}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
