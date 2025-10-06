"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PulpooLogo } from "./pulpoo-logo"
import { LanguageToggle } from "./language-toggle"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import {
  Sparkles,
  MessageCircle,
  Mic,
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Users,
  Calendar,
  BarChart3,
  ChevronDown,
  LogOut,
} from "lucide-react"

interface LandingPageProps {
  onGetStarted: () => void
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { user, signOut } = useAuth()
  const { t, language } = useLanguage()

  const handleGetStarted = () => {
    console.log('LandingPage: Get Started button clicked!')
    console.log('LandingPage: User:', user?.email)
    onGetStarted()
  }

  const features = [
    {
      icon: MessageCircle,
      title: t('feature.chat.title'),
      description: t('feature.chat.description'),
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: Mic,
      title: t('feature.voice.title'),
      description: t('feature.voice.description'),
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      icon: Calendar,
      title: t('feature.scheduling.title'),
      description: t('feature.scheduling.description'),
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      icon: BarChart3,
      title: t('feature.analytics.title'),
      description: t('feature.analytics.description'),
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ]

  const stats = [
    { number: "5 min", label: t('stats.setup') },
    { number: "24/7", label: t('stats.available') },
    { number: "99.9%", label: t('stats.uptime') },
    { number: "∞", label: t('stats.scalable') },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 relative overflow-hidden">
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
                <h1 className="text-xl font-semibold text-gray-900">{t('header.title')}</h1>
                <p className="text-sm text-gray-500">{t('header.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageToggle />
              {user && (
                <>
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <button
                    onClick={signOut}
                    className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('auth.signout')}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            {/* Main Hero Content */}
            <Card className="mx-auto max-w-4xl bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-3xl">
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center space-y-6">
                  <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight">
                    {t('hero.title').split(' ').map((word, index) => {
                      if (word.toLowerCase().includes('ai') || word.toLowerCase().includes('agents')) {
                        return (
                          <span key={index} className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                            {" "}{word}
                          </span>
                        )
                      }
                      return word + " "
                    })}
                  </h1>

                  {/* Hero Badges */}
                  <div className="flex flex-wrap justify-center gap-3 pt-4">
                    <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
                      <Sparkles className="h-4 w-4" />
                      <span>{t('hero.noCode')}</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                      <Zap className="h-4 w-4" />
                      <span>{t('hero.minutes')}</span>
                    </div>
                    <div className="flex items-center space-x-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
                      <Users className="h-4 w-4" />
                      <span>{t('hero.business')}</span>
                    </div>
                  </div>

                  <p className="text-xl text-gray-600 max-w-2xl leading-relaxed">
                    {t('hero.subtitle')}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      onClick={handleGetStarted}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                    >
                      <Zap className={`h-5 w-5 mr-2 ${isHovered ? "animate-pulse" : ""}`} />
                      {user ? t('hero.cta') : t('hero.cta')}
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      className="border-2 border-purple-200 text-purple-700 hover:bg-purple-50 px-8 py-4 rounded-full bg-transparent"
                      onClick={handleGetStarted}
                    >
                      <Globe className="h-5 w-5 mr-2" />
                      {t('hero.demo')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Section */}
            <div className="pt-16">
              <Card className="mx-auto max-w-3xl bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-2xl">
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, index) => (
                      <div key={index} className="text-center">
                        <div className="text-2xl md:text-3xl font-bold text-purple-600">{stat.number}</div>
                        <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{t('features.title')}</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const IconComponent = feature.icon
              return (
                <Card
                  key={index}
                  className="group hover:scale-105 transition-all duration-300 cursor-pointer bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-2xl"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4 h-full justify-center min-h-[200px]">
                      <div
                        className={`p-4 rounded-2xl ${feature.bgColor} group-hover:scale-110 transition-transform duration-300`}
                      >
                        <IconComponent className={`h-8 w-8 ${feature.color}`} />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{t('landing.why.title')}</h2>
                <p className="text-xl text-gray-600 leading-relaxed">
                  {t('landing.why.subtitle')}
                </p>
              </div>

              <div className="space-y-6">
                {[
                  {
                    icon: Shield,
                    title: t('landing.why.secure'),
                    description: t('landing.why.secure.desc'),
                  },
                  {
                    icon: Users,
                    title: t('landing.why.easy'),
                    description: t('landing.why.easy.desc'),
                  },
                  {
                    icon: Zap,
                    title: t('landing.why.fast'),
                    description: t('landing.why.fast.desc'),
                  },
                ].map((benefit, index) => {
                  const IconComponent = benefit.icon
                  return (
                    <div key={index} className="flex items-start space-x-4">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <IconComponent className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">{benefit.title}</h4>
                        <p className="text-gray-600">{benefit.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="relative">
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-3xl">
                <CardContent className="p-12">
                  <div className="flex items-center justify-center">
                    <div className="text-center space-y-6">
                      <div className="relative">
                        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mx-auto flex items-center justify-center">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full"></div>
                          </div>
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-gray-900">{t('landing.yourAgent')}</h3>
                        <p className="text-gray-600">{t('landing.yourAgent.desc')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-3xl">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                    {t('cta.title')}
                  </h2>
                  <p className="text-xl text-gray-600 max-w-2xl">
                    {t('cta.subtitle')}
                  </p>
                </div>

                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-12 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
                  onClick={handleGetStarted}
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  {user ? t('hero.cta') : t('cta.button')}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Terms and Conditions Link */}
      <section className="relative z-10 py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Legal Information</h3>
            <p className="text-gray-600">
              By using our services, you agree to our terms and conditions. 
              Please review our complete privacy policy and terms of service.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/privacy">
                <Button variant="outline" className="text-purple-600 border-purple-600 hover:bg-purple-50">
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Policy & Terms
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll Indicator */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <div className="animate-bounce">
          <ChevronDown className="h-6 w-6 text-purple-600" />
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
} 