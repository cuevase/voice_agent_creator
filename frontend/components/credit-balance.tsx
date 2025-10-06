"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Plus, AlertCircle } from "lucide-react"
import ShinyText from "./ShinyText"
import { getCreditBalance, type CreditBalance } from "@/lib/credits-api"

interface CreditBalanceProps {
  compact?: boolean
  showPurchaseButton?: boolean
}

export function CreditBalance({ compact = false, showPurchaseButton = true }: CreditBalanceProps) {
  const [loading, setLoading] = useState(true)
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCreditBalance()
  }, [])

  const loadCreditBalance = async () => {
    try {
      setLoading(true)
      setError(null)
      const balance = await getCreditBalance()
      setCreditBalance(balance)
    } catch (err) {
      console.error("Error loading credit balance:", err)
      setError("Failed to load credit balance")
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseClick = () => {
    // Navigate to credit dashboard or open purchase modal
    window.location.href = '/dashboard?tab=credits'
  }

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className={`p-4 ${compact ? 'py-2' : ''}`}>
          <div className="flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !creditBalance) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className={`p-4 ${compact ? 'py-2' : ''}`}>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error cargando créditos</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isLowBalance = creditBalance.credits_balance < 10

  if (compact) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  <ShinyText 
                    text={creditBalance.credits_balance.toLocaleString()} 
                    disabled={false} 
                    speed={3} 
                    className="text-sm font-medium"
                  />
                </div>
                <div className="text-xs text-gray-500">Créditos</div>
              </div>
            </div>
            
            {isLowBalance && (
              <Badge variant="destructive" className="text-xs">
                Low
              </Badge>
            )}
            
            {showPurchaseButton && (
              <Button 
                onClick={handlePurchaseClick}
                size="sm" 
                className="h-6 px-2 bg-white hover:bg-gray-50 text-purple-600 border-2 border-purple-600 hover:border-purple-700 hover:text-purple-700 transition-all duration-200"
              >
                <Plus className="h-3 w-3" />
                <ShinyText 
                  text="+" 
                  disabled={false} 
                  speed={2} 
                  className="text-xs font-bold"
                />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
                          <div>
                <div className="text-lg font-bold">
                  <ShinyText 
                    text={creditBalance.credits_balance.toLocaleString()} 
                    disabled={false} 
                    speed={4} 
                    className="text-lg font-bold"
                  />
                </div>
                <div className="text-sm text-gray-500">Créditos Disponibles</div>
              </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isLowBalance && (
              <Badge variant="destructive" className="text-xs">
                Bajo
              </Badge>
            )}
            
            {showPurchaseButton && (
              <Button 
                onClick={handlePurchaseClick}
                size="sm"
                className="bg-white hover:bg-gray-50 text-purple-600 border-2 border-purple-600 hover:border-purple-700 hover:text-purple-700 transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-1" />
                <ShinyText 
                  text="Comprar Créditos" 
                  disabled={false} 
                  speed={3} 
                  className="font-semibold"
                />
              </Button>
            )}
          </div>
        </div>
        
        {isLowBalance && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Saldo de créditos bajo. Considera comprar más créditos.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 