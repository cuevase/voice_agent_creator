import React from "react"

interface OrbIconProps {
  size?: number
  className?: string
}

export default function OrbIcon({ size = 20, className = "" }: OrbIconProps) {
  const dimension = Math.max(8, size)
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="ringStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#8b5cf6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* subtle outer glow */}
      <circle cx="20" cy="20" r="18" fill="url(#ringGlow)" />
      {/* hollow ring */}
      <circle cx="20" cy="20" r="16" fill="none" stroke="url(#ringStroke)" strokeWidth="2.4" />
    </svg>
  )
} 