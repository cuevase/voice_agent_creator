"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, CreditCard, ShoppingCart, History, TrendingUp, AlertCircle, CheckCircle } from "lucide-react"
import ShinyText from "./ShinyText"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { 
  getCreditBalance, 
  getCreditPackages, 
  createCreditCheckout,
  getCreditTransactions,
  type CreditBalance,
  type CreditPackage,
  type CreditTransaction
} from "@/lib/credits-api"

interface CreditDashboardProps {
  onPurchaseComplete?: () => void
}

export function CreditDashboard({ onPurchaseComplete }: CreditDashboardProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null)
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])

  useEffect(() => {
    if (user?.id) {
      loadCreditData()
    }
  }, [user?.id])

  const loadCreditData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      try {
        console.log('🔍 CreditDashboard: Loading credit data...')
        
        const [balanceData, packagesData, transactionsData] = await Promise.all([
          getCreditBalance(),
          getCreditPackages(),
          getCreditTransactions()
        ])

        console.log('🔍 CreditDashboard: Data loaded successfully:', {
          balance: balanceData,
          packages: packagesData,
          transactions: transactionsData
        })

        // Check if the data is actually valid (not empty/null)
        const hasValidBalance = balanceData && typeof balanceData.credits_balance === 'number'
        const hasValidPackages = packagesData && packagesData.packages && packagesData.packages.length > 0
        const hasValidTransactions = transactionsData && transactionsData.transactions

        console.log('🔍 CreditDashboard: Data validation:', {
          hasValidBalance,
          hasValidPackages,
          hasValidTransactions
        })

        if (hasValidBalance && hasValidPackages && hasValidTransactions) {
          // Use real data from backend
          setCreditBalance(balanceData)
          setCreditPackages(packagesData.packages)
          setTransactions(transactionsData.transactions)
        } else {
          // Use fallback demo data
          console.log('🔍 CreditDashboard: Using fallback demo data due to empty backend response')
          setCreditBalance({
            credits_balance: 0,
            total_purchased: 0,
            total_used: 0
          })
          setCreditPackages([
            {
              id: 'starter',
              name: 'Starter',
              credits_amount: 100,
              price_cents: 1000,
              is_active: true
            },
            {
              id: 'pro',
              name: 'Pro',
              credits_amount: 500,
              price_cents: 5000,
              is_active: true
            },
            {
              id: 'enterprise',
              name: 'Enterprise',
              credits_amount: 1000,
              price_cents: 10000,
              is_active: true
            }
          ])
          setTransactions([])
        }
      } catch (error) {
        // If any of the endpoints fail, set default data for demo
        console.warn('🔍 CreditDashboard: Credit system not fully implemented yet:', error)
        console.log('🔍 CreditDashboard: Using fallback demo data')
        setCreditBalance({
          credits_balance: 0,
          total_purchased: 0,
          total_used: 0
        })
        setCreditPackages([
          {
            id: 'starter',
            name: 'Starter',
            credits_amount: 100,
            price_cents: 1000,
            is_active: true
          },
          {
            id: 'pro',
            name: 'Pro',
            credits_amount: 500,
            price_cents: 5000,
            is_active: true
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            credits_amount: 1000,
            price_cents: 10000,
            is_active: true
          }
        ])
        setTransactions([])
      }
      
    } catch (err) {
      console.error("Error loading credit data:", err)
      
      // Check if it's a 404 error (endpoint doesn't exist yet)
      if (err instanceof Error && err.message.includes('404')) {
        setError("Credit system not yet implemented. Please contact support.")
      } else if (err instanceof Error && err.message.includes('500')) {
        setError("Backend error. Please try again later.")
      } else {
        setError("Failed to load credit information")
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (packageId: string) => {
    console.log('🔍 CreditDashboard: Purchase button clicked for package:', packageId)
    
    try {
      setPurchasing(packageId)
      setError(null)
      setSuccess(null)

      console.log('🔍 CreditDashboard: Calling createCreditCheckout...')
      
      const checkoutData = await createCreditCheckout(packageId)
      
      console.log('🔍 CreditDashboard: Checkout data received:', checkoutData)
      console.log('🔍 CreditDashboard: Redirecting to:', checkoutData.checkout_url)
      
      // Redirect to Stripe checkout
      window.location.href = checkoutData.checkout_url
      
      // Call the completion callback if provided
      if (onPurchaseComplete) {
        console.log('🔍 CreditDashboard: Calling onPurchaseComplete callback')
        onPurchaseComplete()
      }
      
    } catch (err) {
      console.error("🔍 CreditDashboard: Error creating checkout:", err)
      console.error("🔍 CreditDashboard: Error details:", {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      })
      setError(`Failed to create checkout session: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setPurchasing(null)
      console.log('🔍 CreditDashboard: Purchase process completed')
    }
  }

  const formatPrice = (priceCents: number) => {
    return `MXN $${(priceCents / 100).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ShoppingCart className="h-4 w-4 text-purple-600" />
      case 'usage':
        return <TrendingUp className="h-4 w-4 text-purple-600" />
      case 'refund':
        return <CheckCircle className="h-4 w-4 text-orange-600" />
      default:
        return <CreditCard className="h-4 w-4 text-gray-600" />
    }
  }

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'text-purple-600'
      case 'usage':
        return 'text-purple-600'
      case 'refund':
        return 'text-orange-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading credit information...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Credit Balance Card */}
                      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="bg-white/50 border-b border-gray-100/50 pb-6">
          <CardTitle className="flex items-center gap-3 text-gray-900">
                          <div className="p-2 bg-gray-100 rounded-xl">
                <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Credit Balance</h3>
              <p className="text-sm text-gray-500 font-normal">Manage your AI service credits</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {creditBalance && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">
                  <ShinyText 
                    text={creditBalance.credits_balance.toLocaleString()} 
                    disabled={false} 
                    speed={4} 
                    className="text-3xl font-bold"
                  />
                </div>
                <div className="text-sm text-gray-500">Available Credits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold">
                  <ShinyText 
                    text={creditBalance.total_purchased.toLocaleString()} 
                    disabled={false} 
                    speed={4} 
                    className="text-2xl font-semibold"
                  />
                </div>
                <div className="text-sm text-gray-500">Total Purchased</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold">
                  <ShinyText 
                    text={creditBalance.total_used.toLocaleString()} 
                    disabled={false} 
                    speed={4} 
                    className="text-2xl font-semibold"
                  />
                </div>
                <div className="text-sm text-gray-500">Total Used</div>
              </div>
            </div>
          )}

          {creditBalance && creditBalance.credits_balance < 10 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Low credit balance. Consider purchasing more credits to continue using AI services.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="packages" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="packages">Purchase Credits</TabsTrigger>
          <TabsTrigger value="history">Transaction History</TabsTrigger>
        </TabsList>

        {/* Credit Packages Tab */}
        <TabsContent value="packages" className="space-y-6">
          {(() => { console.log('🔍 CreditDashboard: Rendering packages tab, packages count:', creditPackages.length); return null; })()}
          <div className="text-xs text-gray-500">1 crédito equivale a un minuto de llamada</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {creditPackages.map((pkg) => (
              <Card key={pkg.id} className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    {pkg.name}
                  </CardTitle>
                  <div className="text-3xl font-bold">
                    <ShinyText 
                      text={pkg.credits_amount.toLocaleString()} 
                      disabled={false} 
                      speed={4} 
                      className="text-3xl font-bold"
                    />
                  </div>
                  <div className="text-sm text-gray-500">Credits</div>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <div className="text-2xl font-bold">
                    <ShinyText 
                      text={formatPrice(pkg.price_cents)} 
                      disabled={false} 
                      speed={4} 
                      className="text-2xl font-bold"
                    />
                  </div>
                  <div className="text-sm text-gray-500">
                    {`MXN $${(pkg.price_cents / 100 / pkg.credits_amount).toFixed(2)} por crédito`}
                  </div>
                  
                  <Button 
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchasing === pkg.id || !pkg.is_active}
                    className="w-full bg-white hover:bg-gray-50 text-purple-600 border-2 border-purple-600 hover:border-purple-700 hover:text-purple-700 transition-all duration-200"
                    size="lg"
                  >
                    {purchasing === pkg.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        <ShinyText 
                          text="Purchase" 
                          disabled={!pkg.is_active} 
                          speed={3} 
                          className="font-semibold"
                        />
                      </>
                    )}
                  </Button>

                  {!pkg.is_active && (
                    <Badge variant="secondary" className="w-full">
                      Coming Soon
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>


        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No transactions found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(transaction.transaction_type)}
                            <span className={`capitalize ${getTransactionColor(transaction.transaction_type)}`}>
                              {transaction.transaction_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {transaction.description}
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${transaction.transaction_type === 'purchase' ? 'text-purple-600' : 'text-red-600'}`}>
                            {transaction.transaction_type === 'purchase' ? '+' : '-'}{transaction.credits_amount}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {formatDate(transaction.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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

      {/* Success Message */}
      {success && (
        <Card className="bg-purple-50 border-purple-200 border">
          <CardContent className="p-4">
                          <div className="flex items-center text-purple-800">
              <CheckCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">{success}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 