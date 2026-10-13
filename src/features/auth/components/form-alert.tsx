export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div role="alert" className="mb-4 flex gap-2 rounded-control border border-destructive/60 bg-destructive/10 px-3 py-2.5 text-sm text-foreground">
      <span aria-hidden className="text-destructive">
        ⚠
      </span>
      {message}
    </div>
  )
}
