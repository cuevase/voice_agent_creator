"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Upload, MapPin, FileText, Phone, AlertCircle, CheckCircle, Plus, Link, RefreshCw } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { supabase } from "@/lib/supabase"

interface PhoneSetupProps {
  companyId: string
}

interface PhoneNumber {
  phone_number: string
  source: string
  status: string
  created_at: string
  is_primary: boolean
  user_id: string
  company_id: string
}

interface RegulatoryBundle {
  bundle_sid: string
  business_name: string
  status: string
  purchased_number?: string
  purchase_date?: string
  auto_provisioned?: boolean
  created_at: string
}

interface BundleDetails {
  bundle_sid: string
  company_id: string
  business_name: string
  business_address: string
  contact_email: string
  iso_country: string
  number_type: string
  end_user_type: string
  status: string
  purchased_number?: string
  purchase_date?: string
  phone_number_sid?: string
  auto_provisioned?: boolean
  created_at: string
  updated_at: string
}

interface UploadedDocument {
  document_id: string
  file_path: string
  extracted_data: any
  status: string
}

interface CompanyPhoneData {
  status: string
  company_id: string
  phone_numbers: PhoneNumber[]
  total_count: number
}

interface CompanyBundlesData {
  status: string
  bundles: RegulatoryBundle[]
}

export function PhoneSetup({ companyId }: PhoneSetupProps) {
  const { t } = useLanguage()
  const [step, setStep] = useState<'loading' | 'checking' | 'setup' | 'business' | 'individual' | 'existing' | 'number-setup'>('loading')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Data state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [bundles, setBundles] = useState<RegulatoryBundle[]>([])
  const [selectedBundle, setSelectedBundle] = useState<BundleDetails | null>(null)
  const [hasExistingData, setHasExistingData] = useState(false)
  
  // Setup form state
  const [isoCountry, setIsoCountry] = useState('MX')
  const [numberType, setNumberType] = useState('')
  const [endUserType, setEndUserType] = useState('')
  
  // Business form state
  const [businessName, setBusinessName] = useState('')
  const [constanciaFile, setConstanciaFile] = useState<File | null>(null)
  const [addressProofFile, setAddressProofFile] = useState<File | null>(null)
  const [addressProofType, setAddressProofType] = useState('')
  
  // Existing number state
  const [existingPhoneNumber, setExistingPhoneNumber] = useState('')
  const [existingAccountSid, setExistingAccountSid] = useState('')
  const [existingAuthToken, setExistingAuthToken] = useState('')
  
  // Upload state
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [bundleResult, setBundleResult] = useState<RegulatoryBundle | null>(null)

  const numberTypes = [
    { value: 'local', label: 'Local' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'toll-free', label: 'Toll-Free' },
    { value: 'national', label: 'National' },
  ]

  const addressProofTypes = [
    { value: 'business_registration', label: 'Business registration showing local address' },
    { value: 'utility_bill', label: 'Recent utility bill (Recibo de agua, luz, predial)' },
    { value: 'government_communication', label: 'Recent government communication (SAT, IMSS, INFONAVIT)' },
  ]

  // Check for existing phone numbers and bundles
  useEffect(() => {
    checkExistingData()
  }, [companyId])

  const checkExistingData = async () => {
    setStep('checking')
    setError(null)

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        setStep('setup')
        return
      }

      const t0 = performance.now()
      // Check for existing phone numbers
      const phoneResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/phone-numbers/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      })
      const t1 = performance.now()
      const phoneData: CompanyPhoneData = await phoneResponse.json()
      console.log(`⏱️ checkExistingData phones fetch ms=${Math.round(t1 - t0)} parse ms=${Math.round(performance.now() - t1)}`)

      const b0 = performance.now()
      // Check for existing bundles
      const bundlesResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regulatory/bundles/company/${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      })
      const b1 = performance.now()
      const bundlesData: CompanyBundlesData = await bundlesResponse.json()
      console.log(`⏱️ checkExistingData bundles fetch ms=${Math.round(b1 - b0)} parse ms=${Math.round(performance.now() - b1)}`)

      const hasPhones = phoneData.total_count > 0
      const hasBundles = bundlesData.bundles.length > 0

      setPhoneNumbers(phoneData.phone_numbers || [])
      setBundles(bundlesData.bundles || [])
      setHasExistingData(hasPhones || hasBundles)

      if (hasPhones || hasBundles) {
        setStep('setup') // Show existing data with option to add new
      } else {
        setStep('setup') // Show setup options for new numbers
      }

    } catch (error) {
      console.error('Error checking existing data:', error)
      setError('Failed to load existing phone data')
      setStep('setup') // Fallback to setup
    }
  }

  const getBundleDetails = async (bundleSid: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regulatory/bundles/${bundleSid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      })
      const data = await response.json()
      setSelectedBundle(data.bundle)
    } catch (error) {
      console.error('Error fetching bundle details:', error)
      setError('Failed to load bundle details')
    }
  }

  const checkBundleStatus = async (bundleSid: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regulatory/bundles/${bundleSid}/check-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      })
      const data = await response.json()
      
      // Refresh the bundles list after status check
      await checkExistingData()
      
      setSuccess(`Bundle status updated: ${data.previous_status} → ${data.current_status}`)
    } catch (error) {
      console.error('Error checking bundle status:', error)
      setError('Failed to check bundle status')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'active':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSelection = (option: 'existing' | 'new') => {
    if (option === 'existing') {
      setStep('existing')
    } else {
      // Go directly to the number setup form
      setStep('number-setup')
    }
    setError(null)
  }

  const handleSetupSubmit = () => {
    if (!isoCountry || !numberType || !endUserType) {
      setError('Please fill in all required fields')
      return
    }

    if (endUserType === 'individual') {
      setStep('individual')
    } else {
      setStep('business')
    }
    setError(null)
  }

  const handleExistingSubmit = async () => {
    if (!existingPhoneNumber || !existingAccountSid || !existingAuthToken) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // TODO: Implement existing number connection
      console.log('Connecting existing number:', {
        phoneNumber: existingPhoneNumber,
        accountSid: existingAccountSid,
        companyId: companyId
      })
      
      setSuccess('Existing Twilio number connected successfully!')
      await checkExistingData() // Refresh data
      
    } catch (error) {
      console.error('Error connecting existing number:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (file: File, type: 'constancia' | 'address') => {
    if (type === 'constancia') {
      setConstanciaFile(file)
    } else {
      setAddressProofFile(file)
    }
  }

  const uploadDocument = async (file: File, documentType: string): Promise<UploadedDocument> => {
    // Get auth token
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      throw new Error('Authentication required')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
    formData.append('company_id', companyId)

    const t0 = performance.now()
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regulatory/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      },
      body: formData
    })
    console.log(`⏱️ uploadDocument fetch ms=${Math.round(performance.now() - t0)}`)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${errorText}`)
    }

    const t1 = performance.now()
    const result = await response.json()
    console.log(`⏱️ uploadDocument parse ms=${Math.round(performance.now() - t1)}`)
    return result
  }

  const createRegulatoryBundle = async (documents: UploadedDocument[]): Promise<RegulatoryBundle> => {
    // Get auth token and user data
    const { data: { session } } = await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()
    const token = session?.access_token
    const contactEmail = user?.email || ''

    if (!token) {
      throw new Error('Authentication required')
    }

    // Debug logging
    console.log('=== REGULATORY BUNDLE CREATE DEBUG ===')
    console.log('Company ID:', companyId)
    console.log('Business Name:', businessName)
    console.log('Contact Email:', contactEmail)
    console.log('ISO Country:', isoCountry)
    console.log('Number Type:', numberType)
    console.log('End User Type:', endUserType)
    console.log('Documents passed to function:', documents)
    console.log('Token available:', !!token)
    console.log('API URL:', `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regulatory/bundles/create`)

    const formData = new FormData()
    formData.append('company_id', companyId)
    formData.append('business_name', businessName)
    formData.append('contact_email', contactEmail)
    formData.append('iso_country', isoCountry)
    formData.append('number_type', numberType)
    formData.append('end_user_type', endUserType)
    
    // Use the documents passed as parameter instead of uploadedDocuments state
    documents.forEach(doc => {
      formData.append('document_ids', doc.document_id)
    })

    // Log FormData contents
    console.log('FormData entries:')
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value)
    }

    const t0 = performance.now()
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/regulatory/bundles/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true'
      },
      body: formData
    })
    const t1 = performance.now()
    console.log(`⏱️ createRegulatoryBundle fetch ms=${Math.round(t1 - t0)}`)

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('Error response body:', errorText)
      throw new Error(`Bundle creation failed: ${errorText}`)
    }

    const t2 = performance.now()
    const result = await response.json()
    console.log(`⏱️ createRegulatoryBundle parse ms=${Math.round(performance.now() - t2)}`)
    console.log('Success response:', result)
    return result
  }

  const handleBusinessSubmit = async () => {
    if (!businessName || !constanciaFile || !addressProofFile || !addressProofType) {
      setError('Please fill in all required fields and upload all documents')
      return
    }

    setLoading(true)
    setError(null)

    const tAll = performance.now()
    try {
      const c0 = performance.now()
      const constanciaDoc = await uploadDocument(constanciaFile, 'constancia_situacion_fiscal')
      console.log(`⏱️ constancia upload total ms=${Math.round(performance.now() - c0)}`)
      const a0 = performance.now()
      const addressDoc = await uploadDocument(addressProofFile, addressProofType)
      console.log(`⏱️ address upload total ms=${Math.round(performance.now() - a0)}`)
      
      const documents = [constanciaDoc, addressDoc]
      setUploadedDocuments(documents)

      const b0 = performance.now()
      const bundle = await createRegulatoryBundle(documents)
      console.log(`⏱️ bundle create total ms=${Math.round(performance.now() - b0)}`)
      setBundleResult(bundle)
      
      setSuccess('Regulatory bundle created successfully! Your phone number setup is being processed.')
      await checkExistingData() // Refresh data
      console.log(`⏱️ handleBusinessSubmit total ms=${Math.round(performance.now() - tAll)}`)
      
    } catch (error) {
      console.error('Error in business submission:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep('setup')
    setIsoCountry('MX')
    setNumberType('')
    setEndUserType('')
    setBusinessName('')
    setConstanciaFile(null)
    setAddressProofFile(null)
    setAddressProofType('')
    setExistingPhoneNumber('')
    setExistingAccountSid('')
    setExistingAuthToken('')
    setUploadedDocuments([])
    setBundleResult(null)
    setError(null)
    setSuccess(null)
  }

  if (step === 'loading' || step === 'checking') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Connect to Real Phone Number</h3>
            <p className="text-gray-600">Checking your existing phone numbers and bundles...</p>
          </div>
        </div>
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading your phone data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Connect to Real Phone Number</h3>
          <p className="text-gray-600">Manage your Twilio phone numbers and regulatory bundles</p>
        </div>
        <Button onClick={checkExistingData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Success Message */}
      {success && (
        <Card className="bg-green-50 border-green-200 border">
          <CardContent className="p-4">
            <div className="flex items-center text-green-800">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">{success}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="bg-red-50 border-red-200 border">
          <CardContent className="p-4">
            <div className="flex items-center text-red-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content with Tabs */}
      {step === 'setup' && (
        <Tabs defaultValue="existing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Numbers & Bundles</TabsTrigger>
            <TabsTrigger value="new">Setup New Number</TabsTrigger>
          </TabsList>

          {/* Existing Numbers & Bundles Tab */}
          <TabsContent value="existing" className="space-y-6">
            {hasExistingData ? (
              <>
                {/* Phone Numbers Section */}
                {phoneNumbers.length > 0 && (
                  <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Your Phone Numbers ({phoneNumbers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {phoneNumbers.map((phone, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Phone className="h-5 w-5 text-blue-600" />
                              <div>
                                <p className="font-medium">{phone.phone_number}</p>
                                <p className="text-sm text-gray-600">
                                  Source: {phone.source} • Status: {phone.status}
                                  {phone.is_primary && ' • Primary'}
                                </p>
                              </div>
                            </div>
                            <Badge className={getStatusColor(phone.status)}>
                              {phone.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bundles Section */}
                {bundles.length > 0 && (
                  <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Your Regulatory Bundles ({bundles.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {bundles.map((bundle, index) => (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <p className="font-medium">{bundle.business_name}</p>
                                <p className="text-sm text-gray-600">
                                  Bundle: {bundle.bundle_sid}
                                  {bundle.purchased_number && ` • Number: ${bundle.purchased_number}`}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge className={getStatusColor(bundle.status)}>
                                  {bundle.status}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => getBundleDetails(bundle.bundle_sid)}
                                >
                                  Details
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkBundleStatus(bundle.bundle_sid)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {bundle.purchase_date && (
                              <p className="text-sm text-gray-500">
                                Purchased: {new Date(bundle.purchase_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bundle Details Modal */}
                {selectedBundle && (
                  <Card className="bg-blue-50 border-blue-200 border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-800">
                        <FileText className="h-5 w-5" />
                        Bundle Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Business Name:</span>
                          <p className="text-gray-600">{selectedBundle.business_name}</p>
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>
                          <Badge className={getStatusColor(selectedBundle.status)}>
                            {selectedBundle.status}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Phone Number:</span>
                          <p className="text-gray-600">{selectedBundle.purchased_number || 'Not purchased yet'}</p>
                        </div>
                        <div>
                          <span className="font-medium">Country:</span>
                          <p className="text-gray-600">{selectedBundle.iso_country}</p>
                        </div>
                        <div>
                          <span className="font-medium">Number Type:</span>
                          <p className="text-gray-600">{selectedBundle.number_type}</p>
                        </div>
                        <div>
                          <span className="font-medium">End User Type:</span>
                          <p className="text-gray-600">{selectedBundle.end_user_type}</p>
                        </div>
                      </div>
                      <Button onClick={() => setSelectedBundle(null)} variant="outline" size="sm">
                        Close
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-gray-50 border-gray-200 border">
                <CardContent className="p-8 text-center">
                  <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Phone Numbers Found</h3>
                  <p className="text-gray-600 mb-4">
                    You don't have any phone numbers or regulatory bundles yet.
                  </p>
                  <Button onClick={() => setStep('setup')}>
                    Setup Your First Number
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Setup New Number Tab */}
          <TabsContent value="new" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Connect Existing Number */}
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => handleSelection('existing')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-5 w-5 text-blue-600" />
                    Connect Existing Twilio Number
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-600 text-sm">
                    Already have a Twilio phone number? Connect it to your account with your existing credentials.
                  </p>
                  <div className="flex items-center text-blue-600">
                    <span className="text-sm font-medium">Connect existing number</span>
                    <Link className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Option 2: Buy New Number */}
              <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => handleSelection('new')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-green-600" />
                    We Buy & Setup Twilio Number for You
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-600 text-sm">
                    Let us handle the entire process - from regulatory compliance to phone number purchase and setup.
                  </p>
                  <div className="flex items-center text-green-600">
                    <span className="text-sm font-medium">Buy new number</span>
                    <Plus className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Connect Existing Number Form */}
      {step === 'existing' && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Connect Existing Twilio Number
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number *</Label>
              <Input
                id="phone-number"
                value={existingPhoneNumber}
                onChange={(e) => setExistingPhoneNumber(e.target.value)}
                placeholder="+1234567890"
              />
              <p className="text-sm text-gray-500">Enter your existing Twilio phone number</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-sid">Account SID *</Label>
              <Input
                id="account-sid"
                value={existingAccountSid}
                onChange={(e) => setExistingAccountSid(e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-sm text-gray-500">Your Twilio Account SID</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-token">Auth Token *</Label>
              <Input
                id="auth-token"
                type="password"
                value={existingAuthToken}
                onChange={(e) => setExistingAuthToken(e.target.value)}
                placeholder="Your Twilio Auth Token"
              />
              <p className="text-sm text-gray-500">Your Twilio Auth Token (will be encrypted)</p>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={handleExistingSubmit}
                disabled={loading || !existingPhoneNumber || !existingAccountSid || !existingAuthToken}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect Number'
                )}
              </Button>
              <Button onClick={resetForm} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Number Setup Form */}
      {step === 'number-setup' && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Step 1: Choose Your Number Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* ISO Country */}
            <div className="space-y-2">
              <Label htmlFor="iso-country">Country (ISO)</Label>
              <Select value={isoCountry} onValueChange={setIsoCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MX">Mexico (MX) - Available</SelectItem>
                  <SelectItem value="US" disabled>United States (US) - Coming Soon</SelectItem>
                  <SelectItem value="CA" disabled>Canada (CA) - Coming Soon</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">Only Mexico is currently available</p>
            </div>

            {/* Number Type */}
            <div className="space-y-2">
              <Label htmlFor="number-type">Number Type</Label>
              <Select value={numberType} onValueChange={setNumberType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select number type" />
                </SelectTrigger>
                <SelectContent>
                  {numberTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End User Type */}
            <div className="space-y-2">
              <Label htmlFor="end-user-type">End User Type</Label>
              <RadioGroup value={endUserType} onValueChange={setEndUserType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="business" id="business" />
                  <Label htmlFor="business">Business (Negocio)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="individual" />
                  <Label htmlFor="individual">Individual (Individual)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={handleSetupSubmit}
                disabled={!isoCountry || !numberType || !endUserType}
                className="flex-1"
              >
                Continue
              </Button>
              <Button onClick={resetForm} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Flow Forms */}
      {step === 'business' && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Business Setup - Required Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name (Nombre del negocio) *</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter your business name"
              />
            </div>

            <div className="space-y-2">
              <Label>Proof of Identity *</Label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-medium mb-2">Constancia de Situación Fiscal con RFC</p>
                <p className="text-blue-700 text-sm mb-3">Upload your business registration document</p>
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'constancia')
                    }}
                    className="flex-1"
                  />
                  {constanciaFile && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      ✓ Uploaded
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Proof of Business Address *</Label>
              <div className="space-y-3">
                <RadioGroup value={addressProofType} onValueChange={setAddressProofType}>
                  {addressProofTypes.map(type => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={type.value} id={type.value} />
                      <Label htmlFor={type.value}>{type.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
                
                {addressProofType && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-700 text-sm mb-3">Upload your address proof document</p>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleFileUpload(file, 'address')
                        }}
                        className="flex-1"
                      />
                      {addressProofFile && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          ✓ Uploaded
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button 
                onClick={handleBusinessSubmit}
                disabled={loading || !businessName || !constanciaFile || !addressProofFile || !addressProofType}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Submit for Review'
                )}
              </Button>
              <Button onClick={resetForm} variant="outline">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'individual' && (
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Individual Setup - Coming Soon!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-800">
                Individual phone number setup is not yet available. We're working on implementing:
              </p>
              <ul className="list-disc list-inside mt-2 text-orange-700 space-y-1">
                <li>Proof of Identity with government-issued ID or passport</li>
                <li>Proof of local address with government-issued ID, utility bill, or government communication</li>
              </ul>
            </div>
            <Button onClick={resetForm} variant="outline" className="w-full">
              Go Back
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bundle Result */}
      {bundleResult && (
        <Card className="bg-green-50 border-green-200 border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              Bundle Created Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Bundle SID:</span>
                <p className="text-gray-600">{bundleResult.bundle_sid}</p>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {bundleResult.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 