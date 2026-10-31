'use client'

import type { KeyboardEvent, ReactNode } from 'react'
import { useBlob } from './use-blob'

/**
 * Einzelauswahl als echte Radiogruppe: Screenreader hören «Optionsfeld, 2 von 5, ausgewählt»,
 * Tab springt in die Gruppe (auf die gewählte Option), Pfeiltasten wählen die nächste – wie bei nativen Radios.
 */
export function RadioGroup<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
  itemClassName,
  fluid = false,
}: {
  value: T | null
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
  className?: string
  itemClassName?: string
  /** Gewählte Option als fliessender Three.js-Tropfen (wie die Reiter-Leisten). */
  fluid?: boolean
}) {
  const { host: ref, on, layers } = useBlob<HTMLDivElement>(value === null ? null : String(value), fluid)
  const current = options.findIndex((o) => o.value === value)

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const from = current < 0 ? 0 : current
    const next = (from + step + options.length) % options.length
    onChange(options[next]!.value)
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div ref={ref} className={`${className ?? ''}${on ? ' blob-on' : ''}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {layers(
        options.map((o) => ({ key: String(o.value), label: o.label })),
        itemClassName,
      )}
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          data-blob={String(o.value)}
          type="button"
          role="radio"
          className={itemClassName}
          aria-checked={o.value === value}
          tabIndex={o.value === value || (current < 0 && i === 0) ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
