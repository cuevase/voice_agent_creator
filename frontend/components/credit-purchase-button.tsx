"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CreditCard, ShoppingCart, Loader2 } from "lucide-react"
import { useCredits } from "@/hooks/use-credits"
import { CreditDashboard } from "./credit-dashboard"

interface CreditPurchaseButtonProps {
  compact?: boolean
  showBalance?: boolean
}

export function CreditPurchaseButton({ compact = false, showBalance = true }: CreditPurchaseButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  
  console.log('🔍 CreditPurchaseButton: Rendering component')
  
  try {
    const { creditBalance, loadBalance } = useCredits()
    console.log('🔍 CreditPurchaseButton: useCredits hook result:', { creditBalance, loadBalance: !!loadBalance })
    
    const handlePurchaseClick = () => {
      console.log('🔍 CreditPurchaseButton: Purchase button clicked')
      setShowDialog(true)
    }

    const handlePurchaseComplete = async () => {
      setPurchasing(true)
      try {
        await loadBalance()
        setShowDialog(false)
      } catch (error) {
        console.error('Error refreshing balance:', error)
      } finally {
        setPurchasing(false)
      }
    }

    const isLowBalance = creditBalance && creditBalance.credits_balance < 10
    console.log('🔍 CreditPurchaseButton: isLowBalance:', isLowBalance)

    if (compact) {
      return (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
                      <Button 
            variant="outline" 
            size="sm"
            className="relative"
            onClick={handlePurchaseClick}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            <span>Buy Credits</span>
            {showBalance && creditBalance && (
              <Badge variant="secondary" className="ml-2">
                {creditBalance.credits_balance}
              </Badge>
            )}
            {isLowBalance && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                !
              </Badge>
            )}
          </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Purchase Credits
              </DialogTitle>
            </DialogHeader>
            <CreditDashboard onPurchaseComplete={handlePurchaseComplete} />
          </DialogContent>
        </Dialog>
      )
    }

    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button 
            variant="outline"
            onClick={handlePurchaseClick}
            className="relative"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            <span>Buy Credits</span>
            {showBalance && creditBalance && (
              <Badge variant="secondary" className="ml-2">
                {creditBalance.credits_balance}
              </Badge>
            )}
            {isLowBalance && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                !
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Purchase Credits
            </DialogTitle>
          </DialogHeader>
          <CreditDashboard onPurchaseComplete={handlePurchaseComplete} />
        </DialogContent>
      </Dialog>
    )
  } catch (error) {
    console.error('🔍 CreditPurchaseButton: Error in useCredits hook:', error)
    // Fallback UI if the hook fails
    return (
      <Button 
        variant="outline" 
        size="sm"
        disabled
        className="opacity-50"
      >
        <CreditCard className="h-4 w-4 mr-1" />
        Credits
      </Button>
    )
  }
} 