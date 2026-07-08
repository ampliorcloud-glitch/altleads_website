import { Suspense, useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, ContactShadows, PerformanceMonitor } from '@react-three/drei'
import CrystalBlob from './CrystalBlob'
import NetworkGraph from './NetworkGraph'
import useBlobState from '../stores/useBlobState'
import * as THREE from 'three'

// Builds a subtle grid texture for refraction backdrop
function useGridTexture() {
  return useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = '#eaeaea'
    ctx.lineWidth = 1
    const step = size / 8
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(4, 4)
    return texture
  }, [])
}

function GridBackdrop() {
  const texture = useGridTexture()
  return (
    <mesh position={[0, 0, -6]} renderOrder={0}>
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial map={texture} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

// Camera controller that lerps toward blob state targets
function CameraController() {
  const { camera } = useThree()

  useFrame(() => {
    const state = useBlobState.getState()
    // Lerp camera Z position (slow, elegant 0.02)
    camera.position.z += (state.cameraZ - camera.position.z) * 0.02
    // Lerp FOV
    camera.fov += (state.cameraFov - camera.fov) * 0.02
    camera.updateProjectionMatrix()
  })

  return null
}

// Reactive lights that shift color/intensity per section
function ReactiveLights({ isMobile }) {
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
      <ambientLight intensity={0.5} />
      {/* Primary Key Light */}
      <directionalLight ref={dirRef} position={[4, 5, 4]} intensity={2.5} color="#ffffff" />
      {/* Rim Lights for edge definition - using clean whites and silvers */}
      <directionalLight position={[-4, 3, -4]} intensity={1.5} color="#ffffff" />
      <directionalLight position={[0, -5, 2]} intensity={1.0} color="#eeeeee" />
      
      {/* Reflection Lights: Placed close to the center to create sharp specular highlights */}
      <pointLight position={[2, 2, 2]} intensity={1.5} color="#ffffff" distance={10} />
      <pointLight position={[-2, -2, 2]} intensity={1.0} color="#e0e0e0" distance={10} />
      
      {/* Light Culling: Drop these two lights on mobile to save fragment shader cycles */}
      {!isMobile && (
        <>
          <pointLight ref={accentRef} position={[0, 3, 3]} intensity={1.5} color="#ffffff" distance={10} />
          <pointLight position={[3, -3, 3]} intensity={1.0} color="#cccccc" distance={10} />
        </>
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
    const targetX = Number.isNaN(blobState.blobPositionX) ? 1.8 : (blobState.blobPositionX || 1.8)
    const pX = Number.isNaN(pointer.x) ? 0 : (pointer.x || 0)
    const pY = Number.isNaN(pointer.y) ? 0 : (pointer.y || 0)

    currentPosX.current += (targetX - currentPosX.current) * 0.02
    
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

// Orbit rings with reactive opacity
const ACCENT_COLOR = new THREE.Color('#2196F3')

function OrbitRings() {
  const groupRef = useRef()
  const ring1Ref = useRef()
  const ring2Ref = useRef()
  const mat1Ref = useRef()
  const mat2Ref = useRef()
  const { pointer } = useThree()

  useFrame((state) => {
    if (!groupRef.current) return
    const t = Number.isNaN(state.clock.elapsedTime) ? 0 : state.clock.elapsedTime
    const blobState = useBlobState.getState()

    groupRef.current.rotation.x += (-pointer.y * 0.12 - groupRef.current.rotation.x) * 0.02
    groupRef.current.rotation.y += (pointer.x * 0.15 - groupRef.current.rotation.y) * 0.02
    groupRef.current.position.y = Math.sin(t * 0.4 + 1.0) * 0.06

    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.1
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.07

    // Lerp ring opacity based on section
    const targetOpacity = blobState.ringOpacity
    if (mat1Ref.current) mat1Ref.current.opacity += (targetOpacity * 0.25 - mat1Ref.current.opacity) * 0.05
    if (mat2Ref.current) mat2Ref.current.opacity += (targetOpacity * 0.15 - mat2Ref.current.opacity) * 0.05
  })

  return (
    <group ref={groupRef}>
      <mesh ref={ring1Ref} rotation={[0.3, 0.2, 0]} renderOrder={2}>
        <torusGeometry args={[2.6, 0.006, 8, 128]} />
        <meshBasicMaterial ref={mat1Ref} color={ACCENT_COLOR} transparent opacity={0.25} depthTest={true} depthWrite={false} toneMapped={false} />
      </mesh>

      <mesh ref={ring2Ref} rotation={[Math.PI / 2.5, Math.PI / 4, 0]} renderOrder={2}>
        <torusGeometry args={[2.4, 0.005, 8, 100]} />
        <meshBasicMaterial ref={mat2Ref} color={ACCENT_COLOR} transparent opacity={0.15} depthTest={true} depthWrite={false} toneMapped={false} />
      </mesh>
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
          toneMappingExposure: 1.3,
        }}
      >
        <Suspense fallback={null}>
          <PerformanceMonitor onIncline={() => setDpr(1.5)} onDecline={() => setDpr(1)} />
          <CameraController />
          <ReactiveLights isMobile={isMobile} />
          <GridBackdrop />
          <SceneWrapper />
          <OrbitRings />
          <ContactShadows
            position={[0, -2, 0]}
            opacity={0.3}
            scale={10}
            blur={2}
            far={4}
            resolution={256}
            color="#000000"
          />
        </Suspense>
      </Canvas>
    </div>
  )
}