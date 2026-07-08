import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import useBlobState from '../stores/useBlobState'
import * as THREE from 'three'

const ACCENT = new THREE.Color('#2196F3')
const NODE_COUNT = 20
const MAX_LINES = (NODE_COUNT * (NODE_COUNT - 1)) / 2
const CONNECTION_DISTANCE = 2.1

// Each node orbits on its own tilted circular path
function generateOrbits(count) {
  const nodes = []
  for (let i = 0; i < count; i++) {
    const orbitRadius = 1.6 + Math.random() * 1.2

    const tiltX = (Math.random() - 0.5) * Math.PI * 0.8
    const tiltZ = (Math.random() - 0.5) * Math.PI * 0.8

    // Scatter target: where nodes go when "fragmented"
    const scatterDir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
    ).normalize()

    // Which "group" this node belongs to for OS reassembly (0, 1, or 2)
    const reassemblyGroup = i % 3

    nodes.push({
      orbitRadius,
      tiltX,
      tiltZ,
      speed: 0.1 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      size: 0.02 + Math.random() * 0.03,
      currentPos: new THREE.Vector3(),
      scatterDir,
      scatterDistance: 3.5 + Math.random() * 2.5,  // how far to scatter
      reassemblyGroup,
    })
  }
  return nodes
}

export default function NetworkGraph() {
  const meshRef = useRef()
  const linesRef = useRef()
  const nucleusRef = useRef()
  const nodeData = useMemo(() => generateOrbits(NODE_COUNT), [])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  const { linePositions, lineColors } = useMemo(() => {
    const positions = new Float32Array(MAX_LINES * 2 * 3)
    const colors = new Float32Array(MAX_LINES * 2 * 4)
    return { linePositions: positions, lineColors: colors }
  }, [])

  // Lerped spread value (smooths transitions)
  const currentSpread = useRef(0)
  const currentLineAlpha = useRef(1)

  useFrame((state) => {
    if (!meshRef.current || !linesRef.current) return
    const t = Number.isNaN(state.clock.elapsedTime) ? 0 : state.clock.elapsedTime

    const blobState = useBlobState.getState()
    const isOS = blobState.activeSection === 'os'

    // Lerp spread and line opacity toward targets
    let targetSpread = blobState.nodeSpread
    let targetLineAlpha = blobState.lineOpacity

    // OS section: spread depends on osProgress (0→1 reassembles)
    // At osProgress 0, nodes are scattered (spread=1). At 1, assembled (spread=0).
    if (isOS) {
      targetSpread = 1 - blobState.osProgress
      targetLineAlpha = blobState.osProgress
    }

    currentSpread.current += (targetSpread - currentSpread.current) * 0.06
    currentLineAlpha.current += (targetLineAlpha - currentLineAlpha.current) * 0.06

    const spread = currentSpread.current

    // Update node positions
    nodeData.forEach((node, i) => {
      const angle = node.phase + t * node.speed

      // Normal orbit position
      const nx = Math.cos(angle) * node.orbitRadius
      const ny = Math.sin(angle) * node.orbitRadius * Math.sin(node.tiltX)
      const nz = Math.sin(angle) * node.orbitRadius * Math.cos(node.tiltX)
      const rx = nx * Math.cos(node.tiltZ) - ny * Math.sin(node.tiltZ)
      const ry = nx * Math.sin(node.tiltZ) + ny * Math.cos(node.tiltZ)

      // Scattered position (fragmented)
      const sx = node.scatterDir.x * node.scatterDistance
      const sy = node.scatterDir.y * node.scatterDistance
      const sz = node.scatterDir.z * node.scatterDistance

      // Effective spread for this node
      let effectiveSpread = spread

      // During OS reassembly: nodes in earlier groups reassemble first
      if (isOS) {
        const progress = blobState.osProgress
        const groupStart = node.reassemblyGroup / 3
        const groupEnd = (node.reassemblyGroup + 1) / 3
        // Node's personal progress within its group window
        const nodeProgress = Math.max(0, Math.min(1, (progress - groupStart) / (groupEnd - groupStart)))
        effectiveSpread = 1 - nodeProgress
      }

      // Interpolate between orbit and scatter
      const finalX = rx + (sx - rx) * effectiveSpread
      const finalY = ry + (sy - ry) * effectiveSpread
      const finalZ = nz + (sz - nz) * effectiveSpread

      node.currentPos.set(finalX, finalY, finalZ)

      // Pulse brightness — brighter during reassembly for active group
      let pulseScale = 1
      if (isOS) {
        const progress = blobState.osProgress
        const groupCenter = (node.reassemblyGroup + 0.5) / 3
        const dist = Math.abs(progress - groupCenter)
        if (dist < 0.2) {
          pulseScale = 1 + (1 - dist / 0.2) * 0.8 // Up to 1.8x scale
        }
      }

      const basePulse = 1 + Math.sin(t * 1.5 + node.phase) * 0.2
      const s = node.size * basePulse * pulseScale
      dummy.position.copy(node.currentPos)
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true

    // Rebuild connections
    const positions = linesRef.current.geometry.attributes.position.array
    const colors = linesRef.current.geometry.attributes.color.array
    let lineIdx = 0

    for (let i = 0; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const p1 = nodeData[i].currentPos
        const p2 = nodeData[j].currentPos
        const dist = p1.distanceTo(p2)

        if (dist < CONNECTION_DISTANCE) {
          positions[lineIdx * 6 + 0] = p1.x
          positions[lineIdx * 6 + 1] = p1.y
          positions[lineIdx * 6 + 2] = p1.z
          positions[lineIdx * 6 + 3] = p2.x
          positions[lineIdx * 6 + 4] = p2.y
          positions[lineIdx * 6 + 5] = p2.z

          // Line alpha modulated by section state
          const baseAlpha = Math.max(0, (1 - (dist / CONNECTION_DISTANCE)) * 0.2)
          const alpha = baseAlpha * currentLineAlpha.current

          colors[lineIdx * 8 + 0] = ACCENT.r
          colors[lineIdx * 8 + 1] = ACCENT.g
          colors[lineIdx * 8 + 2] = ACCENT.b
          colors[lineIdx * 8 + 3] = alpha

          colors[lineIdx * 8 + 4] = ACCENT.r
          colors[lineIdx * 8 + 5] = ACCENT.g
          colors[lineIdx * 8 + 6] = ACCENT.b
          colors[lineIdx * 8 + 7] = alpha
        } else {
          positions[lineIdx * 6 + 0] = 0
          positions[lineIdx * 6 + 1] = 0
          positions[lineIdx * 6 + 2] = 0
          positions[lineIdx * 6 + 3] = 0
          positions[lineIdx * 6 + 4] = 0
          positions[lineIdx * 6 + 5] = 0

          colors[lineIdx * 8 + 0] = 0
          colors[lineIdx * 8 + 1] = 0
          colors[lineIdx * 8 + 2] = 0
          colors[lineIdx * 8 + 3] = 0
          colors[lineIdx * 8 + 4] = 0
          colors[lineIdx * 8 + 5] = 0
          colors[lineIdx * 8 + 6] = 0
          colors[lineIdx * 8 + 7] = 0
        }
        lineIdx++
      }
    }

    linesRef.current.geometry.attributes.position.needsUpdate = true
    linesRef.current.geometry.attributes.color.needsUpdate = true

    // Nucleus pulse
    if (nucleusRef.current) {
      const nucleusScale = 0.2 * (1 + Math.sin(t * 2) * 0.1) * (1 - spread * 0.3)
      nucleusRef.current.scale.set(nucleusScale, nucleusScale, nucleusScale)
    }
  })

  return (
    <group>
      {/* Central Nucleus */}
      <mesh ref={nucleusRef} renderOrder={2}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={ACCENT}
          depthTest={true}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Orbiting Planets */}
      <instancedMesh ref={meshRef} args={[null, null, NODE_COUNT]} renderOrder={2}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={ACCENT}
          depthTest={true}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Dynamic Proximity Lines */}
      <lineSegments ref={linesRef} renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={MAX_LINES * 2}
            array={linePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={MAX_LINES * 2}
            array={lineColors}
            itemSize={4}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          depthTest={true}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}