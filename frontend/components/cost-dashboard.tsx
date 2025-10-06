"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, DollarSign, TrendingUp, Calendar, Activity } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { 
  getUserMonthlyCosts, 
  getUserUsageDetails,
  type UserCost,
  type UserUsage
} from "@/lib/models-api"

interface CostDashboardProps {
  companyId?: string
}

export function CostDashboard({ companyId }: CostDashboardProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [monthlyCosts, setMonthlyCosts] = useState<UserCost[]>([])
  const [recentUsage, setRecentUsage] = useState<UserUsage[]>([])

  useEffect(() => {
    if (user?.id) {
      loadCostData()
    }
  }, [user?.id])

  const loadCostData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      const [costsData, usageData] = await Promise.all([
        getUserMonthlyCosts(user.id),
        getUserUsageDetails(user.id, 20)
      ])

      setMonthlyCosts(costsData)
      setRecentUsage(usageData)
      
    } catch (err) {
      console.error("Error loading cost data:", err)
      setError("Failed to load cost information")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCurrentMonthCost = () => {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    return monthlyCosts.find(cost => cost.month_year === currentMonth)
  }

  const getTotalSpent = () => {
    return monthlyCosts.reduce((total, month) => total + month.total_cost_usd, 0)
  }

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-green-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading cost data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-red-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center text-red-600 mb-4">
            {error}
          </div>
          <Button 
            onClick={loadCostData} 
            className="w-full"
            variant="outline"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const currentMonthCost = getCurrentMonthCost()
  const totalSpent = getTotalSpent()

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Month */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Calendar className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-600">
              {currentMonthCost ? formatCurrency(currentMonthCost.total_cost_usd) : '$0.0000'}
            </div>
            {currentMonthCost && (
              <div className="text-xs text-gray-500 mt-1">
                TTS: {formatCurrency(currentMonthCost.tts_cost_usd)} • 
                STT: {formatCurrency(currentMonthCost.stt_cost_usd)} • 
                LLM: {formatCurrency(currentMonthCost.llm_cost_usd)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Spent */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-green-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <DollarSign className="h-4 w-4" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalSpent)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Across {monthlyCosts.length} months
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-purple-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-purple-600">
              {recentUsage.length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Usage events this month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-b border-gray-100/50 pb-6">
          <CardTitle className="flex items-center gap-3 text-gray-900">
            <div className="p-2 bg-gray-100 rounded-xl">
              <TrendingUp className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Usage & Costs</h3>
              <p className="text-sm text-gray-500 font-normal">Detailed breakdown of your AI usage</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="monthly" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
              <TabsTrigger value="usage">Recent Usage</TabsTrigger>
            </TabsList>
            
            <TabsContent value="monthly" className="space-y-4">
              {monthlyCosts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No cost data available yet. Start using your AI agent to see costs here.
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlyCosts.map((month) => (
                    <div 
                      key={month.month_year} 
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">
                          {new Date(month.month_year + '-01').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long'
                          })}
                        </h4>
                        <Badge variant="secondary" className="text-lg font-semibold">
                          {formatCurrency(month.total_cost_usd)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">TTS:</span>
                          <div className="font-medium">{formatCurrency(month.tts_cost_usd)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">STT:</span>
                          <div className="font-medium">{formatCurrency(month.stt_cost_usd)}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">LLM:</span>
                          <div className="font-medium">{formatCurrency(month.llm_cost_usd)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="usage" className="space-y-4">
              {recentUsage.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No usage data available yet. Start using your AI agent to see usage here.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentUsage.map((usage) => (
                    <div 
                      key={usage.id} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant={usage.models.type === 'tts' ? 'default' : usage.models.type === 'stt' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {usage.models.type.toUpperCase()}
                        </Badge>
                        <div>
                          <div className="text-sm font-medium">
                            {usage.usage_amount} {usage.models.unidad}
                          </div>
                          <div className="text-xs text-gray-500">
                            {usage.models.provider} - {usage.models.model_name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatCurrency(usage.cost_usd)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(usage.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
} 