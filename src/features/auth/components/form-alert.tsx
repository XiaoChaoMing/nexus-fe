export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div role="alert" className="mb-4 flex gap-2 rounded-control border border-error/60 bg-error/10 px-3 py-2.5 text-sm text-fg">
      <span aria-hidden className="text-error">
        ⚠
      </span>
      {message}
    </div>
  )
}
