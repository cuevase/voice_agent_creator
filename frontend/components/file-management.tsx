"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Upload,
  Link,
  FileText,
  Trash2,
  Download,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle,
  File,
  Globe,
  Edit,
} from "lucide-react"
import {
  getCompanyFiles,
  manageCompanyFiles,
  type CompanyFile,
  type CompanyFilesResponse,
} from "@/lib/api"
import { useLanguage } from "@/lib/language-context"
import { ConsentModal } from "./consent-modal"
import { updateConsent } from "@/lib/consent-api"

interface FileManagementProps {
  companyId: string
  companyName: string
}

export function FileManagement({ companyId, companyName }: FileManagementProps) {
  const { t } = useLanguage()
  const [files, setFiles] = useState<CompanyFile[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [additionalText, setAdditionalText] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("files")
  
  // Dialog states
  const [showAddUrlDialog, setShowAddUrlDialog] = useState(false)
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false)
  const [newUrl, setNewUrl] = useState("")
  const [newNote, setNewNote] = useState("")
  
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // Consent modal state
  const [showConsentModal, setShowConsentModal] = useState(false)
  const [consentType, setConsentType] = useState<'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing'>('file_processing')

  useEffect(() => {
    loadCompanyFiles()
  }, [companyId])

  const loadCompanyFiles = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("🔄 Loading company files for companyId:", companyId)
      
      const response = await getCompanyFiles(companyId)
      console.log("📦 File management response:", response)
      
      // Check if response has the expected structure
      if (response && response.data) {
        console.log("✅ Response has data property")
        setFiles(response.data.files || [])
        setUrls(response.data.urls || [])
        setAdditionalText(response.data.additional_text || "")
        console.log("✅ Set files:", response.data.files?.length || 0)
        console.log("✅ Set URLs:", response.data.urls?.length || 0)
        console.log("✅ Set additional text:", response.data.additional_text ? "Present" : "Missing")
      } else {
        console.error("❌ Response doesn't have expected structure:", response)
        // Try to handle the raw backend response as fallback
        if (response && typeof response === 'object') {
          console.log("🔄 Attempting to handle raw backend response...")
          const rawResponse = response as any
          
          // Handle files
          if (rawResponse.files && Array.isArray(rawResponse.files)) {
            const transformedFiles = rawResponse.files.map((filePath: string, index: number) => ({
              file_path: filePath,
              file_name: filePath.split('/').pop() || `file_${index}`,
              file_type: filePath.split('.').pop() || 'unknown',
              created_at: new Date().toISOString(),
              content_type: 'file' as const
            }))
            setFiles(transformedFiles)
          }
          
          // Handle URLs
          if (rawResponse.urls) {
            try {
              if (typeof rawResponse.urls === 'string') {
                const parsedUrls = JSON.parse(rawResponse.urls)
                setUrls(Array.isArray(parsedUrls) ? parsedUrls : [])
              } else if (Array.isArray(rawResponse.urls)) {
                setUrls(rawResponse.urls)
              } else {
                setUrls([])
              }
            } catch (error) {
              console.warn("⚠️ Failed to parse URLs:", rawResponse.urls)
              setUrls([])
            }
          }
          
          // Handle additional text
          if (rawResponse.additional_text) {
            setAdditionalText(rawResponse.additional_text)
          }
          
          console.log("✅ Successfully handled raw backend response")
        } else {
          setError("Invalid response structure from server")
        }
      }
    } catch (error) {
      console.error("❌ Error loading company files:", error)
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      })
      setError("Failed to load company files")
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return

    try {
      setProcessing(true)
      setError(null)
      
      await manageCompanyFiles(companyId, {
        action: "add_files",
        files: selectedFiles,
      })

      setSelectedFiles([])
      await loadCompanyFiles()
      console.log(t('files.success.upload'))
    } catch (error) {
      console.error("Error uploading files:", error)
      
      // Check for consent-related errors
      if (error instanceof Error && error.message.includes('consent required')) {
        showConsentModalForType('file_processing')
      } else {
        setError(t('files.error.upload'))
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleAddUrl = async () => {
    if (!newUrl.trim()) return

    try {
      setProcessing(true)
      setError(null)
      
      await manageCompanyFiles(companyId, {
        action: "add_urls",
        urls_to_add: [newUrl.trim()],
      })

      setNewUrl("")
      setShowAddUrlDialog(false)
      await loadCompanyFiles()
      console.log(t('files.success.url'))
    } catch (error) {
      console.error("Error adding URL:", error)
      setError(t('files.error.url'))
    } finally {
      setProcessing(false)
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    try {
      setProcessing(true)
      setError(null)
      
      await manageCompanyFiles(companyId, {
        action: "add_text",
        additional_text: newNote.trim(),
      })

      setNewNote("")
      setShowAddNoteDialog(false)
      await loadCompanyFiles()
      console.log(t('files.success.note'))
    } catch (error) {
      console.error("Error adding note:", error)
      setError(t('files.error.note'))
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveFile = async (filePath: string) => {
    try {
      setProcessing(true)
      setError(null)
      
      await manageCompanyFiles(companyId, {
        action: "remove_files",
        file_paths_to_remove: [filePath],
      })

      await loadCompanyFiles()
      console.log(t('files.success.remove'))
    } catch (error) {
      console.error("Error removing file:", error)
      setError(t('files.error.remove'))
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveUrl = async (url: string) => {
    try {
      setProcessing(true)
      setError(null)
      
      await manageCompanyFiles(companyId, {
        action: "remove_urls",
        urls_to_remove: [url],
      })

      await loadCompanyFiles()
      console.log(t('files.success.remove'))
    } catch (error) {
      console.error("Error removing URL:", error)
      setError(t('files.error.remove'))
    } finally {
      setProcessing(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Consent handling functions
  const handleConsentUpdate = async (consentType: string, granted: boolean) => {
    try {
      await updateConsent(consentType as any, granted)
      setShowConsentModal(false)
      // Retry the action that triggered the consent request
      if (granted) {
        // Retry the last action
        if (processing) {
          // Retry file upload
          handleFileUpload()
        }
      }
    } catch (error) {
      console.error('Error updating consent:', error)
    }
  }

  const showConsentModalForType = (type: 'voice_recording' | 'file_processing' | 'ai_training' | 'payment_processing') => {
    setConsentType(type)
    setShowConsentModal(true)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading files...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('files.title')}</h2>
          <p className="text-gray-600 mt-1">{t('files.subtitle')}</p>
        </div>
      </div>

      {/* Knowledge Base Note */}
      <Alert className="border-blue-200 bg-blue-50">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 mb-1">{t('files.knowledge.title')}</h3>
            <p className="text-sm text-blue-700">{t('files.knowledge.note')}</p>
          </div>
        </div>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="files" className="flex items-center space-x-2">
            <File className="h-4 w-4" />
            <span>{t('files.tabs.files')}</span>
          </TabsTrigger>
          <TabsTrigger value="urls" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>{t('files.tabs.urls')}</span>
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>{t('files.tabs.notes')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('files.tabs.files')}</h3>
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('files.upload')}
              </Button>
              {selectedFiles.length > 0 && (
                <Button
                  onClick={handleFileUpload}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {processing ? t('files.processing') : 'Upload'}
                </Button>
              )}
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">Selected Files:</h4>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {files.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('files.noFiles')}</h3>
                <p className="text-gray-600">{t('files.dragDrop')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {files.map((file) => (
                <Card key={file.file_path} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <File className="h-5 w-5 text-blue-600" />
                        <div>
                          <h4 className="font-medium">{file.file_name}</h4>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveFile(file.file_path)}
                          disabled={processing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* URLs Tab */}
        <TabsContent value="urls" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('files.tabs.urls')}</h3>
            <Dialog open={showAddUrlDialog} onOpenChange={setShowAddUrlDialog}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('files.addUrl')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('files.addUrl')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="url">{t('files.urlPlaceholder')}</Label>
                    <Input
                      id="url"
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddUrlDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddUrl}
                      disabled={!newUrl.trim() || processing}
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link className="h-4 w-4 mr-2" />
                      )}
                      {processing ? t('files.processing') : t('files.addUrl')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {urls.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('files.noUrls')}</h3>
                <p className="text-gray-600">Add URLs to crawl and store as PDFs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {urls.map((url, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Globe className="h-5 w-5 text-green-600" />
                        <div>
                          <h4 className="font-medium">{url}</h4>
                          <p className="text-sm text-gray-500">Crawled and stored as PDF</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveUrl(url)}
                        disabled={processing}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('files.tabs.notes')}</h3>
            <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('files.addNote')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('files.addNote')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="note">{t('files.notePlaceholder')}</Label>
                    <Textarea
                      id="note"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Enter additional company information..."
                      rows={6}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowAddNoteDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || processing}
                    >
                      {processing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      {processing ? t('files.processing') : t('files.addNote')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {!additionalText ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('files.noNotes')}</h3>
                <p className="text-gray-600">Add text notes to your company knowledge base</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <h4 className="font-medium">Additional Text Note</h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddNoteDialog(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">{additionalText}</pre>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Consent Modal */}
      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        consentType={consentType}
        onConsent={handleConsentUpdate}
      />
    </div>
  )
} 