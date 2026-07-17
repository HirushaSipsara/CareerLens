'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  opacity: number
  pulsePhase: number
  pulseSpeed: number
}

const NODE_COUNT = 55
const CONNECTION_DISTANCE = 160
const NODE_COLOR = '0, 229, 204'
const ACCENT_COLOR = '240, 165, 0'

export default function BackgroundAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let nodes: Node[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const initNodes = () => {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 1.8 + 0.8,
        opacity: Math.random() * 0.5 + 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.015 + 0.008,
      }))
    }

    const drawNode = (node: Node, time: number) => {
      const pulse = Math.sin(node.pulsePhase + time * node.pulseSpeed)
      const r = node.radius + pulse * 0.6
      const alpha = node.opacity + pulse * 0.15

      // Outer glow
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 5)
      glow.addColorStop(0, `rgba(${NODE_COLOR}, ${alpha * 0.5})`)
      glow.addColorStop(1, `rgba(${NODE_COLOR}, 0)`)
      ctx.beginPath()
      ctx.arc(node.x, node.y, r * 5, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()

      // Core dot
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${NODE_COLOR}, ${alpha})`
      ctx.fill()
    }

    const drawConnection = (a: Node, b: Node, dist: number, time: number) => {
      const strength = 1 - dist / CONNECTION_DISTANCE
      // Pulse the connection opacity
      const pulse = Math.sin(time * 0.001 + a.pulsePhase) * 0.5 + 0.5
      const alpha = strength * 0.25 * pulse

      // Pick accent color for ~15% of connections
      const isAccent = (a.pulsePhase + b.pulsePhase) % (Math.PI * 2) < 0.9
      const color = isAccent ? ACCENT_COLOR : NODE_COLOR

      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
      grad.addColorStop(0, `rgba(${color}, 0)`)
      grad.addColorStop(0.5, `rgba(${color}, ${alpha})`)
      grad.addColorStop(1, `rgba(${color}, 0)`)

      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.strokeStyle = grad
      ctx.lineWidth = strength * 1.2
      ctx.stroke()
    }

    const update = (node: Node) => {
      node.x += node.vx
      node.y += node.vy

      // Soft bounce off edges
      if (node.x < 0 || node.x > canvas.width)  node.vx *= -1
      if (node.y < 0 || node.y > canvas.height) node.vy *= -1

      node.x = Math.max(0, Math.min(canvas.width, node.x))
      node.y = Math.max(0, Math.min(canvas.height, node.y))
    }

    let time = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 1

      // Draw connections first (behind nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DISTANCE) {
            drawConnection(nodes[i], nodes[j], dist, time)
          }
        }
      }

      // Draw nodes on top
      for (const node of nodes) {
        drawNode(node, time)
        update(node)
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    initNodes()
    draw()

    window.addEventListener('resize', () => {
      resize()
      initNodes()
    })

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Canvas neural network */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Ambient orb — top-left teal */}
      <div
        className="bg-orb-1 absolute rounded-full"
        style={{ width: 700, height: 700, top: '-200px', left: '-180px' }}
      />

      {/* Ambient orb — bottom-right amber */}
      <div
        className="bg-orb-2 absolute rounded-full"
        style={{ width: 500, height: 500, bottom: '-140px', right: '-120px' }}
      />

      {/* Faint scan line sweep */}
      <div
        className="scan-line absolute inset-x-0"
        style={{ height: 100, top: 0 }}
      />

      {/* Corner accent brackets */}
      <div className="corner-dot absolute top-6 left-6  w-8 h-8 border-t-2 border-l-2 border-primary/40" style={{ animationDelay: '0s' }} />
      <div className="corner-dot absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-primary/40" style={{ animationDelay: '0.6s' }} />
      <div className="corner-dot absolute bottom-6 left-6  w-8 h-8 border-b-2 border-l-2 border-primary/40" style={{ animationDelay: '1.2s' }} />
      <div className="corner-dot absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-primary/40" style={{ animationDelay: '1.8s' }} />
    </div>
  )
}
