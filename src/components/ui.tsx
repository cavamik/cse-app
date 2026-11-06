import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink/90',
  secondary: 'border border-line bg-white text-ink hover:bg-paper',
  ghost: 'bg-transparent text-ink hover:bg-ink/5',
  danger: 'bg-danger-soft text-danger hover:bg-danger/10',
}

function buttonClass(variant: Variant = 'primary', className = '') {
  return `inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${className}`
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}

export function FileButton({
  htmlFor,
  variant = 'secondary',
  className = '',
  children,
}: {
  htmlFor: string
  variant?: Variant
  className?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className={buttonClass(variant, className)}>
      {children}
    </label>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  required = false,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{hint}</p> : null}
    </div>
  )
}

export function StepHeader({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <header className="mb-5">
      <p className="text-xs font-semibold tracking-[0.16em] text-amber-deep uppercase">{kicker}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
    </header>
  )
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-4 shadow-[0_16px_40px_-28px_rgba(20,32,43,0.55)] ${className}`}>
      {children}
    </section>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-amber/15 px-3 py-3 text-sm leading-relaxed text-ink">{children}</p>
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="bg-danger-soft px-4 py-3 text-sm leading-relaxed text-danger">
      {children}
    </p>
  )
}

export function BrandBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-ink pt-[env(safe-area-inset-top)] text-white">
      <div className={className}>{children}</div>
      <div
        className="h-1.5 bg-[repeating-linear-gradient(135deg,#e6a317_0_10px,#14202b_10px_20px)]"
        aria-hidden="true"
      />
    </header>
  )
}

export function Badge({ stato }: { stato: 'bozza' | 'completato' }) {
  const completato = stato === 'completato'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${completato ? 'bg-pine-soft text-pine' : 'bg-amber/20 text-amber-deep'}`}
    >
      {completato ? 'Completato' : 'Bozza'}
    </span>
  )
}
