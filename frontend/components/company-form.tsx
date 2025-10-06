"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, X, FileText, AlertCircle, CheckCircle, Building2, FileCheck, Sparkles } from "lucide-react"
import { createCompany } from "@/lib/api"
import { useLanguage } from "@/lib/language-context"

interface CompanyFormProps {
  onCompanyCreated: (companyId: string, companyData?: any) => void
}

export function CompanyForm({ onCompanyCreated }: CompanyFormProps) {
  const { t } = useLanguage()
  
  const loadingSteps = [
    { icon: Building2, message: t('company.loading.creating'), duration: 1000 },
    { icon: FileCheck, message: t('company.loading.processing'), duration: 1500 },
    { icon: Sparkles, message: t('company.loading.configuring'), duration: 1200 },
    { icon: CheckCircle, message: t('company.loading.ready'), duration: 800 },
  ]

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    additionalText: "",
    website_url: "", // Add website URL field
    language: "es", // Add language field
  })
  const [files, setFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isLoading && currentStep < loadingSteps.length - 1) {
      interval = setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
      }, loadingSteps[currentStep].duration)
    }
    return () => clearTimeout(interval)
  }, [isLoading, currentStep])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const validFiles = droppedFiles.filter((file) => {
      const validTypes = [
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024 // 10MB limit
    })

    if (validFiles.length !== droppedFiles.length) {
      setError(t('company.files.error'))
    } else {
      setError(null)
    }

    setFiles((prev) => [...prev, ...validFiles])
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      const validFiles = selectedFiles.filter((file) => {
        const validTypes = [
          "application/pdf",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]
        return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
      })

      if (validFiles.length !== selectedFiles.length) {
        setError(t('company.files.error'))
      } else {
        setError(null)
      }

      setFiles((prev) => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("📝 Form submitted with data:", formData)
    console.log("📎 Files to upload:", files.map(f => ({ name: f.name, size: f.size, type: f.type })))
    
    setIsLoading(true)
    setError(null)
    setCurrentStep(0)

    try {
      console.log("🔄 Calling createCompany API...")
      const result = await createCompany({
        name: formData.name,
        email: formData.email,
        files,
        additionalText: formData.additionalText,
        website_url: formData.website_url, // Include website URL
        language: formData.language, // Include language
      })

      console.log("✅ createCompany API response:", result)

      if (result.data && result.data[0]) {
        console.log("🎉 Company created successfully:", result.data[0])
        setSuccess(true)
        setTimeout(() => {
          console.log("🏢 Calling onCompanyCreated callback with:", result.data[0].company_id, result.data[0])
          onCompanyCreated(result.data[0].company_id, result.data[0])
          // Reset form
          setFormData({ name: "", email: "", additionalText: "", website_url: "", language: "es" })
          setFiles([])
        }, 1500)
      } else {
        console.error("❌ Invalid API response structure:", result)
        setError("Error: Invalid response from server")
      }
    } catch (error) {
      console.error("❌ Error creating company:", error)
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes("No authenticated session")) {
          setError("Error de autenticación. Por favor inicia sesión nuevamente.")
        } else if (error.message.includes("Failed to create company")) {
          setError("Error al crear la empresa. Por favor verifica los datos e intenta de nuevo.")
        } else {
          setError(`Error: ${error.message}`)
        }
      } else {
        setError("Error al crear la empresa. Por favor intenta de nuevo.")
      }
    } finally {
      console.log("🔚 handleSubmit finally block - setting isLoading to false")
      setIsLoading(false)
      setCurrentStep(0)
    }
  }

  if (isLoading) {
    const currentStepData = loadingSteps[currentStep]
    const IconComponent = currentStepData.icon

    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        {/* Minimalistic Loading Animation */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-100 rounded-full animate-spin">
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <IconComponent className="h-6 w-6 text-purple-600" />
          </div>
        </div>

        {/* Progress Steps */}
        <div className="text-center space-y-3">
          <h3 className="text-lg font-medium text-gray-900">{currentStepData.message}</h3>
          <div className="flex space-x-2 justify-center">
            {loadingSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index <= currentStep ? "bg-purple-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-500 max-w-md">
            {currentStep === 0 && "Estamos configurando tu espacio de trabajo personalizado"}
            {currentStep === 1 &&
              files.length > 0 &&
              `Analizando ${files.length} archivo${files.length > 1 ? "s" : ""} para entrenar tu IA`}
            {currentStep === 1 && files.length === 0 && "Preparando la base de conocimiento de tu IA"}
            {currentStep === 2 && "Inicializando las capacidades de tu agente inteligente"}
            {currentStep === 3 && "¡Tu empresa está lista para usar!"}
          </p>
        </div>

        {/* Subtle progress indicator */}
        <div className="w-64 bg-gray-200 rounded-full h-1">
          <div
            className="bg-gradient-to-r from-purple-500 to-purple-600 h-1 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((currentStep + 1) / loadingSteps.length) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center space-x-2 text-green-800">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{t('company.success')}</span>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">{t('company.name')} *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('company.name.placeholder')}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('company.email')} *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder={t('company.email.placeholder')}
            required
          />
        </div>
      </div>

      {/* Add website URL field */}
      <div className="space-y-2">
        <Label htmlFor="website_url">{t('company.website')}</Label>
        <Input
          id="website_url"
          type="url"
          value={formData.website_url}
          onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
          placeholder={t('company.website.placeholder')}
        />
        <p className="text-xs text-gray-500">
          {t('language') === 'en' 
            ? 'If you provide a URL, we will automatically analyze your website content to better train your AI agent'
            : 'Si proporcionas una URL, analizaremos automáticamente el contenido de tu sitio web para entrenar mejor a tu agente de IA'
          }
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">{t('company.language')}</Label>
        <Select onValueChange={(value) => setFormData({ ...formData, language: value })} value={formData.language}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('company.language.placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">{t('company.language.es')}</SelectItem>
            <SelectItem value="en">{t('company.language.en')}</SelectItem>
            <SelectItem value="fr">{t('company.language.fr')}</SelectItem>
            <SelectItem value="de">{t('company.language.de')}</SelectItem>
            <SelectItem value="it">{t('company.language.it')}</SelectItem>
            <SelectItem value="pt">{t('company.language.pt')}</SelectItem>
            <SelectItem value="ru">{t('company.language.ru')}</SelectItem>
            <SelectItem value="zh">{t('company.language.zh')}</SelectItem>
            <SelectItem value="ja">{t('company.language.ja')}</SelectItem>
            <SelectItem value="ko">{t('company.language.ko')}</SelectItem>
            <SelectItem value="ar">{t('company.language.ar')}</SelectItem>
            <SelectItem value="hi">{t('company.language.hi')}</SelectItem>
            <SelectItem value="nl">{t('company.language.nl')}</SelectItem>
            <SelectItem value="sv">{t('company.language.sv')}</SelectItem>
            <SelectItem value="no">{t('company.language.no')}</SelectItem>
            <SelectItem value="da">{t('company.language.da')}</SelectItem>
            <SelectItem value="fi">{t('company.language.fi')}</SelectItem>
            <SelectItem value="pl">{t('company.language.pl')}</SelectItem>
            <SelectItem value="tr">{t('company.language.tr')}</SelectItem>
            <SelectItem value="cs">{t('company.language.cs')}</SelectItem>
            <SelectItem value="hu">{t('company.language.hu')}</SelectItem>
            <SelectItem value="ro">{t('company.language.ro')}</SelectItem>
            <SelectItem value="bg">{t('company.language.bg')}</SelectItem>
            <SelectItem value="sk">{t('company.language.sk')}</SelectItem>
            <SelectItem value="sl">{t('company.language.sl')}</SelectItem>
            <SelectItem value="hr">{t('company.language.hr')}</SelectItem>
            <SelectItem value="sr">{t('company.language.sr')}</SelectItem>
            <SelectItem value="el">{t('company.language.el')}</SelectItem>
            <SelectItem value="he">{t('company.language.he')}</SelectItem>
            <SelectItem value="th">{t('company.language.th')}</SelectItem>
            <SelectItem value="vi">{t('company.language.vi')}</SelectItem>
            <SelectItem value="id">{t('company.language.id')}</SelectItem>
            <SelectItem value="ms">{t('company.language.ms')}</SelectItem>
            <SelectItem value="fil">{t('company.language.fil')}</SelectItem>
            <SelectItem value="bn">{t('company.language.bn')}</SelectItem>
            <SelectItem value="ur">{t('company.language.ur')}</SelectItem>
            <SelectItem value="fa">{t('company.language.fa')}</SelectItem>
            <SelectItem value="am">{t('company.language.am')}</SelectItem>
            <SelectItem value="sw">{t('company.language.sw')}</SelectItem>
            <SelectItem value="yo">{t('company.language.yo')}</SelectItem>
            <SelectItem value="ig">{t('company.language.ig')}</SelectItem>
            <SelectItem value="ha">{t('company.language.ha')}</SelectItem>
            <SelectItem value="zu">{t('company.language.zu')}</SelectItem>
            <SelectItem value="xh">{t('company.language.xh')}</SelectItem>
            <SelectItem value="af">{t('company.language.af')}</SelectItem>
            <SelectItem value="lo">{t('company.language.lo')}</SelectItem>
            <SelectItem value="km">{t('company.language.km')}</SelectItem>
            <SelectItem value="my">{t('company.language.my')}</SelectItem>
            <SelectItem value="mn">{t('company.language.mn')}</SelectItem>
            <SelectItem value="ka">{t('company.language.ka')}</SelectItem>
            <SelectItem value="hy">{t('company.language.hy')}</SelectItem>
            <SelectItem value="az">{t('company.language.az')}</SelectItem>
            <SelectItem value="kk">{t('company.language.kk')}</SelectItem>
            <SelectItem value="ky">{t('company.language.ky')}</SelectItem>
            <SelectItem value="uz">{t('company.language.uz')}</SelectItem>
            <SelectItem value="tk">{t('company.language.tk')}</SelectItem>
            <SelectItem value="tj">{t('company.language.tj')}</SelectItem>
            <SelectItem value="ps">{t('company.language.ps')}</SelectItem>
            <SelectItem value="ne">{t('company.language.ne')}</SelectItem>
            <SelectItem value="si">{t('company.language.si')}</SelectItem>
            <SelectItem value="ml">{t('company.language.ml')}</SelectItem>
            <SelectItem value="ta">{t('company.language.ta')}</SelectItem>
            <SelectItem value="te">{t('company.language.te')}</SelectItem>
            <SelectItem value="kn">{t('company.language.kn')}</SelectItem>
            <SelectItem value="gu">{t('company.language.gu')}</SelectItem>
            <SelectItem value="pa">{t('company.language.pa')}</SelectItem>
            <SelectItem value="or">{t('company.language.or')}</SelectItem>
            <SelectItem value="as">{t('company.language.as')}</SelectItem>
            <SelectItem value="mr">{t('company.language.mr')}</SelectItem>
            <SelectItem value="sa">{t('company.language.sa')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="files">{t('company.files')}</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
            isDragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload className={`mx-auto h-12 w-12 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />
            <div className="mt-4">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  {isDragOver 
                    ? (t('language') === 'en' ? 'Drop files here' : 'Suelta los archivos aquí')
                    : t('company.files.drag')
                  }
                </span>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFileChange}
                  accept=".pdf,.txt,.doc,.docx"
                />
              </label>
              <p className="text-xs text-gray-500">
                <strong>{t('language') === 'en' ? 'Recommended:' : 'Recomendado:'}</strong> {t('company.files.limit')}
              </p>
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800 font-medium mb-1">
                  💡 {t('language') === 'en' 
                    ? 'Files are more effective than website extraction'
                    : 'Los archivos son más efectivos que la extracción de sitios web'
                  }
                </p>
                <p className="text-xs text-blue-700">
                  {t('language') === 'en'
                    ? 'Include PDFs of: product databases, price lists, service policies, FAQs, user manuals, catalogs, and any specific information you want your AI agent to know perfectly.'
                    : 'Incluye PDFs de: bases de datos de productos, listas de precios, políticas de servicio, preguntas frecuentes, manuales de usuario, catálogos, y cualquier información específica que quieras que tu agente de IA conozca perfectamente.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => (
              <Card key={index}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="additionalText">{t('company.description')}</Label>
        <Textarea
          id="additionalText"
          value={formData.additionalText}
          onChange={(e) => setFormData({ ...formData, additionalText: e.target.value })}
          placeholder={t('company.description.placeholder')}
          rows={4}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t('company.submit') + "..." : t('company.submit')}
      </Button>
    </form>
  )
}
