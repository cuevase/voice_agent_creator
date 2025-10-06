import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const cookiePolicy = {
      last_updated: "2024-01-01",
      essential_cookies: {
        name: "Essential Cookies",
        description: "These cookies are necessary for the website to function properly. They enable basic functions like page navigation and access to secure areas of the website.",
        examples: ["Authentication cookies", "Session management", "Security cookies"],
        duration: "Session or up to 1 year"
      },
      analytics_cookies: {
        name: "Analytics Cookies",
        description: "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.",
        examples: ["Google Analytics", "Page view tracking", "User behavior analysis"],
        duration: "Up to 2 years"
      },
      marketing_cookies: {
        name: "Marketing Cookies",
        description: "These cookies are used to track visitors across websites to display relevant and engaging advertisements.",
        examples: ["Google Ads", "Facebook Pixel", "Retargeting cookies"],
        duration: "Up to 1 year"
      },
      third_party_cookies: {
        name: "Third-party Cookies",
        description: "These cookies are set by external services that we use to enhance our website functionality.",
        examples: ["Payment processors", "AI service providers", "Social media plugins"],
        duration: "Varies by service"
      }
    }

    return NextResponse.json({ cookie_policy: cookiePolicy })
  } catch (error) {
    console.error('Error fetching cookie policy:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 