# WebGL & Anti-Tracking Browser Quirks (Zen Browser)

This document serves as a historical record of the intensive debugging session required to make the 3D `CrystalScene` function in privacy-focused browsers (specifically **Zen Browser**).

Privacy browsers use aggressive anti-fingerprinting heuristics that silently break standard React Three Fiber (R3F) and WebGL implementations. If the 3D scene breaks in the future, check these vectors first.

## 1. The `ResizeObserver` Spoofing Bug
**The Symptom:** The R3F `<Canvas>` would render at a default 150x150 pixels, breaking the layout. The R3F engine uses `react-use-measure` which relies on `ResizeObserver`.
**The Cause:** Zen Browser intercepts `ResizeObserver` and reports incorrect `clientWidth`/`clientHeight` (or zeroes) for canvas elements to prevent fingerprinting via window sizing.
**The Fix:**
- We wrote a custom `ResizeObserverPolyfill` in `App.jsx` that falls back to `getComputedStyle(element).width` and `height`.
- We forced the canvas CSS to `width: 100vw !important` and `height: 100dvh !important` to ensure the drawing buffer always matched the viewport regardless of DOM layout spoofing.

## 2. The Reduced-Motion Trap
**The Symptom:** The 3D scene would render perfectly for 1 second, then completely disappear the moment `index.css` loaded.
**The Cause:** To mask the user's actual OS settings, Zen Browser injects `prefers-reduced-motion: reduce` as `true` for all websites. In `index.css`, a media query was set to `display: none` the `.crystal-scene-global` if reduced motion was detected.
**The Fix:**
- Removed `display: none` from the `@media (prefers-reduced-motion: reduce)` block in `index.css`.

## 3. The FBO (Framebuffer Object) Block
**The Symptom:** The crystal appeared as a static, featureless white ghost that perfectly camouflaged into the background. It did not appear to be rotating, and reflections were missing.
**The Cause:** Zen Browser aggressively blocks `WebGLRenderTarget` (FBO) creation to stop trackers from using `readPixels` for graphics card fingerprinting.
- **`<Environment preset="city">` Failed:** Drei's Environment component uses a `PMREMGenerator` (which is an FBO) to create the lighting map. Because it failed, the glass had nothing to reflect.
- **`transmission: 1` Failed:** Three.js uses an FBO to capture the background for the refraction pass. Because this failed, it just refracted the pure white background.
**The Fix (Fake Glass):**
- **Removed** the `<Environment>` component entirely.
- **Removed** `transmission` (set to 0).
- **Faked it** using a standard transparent `MeshPhysicalMaterial`: `opacity: 0.15`, `color: "#e3f2fd"`, `metalness: 0.3`, `roughness: 0.05`, and crucially, **`clearcoat: 1.0`** with `clearcoatRoughness: 0.1` to provide ultra-glossy specular highlights from the directional lights without requiring an Environment map or FBOs.

## Summary
When building 3D for the web in 2026, you cannot rely on FBOs, precise ResizeObservers, or assume that `prefers-reduced-motion` indicates a low-end device (it is often a privacy shield). Build fallbacks using standard DOM styles and base WebGL properties (`clearcoat`, `opacity`) to guarantee cross-browser stability.
