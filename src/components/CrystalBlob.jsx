import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import useBlobState from '../stores/useBlobState'
import * as THREE from 'three'

// Returns the 12 vertices of a regular icosahedron, normalized to unit sphere.
function icosahedronVertices() {
  const phi = (1 + Math.sqrt(5)) / 2
  const raw = [
    [0, 1, phi], [0, 1, -phi], [0, -1, phi], [0, -1, -phi],
    [1, phi, 0], [1, -phi, 0], [-1, phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1],
  ]
  return raw.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize())
}

function createBlobGeometry(radius = 1.8, detail = 6) {
  const geo = new THREE.IcosahedronGeometry(radius, detail)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()

  const centers = icosahedronVertices()

  const AMPLITUDE = 0.9
  const SHARPNESS = 6.0
  const BASE_CONTRACTION = 0.4

  const colors = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const dir = v.clone().normalize()

    let displacement = 0
    for (let c = 0; c < centers.length; c++) {
      const alignment = Math.max(0, dir.dot(centers[c]))
      const contribution = Math.pow(alignment, SHARPNESS) * AMPLITUDE
      displacement = Math.max(displacement, contribution)
    }

    const finalDisplacement =
      -BASE_CONTRACTION * radius + displacement * (1 + BASE_CONTRACTION)

    v.copy(dir).multiplyScalar(radius + finalDisplacement)

    if (!Number.isNaN(v.x) && !Number.isNaN(v.y) && !Number.isNaN(v.z)) {
      pos.setXYZ(i, v.x, v.y, v.z)
    }

    // Bake ambient occlusion (shadows) into vertex colors
    // displacement ranges from 0 (deepest valley) to AMPLITUDE (highest peak)
    const shadowIntensity = 0.15 + (displacement / AMPLITUDE) * 0.85
    colors[i * 3] = shadowIntensity     // R
    colors[i * 3 + 1] = shadowIntensity // G
    colors[i * 3 + 2] = shadowIntensity // B
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

export default function CrystalBlob() {
  const meshRef = useRef()
  const matRef = useRef()
  
  // Dynamic Geometry Decimation: 
  // Desktop gets detail 5 (20k faces), Mobile gets detail 4 (5k faces) for an instant load
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const detailLevel = isMobile ? 4 : 5

  // Shortened by 10% (1.8 -> 1.62)
  const geometry = useMemo(() => createBlobGeometry(1.62, detailLevel), [detailLevel])

  // Start scale at 0 for a pop-in animation when the site loads
  const currentScale = useRef(0)
  const currentOpacity = useRef(0)

  useFrame((state, delta) => {
    if (!meshRef.current) return

    // Guard against NaN delta (some anti-tracking browsers throttle RAF and return weird deltas)
    const safeDelta = Number.isNaN(delta) || delta > 1 ? 0.016 : delta;

    // Combine idle rotation with scroll-scrubbed rotation
    const scrollY = window.scrollY || 0
    const t = Number.isNaN(state.clock.elapsedTime) ? 0 : state.clock.elapsedTime
    const targetRotY = (t * 0.08) + (scrollY * 0.002)
    const targetRotX = (t * 0.04) + (scrollY * 0.001)

    // Buttery smooth lerp toward the combined rotation target
    meshRef.current.rotation.y += (targetRotY - meshRef.current.rotation.y) * 0.05
    meshRef.current.rotation.x += (targetRotX - meshRef.current.rotation.x) * 0.05
    const blobState = useBlobState.getState()

    // Lerp scale toward target, guard against NaN
    const targetScale = Number.isNaN(blobState.blobScale) ? 1 : (blobState.blobScale || 1)
    // Buttery smooth scale animation (0.02)
    currentScale.current += (targetScale - currentScale.current) * 0.02
    const s = Number.isNaN(currentScale.current) ? 1 : currentScale.current
    if (meshRef.current) {
      meshRef.current.scale.set(s, s, s)
    }

    const targetOpacity = Number.isNaN(blobState.blobOpacity) ? 1 : (blobState.blobOpacity || 1)
    // Buttery smooth opacity animation (0.02)
    currentOpacity.current += (targetOpacity - currentOpacity.current) * 0.02
    if (matRef.current) {
      // Base opacity of 0.35 for elegant glassmorphism
      matRef.current.opacity = currentOpacity.current * 0.35
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} renderOrder={1}>
      <meshPhysicalMaterial
        ref={matRef}
        flatShading={false}
        vertexColors={true}
        color="#ffffff"
        emissive="#111111"
        emissiveIntensity={0.2}
        roughness={0.05}
        metalness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
        transparent={true}
        opacity={0.35}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}