export function Alert({ ok, message }: { ok?: boolean; message?: string }) {
  if (!message) return null
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        ok
          ? 'border-teal-200 bg-teal-50 text-teal-800'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {message}
    </div>
  )
}
