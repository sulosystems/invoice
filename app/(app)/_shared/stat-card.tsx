export function StatCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string
  value: string | number
  sub?: string
  /** Red accent for a number worth drawing attention to. */
  warn?: boolean
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? 'text-red-600' : ''}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  )
}
