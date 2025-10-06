"use client"

interface PulpooLogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function PulpooLogo({ className = "", size = "md" }: PulpooLogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  return <img src="/images/pulpoo-logo.png" alt="Pulpoo Logo" className={`${sizeClasses[size]} ${className}`} />
}
