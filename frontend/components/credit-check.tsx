"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CreditCard, AlertCircle, ShoppingCart } from "lucide-react"
import { useCredits } from "@/hooks/use-credits"
import { CreditDashboard } from "./credit-dashboard"

interface CreditCheckProps {
  usageType: string
  amount: number
  onProceed: () => void
  onCancel: () => void
  children: React.ReactNode
  showPurchaseDialog?: boolean
}

export function CreditCheck({ 
  usageType, 
  amount, 
  onProceed, 
  onCancel, 
  children,
  showPurchaseDialog = true 
}: CreditCheckProps) {
  const { creditBalance, hasEnoughCredits, getRequiredCredits, loadBalance } = useCredits()
  const [showDialog, setShowDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadBalance()
  }, [loadBalance])

  const requiredCredits = getRequiredCredits(usageType as any, amount)
  const hasEnough = hasEnoughCredits(usageType as any, amount)

  const handleProceed = async () => {
    setLoading(true)
    try {
      await onProceed()
      setShowDialog(false)
    } catch (error) {
      console.error("Error proceeding with operation:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setShowDialog(false)
    onCancel()
  }

  const handlePurchaseClick = () => {
    setShowDialog(true)
  }

  if (!creditBalance) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
      </div>
    )
  }

  if (hasEnough) {
    return <>{children}</>
  }

  return (
    <div className="space-y-4">
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <div className="flex items-center justify-between">
            <span>
              Créditos insuficientes. Necesitas {requiredCredits} créditos para esta operación, pero tienes {creditBalance.credits_balance}.
            </span>
            {showPurchaseDialog && (
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="ml-2">
                    <ShoppingCart className="h-4 w-4 mr-1" />
                    Comprar Créditos
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Comprar Créditos
                    </DialogTitle>
                  </DialogHeader>
                  <CreditDashboard />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {creditBalance.credits_balance}
            </div>
            <div className="text-sm text-gray-500">Available</div>
          </div>
          <div className="text-gray-400">→</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {requiredCredits}
            </div>
            <div className="text-sm text-gray-500">Required</div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleCancel} 
            variant="outline"
            disabled={loading}
          >
            Cancel
          </Button>
          {showPurchaseDialog && (
            <Button 
              onClick={handlePurchaseClick}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Comprar Créditos
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// Credit usage display component
export function CreditUsageDisplay({ 
  usageType, 
  amount, 
  className = "" 
}: { 
  usageType: string
  amount: number
  className?: string 
}) {
  const { getRequiredCredits, creditBalance } = useCredits()
  const requiredCredits = getRequiredCredits(usageType as any, amount)

  if (!creditBalance) return null

  return (
    <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      <CreditCard className="h-4 w-4" />
      <span>{requiredCredits} credits</span>
      {creditBalance.credits_balance < requiredCredits && (
        <Badge variant="destructive" className="text-xs">
          Insufficient
        </Badge>
      )}
    </div>
  )
}

// Credit balance display component
export function CreditBalanceDisplay({ 
  compact = false,
  showPurchaseButton = true 
}: { 
  compact?: boolean
  showPurchaseButton?: boolean 
}) {
  const { creditBalance, loading } = useCredits()

  if (loading || !creditBalance) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <CreditCard className="h-4 w-4 text-blue-600" />
      <span className="font-medium">{creditBalance.credits_balance}</span>
      <span className="text-sm text-gray-500">credits</span>
      
      {creditBalance.credits_balance < 10 && (
        <Badge variant="destructive" className="text-xs">
          Low
        </Badge>
      )}
      
      {showPurchaseButton && (
        <Button size="sm" variant="outline" className="h-6 px-2">
          <ShoppingCart className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
} 