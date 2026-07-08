import { create } from 'zustand'

/**
 * Blob visual-state store.
 *
 * GSAP ScrollTrigger callbacks call `setSection(name)` as each section enters
 * the viewport. R3F components read target values via `useBlobState.getState()`
 * inside useFrame — no React subscription, no re-renders.
 *
 * Each section maps to a preset of target values that the 3D components
 * lerp toward every frame.
 */

// Section presets — keyed by section name
const SECTION_PRESETS = {
  hero: {
    nodeSpread: 0,        // 0 = tight orbits (default)
    lineOpacity: 1,       // full connections
    blobScale: 1,         // full size
    blobOpacity: 1,       // fully visible
    blobPositionX: 1.8,   // offset right for hero layout
    cameraZ: 9,           // default camera distance
    cameraFov: 28,        // default FOV
    lightIntensity: 1.5,  // default directional
    lightColor: '#2196F3', // default accent
    ringOpacity: 1,       // orbit rings visible
  },

  social: {
    nodeSpread: 0,
    lineOpacity: 1,
    blobScale: 0.85,      // recede slightly
    blobOpacity: 0.8,
    blobPositionX: 0,     // center
    cameraZ: 10,          // pull back
    cameraFov: 28,
    lightIntensity: 1.2,
    lightColor: '#2196F3',
    ringOpacity: 0.6,
  },

  reality: {
    nodeSpread: 1,         // nodes scatter outward
    lineOpacity: 0.05,     // connections nearly gone
    blobScale: 0.9,
    blobOpacity: 0.85,
    blobPositionX: 0,
    cameraZ: 9,
    cameraFov: 28,
    lightIntensity: 0.8,   // dimmer — "chaos" mood
    lightColor: '#1565C0', // cooler blue
    ringOpacity: 0.3,
  },

  os: {
    nodeSpread: 0,         // controlled by osProgress
    lineOpacity: 1,        // controlled by osProgress
    blobScale: 1,
    blobOpacity: 1,
    blobPositionX: -2,     // offset LEFT — blob on left, steps on right
    cameraZ: 9,
    cameraFov: 28,
    lightIntensity: 1.8,   // brighter — "order restored"
    lightColor: '#2196F3',
    ringOpacity: 1,
  },

  modules: {
    nodeSpread: 0.3,       // slight spread for satellites
    lineOpacity: 0.7,
    blobScale: 0.75,       // smaller to make room for satellites
    blobOpacity: 0.9,
    blobPositionX: 0,
    cameraZ: 11,           // pull back to see satellites
    cameraFov: 30,
    lightIntensity: 1.4,
    lightColor: '#2196F3',
    ringOpacity: 0.4,
  },

  differentiator: {
    nodeSpread: 0,
    lineOpacity: 1,
    blobScale: 1.1,        // slightly larger — "zoom in"
    blobOpacity: 1,
    blobPositionX: 2,      // offset right — copy on left
    cameraZ: 6.5,          // dolly in close
    cameraFov: 24,         // narrower FOV
    lightIntensity: 2.0,   // brightest — "intelligence" peak
    lightColor: '#42A5F5', // warmer bright blue
    ringOpacity: 0.2,
  },

  target: {
    nodeSpread: 0,
    lineOpacity: 0.8,
    blobScale: 0.9,
    blobOpacity: 0.9,
    blobPositionX: 0,
    cameraZ: 9,
    cameraFov: 28,
    lightIntensity: 1.5,
    lightColor: '#2196F3', // shifts per sub-section via scrollTrigger
    ringOpacity: 0.5,
  },

  friction: {
    nodeSpread: 0,
    lineOpacity: 0.6,
    blobScale: 0.8,
    blobOpacity: 0.85,
    blobPositionX: 0,
    cameraZ: 9,
    cameraFov: 28,
    lightIntensity: 1.3,
    lightColor: '#2196F3',
    ringOpacity: 0.3,
  },

  faq: {
    nodeSpread: 0,
    lineOpacity: 0.3,
    blobScale: 0.35,       // tiny, understated
    blobOpacity: 0.15,     // nearly invisible
    blobPositionX: 0,
    cameraZ: 12,
    cameraFov: 28,
    lightIntensity: 0.6,
    lightColor: '#2196F3',
    ringOpacity: 0.1,
  },

  demo: {
    nodeSpread: 0,
    lineOpacity: 1,
    blobScale: 0.9,
    blobOpacity: 1,
    blobPositionX: 0,
    cameraZ: 8,
    cameraFov: 28,
    lightIntensity: 2.0,   // warm inviting glow
    lightColor: '#42A5F5',
    ringOpacity: 0.8,
  },

  footer: {
    nodeSpread: 0,
    lineOpacity: 0.4,
    blobScale: 0.2,        // tiny mark
    blobOpacity: 0.3,
    blobPositionX: 0,
    cameraZ: 14,
    cameraFov: 28,
    lightIntensity: 0.5,
    lightColor: '#2196F3',
    ringOpacity: 0,
  },
}

const useBlobState = create((set) => ({
  activeSection: 'hero',

  // Current target values (what R3F lerps toward)
  ...SECTION_PRESETS.hero,

  // OS-In-Action sub-progress (0–1 across 3 steps)
  osProgress: 0,

  // Target Profiles sub-progress for color shift
  targetSubColor: '#2196F3',

  setSection: (name) => {
    const preset = SECTION_PRESETS[name]
    if (!preset) return
    set({ activeSection: name, ...preset })
  },

  setOsProgress: (val) => set({ osProgress: val }),

  setTargetSubColor: (color) => set({ targetSubColor: color }),
}))

export { SECTION_PRESETS }
export default useBlobState
