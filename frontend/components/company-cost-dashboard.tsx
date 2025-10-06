"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar, 
  Activity, 
  Users, 
  AlertTriangle,
  Shield,
  BarChart3,
  PieChart
} from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { 
  getCompanyCostSummary,
  getCompanyUsageDetails,
  getCompanyUsersWithCosts,
  getCompanyMonthlyCosts,
  isCompanyAdmin,
  type CompanyCostSummary,
  type CompanyUsage,
  type CompanyUserCost,
  type CompanyCost
} from "@/lib/company-costs-api"

interface CompanyCostDashboardProps {
  companyId: string
  companyName: string
}

export function CompanyCostDashboard({ companyId, companyName }: CompanyCostDashboardProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  
  const [costSummary, setCostSummary] = useState<CompanyCostSummary | null>(null)
  const [monthlyCosts, setMonthlyCosts] = useState<CompanyCost[]>([])
  const [recentUsage, setRecentUsage] = useState<CompanyUsage[]>([])
  const [userCosts, setUserCosts] = useState<CompanyUserCost[]>([])

  useEffect(() => {
    if (user?.id) {
      checkAccess()
    }
  }, [user?.id, companyId])

  const checkAccess = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // All company users can access company costs
      setIsAdmin(true)
      
      // Load all data
      await loadCompanyData()
      
    } catch (err) {
      console.error("Error loading company data:", err)
      setError("Failed to load company data")
    } finally {
      setLoading(false)
    }
  }

  const loadCompanyData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [summaryData, monthlyData, userCostsData] = await Promise.all([
        getCompanyCostSummary(companyId),
        getCompanyMonthlyCosts(companyId),
        getCompanyUsersWithCosts(companyId)
      ])

      setCostSummary(summaryData)
      setMonthlyCosts(monthlyData)
      setUserCosts(userCostsData)
      
      // Load usage data separately to handle potential errors
      try {
        const usageData = await getCompanyUsageDetails(companyId, 20)
        setRecentUsage(usageData)
      } catch (usageError) {
        console.error("Error loading usage data:", usageError)
        setRecentUsage([])
        // Don't fail the entire load if usage data fails
      }
      
    } catch (err) {
      console.error("Error loading company data:", err)
      setError(err instanceof Error ? err.message : "Failed to load company cost data")
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
    const currentMonth = new Date().toISOString().slice(0, 7)
    return monthlyCosts.find(m => m.month_year === currentMonth)?.total_cost_usd || 0
  }

  const getCostTrend = () => {
    if (monthlyCosts.length < 2) return 'stable'
    
    const currentMonth = new Date().toISOString().slice(0, 7)
    const currentIndex = monthlyCosts.findIndex(m => m.month_year === currentMonth)
    
    if (currentIndex === -1 || currentIndex === monthlyCosts.length - 1) return 'stable'
    
    const currentCost = monthlyCosts[currentIndex]?.total_cost_usd || 0
    const previousCost = monthlyCosts[currentIndex + 1]?.total_cost_usd || 0
    
    if (currentCost > previousCost) return 'up'
    if (currentCost < previousCost) return 'down'
    return 'stable'
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendText = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'Costs increasing'
      case 'down':
        return 'Costs decreasing'
      default:
        return 'Costs stable'
    }
  }

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading company cost data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-red-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button 
              onClick={checkAccess} 
              variant="outline"
              className="w-full"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }



  if (!costSummary) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No cost data available for this company yet.
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentMonthCost = getCurrentMonthCost()
  const costTrend = getCostTrend()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company Cost Dashboard</h2>
          <p className="text-gray-600">{companyName}</p>
        </div>
        <Button 
          onClick={loadCompanyData} 
          variant="outline"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Spent */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <DollarSign className="h-4 w-4" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(costSummary.total_cost_usd)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              All time
            </div>
          </CardContent>
        </Card>

        {/* Current Month */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-green-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Calendar className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(currentMonthCost)}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              {getTrendIcon(costTrend)}
              <span>{getTrendText(costTrend)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Users */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-purple-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-purple-600">
              {costSummary.total_users}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Company members
            </div>
          </CardContent>
        </Card>

        {/* Average Cost */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-orange-100/50 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Activity className="h-4 w-4" />
              Avg per User
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(costSummary.average_cost_per_user)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Per user average
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-gray-100/50 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-b border-gray-100/50 pb-6">
          <CardTitle className="flex items-center gap-3 text-gray-900">
            <div className="p-2 bg-gray-100 rounded-xl">
              <BarChart3 className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Company Analytics</h3>
              <p className="text-sm text-gray-500 font-normal">Detailed breakdown of company-wide costs and usage</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs defaultValue="monthly" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
              <TabsTrigger value="users">User Breakdown</TabsTrigger>
              <TabsTrigger value="usage">Recent Usage</TabsTrigger>
            </TabsList>
            
            <TabsContent value="monthly" className="space-y-4">
              {monthlyCosts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No monthly cost data available yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {monthlyCosts.map((month) => (
                    <div 
                      key={month.month_year} 
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {new Date(month.month_year + '-01').toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long'
                            })}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {month.active_users} active users
                          </p>
                        </div>
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
            
            <TabsContent value="users" className="space-y-4">
              {userCosts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No user cost data available yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Showing individual user costs across all months
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>TTS</TableHead>
                        <TableHead>STT</TableHead>
                        <TableHead>LLM</TableHead>
                        <TableHead>Usage Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userCosts.map((userCost) => (
                        <TableRow key={userCost.user_id}>
                          <TableCell className="font-medium">
                            {userCost.user_email}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(userCost.total_cost_usd)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(userCost.tts_cost_usd)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(userCost.stt_cost_usd)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(userCost.llm_cost_usd)}
                          </TableCell>
                          <TableCell>
                            {userCost.usage_count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="usage" className="space-y-4">
              {recentUsage.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No usage data available yet.
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
                          variant={usage.models?.type === 'tts' ? 'default' : usage.models?.type === 'stt' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {usage.models?.type?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        <div>
                          <div className="text-sm font-medium">
                            {usage.user_email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {usage.usage_amount} {usage.models?.unidad || 'units'} • {usage.models?.provider || 'Unknown'} - {usage.models?.model_name || 'Unknown Model'}
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