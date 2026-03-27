interface FloralDividerProps {
  height?: number
  flip?:   boolean
  opacity?: number
}

export function FloralDivider({ height = 120, flip = false, opacity = 0.85 }: FloralDividerProps) {
  return (
    <div
      className={flip ? 'floral-banner-flip' : 'floral-banner'}
      style={{ width: '100%', height, opacity }}
    />
  )
}
