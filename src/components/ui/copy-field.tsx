import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type CopyFieldProps = {
  label: string
  value: string
  secret?: boolean
  /** Shown right of the label (e.g. when a key was created). */
  hint?: string
}

function IconAction({ label, onClick, pressed, children }: { label: string; onClick: () => void; pressed?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} aria-pressed={pressed} onClick={onClick} className="bg-card text-muted-foreground hover:text-foreground">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Read-only monospace value with copy (and show/hide for secrets such as the stream key). */
export function CopyField({ label, value, secret = false, hint }: CopyFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const [revealed, setRevealed] = useState(!secret)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setRevealed(true)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        {hint && <span className="text-body-sm text-subtle-foreground">{hint}</span>}
      </div>
      <div className="flex h-10 items-center gap-1 rounded-lg border border-transparent bg-background pr-1.5 pl-3 focus-within:border-primary">
        <input
          id={id}
          readOnly
          type={revealed ? 'text' : 'password'}
          value={value}
          onFocus={(e) => e.target.select()}
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none"
        />
        {secret && (
          <IconAction label={revealed ? t('actions.hide') : t('actions.show')} pressed={revealed} onClick={() => setRevealed((r) => !r)}>
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </IconAction>
        )}
        <IconAction label={copied ? t('actions.copied') : t('actions.copy')} onClick={copy}>
          {copied ? <CheckIcon className="text-primary" /> : <CopyIcon />}
        </IconAction>
      </div>
    </div>
  )
}
