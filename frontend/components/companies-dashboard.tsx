"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { getUserCompanies, type Company } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useLanguage } from "@/lib/language-context"
import { 
  Building2, 
  Plus, 
  Calendar, 
  FileText, 
  Mail, 
  Users, 
  Sparkles,
  Loader2,
  AlertCircle
} from "lucide-react"

interface CompaniesDashboardProps {
  onCompanySelected: (company: Company, isNewlyCreated?: boolean) => void
}

export function CompaniesDashboard({ onCompanySelected }: CompaniesDashboardProps) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)


  useEffect(() => {
    if (user) {
      loadUserCompanies()
    }
  }, [user])

  const loadUserCompanies = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getUserCompanies(user!.id)
      setCompanies(response.companies)
    } catch (error) {
      console.error("Error loading companies:", error)
      setError(t('companies.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleCompanyCreated = (companyId: string, companyData: any) => {
    console.log("📋 Companies Dashboard handleCompanyCreated called with:", { companyId, companyData })
    
    // Add the new company to the list
    const newCompany: Company = {
      company_id: companyId,
      company_name: companyData.company_name,
      company_email: companyData.company_email,
      created_at: new Date().toISOString(),
      files: companyData.files || [],
      additional_text: companyData.additional_text,
      website_url: companyData.website_url,
      user_id: user!.id
    }
    setCompanies(prev => [newCompany, ...prev])
    
    // 🎯 NEW: Auto-select the newly created company to start step-by-step flow
    console.log("🚀 Auto-selecting newly created company for step-by-step setup")
    onCompanySelected(newCompany, true) // Pass true to indicate this is newly created
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(t('language') === 'en' ? 'en-US' : 'es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <p className="text-gray-600">{t('companies.loading')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-red-600">{error}</p>
        <Button onClick={loadUserCompanies} variant="outline">
          {t('companies.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('companies.title')}</h2>
          <p className="text-gray-600 mt-1">
            {companies.length === 0 
              ? t('companies.no-companies.subtitle')
              : t('language') === 'en'
                ? `${companies.length} company${companies.length > 1 ? 's' : ''} created`
                : `${companies.length} empresa${companies.length > 1 ? 's' : ''} creada${companies.length > 1 ? 's' : ''}`
            }
          </p>
        </div>
        
        <Button 
          className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          onClick={() => onCompanySelected({} as Company, true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('companies.create')}
        </Button>
      </div>

      {/* Companies Grid */}
      {companies.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('companies.no-companies')}</h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              {t('companies.no-companies.subtitle')}
            </p>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
              onClick={() => onCompanySelected({} as Company, true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('companies.create')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Card 
              key={company.company_id} 
              className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-purple-200"
              onClick={() => onCompanySelected(company)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">
                        {company.company_name}
                      </CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-600">{company.company_email}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t('language') === 'en' ? 'Active' : 'Activa'}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {company.additional_text && (
                    <div className="flex items-start space-x-2">
                      <Sparkles className="h-4 w-4 text-purple-500 mt-0.5" />
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {company.additional_text}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(company.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>
                        {t('language') === 'en'
                          ? `${company.files.length} file${company.files.length !== 1 ? 's' : ''}`
                          : `${company.files.length} archivo${company.files.length !== 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {t('companies.manage')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
} 