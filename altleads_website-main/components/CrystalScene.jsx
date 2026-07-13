import { Suspense, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, ContactShadows, PerformanceMonitor } from '@react-three/drei'
import CrystalBlob from './CrystalBlob'
import NetworkGraph from './NetworkGraph'
import useBlobState from '../stores/useBlobState'
import { useTheme } from 'next-themes'
import * as THREE from 'three'

// Grid texture removed per user request

// Camera controller that lerps toward blob state targets
function CameraController() {
  const { camera } = useThree()

  useFrame(() => {
    const state = useBlobState.getState()
    // Lerp camera Z position (slow, elegant 0.02)
    camera.position.z += (state.cameraZ - camera.position.z) * 0.06
    // Lerp FOV
    camera.fov += (state.cameraFov - camera.fov) * 0.06
    camera.updateProjectionMatrix()
  })

  return null
}

// Reactive lights that shift color/intensity per section and theme
function ReactiveLights({ isMobile }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  
  const dirRef = useRef()
  const accentRef = useRef()
  const targetColor = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    const state = useBlobState.getState()

    // Lerp directional light intensity
    if (dirRef.current) {
      dirRef.current.intensity += (state.lightIntensity - dirRef.current.intensity) * 0.05
    }

    // Lerp accent light color
    if (accentRef.current) {
      targetColor.set(state.lightColor)
      accentRef.current.color.lerp(targetColor, 0.05)
    }
  })

  return (
    <>
      <ambientLight intensity={isDark ? 0.2 : 0.5} color={isDark ? "#ffffff" : "#eef5eb"} />
      
      <directionalLight 
        ref={dirRef} 
        position={[3, 2, 5]} 
        intensity={isDark ? 1.5 : 2.0} 
        color={isDark ? "#ffffff" : "#fcfcf0"} 
      />
      
      <directionalLight 
        position={[-3, 1, -3]} 
        intensity={isDark ? 0.4 : 0.8} 
        color={isDark ? "#38bdf8" : "#e0edd8"} 
      />
      
      <directionalLight 
        position={[0, -3, 2]} 
        intensity={isDark ? 0.3 : 0.5} 
        color={isDark ? "#0284c7" : "#d4e0ce"} 
      />

      {!isMobile && (
        <pointLight ref={accentRef} position={[-1, 2, 4]} intensity={isDark ? 2.0 : 1.2} color="#ffffff" distance={12} />
      )}
    </>
  )
}

function SceneWrapper() {
  const groupRef = useRef()
  const { pointer } = useThree()
  const currentPosX = useRef(1.8) // start at hero offset

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const blobState = useBlobState.getState()

    // Lerp X position toward section target + subtle pointer parallax
    // Guard against NaN from blobState or pointer
    const targetX = Number.isNaN(blobState.blobPositionX) ? 1.8 : (blobState.blobPositionX ?? 1.8)
    const pX = Number.isNaN(pointer.x) ? 0 : (pointer.x ?? 0)
    const pY = Number.isNaN(pointer.y) ? 0 : (pointer.y ?? 0)

    currentPosX.current += (targetX - currentPosX.current) * 0.06

    // Safety check for currentPosX
    if (Number.isNaN(currentPosX.current)) currentPosX.current = 1.8

    window.__R3F_DEBUG = {
      blobState,
      cameraPosition: state.camera.position.toArray(),
      cameraFov: state.camera.fov,
      groupPosition: groupRef.current.position.toArray(),
      t: t
    }

    groupRef.current.position.x = currentPosX.current + pX * 0.1
    groupRef.current.position.y = Math.sin(t * 0.6) * 0.08
    groupRef.current.rotation.x += (pY * 0.08 - groupRef.current.rotation.x) * 0.05
    groupRef.current.rotation.y += (pX * 0.08 - groupRef.current.rotation.y) * 0.05
  })

  return (
    <group ref={groupRef}>
      <CrystalBlob />
      <NetworkGraph />
    </group>
  )
}

export default function CrystalScene() {
  // Adaptive Performance: Scale DPR down if framerate drops
  const [dpr, setDpr] = useState(1.5)
  // Check if mobile for aggressive light culling
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-transparent">
      <Canvas
        style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
        resize={{ polyfill: window.ResizeObserver }}
        camera={{ position: [0, 0, 9], fov: 28 }}
        dpr={dpr}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
      >
        <Suspense fallback={null}>
          <PerformanceMonitor onIncline={() => setDpr(1.5)} onDecline={() => setDpr(1)} />
          <Environment preset="city" />
          <CameraController />
          <ReactiveLights isMobile={isMobile} />
          {/* OrbitRings removed per user request */}
          <SceneWrapper />
          <ContactShadows
            position={[0, -2, 0]}
            opacity={0.08}
            scale={10}
            blur={2}
            far={4}
            resolution={256}
            color="#224422"
          />
        </Suspense>
      </Canvas>
    </div>
  )
}