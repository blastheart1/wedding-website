/** Decoration-only list retained for the original-component QA control. */
export const NAVBAR_SURFACE_TRANSITION = 'background-color, box-shadow, backdrop-filter'

export interface NavbarScrollState {
  hidden: boolean
  scrolled: boolean
}

/** Absolute hero geometry, never scroll direction, focus, gallery visibility or idle time. */
export function navbarScrollState(scrollY: number, heroTop: number, heroHeight: number): NavbarScrollState {
  return {
    hidden: scrollY >= heroTop + heroHeight * 0.5,
    scrolled: scrollY > 40,
  }
}

export function sameNavbarScrollState(a: NavbarScrollState, b: NavbarScrollState): boolean {
  return a.hidden === b.hidden && a.scrolled === b.scrolled
}

export const NAVBAR_TRANSITION_PROPERTIES = `opacity, transform, ${NAVBAR_SURFACE_TRANSITION}`

/** Native CSS is the pill's sole animator; its underlying style is final from the start. */
export function navbarVisualStyle(hidden: boolean, reduced: boolean) {
  return {
    opacity: hidden ? 0 : 1,
    transform: hidden ? 'translateY(-20px)' : 'translateY(0px)',
    transitionProperty: NAVBAR_TRANSITION_PROPERTIES,
    transitionDuration: reduced ? '0s' : '0.4s, 0.4s, 0.3s, 0.3s, 0.3s',
    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
  }
}
