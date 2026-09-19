/**
 * Two-slice donut, built from two overlaid SVG circles using the standard
 * stroke-dasharray technique — no charting library needed for something
 * this simple.
 */
export function StockDonutChart({ added, issued }: { added: number; issued: number }) {
  const total = added + issued
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const addedDash = total > 0 ? (added / total) * circumference : 0

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 flex-shrink-0 -rotate-90">
        {total === 0 ? (
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e5e5" strokeWidth="14" />
        ) : (
          <>
            {/* Issued fills the whole ring first; Added is drawn on top, so
                there's no gap or overlap arithmetic to get wrong. */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#d4d4d4"
              strokeWidth="14"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#171717"
              strokeWidth="14"
              strokeDasharray={`${addedDash} ${circumference - addedDash}`}
              strokeLinecap="butt"
            />
          </>
        )}
      </svg>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-900" />
          <dt className="text-neutral-500">Added</dt>
          <dd className="font-medium tabular-nums">{added}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
          <dt className="text-neutral-500">Issued</dt>
          <dd className="font-medium tabular-nums">{issued}</dd>
        </div>
      </dl>
    </div>
  )
}
