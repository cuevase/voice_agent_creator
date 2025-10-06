"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { SystemPromptForm } from "./system-prompt-form"
import { ToolsConfiguration } from "./tools-configuration"
import { WorkersScheduleSetup } from "./workers-schedule-setup"
import { AgentInterface } from "./agent-interface"
import { VoiceAgentWebRTC } from "./voice-agent-webrtc"
import { ConversationsDashboard } from "./conversations-dashboard"
import { FileManagement } from "./file-management"
import { PhoneSetup } from "./phone-setup"
import { ModelSelector } from "./model-selector"
import { CostDashboard } from "./cost-dashboard"
import { CompanyCostDashboard } from "./company-cost-dashboard"
import { SettingsPage } from "./settings-page"

import { TrainingDashboard } from "./training-dashboard"

import { CreditDashboard } from "./credit-dashboard"
import { CreditPurchaseButton } from "./credit-purchase-button"
import OrbIcon from "./orb-icon"
import { 
  getCompanyPrompts,
  getCompanyTools,
  activatePrompt,
  type Company,
  type ExistingPrompt,
  type Tool,
} from "@/lib/api"
import { 
  MessageSquare, 
  Wrench, 
  Calendar, 
  Mic, 
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  ArrowLeft,
  File,
  GraduationCap,
  Bot,
  Sparkles,
  Users,
  Building,
  MessageCircle,
  Phone,
  DollarSign,
  Settings,
  BarChart3,
  CreditCard,
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"

interface CompanyManagementDashboardProps {
  company: Company
  onBackToCompanies: () => void
}

export function CompanyManagementDashboard({ company, onBackToCompanies }: CompanyManagementDashboardProps) {
  const [activeSideMenu, setActiveSideMenu] = useState("my-agent")
  const [activeTab, setActiveTab] = useState("agent")
  const [prompts, setPrompts] = useState<ExistingPrompt[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreatePromptDialog, setShowCreatePromptDialog] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  const [activatingPrompt, setActivatingPrompt] = useState<string | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    loadCompanyData()
  }, [company])

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
    
    if (tab === 'credits') {
      setActiveSideMenu('credits')
    }
  }, [])

  const loadCompanyData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log("Loading company data for:", company.company_id)
      
      // Load all data in parallel
      const [promptsData, toolsData] = await Promise.all([
        getCompanyPrompts(company.company_id),
        getCompanyTools(company.company_id),
      ])
      
      console.log("Prompts data:", promptsData)
      console.log("Tools data:", toolsData)
      
      // Both functions now return arrays directly
      setPrompts(Array.isArray(promptsData) ? promptsData : [])
      setTools(Array.isArray(toolsData) ? toolsData : [])
    } catch (error) {
      console.error("Error loading company data:", error)
      setError("Error al cargar los datos de la empresa. Por favor intenta de nuevo.")
      // Set empty arrays on error to prevent map errors
      setPrompts([])
      setTools([])
    } finally {
      setLoading(false)
    }
  }

  const handlePromptCreated = () => {
    loadCompanyData() // Reload prompts
    setShowCreatePromptDialog(false)
  }



  const handlePromptActivation = async (promptId: string) => {
    try {
      setActivatingPrompt(promptId)
      await activatePrompt(company.company_id, promptId)
      
      // Reload prompts to get updated active status
      const updatedPrompts = await getCompanyPrompts(company.company_id)
      setPrompts(updatedPrompts)
      
      // Show success message (you could add a toast here)
      console.log(t('prompts.activate.success'))
    } catch (error) {
      console.error(t('prompts.activate.error'), error)
      setError(t('prompts.activate.error'))
    } finally {
      setActivatingPrompt(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <p className="text-gray-600">Cargando datos de la empresa...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-red-600">{error}</p>
        <Button onClick={loadCompanyData} variant="outline">
          Intentar de nuevo
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button onClick={onBackToCompanies} variant="ghost" className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{company.company_name}</h2>
            <p className="text-gray-600 mt-1">{t('companyManagement.dashboard.title')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CreditPurchaseButton compact={true} showBalance={true} />
          <Badge variant="secondary" className="text-sm">
          </Badge>
        </div>
      </div>

      {/* Side Menu */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-64 p-4 bg-white rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">{t('dashboard.sideMenu.title')}</h3>
          <div className="space-y-2">
            <Button
              variant={activeSideMenu === "my-agent" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("my-agent")}
              className="w-full justify-start"
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center">
                <OrbIcon className="h-5 w-5" />
              </span>
              {t('dashboard.sideMenu.myAgent')}
            </Button>
            <Button
              variant={activeSideMenu === "conversations" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("conversations")}
              className="w-full justify-start"
            >
              <Users className="h-5 w-5 mr-2" />
              {t('dashboard.sideMenu.conversations')}
            </Button>
            <Button
              variant={activeSideMenu === "costs" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("costs")}
              className="w-full justify-start"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              Costos
            </Button>
            <Button
              variant={activeSideMenu === "credits" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("credits")}
              className="w-full justify-start"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Créditos
            </Button>
            <Button
              variant={activeSideMenu === "phone-integration" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("phone-integration")}
              className="w-full justify-start"
            >
              <Phone className="h-5 w-5 mr-2" />
              {t('phone.title')}
            </Button>
            <Button
              variant={activeSideMenu === "my-company" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("my-company")}
              className="w-full justify-start"
            >
              <Building className="h-5 w-5 mr-2" />
              {t('dashboard.sideMenu.myCompany')}
            </Button>
            <Button
              variant={activeSideMenu === "settings" ? "default" : "ghost"}
              onClick={() => setActiveSideMenu("settings")}
              className="w-full justify-start"
            >
              <Settings className="h-5 w-5 mr-2" />
              Configuración
            </Button>

          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-4">
          {activeSideMenu === "my-agent" && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="agent" className="flex items-center space-x-2">
                  <Mic className="h-5 w-5" />
                  <span>{t('dashboard.agent')}</span>
                </TabsTrigger>
                <TabsTrigger value="prompts" className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>{t('dashboard.prompts')}</span>
                </TabsTrigger>
                <TabsTrigger value="tools" className="flex items-center space-x-2">
                  <Wrench className="h-5 w-5" />
                  <span>{t('dashboard.tools')}</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="flex items-center space-x-2">
                  <File className="h-5 w-5" />
                  <span>{t('files.title')}</span>
                </TabsTrigger>
                <TabsTrigger value="training" className="flex items-center space-x-2">
                  <GraduationCap className="h-5 w-5" />
                  <span>{t('dashboard.training')}</span>
                </TabsTrigger>
              </TabsList>

              {/* Mi Agente Tab */}
              <TabsContent value="agent" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t('dashboard.agent')}</h3>
                </div>
                
                {/* Agent Interface Section */}
                <div className="space-y-4">
                  <AgentInterface companyId={company.company_id} />
                </div>
              </TabsContent>

              {/* Mis Prompts Tab */}
              <TabsContent value="prompts" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t('dashboard.prompts')}</h3>
                  {prompts.length > 0 && (
                    <Dialog open={showCreatePromptDialog} onOpenChange={setShowCreatePromptDialog}>
                      <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800">
                          <Plus className="h-4 w-4 mr-2" />
                          Nuevo Prompt
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto backdrop-blur-md bg-white/95 border-0 shadow-2xl">
                        <DialogHeader>
                          <DialogTitle>Crear Nuevo Prompt</DialogTitle>
                        </DialogHeader>
                        <SystemPromptForm 
                          onPromptCreated={handlePromptCreated}
                          companyId={company.company_id}
                          companyName={company.company_name}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {prompts.length === 0 ? (
                  <div className="space-y-6">
                    <Card className="border-dashed border-2 border-gray-200 bg-gray-50">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.prompts.none')}</h3>
                        <p className="text-gray-600 text-center mb-6 max-w-md">
                          {t('dashboard.prompts.none.desc')}
                        </p>
                      </CardContent>
                    </Card>
                    
                    {/* Show the form directly on the page */}
                    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-purple-100/50 rounded-2xl overflow-hidden">
                      <CardHeader className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-b border-purple-100/50 pb-6">
                        <CardTitle className="flex items-center gap-3 text-gray-900">
                          <div className="p-2 bg-purple-100 rounded-xl">
                            <MessageSquare className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{t('dashboard.prompts.create')}</h3>
                            <p className="text-sm text-gray-500 font-normal">{t('dashboard.prompts.create.desc')}</p>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <SystemPromptForm 
                          onPromptCreated={handlePromptCreated}
                          companyId={company.company_id}
                          companyName={company.company_name}
                        />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {prompts.map((prompt) => (
                      <Card key={prompt.prompt_id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">{prompt.prompt_name}</h4>
                              <p className="text-sm text-gray-600 line-clamp-3">{prompt.prompt_content}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={prompt.active ? "default" : "secondary"}>
                                {prompt.active ? t('prompts.status.active') : t('prompts.status.inactive')}
                              </Badge>
                              <Switch
                                checked={prompt.active}
                                onCheckedChange={() => handlePromptActivation(prompt.prompt_id)}
                                disabled={activatingPrompt === prompt.prompt_id}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Mis Herramientas Tab */}
              <TabsContent value="tools" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t('dashboard.tools')}</h3>
                </div>

                {tools.length === 0 ? (
                  <div className="space-y-6">
                    <Card className="border-dashed border-2 border-gray-200 bg-gray-50">
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Wrench className="h-12 w-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.tools.none')}</h3>
                        <p className="text-gray-600 text-center mb-6 max-w-md">
                          {t('dashboard.tools.none.desc')}
                        </p>
                      </CardContent>
                    </Card>
                    
                    {/* Show the form directly on the page */}
                    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
                      <CardHeader className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-b border-blue-100/50 pb-6">
                        <CardTitle className="flex items-center gap-3 text-gray-900">
                          <div className="p-2 bg-blue-100 rounded-xl">
                            <Wrench className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{t('dashboard.tools.create')}</h3>
                            <p className="text-sm text-gray-500 font-normal">{t('dashboard.tools.create.desc')}</p>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <ToolsConfiguration 
                          companyId={company.company_id}
                          companyName={company.company_name}
                        />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tools.map((tool) => (
                      <Card key={tool.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="bg-blue-100 p-2 rounded-full">
                                <Wrench className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{tool.name}</h4>
                                <p className="text-sm text-gray-500">{tool.description}</p>
                              </div>
                            </div>
                            <Badge variant="default" className="bg-blue-100 text-blue-800">
                              {tool.method}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Files Tab */}
              <TabsContent value="files" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{t('files.title')}</h3>
                  <Button variant="outline" size="sm" onClick={loadCompanyData} disabled={loading}>{t('dashboard.files.refresh')}</Button>
                </div>
                <FileManagement 
                  companyId={company.company_id}
                  companyName={company.company_name}
                />
              </TabsContent>

              {/* Training Tab */}
              <TabsContent value="training" className="space-y-6">
                <TrainingDashboard 
                  companyId={company.company_id}
                  companyName={company.company_name}
                />
              </TabsContent>

            </Tabs>
          )}

          {activeSideMenu === "conversations" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t('dashboard.conversations.title').replace('{COMPANY_NAME}', company.company_name)}</h3>
                <p className="text-sm text-gray-600 mt-1">{t('dashboard.conversations.subtitle')}</p>
                <Button variant="outline" size="sm" onClick={loadCompanyData} disabled={loading}>{t('dashboard.conversations.refresh')}</Button>
              </div>
              <ConversationsDashboard 
                companyId={company.company_id}
                companyName={company.company_name}
              />
            </div>
          )}

          {activeSideMenu === "my-company" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">My Company</h3>
                <Button variant="outline" size="sm" onClick={loadCompanyData} disabled={loading}>Refresh</Button>
              </div>
              
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-b border-blue-100/50 pb-6">
                  <CardTitle className="flex items-center gap-3 text-gray-900">
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{company.company_name}</h3>
                      <p className="text-sm text-gray-500 font-normal">Company ID: {company.company_id}</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Company Status</p>
                        <p className="text-sm text-gray-500">Active</p>
                      </div>
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Company Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Company Name:</span>
                            <span className="font-medium">{company.company_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Company ID:</span>
                            <span className="font-medium">{company.company_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Created:</span>
                            <span className="font-medium">{new Date(company.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">Quick Actions</h4>
                        <div className="space-y-2">
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Users className="h-4 w-4 mr-2" />
                            Manage Team Members
                          </Button>
                          <Button variant="outline" size="sm" className="w-full justify-start">
                            <Settings className="h-4 w-4 mr-2" />
                            Company Settings
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

          {activeSideMenu === "phone-integration" && (
            <PhoneSetup companyId={company.company_id} />
          )}

          {activeSideMenu === "costs" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Costs & Models</h3>
                  <p className="text-gray-600">Track costs and manage model settings</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadCompanyData} disabled={loading}>Refresh</Button>
              </div>
              
              <Tabs defaultValue="costs" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="costs" className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Company Costs</span>
                  </TabsTrigger>
                  <TabsTrigger value="models" className="flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Model Settings</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="costs" className="space-y-6">
                  <CompanyCostDashboard 
                    companyId={company.company_id}
                    companyName={company.company_name}
                  />
                </TabsContent>
                
                <TabsContent value="models" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Model Settings</h3>
                    <Button variant="outline" size="sm" onClick={loadCompanyData} disabled={loading}>Refresh</Button>
                  </div>
                  <ModelSelector companyId={company.company_id} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeSideMenu === "credits" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Credit Management</h3>
                  <p className="text-gray-600">Purchase and manage your AI service credits</p>
                </div>
              </div>
              
              <CreditDashboard />
            </div>
          )}

          {activeSideMenu === "settings" && (
            <SettingsPage 
              companyId={company.company_id} 
              onBack={() => setActiveSideMenu("my-agent")}
            />
          )}


        </div>
      </div>
    </div>
  )
} 