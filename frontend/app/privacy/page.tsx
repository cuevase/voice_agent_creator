"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PulpooLogo } from "@/components/pulpoo-logo"
import { LanguageToggle } from "@/components/language-toggle"
import { ArrowLeft, Shield, Globe, Mail, MapPin } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import Link from "next/link"

export default function PrivacyPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Home
                </Button>
              </Link>
              <PulpooLogo size="md" />
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy & Terms of Service</h1>
            <p className="text-xl text-gray-600">Important information about our services and your rights</p>
          </div>

          {/* Privacy Policy */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Shield className="w-8 h-8 text-blue-600" />
                Privacy Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-gray-700">
              <p><strong>Last Updated:</strong> January 1st, 2024</p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Recent Updates:</strong> Added comprehensive cookie management system with GDPR compliance
              </p>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Information We Collect</h3>
                <h4 className="font-medium text-gray-900 mb-2">Personal Information</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>User Account Data:</strong> Email addresses, user IDs, authentication tokens</li>
                  <li>• <strong>Company Information:</strong> Company names, emails, business details</li>
                  <li>• <strong>Communication Data:</strong> Text messages, voice recordings (processed in real-time, not stored)</li>
                  <li>• <strong>Document Data:</strong> Uploaded PDFs, text files, and processed content</li>
                  <li>• <strong>Payment Information:</strong> Stripe account IDs and transaction data</li>
                  <li>• <strong>Session Data:</strong> Chat sessions, conversation history, session metadata</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Technical Information</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Device Information:</strong> Browser type, IP address, device identifiers</li>
                  <li>• <strong>Usage Data:</strong> Feature usage, interaction patterns, session duration</li>
                  <li>• <strong>Log Data:</strong> Server logs, error reports, performance metrics</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">2. How We Use Your Information</h3>
                <h4 className="font-medium text-gray-900 mb-2">Primary Uses</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Service Delivery:</strong> Provide AI voice agent services</li>
                  <li>• <strong>Account Management:</strong> User authentication and account administration</li>
                  <li>• <strong>Communication:</strong> Process and respond to voice messages</li>
                  <li>• <strong>File Processing:</strong> Upload and process documents (PDF, TXT, DOC, DOCX)</li>
                  <li>• <strong>Company Management:</strong> Create and manage business profiles</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">AI and Voice Processing</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Voice Processing:</strong> Real-time voice transcription and synthesis</li>
                  <li>• <strong>Document Analysis:</strong> Process uploaded documents for AI training</li>
                  <li>• <strong>Conversation Training:</strong> Train AI responses using conversation sessions</li>
                  <li>• <strong>WhatsApp Integration:</strong> Connect AI agent to WhatsApp messaging</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Third-Party Services</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-300 p-2 text-left">Service</th>
                        <th className="border border-gray-300 p-2 text-left">Purpose</th>
                        <th className="border border-gray-300 p-2 text-left">Data Shared</th>
                        <th className="border border-gray-300 p-2 text-left">Retention</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2"><strong>External AI Service</strong></td>
                        <td className="border border-gray-300 p-2">Voice transcription and synthesis</td>
                        <td className="border border-gray-300 p-2">Voice recordings (real-time only)</td>
                        <td className="border border-gray-300 p-2">Not stored</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2"><strong>External AI Service</strong></td>
                        <td className="border border-gray-300 p-2">Document processing and AI responses</td>
                        <td className="border border-gray-300 p-2">Document content and conversations</td>
                        <td className="border border-gray-300 p-2">30 days</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2"><strong>Twilio</strong></td>
                        <td className="border border-gray-300 p-2">WhatsApp integration</td>
                        <td className="border border-gray-300 p-2">Messages and phone numbers</td>
                        <td className="border border-gray-300 p-2">30 days</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2"><strong>Supabase</strong></td>
                        <td className="border border-gray-300 p-2">Data storage and authentication</td>
                        <td className="border border-gray-300 p-2">All user data</td>
                        <td className="border border-gray-300 p-2">Per retention policy</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Data Retention</h3>
                <h4 className="font-medium text-gray-900 mb-2">Standard Retention (Default)</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Conversations:</strong> 30 days</li>
                  <li>• <strong>Voice recordings:</strong> Not stored (processed in real-time)</li>
                  <li>• <strong>Documents:</strong> Until user deletion</li>
                  <li>• <strong>Session data:</strong> 30 days</li>
                  <li>• <strong>User accounts:</strong> Until deletion</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Extended Retention (Business Analytics)</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Conversations:</strong> Up to 1 year (with consent)</li>
                  <li>• <strong>Documents:</strong> Until deletion</li>
                  <li>• <strong>Training sessions:</strong> Until deletion</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Long-Term Storage (Enterprise)</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Conversations:</strong> Indefinite (with explicit consent)</li>
                  <li>• <strong>Documents:</strong> Until deletion</li>
                  <li>• <strong>Business data:</strong> Until account deletion</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Your Rights (GDPR Compliance)</h3>
                <h4 className="font-medium text-gray-900 mb-2">Right to Access</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Consent Status:</strong> View what you've consented to</li>
                  <li>• <strong>Account Information:</strong> Access your account and company data</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Right to Control</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Consent Management:</strong> Grant or withdraw consent anytime</li>
                  <li>• <strong>Account Deletion:</strong> Remove your account and all associated data</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Right to Object</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Processing Objection:</strong> Object to specific data processing</li>
                  <li>• <strong>Voice Recording:</strong> Opt out of voice recording features</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Consent Management</h3>
                <h4 className="font-medium text-gray-900 mb-2">Required Consents</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Voice Recording:</strong> Consent to voice transcription and synthesis</li>
                  <li>• <strong>File Processing:</strong> Consent to document analysis and processing</li>
                  <li>• <strong>AI Training:</strong> Consent to use conversations for AI improvement</li>
                  <li>• <strong>Age Verification:</strong> Consent to age verification (16+ requirement)</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">How to Manage Consent</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Update Settings:</strong> Modify consents in your account settings</li>
                  <li>• <strong>Withdraw Consent:</strong> Revoke any consent at any time</li>
                  <li>• <strong>Consent History:</strong> View your consent history and changes</li>
                </ul>
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h5 className="font-medium text-blue-900 mb-2">🍪 Cookie Management</h5>
                  <p className="text-sm text-blue-700 mb-3">
                    We use cookies to improve your experience, analyze site traffic, and personalize content. 
                    You have full control over which cookies you allow.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-3 rounded border">
                      <h6 className="font-medium text-gray-900 mb-2">Cookie Categories</h6>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li>• <strong>Essential:</strong> Required for website functionality</li>
                        <li>• <strong>Analytics:</strong> Help us understand website usage</li>
                        <li>• <strong>Marketing:</strong> Deliver personalized advertisements</li>
                        <li>• <strong>Third-party:</strong> External service integrations</li>
                      </ul>
                    </div>
                    
                    <div className="bg-white p-3 rounded border">
                      <h6 className="font-medium text-gray-900 mb-2">Management Options</h6>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li>• <strong>Cookie Banner:</strong> Appears on first visit</li>
                        <li>• <strong>Profile Settings:</strong> Manage in your account</li>
                        <li>• <strong>Detailed Preferences:</strong> Advanced cookie settings</li>
                        <li>• <strong>Revoke Consent:</strong> Disable all optional cookies</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link href="/cookie-preferences">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        Manage Cookie Preferences
                      </Button>
                    </Link>
                    <Link href="/cookie-policy">
                      <Button size="sm" variant="outline">
                        View Cookie Policy
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">6.5. Cookie Management & Control</h3>
                <h4 className="font-medium text-gray-900 mb-2">Cookie Categories</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Essential Cookies:</strong> Required for website functionality (always enabled)</li>
                  <li>• <strong>Analytics Cookies:</strong> Help us understand website usage and improve services</li>
                  <li>• <strong>Marketing Cookies:</strong> Deliver personalized advertisements and content</li>
                  <li>• <strong>Third-party Cookies:</strong> Enable external service integrations (AI providers, payment processors)</li>
                </ul>
                
                <h4 className="font-medium text-gray-900 mb-2">How to Manage Cookies</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Cookie Banner:</strong> Manage preferences when you first visit our website</li>
                  <li>• <strong>Profile Settings:</strong> Access cookie settings in your account privacy settings</li>
                  <li>• <strong>Detailed Preferences:</strong> Use our advanced cookie preferences page for granular control</li>
                  <li>• <strong>Browser Settings:</strong> Control cookies through your browser's privacy settings</li>
                  <li>• <strong>Revoke Consent:</strong> Disable all optional cookies at any time</li>
                </ul>
                
                <h4 className="font-medium text-gray-900 mb-2">GDPR Compliance</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>No Pre-ticked Boxes:</strong> Optional cookies are disabled by default</li>
                  <li>• <strong>Granular Control:</strong> Separate consent for each cookie category</li>
                  <li>• <strong>Easy Withdrawal:</strong> Revoke consent at any time</li>
                  <li>• <strong>Clear Information:</strong> Detailed explanations of cookie usage</li>
                  <li>• <strong>Consent History:</strong> Track when consent was given or modified</li>
                </ul>
                
                <h4 className="font-medium text-gray-900 mb-2">Cookie Policy</h4>
                <p className="ml-4 mb-4">
                  For detailed information about how we use cookies, including specific examples and duration, 
                  please visit our <Link href="/cookie-policy" className="text-blue-600 hover:underline">Cookie Policy page</Link>.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Data Security</h3>
                <h4 className="font-medium text-gray-900 mb-2">Security Measures</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Encryption:</strong> All data encrypted in transit and at rest</li>
                  <li>• <strong>Access Control:</strong> Row-level security and user-based access</li>
                  <li>• <strong>Authentication:</strong> Secure JWT-based authentication</li>
                  <li>• <strong>Audit Logging:</strong> Complete audit trail of data processing</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Data Protection</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Storage Security:</strong> Supabase with enterprise-grade security</li>
                  <li>• <strong>API Security:</strong> HTTPS-only communication</li>
                  <li>• <strong>Third-party Security:</strong> All third-party services are GDPR compliant</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">8. International Data Transfers</h3>
                <h4 className="font-medium text-gray-900 mb-2">Data Location</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Primary Storage:</strong> Supabase (EU/US)</li>
                  <li>• <strong>Processing:</strong> Various third-party services globally</li>
                  <li>• <strong>Compliance:</strong> All transfers comply with GDPR requirements</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Safeguards</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Standard Contractual Clauses:</strong> Where applicable</li>
                  <li>• <strong>Adequacy Decisions:</strong> For transfers to adequate countries</li>
                  <li>• <strong>Consent:</strong> For transfers requiring consent</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">9. Children's Privacy</h3>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Minimum Age:</strong> 16 years old (as per our Terms of Service)</li>
                  <li>• <strong>Age Verification:</strong> Required for all users during registration</li>
                  <li>• <strong>No Collection:</strong> We do not knowingly collect data from children under 16</li>
                  <li>• <strong>Parental Consent:</strong> May be required for users under 18 in certain jurisdictions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h3>
                <h4 className="font-medium text-gray-900 mb-2">Notification</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Email Notification:</strong> 30 days before changes</li>
                  <li>• <strong>In-App Notification:</strong> Prominent notice of changes</li>
                  <li>• <strong>Consent Renewal:</strong> May require renewed consent for new processing</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Version History</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Current Version:</strong> 1</li>
                  <li>• <strong>Previous Versions:</strong> Available upon request</li>
                  <li>• <strong>Change Log:</strong> Documented changes and rationale</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">11. Contact Information</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <span><strong>Email:</strong> efernandezsa7@gmail.com</span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span><strong>Address:</strong> 7000 Island Boulevard 2802 Aventura, FL33160 US</span>
                </div>
                <h4 className="font-medium text-gray-900 mb-2">Response Time</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Initial Response:</strong> Within 48 hours</li>
                  <li>• <strong>Full Response:</strong> Within 30 days</li>
                  <li>• <strong>Complaint Resolution:</strong> Within 60 days</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">12. Legal Basis</h3>
                <h4 className="font-medium text-gray-900 mb-2">Processing Legal Bases</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Consent:</strong> For AI training and extended retention</li>
                  <li>• <strong>Contract:</strong> For service delivery and account management</li>
                  <li>• <strong>Legitimate Interest:</strong> For business analytics and service improvement</li>
                  <li>• <strong>Legal Obligation:</strong> For regulatory compliance and fraud prevention</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Rights Exercise</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>No Fee:</strong> Free exercise of rights</li>
                  <li>• <strong>Response Time:</strong> 30 days for most requests</li>
                  <li>• <strong>Extension:</strong> Up to 60 days for complex requests</li>
                  <li>• <strong>Appeal:</strong> Right to appeal decisions</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Terms of Service */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Globe className="w-8 h-8 text-green-600" />
                Terms of Service
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-gray-700">
              <p><strong>Last Updated:</strong> August 1st, 2025</p>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h3>
                <p>By accessing or using our AI chatbot and voice agent services, you agree to be bound by these Terms of Service.</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Age Requirements and Eligibility</h3>
                <h4 className="font-medium text-gray-900 mb-2">Minimum Age Requirement</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Minimum Age:</strong> You must be at least 16 years old to use our services</li>
                  <li>• <strong>Age Verification:</strong> You must confirm your age during the registration process</li>
                  <li>• <strong>Truthful Declaration:</strong> You must provide accurate age information</li>
                  <li>• <strong>Parental Consent:</strong> Users under 18 may require parental consent in certain jurisdictions</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Age Verification Process</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Post-Login Verification:</strong> Age consent is collected immediately after successful login</li>
                  <li>• <strong>Mandatory Confirmation:</strong> You must check "I am 16 years or older" to proceed</li>
                  <li>• <strong>One-Time Process:</strong> Age verification is required only once per account</li>
                  <li>• <strong>Database Storage:</strong> Age consent is stored securely in our database</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Consequences of Non-Compliance</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Service Restriction:</strong> Users who cannot verify age will be redirected to home page</li>
                  <li>• <strong>Account Termination:</strong> False age declarations may result in account termination</li>
                  <li>• <strong>Legal Compliance:</strong> We reserve the right to verify age through additional means if necessary</li>
                  <li>• <strong>Data Protection:</strong> Age verification data is protected under our privacy policy</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Service Description</h3>
                <h4 className="font-medium text-gray-900 mb-2">What We Provide</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>AI Chatbot Services:</strong> Text-based AI conversation capabilities</li>
                  <li>• <strong>Voice Agent Services:</strong> Voice-to-text and text-to-voice processing</li>
                  <li>• <strong>Document Processing:</strong> AI-powered document analysis and processing</li>
                  <li>• <strong>Payment Processing:</strong> Secure payment handling through Stripe</li>
                  <li>• <strong>WhatsApp Integration:</strong> Messaging services via Twilio</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Service Limitations</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Voice Processing:</strong> Real-time only, no voice storage</li>
                  <li>• <strong>Document Processing:</strong> Limited to supported file types</li>
                  <li>• <strong>AI Responses:</strong> Based on provided training data and context</li>
                  <li>• <strong>Availability:</strong> 99.9% uptime target (excluding maintenance)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">4. User Responsibilities</h3>
                <h4 className="font-medium text-gray-900 mb-2">Account Security</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Password Protection:</strong> Maintain secure passwords</li>
                  <li>• <strong>Account Access:</strong> Don't share account credentials</li>
                  <li>• <strong>Unauthorized Use:</strong> Report suspicious activity immediately</li>
                  <li>• <strong>Session Management:</strong> Log out from shared devices</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Acceptable Use</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Legal Compliance:</strong> Use services only for legal purposes</li>
                  <li>• <strong>Content Standards:</strong> No harmful, offensive, or illegal content</li>
                  <li>• <strong>Service Integrity:</strong> Don't interfere with service operation</li>
                  <li>• <strong>Third-party Rights:</strong> Respect intellectual property rights</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Data Accuracy</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Truthful Information:</strong> Provide accurate account information</li>
                  <li>• <strong>Consent Accuracy:</strong> Ensure consent is freely given</li>
                  <li>• <strong>Update Information:</strong> Keep account information current</li>
                  <li>• <strong>Notification:</strong> Report data breaches or security issues</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Data Processing and Consent</h3>
                <h4 className="font-medium text-gray-900 mb-2">Consent Requirements</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Explicit Consent:</strong> Required for all data processing</li>
                  <li>• <strong>Granular Control:</strong> Separate consent for each processing type</li>
                  <li>• <strong>Withdrawal Rights:</strong> Can withdraw consent anytime</li>
                  <li>• <strong>Consent History:</strong> Maintained for audit purposes</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Processing Types</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Voice Recording:</strong> Real-time transcription and synthesis</li>
                  <li>• <strong>Document Processing:</strong> AI analysis of uploaded files</li>
                  <li>• <strong>Conversation Processing:</strong> AI training and improvement</li>
                  <li>• <strong>Payment Processing:</strong> Secure transaction handling</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Data Rights</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Access Rights:</strong> View and download your data</li>
                  <li>• <strong>Correction Rights:</strong> Update inaccurate information</li>
                  <li>• <strong>Deletion Rights:</strong> Remove all your data</li>
                  <li>• <strong>Portability Rights:</strong> Export data in standard format</li>
                </ul>
              </div>



              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Service Availability</h3>
                <h4 className="font-medium text-gray-900 mb-2">Uptime Commitment</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Target:</strong> 99.9% uptime</li>
                  <li>• <strong>Maintenance:</strong> Scheduled maintenance with notice</li>
                  <li>• <strong>Emergency:</strong> Emergency maintenance when necessary</li>
                  <li>• <strong>Compensation:</strong> Service credits for extended outages</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Service Limits</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Rate Limits:</strong> API rate limiting applies</li>
                  <li>• <strong>Storage Limits:</strong> Document storage limits per plan</li>
                  <li>• <strong>Processing Limits:</strong> AI processing limits per plan</li>
                  <li>• <strong>Concurrent Users:</strong> Limits based on plan</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">8. Intellectual Property</h3>
                <h4 className="font-medium text-gray-900 mb-2">Our Rights</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Service IP:</strong> We retain rights to our service</li>
                  <li>• <strong>AI Models:</strong> Rights to AI models and improvements</li>
                  <li>• <strong>Analytics:</strong> Rights to anonymized usage analytics</li>
                  <li>• <strong>Branding:</strong> Rights to our trademarks and branding</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Your Rights</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Your Content:</strong> You retain rights to your content</li>
                  <li>• <strong>Your Data:</strong> You own your data and conversations</li>
                  <li>• <strong>Export Rights:</strong> Right to export your data</li>
                  <li>• <strong>Deletion Rights:</strong> Right to delete your data</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">9. Limitation of Liability</h3>
                <h4 className="font-medium text-gray-900 mb-2">Service Limitations</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>AI Accuracy:</strong> AI responses are not guaranteed to be accurate</li>
                  <li>• <strong>Service Interruptions:</strong> Not liable for temporary outages</li>
                  <li>• <strong>Third-party Services:</strong> Not liable for third-party service issues</li>
                  <li>• <strong>Data Loss:</strong> Not liable for data loss due to user error</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Liability Caps</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Maximum Liability:</strong> Limited to service usage in last 12 months</li>
                  <li>• <strong>Indirect Damages:</strong> Not liable for indirect or consequential damages</li>
                  <li>• <strong>Force Majeure:</strong> Not liable for events beyond our control</li>
                  <li>• <strong>User Negligence:</strong> Not liable for damages due to user negligence</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">10. Termination</h3>
                <h4 className="font-medium text-gray-900 mb-2">Account Termination</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>User Initiated:</strong> Can delete account anytime</li>
                  <li>• <strong>Service Initiated:</strong> For terms violations or misuse</li>
                  <li>• <strong>Data Deletion:</strong> All data deleted upon termination</li>
                  <li>• <strong>Data Export:</strong> Export your data before deletion</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Post-Termination</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Data Retention:</strong> 30 days for legal compliance</li>
                  <li>• <strong>Export Rights:</strong> Right to export data before deletion</li>
                  <li>• <strong>Service Access:</strong> No access after termination</li>
                  <li>• <strong>Ongoing Obligations:</strong> Privacy obligations continue</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">11. Dispute Resolution</h3>
                <h4 className="font-medium text-gray-900 mb-2">Informal Resolution</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Direct Contact:</strong> Contact us first for issues</li>
                  <li>• <strong>Response Time:</strong> 30 days for initial response</li>
                  <li>• <strong>Mediation:</strong> Informal mediation if needed</li>
                  <li>• <strong>Escalation:</strong> Formal process if informal fails</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">12. Changes to Terms</h3>
                <h4 className="font-medium text-gray-900 mb-2">Notification</h4>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• <strong>Email Notice:</strong> 30 days before changes</li>
                  <li>• <strong>In-App Notice:</strong> Prominent in-app notification</li>
                  <li>• <strong>Consent Required:</strong> May require renewed consent</li>
                  <li>• <strong>Opt-out Rights:</strong> Right to terminate if changes unacceptable</li>
                </ul>
                <h4 className="font-medium text-gray-900 mb-2">Version Control</h4>
                <ul className="space-y-1 ml-4">
                  <li>• <strong>Current Version:</strong> 1</li>
                  <li>• <strong>Previous Versions:</strong> Available upon request</li>
                  <li>• <strong>Change Log:</strong> Documented changes and rationale</li>
                  <li>• <strong>Effective Date:</strong> Clear effective date for changes</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">13. Contact Information</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <span><strong>General Inquiries:</strong> team@pulpoo.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-600" />
                  <span><strong>Legal Inquiries:</strong> team@pulpoo.com</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 