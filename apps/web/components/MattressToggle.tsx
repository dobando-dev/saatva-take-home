'use client'

import { useRef } from 'react'
import type { KeyboardEvent } from 'react'

interface ToggleOption {
  id: string
  label: string
}

interface MattressToggleProps {
  options: ToggleOption[]
  value: string
  onChange: (id: string) => void
  labelledBy: string
}

export function MattressToggle({ options, value, onChange, labelledBy }: MattressToggleProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(event: KeyboardEvent, index: number) {
    let next: number
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index - 1 + options.length) % options.length
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % options.length
    } else {
      return
    }
    event.preventDefault()
    onChange(options[next].id)
    buttons.current[next]?.focus()
  }

  return (
    <div className="toggle" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((option, index) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            ref={(el) => {
              buttons.current[index] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={`toggle__option${selected ? ' toggle__option--selected' : ''}`}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
