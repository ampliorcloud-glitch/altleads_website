import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import useBlobState from '../stores/useBlobState'
import * as THREE from 'three'

function createPremiumGeometry() {
  // Closed torus knot — seamless, polished, no gaps
  const geo = new THREE.TorusKnotGeometry(1.1, 0.35, 256, 32);
  // Do NOT call computeVertexNormals() on TorusKnotGeometry, it breaks the seam normals!
  return geo;
}

export default function CrystalBlob() {
  const meshRef = useRef()
  const matRef = useRef()
  
  const geometry = useMemo(() => createPremiumGeometry(), [])

  // Start scale at 0 for a pop-in animation when the site loads
  const currentScale = useRef(0)
  const currentOpacity = useRef(0)

  // Track a slow idle rotation angle that doesn't run away
  const idleRotY = useRef(0)
  const idleRotX = useRef(0)

  useFrame((state, delta) => {
    if (!meshRef.current) return

    // Slow idle drift (delta-based, stays gentle)
    idleRotY.current += 0.08 * delta
    idleRotX.current += 0.04 * delta

    // Scroll-scrubbed rotation — the primary driver
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0

    const targetRotY = idleRotY.current + (scrollY * 0.006)
    const targetRotX = idleRotX.current + (scrollY * 0.003)

    // Smooth lerp toward scroll-driven target
    meshRef.current.rotation.y += (targetRotY - meshRef.current.rotation.y) * 0.05
    meshRef.current.rotation.x += (targetRotX - meshRef.current.rotation.x) * 0.05
    
    // We can't use useBlobState() directly as a hook because it's just a zustand store without react bindings in this setup.
    const blobState = useBlobState.getState()

    // Lerp scale toward target, guard against NaN
    const targetScale = Number.isNaN(blobState.blobScale) ? 1 : (blobState.blobScale ?? 1)
    // Buttery smooth scale animation (0.066)
    currentScale.current += (targetScale - currentScale.current) * 0.066
    const s = Number.isNaN(currentScale.current) ? 1 : currentScale.current
    if (meshRef.current) {
      meshRef.current.scale.set(s, s, s)
    }

    const targetOpacity = Number.isNaN(blobState.blobOpacity) ? 1 : (blobState.blobOpacity ?? 1)
    // Buttery smooth opacity animation (0.02)
    currentOpacity.current += (targetOpacity - currentOpacity.current) * 0.06
    if (matRef.current) {
      matRef.current.opacity = currentOpacity.current
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={1}>
      <meshPhysicalMaterial
        ref={matRef}
        flatShading={false}
        color="#d0f0ff"
        emissive="#009fe3"
        emissiveIntensity={0.2}
        roughness={0.1}
        metalness={0.0}
        transmission={1.0}
        ior={1.52}
        thickness={2.5}
        attenuationColor="#008ecc"
        attenuationDistance={1.2}
        envMapIntensity={1.8}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        transparent={true}
        opacity={1.0}
        depthWrite={true}
        side={THREE.FrontSide}
      />
    </mesh>
  )
}