"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CompanyForm } from "@/components/company-form"
import { CompanyLoader } from "@/components/company-loader"
import { VoiceAgent } from "@/components/voice-agent"
import { PulpooLogo } from "@/components/pulpoo-logo"
import { LanguageToggle } from "@/components/language-toggle"
import { Building2, Users, Search, Mic, MessageSquare, Sparkles, Wrench, MessageCircle, ArrowLeft, Calendar, FileText, GraduationCap, Settings, CheckCircle, AlertCircle } from "lucide-react"
import { SystemPromptForm } from "@/components/system-prompt-form"
import { ConversationsDashboard } from "@/components/conversations-dashboard"
import { LandingPage } from "@/components/landing-page"
import { LoginPage } from "@/components/login-page"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { CompaniesDashboard } from "@/components/companies-dashboard"
import { Company } from "@/lib/api"
import { CompanyManagementDashboard } from "@/components/company-management-dashboard"
import { Button } from "@/components/ui/button"
import { SettingsPage } from "@/components/settings-page"

export default function Home() {
  const [activeCompany, setActiveCompany] = useState<Company | null>(null)
  const [activeTab, setActiveTab] = useState("company")
  const [completedSteps, setCompletedSteps] = useState({
    company: false,
    systemPrompt: false,
    agent: false,
  })

  const [showCompaniesDashboard, setShowCompaniesDashboard] = useState(true)
  const [showLandingPage, setShowLandingPage] = useState(true)
  const [intendingToLogin, setIntendingToLogin] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false) // Track logout state
  const [isNewCompany, setIsNewCompany] = useState(false) // Track if this is a newly created company
  const [showSuccessScreen, setShowSuccessScreen] = useState(false) // Track success screen state
  const [showSettings, setShowSettings] = useState(false) // Track settings modal state
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  const { user, loading, signOut } = useAuth()
  const { t } = useLanguage()

  // Debug logging for state changes
  useEffect(() => {
    console.log("🔄 State changed - activeCompany:", activeCompany)
  }, [activeCompany])

  useEffect(() => {
    console.log("🔄 State changed - isNewCompany:", isNewCompany)
  }, [isNewCompany])

  useEffect(() => {
    console.log("🔄 State changed - showCompaniesDashboard:", showCompaniesDashboard)
  }, [showCompaniesDashboard])

  useEffect(() => {
    console.log("🔄 State changed - activeTab:", activeTab)
  }, [activeTab])

  // Reset completed steps when switching companies
  useEffect(() => {
    if (!activeCompany) {
      setCompletedSteps({
        company: false,
        systemPrompt: false,
        agent: false,
      })
      setIsNewCompany(false)
    }
  }, [activeCompany])

  // Handle authentication state changes
  useEffect(() => {
    console.log('Auth state changed:', { user: user?.email, loading, showLandingPage, intendingToLogin, isLoggingOut })
    
    if (!user && !loading && !intendingToLogin && !isLoggingOut) {
      // Only reset to landing page if we're not intentionally going to login and not logging out
      console.log('User logged out, showing landing page')
      setShowLandingPage(true)
    } else if (user && !loading && !isLoggingOut) {
      // If user is authenticated and not logging out, proceed to main app
      console.log('User authenticated, proceeding directly to main app')
      setShowLandingPage(false)
      setIntendingToLogin(false) // Reset the flag
    }
  }, [user, loading, showLandingPage, intendingToLogin, isLoggingOut])

  // Handle payment status from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const payment = urlParams.get('payment')
    const tab = urlParams.get('tab')
    
    if (payment) {
      setPaymentStatus(payment)
      // Clear the URL parameter after reading it
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('payment')
      newUrl.searchParams.delete('tab')
      window.history.replaceState({}, '', newUrl.toString())
      
      // Auto-hide payment status after 5 seconds
      setTimeout(() => {
        setPaymentStatus(null)
      }, 5000)
    }
  }, [])



  const handleGetStarted = () => {
    console.log('Get Started clicked, setting showLandingPage to false')
    setIntendingToLogin(true)
    setShowLandingPage(false)

    console.log('Page: showLandingPage should now be false')
  }

  const handleCompanyLoaded = (company: Company) => {
    setActiveCompany(company)
    setCompletedSteps((prev) => ({ ...prev, company: true }))
    setActiveTab("system-prompt")
    setIsNewCompany(false) // This is an existing company being loaded
  }

  const handleCompanyCreated = (companyId: string, companyData?: any) => {
    console.log("🎯 handleCompanyCreated called with:", { companyId, companyData })
    
    const newCompany: Company = {
      company_id: companyId,
      company_name: companyData?.company_name || "Nueva Empresa",
      company_email: companyData?.company_email || "",
      additional_text: companyData?.additional_text,
      website_url: companyData?.website_url,
      created_at: new Date().toISOString(),
      files: [],
      user_id: user?.id || "",
    }

    setActiveCompany(newCompany)
    setIsNewCompany(true)
    setShowCompaniesDashboard(false)
    setActiveTab("system-prompt") // Advance to system-prompt after company creation
    setCompletedSteps({
      company: true, // Mark company as completed
      systemPrompt: false,
      agent: false,
    })
  }

  const handlePromptCreated = () => {
    setCompletedSteps(prev => ({ 
      ...prev, 
      systemPrompt: true,
    }))
    setActiveTab("agent")
    // Show success screen immediately when reaching the agent tab
    setTimeout(() => {
      setShowSuccessScreen(true)
    }, 500) // Small delay to ensure smooth transition
  }

  const handleVoiceAgentComplete = () => {
    console.log('🎉 Voice agent setup completed, showing success screen')
    setShowSuccessScreen(true)
  }

  const handleContinueToDashboard = () => {
    console.log('🚀 Continuing to full dashboard')
    setShowSuccessScreen(false)
    setIsNewCompany(false) // Switch to management dashboard mode
  }

  const handleStayHere = () => {
    console.log('👋 User chose to stay in current view')
    setShowSuccessScreen(false)
    // Keep the current step-by-step view
  }



  const handleCompanySelected = (company: Company, isNewlyCreated = false) => {
    console.log("🏪 handleCompanySelected called with existing company:", company)
    console.log("🏪 isNewlyCreated flag:", isNewlyCreated)
    setActiveCompany(company)
    
    if (isNewlyCreated) {
      console.log("🏪 Setting isNewCompany to true for newly created company")
      setIsNewCompany(true) // This is a newly created company that should go through setup flow
      setActiveTab("company") // Start with company creation
      setCompletedSteps((prev) => ({ ...prev, company: false })) // Company step not complete yet
    } else {
      console.log("🏪 Setting isNewCompany to false for existing company")
      setIsNewCompany(false) // This is an existing company, show management dashboard
    }
    
    setShowCompaniesDashboard(false) // Hide companies dashboard
  }

  const handleBackToCompanies = () => {
    setActiveCompany(null)
    setIsNewCompany(false)
    setShowCompaniesDashboard(true)
    setActiveTab("company") // Reset to first tab (company)
    setCompletedSteps({
      company: false, // Company step not complete when going back
      systemPrompt: false,
      agent: false,
    })
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 flex items-center justify-center">
        <div className="text-center">
          <PulpooLogo size="lg" className="mx-auto mb-4" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  // Show landing page first, regardless of authentication status
  if (showLandingPage) {
    return <LandingPage onGetStarted={handleGetStarted} />
  }

  // Show login page if user is not authenticated after clicking "Get Started"
  if (!user && !loading) {
    console.log('User not authenticated, showing login page')
    return <LoginPage onLoginSuccess={() => {
      console.log('Login successful, proceeding to main app')
      setShowLandingPage(false)
    }} />
  }

  // Show companies dashboard for authenticated users
  if (user && !loading) {
    console.log('🎯 User authenticated, checking flow conditions:', {
      activeCompany: !!activeCompany,
      isNewCompany,
      showCompaniesDashboard,
      activeTab
    })
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30" style={{ transform: 'scale(1.2)', transformOrigin: 'top center' }}>
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <PulpooLogo />
                <LanguageToggle />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Button
                  onClick={async () => {
                    console.log('Logout button clicked')
                    // Set logging out state to prevent automatic redirects
                    setIsLoggingOut(true)
                    setIntendingToLogin(false)
                    await signOut()
                  }}
                  variant="outline"
                  size="sm"
                  className="text-gray-600 hover:text-gray-800"
                >
                  {t('auth.logout')}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          {/* Payment Status Message */}
          {paymentStatus && (
            <Card className={`mb-4 ${
              paymentStatus === 'success' 
                ? 'bg-green-50 border-green-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center">
                  {paymentStatus === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                  )}
                  <span className={`font-medium ${
                    paymentStatus === 'success' ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {paymentStatus === 'success' 
                      ? 'Payment successful! Your credits have been added to your account.' 
                      : 'Payment was cancelled. No charges were made.'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {showSettings ? (
            <SettingsPage 
              onBack={() => setShowSettings(false)} 
              companyId={activeCompany?.company_id || ''}
            />
          ) : !activeCompany ? (
            <CompaniesDashboard onCompanySelected={handleCompanySelected} />
          ) : (
            // Check if this is a newly created company that should go through setup flow
            (() => {
              if (isNewCompany && !showSuccessScreen) {
                console.log('🚀 Rendering step-by-step flow for newly created company')
                return (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    {/* Header with Back Button */}
                    <div className="flex items-center justify-between mb-6">
                      <Button
                        onClick={handleBackToCompanies}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t('companyManagement.back')}
                      </Button>
                      <div className="text-center">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {t('companyManagement.dashboard.title')}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {activeCompany?.company_name}
                        </p>
                      </div>
                      <div className="w-20"></div> {/* Spacer for centering */}
                    </div>

                    {/* Beautiful Tab Navigation */}
                    <div className="flex justify-center mb-8">
                      <TabsList className="bg-white/60 backdrop-blur-sm border border-gray-200/50 p-1 rounded-xl shadow-lg">
                        <TabsTrigger
                          value="company"
                          className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md rounded-lg px-6 py-3 font-medium transition-all duration-200"
                        >
                          <Building2 className="w-4 h-4 mr-2" />
                          {t('home.steps.company')}
                        </TabsTrigger>
                        <TabsTrigger
                          value="system-prompt"
                          disabled={!completedSteps.company}
                          className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md rounded-lg px-6 py-3 font-medium transition-all duration-200 disabled:opacity-50"
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          {t('home.steps.systemPrompt')}
                        </TabsTrigger>
                        <TabsTrigger
                          value="agent"
                          disabled={!completedSteps.systemPrompt}
                          className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md rounded-lg px-6 py-3 font-medium transition-all duration-200 disabled:opacity-50"
                        >
                          <Mic className="w-4 h-4 mr-2" />
                          {t('home.steps.voiceAgent')}
                        </TabsTrigger>
                        <TabsTrigger
                          value="conversations"
                          disabled={!completedSteps.systemPrompt}
                          className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md rounded-lg px-6 py-3 font-medium transition-all duration-200 disabled:opacity-50"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          {t('home.steps.conversations')}
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {/* Tab Contents */}
                    <TabsContent value="company" className="space-y-6">
                      <CompanyForm onCompanyCreated={handleCompanyCreated} />
                    </TabsContent>

                    <TabsContent value="system-prompt" className="space-y-6">
                      <SystemPromptForm
                        companyId={activeCompany.company_id}
                        companyName={activeCompany.company_name}
                        onPromptCreated={handlePromptCreated}
                        autoActivate={true}
                      />
                    </TabsContent>

                    <TabsContent value="agent" className="space-y-6">
                      <VoiceAgent 
                        companyId={activeCompany.company_id} 
                        onComplete={handleVoiceAgentComplete}
                      />
                    </TabsContent>

                    <TabsContent value="conversations" className="space-y-6">
                      <ConversationsDashboard
                        companyId={activeCompany.company_id}
                        companyName={activeCompany.company_name}
                      />
                    </TabsContent>
                  </Tabs>
                )
              } else if (showSuccessScreen) {
                console.log('🎉 Rendering success screen')
                return (
                  <div className="space-y-6">
                    {/* Header with Back Button */}
                    <div className="flex items-center justify-between mb-6">
                      <Button
                        onClick={handleBackToCompanies}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        {t('companyManagement.back')}
                      </Button>
                      <div className="text-center">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {t('companyManagement.dashboard.title')}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {activeCompany?.company_name}
                        </p>
                      </div>
                      <div className="w-20"></div> {/* Spacer for centering */}
                    </div>

                    {/* Success Screen */}
                    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                      <CardContent className="p-8 text-center">
                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                          <div className="bg-gradient-to-r from-green-500 to-emerald-600 h-2 rounded-full transition-all duration-1000" style={{ width: '100%' }}></div>
                        </div>

                        {/* Success Icon and Message */}
                        <div className="mb-6">

                          <h3 className="text-2xl font-bold text-gray-900 mb-2">
                            ¡Tu agente de IA está listo!
                          </h3>
                          <p className="text-gray-600">
                            Has completado la configuración inicial. Tu agente puede ahora procesar conversaciones y responder a tus clientes.
                            Accede al dashboard para ver todas las herramientas disponibles:
                          </p>
                        </div>

                        {/* Feature Preview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-green-200">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <MessageCircle className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Conversaciones</h4>
                                <p className="text-sm text-gray-600">Revisa todas las conversaciones con tus clientes</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-green-200">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Wrench className="h-5 w-5 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Herramientas</h4>
                                <p className="text-sm text-gray-600">Configura herramientas y integraciones</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-green-200">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-orange-100 rounded-lg">
                                <FileText className="h-5 w-5 text-orange-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Archivos</h4>
                                <p className="text-sm text-gray-600">Gestiona documentos y conocimiento</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-green-200">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <GraduationCap className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Entrenamiento</h4>
                                <p className="text-sm text-gray-600">Mejora el rendimiento de tu agente</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <Button
                            onClick={handleContinueToDashboard}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3"
                            size="lg"
                          >
                            Continuar al Dashboard Completo
                          </Button>
                          <Button
                            onClick={handleStayHere}
                            variant="outline"
                            className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3"
                            size="lg"
                          >
                            Quedarme Aquí
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              } else {
                console.log('🏪 Rendering management dashboard for existing company')
                return <CompanyManagementDashboard company={activeCompany} onBackToCompanies={handleBackToCompanies} />
              }
            })()
          )}
        </main>

        {/* Elegant Footer */}
        <footer className="mt-20 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-center space-x-2 text-gray-500">
              <PulpooLogo size="sm" />
              <span className="text-sm">{t('footer.powered')}</span>
            </div>
          </div>
        </footer>
      </div>
    )
  }
}
