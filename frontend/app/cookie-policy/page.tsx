'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PulpooLogo } from "@/components/pulpoo-logo"
import { LanguageToggle } from "@/components/language-toggle"
import { ArrowLeft, Cookie, Shield, BarChart3, ShoppingCart, ExternalLink } from "lucide-react"
import Link from "next/link"

export default function CookiePolicyPage() {
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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Cookie Policy</h1>
            <p className="text-xl text-gray-600">How we use cookies to improve your experience</p>
            <p className="text-sm text-gray-500 mt-2">Last updated: January 1, 2024</p>
          </div>

          {/* What are Cookies */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Cookie className="w-8 h-8 text-orange-600" />
                What are Cookies?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <p>
                Cookies are small text files that are stored on your device when you visit our website. 
                They help us provide you with a better experience by remembering your preferences, 
                analyzing how you use our site, and personalizing content.
              </p>
              <p>
                We use cookies to make our website work properly, improve its functionality, 
                and provide you with relevant content and advertisements.
              </p>
            </CardContent>
          </Card>

          {/* Essential Cookies */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <Shield className="w-6 h-6 text-green-600" />
                Essential Cookies
              </CardTitle>
              <CardDescription>
                These cookies are necessary for the website to function properly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">What they do:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Enable basic functions like page navigation and access to secure areas</li>
                  <li>• Remember your login status and preferences</li>
                  <li>• Ensure the website loads properly and securely</li>
                  <li>• Prevent security threats and fraud</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Examples:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Authentication cookies (session management)</li>
                  <li>• Security cookies (CSRF protection)</li>
                  <li>• Load balancing cookies</li>
                  <li>• User interface customization cookies</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Duration:</h4>
                <p className="ml-4">Session or up to 1 year</p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  <strong>Note:</strong> These cookies cannot be disabled as they are essential for the website to function.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Cookies */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Analytics Cookies
              </CardTitle>
              <CardDescription>
                Help us understand how visitors use our website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">What they do:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Collect information about how you use our website</li>
                  <li>• Help us improve our services and user experience</li>
                  <li>• Identify which pages are most popular and least popular</li>
                  <li>• Understand how visitors navigate through our site</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Examples:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Google Analytics cookies</li>
                  <li>• Page view tracking</li>
                  <li>• User behavior analysis</li>
                  <li>• Performance monitoring</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Duration:</h4>
                <p className="ml-4">Up to 2 years</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> These cookies help us improve our website. You can disable them, 
                  but it may affect our ability to provide you with the best experience.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Marketing Cookies */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
                Marketing Cookies
              </CardTitle>
              <CardDescription>
                Used to deliver personalized advertisements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">What they do:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Track visitors across websites to display relevant ads</li>
                  <li>• Measure the effectiveness of our marketing campaigns</li>
                  <li>• Provide you with personalized content and offers</li>
                  <li>• Help us understand which advertisements are most effective</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Examples:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Google Ads cookies</li>
                  <li>• Facebook Pixel cookies</li>
                  <li>• Retargeting cookies</li>
                  <li>• Social media advertising cookies</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Duration:</h4>
                <p className="ml-4">Up to 1 year</p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-purple-800 text-sm">
                  <strong>Note:</strong> These cookies help us provide you with relevant content and offers. 
                  You can disable them if you prefer not to see personalized advertisements.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Third-party Cookies */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <ExternalLink className="w-6 h-6 text-gray-600" />
                Third-party Cookies
              </CardTitle>
              <CardDescription>
                Set by external services that enhance our website functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">What they do:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• Enable integration with external services</li>
                  <li>• Provide additional functionality and features</li>
                  <li>• Enable voice processing services</li>
                  <li>• Enable AI and voice processing services</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Examples:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• External AI service integration cookies</li>
                  <li>• OpenAI API integration cookies</li>
                  <li>• ElevenLabs voice processing cookies</li>
                  <li>• Social media plugin cookies</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Duration:</h4>
                <p className="ml-4">Varies by service</p>
              </div>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-gray-800 text-sm">
                  <strong>Note:</strong> These cookies are set by third-party services. 
                  You can disable them, but it may affect certain features of our website.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Managing Cookies */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Managing Your Cookie Preferences</CardTitle>
              <CardDescription>
                How to control and manage cookies on our website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Cookie Banner</h4>
                <p className="mb-2">
                  When you first visit our website, you'll see a cookie banner that allows you to:
                </p>
                <ul className="space-y-1 ml-4 mb-4">
                  <li>• Accept all cookies</li>
                  <li>• Accept only essential cookies</li>
                  <li>• Customize your preferences</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Cookie Preferences Page</h4>
                <p className="mb-2">
                  You can manage your cookie preferences at any time by visiting our cookie preferences page:
                </p>
                <div className="mt-4">
                  <Link href="/cookie-preferences">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Manage Cookie Preferences
                    </Button>
                  </Link>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Browser Settings</h4>
                <p className="mb-2">
                  You can also control cookies through your browser settings:
                </p>
                <ul className="space-y-1 ml-4">
                  <li>• Chrome: Settings → Privacy and security → Cookies and other site data</li>
                  <li>• Firefox: Options → Privacy & Security → Cookies and Site Data</li>
                  <li>• Safari: Preferences → Privacy → Manage Website Data</li>
                  <li>• Edge: Settings → Cookies and site permissions → Cookies and site data</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Updates to Policy */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Updates to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices 
                or for other operational, legal, or regulatory reasons.
              </p>
              <p>
                When we make changes, we will:
              </p>
              <ul className="space-y-1 ml-4">
                <li>• Update the "Last updated" date at the top of this policy</li>
                <li>• Notify you via email if you have an account with us</li>
                <li>• Display a notice on our website for significant changes</li>
                <li>• Provide you with the opportunity to review and accept new cookie preferences</li>
              </ul>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <p>
                If you have any questions about our use of cookies or this Cookie Policy, 
                please contact us:
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> team@pulpoo.com</p>
                <p><strong>Address:</strong> 7000 Island Boulevard 2802 Aventura, FL33160 US</p>
              </div>
              <div className="mt-4">
                <Link href="/privacy">
                  <Button variant="outline">
                    View Full Privacy Policy
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 