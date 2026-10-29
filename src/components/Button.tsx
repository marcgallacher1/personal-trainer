import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
}

const VARIANTS = {
  primary: 'bg-accent text-accent-fg',
  secondary: 'bg-surface-2 text-text border border-border',
  danger: 'bg-danger text-white',
} as const

/** Big, thumb-friendly button (min 56px tall). */
export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button
      {...rest}
      className={`h-14 rounded-xl px-5 text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  )
}
