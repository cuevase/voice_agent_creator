"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Search, Building2, Mail, FileText, AlertCircle, Loader2, CheckCircle, Globe } from "lucide-react"
import { getCompanyInfo, type Company } from "@/lib/api"
import { useLanguage } from "@/lib/language-context"

interface CompanyLoaderProps {
  onCompanyLoaded: (company: Company) => void
}

export function CompanyLoader({ onCompanyLoaded }: CompanyLoaderProps) {
  const { t } = useLanguage()
  const [companyId, setCompanyId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedCompany, setLoadedCompany] = useState<Company | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId.trim()) return

    setIsLoading(true)
    setError(null)
    setLoadedCompany(null)

    try {
      const result = await getCompanyInfo(companyId.trim())

      if (result.message === "Company info fetched successfully" && result.data && result.data.length > 0) {
        const company = result.data[0]
        setLoadedCompany(company)
      } else {
        setError(t('company.loader.notFound'))
      }
    } catch (error) {
      console.error("Error loading company:", error)
      setError(t('company.loader.error'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoadCompany = () => {
    if (loadedCompany) {
      onCompanyLoaded(loadedCompany)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyId">{t('company.loader.id')}</Label>
          <Input
            id="companyId"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            placeholder={t('company.loader.id.placeholder')}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t('company.loader.searching')}
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              {t('company.loader.search')}
            </>
          )}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loadedCompany && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">{t('company.loader.found')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{loadedCompany.company_name}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">{loadedCompany.company_email}</span>
              </div>

              {loadedCompany.website_url && (
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <a
                    href={loadedCompany.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {loadedCompany.website_url}
                  </a>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">ID:</span>
                <Badge variant="outline" className="text-xs">
                  {loadedCompany.company_id}
                </Badge>
              </div>

              {loadedCompany.additional_text && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Información Adicional:</span>
                  </div>
                  <p className="text-sm text-gray-600 pl-6">{loadedCompany.additional_text}</p>
                </div>
              )}

              {loadedCompany.files && loadedCompany.files.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Archivos:</span>
                  </div>
                  <div className="pl-6 space-y-1">
                    {loadedCompany.files.map((file, index) => (
                      <Badge key={index} variant="secondary" className="text-xs mr-2">
                        {file.split("/").pop()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleLoadCompany} className="w-full mt-4">
              Cargar Esta Empresa
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <p className="text-sm text-gray-500">
          ¿No tienes un ID de Empresa? Crea una nueva empresa usando el formulario de la izquierda.
        </p>
      </div>
    </div>
  )
}
