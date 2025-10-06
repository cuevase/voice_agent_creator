"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { PulpooLogo } from "./pulpoo-logo"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { ArrowRight, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"

interface LoginPageProps {
  onLoginSuccess: () => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { signIn, signInWithEmail, signUpWithEmail, resetPassword, loading } = useAuth()
  const { t } = useLanguage()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [authMode, setAuthMode] = useState<"google" | "email">("google")
  const [emailMode, setEmailMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true)
    setError(null)
    try {
      console.log('Starting Google sign in...')
      const result = await signIn('google')
      console.log('Sign in completed:', result)
    } catch (error) {
      console.error('Sign in error:', error)
      setError(`Error al iniciar sesión con Google: ${error}`)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Por favor completa todos los campos")
      return
    }

    setIsSigningIn(true)
    setError(null)
    try {
      console.log('Starting email sign in...')
      const result = await signInWithEmail(email, password)
      console.log('Email sign in completed:', result)
    } catch (error) {
      console.error('Email sign in error:', error)
      setError(`Error al iniciar sesión: ${error}`)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Por favor completa todos los campos")
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setIsSigningIn(true)
    setError(null)
    setSuccess(null)
    try {
      console.log('Starting email sign up...')
      const result = await signUpWithEmail(email, password)
      console.log('Email sign up completed:', result)
      setSuccess("¡Cuenta creada exitosamente! Revisa tu email para confirmar tu cuenta.")
    } catch (error) {
      console.error('Email sign up error:', error)
      setError(`Error al crear cuenta: ${error}`)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Por favor ingresa tu email")
      return
    }

    setIsSigningIn(true)
    setError(null)
    setSuccess(null)
    try {
      console.log('Starting password reset...')
      await resetPassword(email)
      setSuccess("Se ha enviado un enlace de restablecimiento a tu email.")
      setShowForgotPassword(false)
    } catch (error) {
      console.error('Password reset error:', error)
      setError(`Error al enviar el enlace de restablecimiento: ${error}`)
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 relative overflow-hidden" style={{ transform: 'scale(1.3)', transformOrigin: 'center center' }}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <PulpooLogo size="md" className="drop-shadow-sm" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Pulpoo Playground</h1>
                <p className="text-sm text-gray-500">{t('header.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex items-center justify-center pt-20">
        <div className="w-full max-w-md mx-auto px-4">
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-3xl">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-4">
                <PulpooLogo size="lg" className="drop-shadow-sm" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                {t('login.title')}
              </CardTitle>
              <p className="text-gray-600 mt-2">
                {t('login.subtitle')}
              </p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                {/* Auth Mode Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setAuthMode("google")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      authMode === "google"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Google
                  </button>
                  <button
                    onClick={() => setAuthMode("email")}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      authMode === "email"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Email
                  </button>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Success Display */}
                {success && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-600">{success}</p>
                  </div>
                )}

                {/* Google OAuth */}
                {authMode === "google" && (
                  <>
                    <Button
                      onClick={handleGoogleSignIn}
                      disabled={isSigningIn || loading}
                      className="w-full bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 py-3 px-4 rounded-xl font-medium"
                    >
                      {isSigningIn ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                      )}
                      {isSigningIn ? "Iniciando sesión..." : "Continuar con Google"}
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </>
                )}

                {/* Email Form */}
                {authMode === "email" && (
                  <div className="space-y-4">
                    {/* Email Mode Toggle */}
                    {!showForgotPassword && (
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setEmailMode("signin")}
                          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                            emailMode === "signin"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          Iniciar Sesión
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailMode("signup")}
                          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                            emailMode === "signup"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          {t('login.signup')}
                        </button>
                      </div>
                    )}

                    {/* Forgot Password Form */}
                    {showForgotPassword ? (
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">Restablecer Contraseña</h3>
                          <p className="text-sm text-gray-600">Ingresa tu email para recibir un enlace de restablecimiento</p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="reset-email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="tu@email.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowForgotPassword(false)}
                            className="flex-1"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            disabled={isSigningIn || loading}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          >
                            {isSigningIn ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              "Enviar Enlace"
                            )}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      /* Normal Sign In/Sign Up Form */
                      <form onSubmit={emailMode === "signin" ? handleEmailSignIn : handleEmailSignUp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="tu@email.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="pl-10"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password">Contraseña</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Tu contraseña"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pl-10 pr-10"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {emailMode === "signup" && (
                            <p className="text-xs text-gray-500">La contraseña debe tener al menos 6 caracteres</p>
                          )}
                        </div>

                        {emailMode === "signin" && (
                          <div className="text-right">
                            <button
                              type="button"
                              onClick={() => setShowForgotPassword(true)}
                              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                            >
                              ¿Olvidaste tu contraseña?
                            </button>
                          </div>
                        )}

                        <Button
                          type="submit"
                          disabled={isSigningIn || loading}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-xl font-medium"
                        >
                          {isSigningIn ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              {emailMode === "signin" ? "Iniciando sesión..." : "Creando cuenta..."}
                            </>
                          ) : (
                            <>
                              {emailMode === "signin" ? t('login.signin') : t('login.signup')}
                              <ArrowRight className="h-5 w-5 ml-2" />
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    By continuing, you agree to our{" "}
                    <a href="#" className="text-purple-600 hover:text-purple-700 font-medium">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-purple-600 hover:text-purple-700 font-medium">
                      Privacy Policy
                    </a>
                    , and consent to data processing for AI features.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-20 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <PulpooLogo size="sm" />
            <span className="text-sm">Powered by Pulpoo</span>
          </div>
        </div>
      </footer>
    </div>
  )
} 