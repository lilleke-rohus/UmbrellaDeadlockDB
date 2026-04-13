import { useState, type ChangeEvent, type ReactElement } from 'react'

export type AuthLuxInputProps = {
  id: string
  label?: string
  placeholder?: string
  type?: string
  value: string
  onChange: (ev: ChangeEvent<HTMLInputElement>) => void
  required?: boolean
  minLength?: number
  autoComplete?: string
  disabled?: boolean
}

export function AuthLuxInput({
  id,
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  disabled,
}: AuthLuxInputProps): ReactElement {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div className="auth-lux-field">
      {label ? (
        <label className="auth-lux-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div
        className="auth-lux-input-wrap"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <input
          id={id}
          className="auth-lux-input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        {isHovering ? (
          <>
            <div
              className="auth-lux-glow auth-lux-glow-top"
              style={{
                background: `radial-gradient(30px circle at ${String(mousePosition.x)}px 0px, var(--auth-lux-highlight) 0%, transparent 70%)`,
              }}
            />
            <div
              className="auth-lux-glow auth-lux-glow-bottom"
              style={{
                background: `radial-gradient(30px circle at ${String(mousePosition.x)}px 2px, var(--auth-lux-highlight) 0%, transparent 70%)`,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
