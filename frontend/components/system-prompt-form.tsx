"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Plus,
  X,
  MessageSquare,
  AlertCircle,
  Loader2,
  CheckCircle,
  FileText,
  ArrowRight,
  Eye,
  Sparkles,
  Headphones,
  ShoppingCart,
  Wrench,
  Calendar,
  Building,
  Utensils,
  Heart,
  Briefcase,
} from "lucide-react"
import {
  createSystemPrompt,
  getCompanyPrompts,
  activatePrompt,
  type PromptCreate,
  type PromptFragment,
  type ExistingPrompt,
} from "@/lib/api"
import { useLanguage } from "@/lib/language-context"

interface SystemPromptFormProps {
  companyId: string
  companyName: string
  onPromptCreated: () => void
  autoActivate?: boolean // New prop for auto-activation
}

export function SystemPromptForm({ companyId, companyName, onPromptCreated, autoActivate = false }: SystemPromptFormProps) {
  const { t } = useLanguage()
  const [existingPrompts, setExistingPrompts] = useState<ExistingPrompt[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState<ExistingPrompt | null>(null)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true)
  const [viewMode, setViewMode] = useState<"select" | "create" | "view">("select")

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    content: "",
    locale: "es-MX",
    model: "gemini-2.5-flash",
  })
  const [fragments, setFragments] = useState<PromptFragment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const promptTemplates = [
    {
      id: "customer-service",
      name: t('promptTemplate.customerService.name'),
      icon: Headphones,
      description: t('promptTemplate.customerService.description'),
      content: t('promptTemplate.customerService.content').replace('{COMPANY_NAME}', companyName),
    },
    {
      id: "sales-agent",
      name: t('promptTemplate.salesAgent.name'),
      icon: ShoppingCart,
      description: t('promptTemplate.salesAgent.description'),
      content: t('promptTemplate.salesAgent.content').replace('{COMPANY_NAME}', companyName),
    },
    {
      id: "technical-support",
      name: t('promptTemplate.technicalSupport.name'),
      icon: Wrench,
      description: t('promptTemplate.technicalSupport.description'),
      content: t('promptTemplate.technicalSupport.content').replace('{COMPANY_NAME}', companyName),
    },
    {
      id: "appointment-booking",
      name: t('promptTemplate.appointmentBooking.name'),
      icon: Calendar,
      description: t('promptTemplate.appointmentBooking.description'),
      content: t('promptTemplate.appointmentBooking.content').replace('{COMPANY_NAME}', companyName),
    },
    {
      id: "general-assistant",
      name: t('promptTemplate.generalAssistant.name'),
      icon: Building,
      description: t('promptTemplate.generalAssistant.description'),
      content: t('promptTemplate.generalAssistant.content').replace('{COMPANY_NAME}', companyName),
    },
    {
      id: "restaurant-hospitality",
      name: t('promptTemplate.restaurantHospitality.name'),
      icon: Utensils,
      description: t('promptTemplate.restaurantHospitality.description'),
      content: t('promptTemplate.restaurantHospitality.content').replace('{COMPANY_NAME}', companyName),
    },
    {
      id: "healthcare-assistant",
      name: t('promptTemplate.healthcareAssistant.name'),
      icon: Heart,
      description: t('promptTemplate.healthcareAssistant.description'),
      content: t('promptTemplate.healthcareAssistant.content').replace('{COMPANY_NAME}', companyName),
    },
  ]

  useEffect(() => {
    loadExistingPrompts()
  }, [companyId])

  const loadExistingPrompts = async () => {
    try {
      setIsLoadingPrompts(true)
      setError(null)
      const prompts = await getCompanyPrompts(companyId)
      setExistingPrompts(prompts)

      // If prompts exist, show selection view, otherwise show create form
      if (prompts.length === 0) {
        setViewMode("create")
        setShowCreateNew(true)
      } else {
        setViewMode("select")
      }
    } catch (error) {
      console.error("Error loading prompts:", error)
      setError("Error al cargar los prompts existentes. Aún puedes crear uno nuevo.")
      setViewMode("create")
      setShowCreateNew(true)
    } finally {
      setIsLoadingPrompts(false)
    }
  }

  const handleTemplateSelect = (template: (typeof promptTemplates)[0]) => {
    setFormData({
      ...formData,
      name: template.name,
      description: template.description,
      content: template.content.replace(/\{COMPANY_NAME\}/g, companyName),
    })
  }

  const addFragment = () => {
    const newFragment: PromptFragment = {
      name: `Fragmento ${fragments.length + 1}`,
      content: "",
      position: fragments.length,
    }
    setFragments([...fragments, newFragment])
  }

  const updateFragment = (index: number, field: keyof PromptFragment, value: string | number) => {
    const updatedFragments = fragments.map((fragment, i) => (i === index ? { ...fragment, [field]: value } : fragment))
    setFragments(updatedFragments)
  }

  const removeFragment = (index: number) => {
    const updatedFragments = fragments.filter((_, i) => i !== index)
    // Reorder positions
    const reorderedFragments = updatedFragments.map((fragment, i) => ({
      ...fragment,
      position: i,
    }))
    setFragments(reorderedFragments)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const promptData: PromptCreate = {
        name: formData.name,
        description: formData.description || undefined,
        version_data: {
          version: 1,
          content: formData.content,
          locale: formData.locale,
          model_prefs: {
            model: formData.model,
          },
          fragments: fragments.length > 0 ? fragments : undefined,
        },
      }

      console.log('📝 Creating system prompt with data:', promptData)
      const result = await createSystemPrompt(companyId, promptData)
      console.log('✅ System prompt created:', result)

      // Auto-activate the prompt if autoActivate is true
      if (autoActivate && result.data?.prompt_id) {
        console.log('🔄 Auto-activating prompt:', result.data.prompt_id)
        await activatePrompt(companyId, result.data.prompt_id)
        console.log('✅ Prompt auto-activated')
      }

      setSuccess(true)
      setTimeout(() => {
        onPromptCreated()
      }, 1500)
    } catch (error) {
      console.error('Error creating system prompt:', error)
      setError(error instanceof Error ? error.message : 'Error creating system prompt')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseExistingPrompt = () => {
    if (selectedPrompt) {
      setSuccess(true)
      setTimeout(() => {
        onPromptCreated()
      }, 1500)
    }
  }

  const handleViewPrompt = (prompt: ExistingPrompt) => {
    setSelectedPrompt(prompt)
    setViewMode("view")
  }

  if (isLoadingPrompts) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">Cargando prompts existentes...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            {selectedPrompt ? "¡Prompt Existente Seleccionado!" : "¡Prompt del Sistema Creado!"}
          </h3>
          <p className="text-green-700">
            {selectedPrompt
              ? `Usando "${selectedPrompt.prompt_name}" para tu agente de IA.`
              : "La personalidad y comportamiento de tu agente de IA han sido configurados."}
          </p>
        </CardContent>
      </Card>
    )
  }

  // View existing prompt details
  if (viewMode === "view" && selectedPrompt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Viendo Prompt del Sistema: {selectedPrompt.prompt_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('systemPromptForm.promptContentLabel')}</Label>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{selectedPrompt.prompt_content}</pre>
            </div>
          </div>

          {selectedPrompt.prompt_variables && Object.keys(selectedPrompt.prompt_variables).length > 0 && (
            <div className="space-y-2">
              <Label>{t('systemPromptForm.variablesLabel')}</Label>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <pre className="text-sm text-gray-700">{JSON.stringify(selectedPrompt.prompt_variables, null, 2)}</pre>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setViewMode("select")}>
              {t('systemPromptForm.backToSelection')}
            </Button>
            <Button onClick={handleUseExistingPrompt}>
              {t('systemPromptForm.useThisPrompt')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show existing prompts selection
  if (viewMode === "select" && existingPrompts.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('systemPromptForm.promptConfigurationTitle')}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {t('systemPromptForm.foundExistingPrompts').replace('{COMPANY_NAME}', companyName)}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">{t('systemPromptForm.existingPromptsTitle')}</h4>
            <div className="grid gap-4">
              {existingPrompts.map((prompt) => (
                <Card
                  key={prompt.prompt_id}
                  className={`border-2 transition-colors cursor-pointer ${
                    selectedPrompt?.prompt_id === prompt.prompt_id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedPrompt(prompt)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <h5 className="font-medium text-gray-900">{prompt.prompt_name}</h5>
                          {selectedPrompt?.prompt_id === prompt.prompt_id && (
                            <Badge variant="default">{t('systemPromptForm.selectedBadge')}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3">
                          {prompt.prompt_content.substring(0, 200)}
                          {prompt.prompt_content.length > 200 && "..."}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewPrompt(prompt)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">{t('systemPromptForm.createNewPromptTitle')}</h4>
            <Button variant="outline" onClick={() => setViewMode("create")} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {t('systemPromptForm.createNewPromptButton')}
            </Button>
          </div>

          {selectedPrompt && (
            <div className="flex justify-end">
              <Button onClick={handleUseExistingPrompt}>
                {t('systemPromptForm.useSelectedPrompt')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Create new prompt form
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {existingPrompts.length > 0
            ? t('systemPromptForm.createNewPromptTitle')
            : t('systemPromptForm.configureAgentPromptTitle').replace('{COMPANY_NAME}', companyName)}
        </CardTitle>
        <p className="text-sm text-gray-600">
          {t('systemPromptForm.defineAgentBehavior').replace('{COMPANY_NAME}', companyName)}
        </p>
        {existingPrompts.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setViewMode("select")}>
            {t('systemPromptForm.backToExistingPrompts')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Template Selection */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <h4 className="font-medium text-gray-900">{t('systemPromptForm.quickTemplatesTitle')}</h4>
            <Badge variant="secondary" className="text-xs">
              {t('systemPromptForm.newBadge')}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            {t('systemPromptForm.selectQuickTemplate')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promptTemplates.map((template) => {
              const IconComponent = template.icon
              return (
                <Card
                  key={template.id}
                  className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-purple-300 border-2 border-gray-200"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <IconComponent className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-gray-900 mb-1">{template.name}</h5>
                        <p className="text-xs text-gray-600 line-clamp-2">{template.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Separator />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('systemPromptForm.nameLabel')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('systemPromptForm.namePlaceholder')}
                required
              />
            </div>

                      <div className="space-y-2">
            <Label htmlFor="description">{t('systemPromptForm.descriptionLabel')}</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('systemPromptForm.descriptionPlaceholder')}
            />
          </div>
        </div>

        {/* Note about tools availability */}
        <Alert className="bg-blue-50 border-blue-200">
          <Wrench className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Note:</strong> You can add tools and integrations later in the company management dashboard after completing the initial setup.
          </AlertDescription>
        </Alert>

          <div className="space-y-2">
            <Label htmlFor="content">{t('systemPromptForm.contentLabel')}</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder={t('systemPromptForm.contentPlaceholder')}
              rows={12}
              required
            />
            <p className="text-xs text-gray-500">
              {t('systemPromptForm.contentHelper')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('systemPromptForm.localeLabel')}</Label>
              <Select value={formData.locale} onValueChange={(value) => setFormData({ ...formData, locale: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es-MX">{t('systemPromptForm.localeSpanishMX')}</SelectItem>
                  <SelectItem value="en-US">{t('systemPromptForm.localeEnglishUS')}</SelectItem>
                  <SelectItem value="en-GB">{t('systemPromptForm.localeEnglishGB')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('systemPromptForm.modelLabel')}</Label>
              <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.5-flash">{t('systemPromptForm.modelGemini25Flash')}</SelectItem>
                  <SelectItem value="gpt-4">{t('systemPromptForm.modelGPT4')}</SelectItem>
                  <SelectItem value="claude-3">{t('systemPromptForm.modelClaude3')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prompt Fragments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('systemPromptForm.promptFragmentsLabel')}</Label>
                <p className="text-xs text-gray-500">{t('systemPromptForm.promptFragmentsHelper')}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addFragment}>
                <Plus className="h-4 w-4 mr-1" />
                {t('systemPromptForm.addFragmentButton')}
              </Button>
            </div>

            {fragments.map((fragment, index) => (
              <Card key={index} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline">{t('systemPromptForm.fragmentBadge').replace('{INDEX}', (index + 1).toString())}</Badge>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFragment(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <Input
                      placeholder={t('systemPromptForm.fragmentNamePlaceholder')}
                      value={fragment.name}
                      onChange={(e) => updateFragment(index, "name", e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder={t('systemPromptForm.fragmentPositionPlaceholder')}
                      value={fragment.position}
                      onChange={(e) => updateFragment(index, "position", Number.parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <Textarea
                    placeholder={t('systemPromptForm.fragmentContentPlaceholder')}
                    value={fragment.content}
                    onChange={(e) => updateFragment(index, "content", e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('systemPromptForm.creatingPrompt')}
              </>
            ) : (
              t('systemPromptForm.createPromptButton')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
