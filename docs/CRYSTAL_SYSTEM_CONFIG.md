# Crystal System Configuration & Laboratory Log

**Status:** STABLE
**Environment:** React Three Fiber, GSAP, Lenis, Zen Browser (Privacy Strict)
**Last Updated:** July 2026

This document serves as the scientific record of the optical, kinetic, and environmental configurations required to achieve the current ultra-premium 3D crystal experience. 

---

## 1. Material & Optical Configuration

### The "Visible Frosted Silver" Material
We conducted extensive experiments with advanced transmission shaders (e.g., `MeshTransmissionMaterial` and `Environment` mapping). 

**Observation (Failure):** Advanced shaders rely on WebGL Framebuffer Objects (FBOs) to capture the background and refract it. Privacy-focused browsers like Zen actively block FBO generation and cross-origin CDNs (used for Environment maps). This resulted in the crystal turning into an invisible "ghost" that perfectly camouflaged into the `#fafafa` background.

**Observation (Success):** To ensure 100% visibility across all browsers without triggering anti-tracking blocks, we reverted to a highly tuned standard `meshPhysicalMaterial`. 

**Final Stable Configuration (`CrystalBlob.jsx`):**
```jsx
<meshPhysicalMaterial
  flatShading={false}
  roughness={0.1}
  transmission={0} // FBOs blocked by Zen, must remain 0
  opacity={0.4}
  transparent={true}
  ior={1.5}
  color="#e0e0e0" // Frosted silver ensures contrast against white backgrounds
  metalness={0.6}
  clearcoat={1.0} // Provides fake glass specular highlights
  clearcoatRoughness={0.1}
/>
```

---

## 2. Kinetic & Animation Configuration

### The "Buttery Smooth" Lerp Tuning
Initial experiments used a lerp (linear interpolation) factor of `0.08` to make transitions "snappy." 

**Observation (Failure):** High lerp factors (`>0.05`) caused the camera and object to whip across the screen jarringly when scrolling through sections. It lacked the weighted, expensive feel of a premium brand.

**Observation (Success):** Lowering all animation factors to `0.02` provided maximum elegance. The objects now glide gracefully, giving a cinematic and deliberate feel to the UI.

**Final Stable Configuration:**
- **Camera Z Position Lerp:** `0.02` (`CrystalScene.jsx`)
- **Camera FOV Lerp:** `0.02` (`CrystalScene.jsx`)
- **Blob Scale Lerp:** `0.02` (`CrystalBlob.jsx`)
- **Blob Opacity Lerp:** `0.02` (`CrystalBlob.jsx`)
- **Blob Horizontal (X) Pan Lerp:** `0.02` (`CrystalScene.jsx`)

### Physical Scroll Scrubbing
Instead of the blob spinning purely on a timer, its rotation is physically bound to the user's scroll momentum.
```jsx
const scrollY = window.scrollY || 0
const t = state.clock.elapsedTime
const targetRotY = (t * 0.08) + (scrollY * 0.002)
const targetRotX = (t * 0.04) + (scrollY * 0.001)

meshRef.current.rotation.y += (targetRotY - meshRef.current.rotation.y) * 0.05
```
**Observation (Success):** This math allows the object to spin idly while the user reads, but actively twist when they scroll, creating a highly tactile connection to the 3D scene.

---

## 3. Scroll & Environment Configuration

### Free Scrolling vs. CSS Snapping
We experimented with CSS Scroll Snapping (`scroll-snap-type: y mandatory`) to force the user to land perfectly on sections.

**Observation (Failure):** Scroll snapping conflicted heavily with the Lenis smooth scrolling engine and the user's natural scroll momentum, resulting in jerky, forced jumps that felt frustrating rather than premium.

**Observation (Success):** Complete removal of CSS Scroll Snapping. Reverting to pure Lenis smooth-scrolling (`duration: 1.2`) restored the free-flowing, buttery UX.

**Final Stable Configuration (`App.jsx`):**
```javascript
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
})
```

---

## Summary of Scientific Findings
1. **Never trust FBOs on the modern web:** Privacy browsers will break them. Build aesthetics using `clearcoat` and opacity.
2. **Speed kills elegance:** In 3D web design, slower lerps (`0.02`) equal higher perceived quality and brand trust.
3. **Don't fight the scrollbar:** Let Lenis handle the smoothing. Forcing snaps breaks user autonomy.
