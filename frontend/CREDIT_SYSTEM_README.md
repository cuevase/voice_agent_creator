# Credit System Implementation

## 🚀 **Complete Credit System for AI Services**

This implementation provides a comprehensive credit system for managing AI service usage with Stripe integration, real-time balance tracking, and seamless user experience.

## 📋 **What's Implemented**

### ✅ **Frontend Components**
- **Credit Dashboard**: Complete credit management interface
- **Credit Balance Display**: Compact balance widget for headers/sidebars
- **Credit Check Component**: Pre-operation credit validation
- **Purchase Flow**: Stripe checkout integration
- **Transaction History**: Complete audit trail

### ✅ **Backend Integration**
- **Credit API**: All CRUD operations for credits
- **Stripe Integration**: Secure payment processing
- **Database Schema**: Complete PostgreSQL setup
- **Credit Usage Hooks**: React hooks for credit management

### ✅ **Features**
- **Real-time Balance**: Live credit balance updates
- **Purchase Packages**: Starter, Pro, Enterprise tiers
- **Usage Tracking**: Per-service credit consumption
- **Low Balance Alerts**: Automatic warnings
- **Transaction History**: Complete audit trail

## 🛠 **Setup Instructions**

### **1. Database Setup**

Run the SQL script to create the credit system tables:

```bash
# Execute the SQL script in your Supabase database
psql -h your-supabase-host -U your-username -d your-database -f CREDIT_SYSTEM_SETUP.sql
```

Or run it in the Supabase SQL editor.

### **2. Environment Variables**

Add these to your `.env.local`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# API Base URL
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
```

### **3. Backend API Endpoints**

Your backend needs these endpoints:

```python
# GET /api/credits/balance
# POST /api/credits/checkout
# POST /api/credits/use
# GET /api/credits/packages
# GET /api/credits/transactions
# POST /api/credits/webhook (Stripe webhook)
```

### **4. Stripe Configuration**

1. **Create Stripe Account**: Sign up at [stripe.com](https://stripe.com)
2. **Get API Keys**: From Stripe Dashboard → Developers → API Keys
3. **Set Webhook**: 
   - URL: `https://your-backend.com/api/credits/webhook`
   - Events: `checkout.session.completed`

## 💳 **Credit Packages**

| Package | Credits | Price | Price per Credit |
|---------|---------|-------|------------------|
| Starter | 100 | $10.00 | $0.10 |
| Pro | 500 | $50.00 | $0.10 |
| Enterprise | 1000 | $100.00 | $0.10 |

## 💰 **Credit Usage Costs**

| Service | Cost | Description |
|---------|------|-------------|
| Voice Call | 1 credit/minute | Per minute of voice conversation |
| SMS | 1 credit/message | Per SMS message sent |
| WhatsApp | 1 credit/message | Per WhatsApp message |
| AI Response | 2 credits/response | Per AI-generated response |
| GPT-4 | 60 credits/1K tokens | Per 1000 tokens used |
| GPT-3.5 | 2 credits/1K tokens | Per 1000 tokens used |
| Gemini Pro | 1 credit/1K tokens | Per 1000 tokens used |
| Claude | 2 credits/1K tokens | Per 1000 tokens used |
| Document Upload | 5 credits/document | Per document processed |
| Bundle Creation | 50 credits/bundle | Per regulatory bundle |
| Phone Number | 100 credits/number | Per phone number purchase |

## 🎯 **Usage Examples**

### **Credit Check Before Operation**
```tsx
import { CreditCheck } from "@/components/credit-check"

<CreditCheck 
  usageType="voice_call" 
  amount={5} 
  onProceed={handleVoiceCall}
  onCancel={handleCancel}
>
  <VoiceCallComponent />
</CreditCheck>
```

### **Credit Balance Display**
```tsx
import { CreditBalanceDisplay } from "@/components/credit-check"

<CreditBalanceDisplay compact={true} />
```

### **Using Credits Hook**
```tsx
import { useCredits } from "@/hooks/use-credits"

const { useVoiceCallCredits, hasEnoughCredits } = useCredits()

if (hasEnoughCredits('voice_call', 5)) {
  await useVoiceCallCredits(5)
  // Proceed with voice call
}
```

## 🔧 **Integration Points**

### **Voice Agent Integration**
```tsx
// In your voice agent component
const { useVoiceCallCredits, hasEnoughCredits } = useCredits()

const handleVoiceCall = async () => {
  if (!hasEnoughCredits('voice_call', 1)) {
    setError('Insufficient credits for voice call')
    return
  }
  
  try {
    await useVoiceCallCredits(1)
    // Proceed with voice call
  } catch (error) {
    console.error('Credit usage failed:', error)
  }
}
```

### **Document Upload Integration**
```tsx
// In your document upload component
const { useDocumentUploadCredits } = useCredits()

const handleDocumentUpload = async (file: File) => {
  try {
    await useDocumentUploadCredits('pdf')
    // Proceed with upload
  } catch (error) {
    console.error('Credit usage failed:', error)
  }
}
```

### **Bundle Creation Integration**
```tsx
// In your phone setup component
const { useBundleCreationCredits } = useCredits()

const handleBundleCreation = async () => {
  try {
    await useBundleCreationCredits('regulatory')
    // Proceed with bundle creation
  } catch (error) {
    console.error('Credit usage failed:', error)
  }
}
```

## 🎨 **UI Components**

### **Credit Dashboard**
- **Balance Display**: Current credits, total purchased, total used
- **Purchase Packages**: Stripe checkout integration
- **Transaction History**: Complete audit trail
- **Usage Guide**: Service cost breakdown

### **Credit Balance Widget**
- **Compact Mode**: For headers/sidebars
- **Low Balance Alerts**: Automatic warnings
- **Purchase Button**: Quick access to buy credits

### **Credit Check Component**
- **Pre-operation Validation**: Check credits before expensive operations
- **Insufficient Credit Handling**: Clear error messages
- **Purchase Integration**: Direct access to buy credits

## 🔒 **Security Features**

- **Row Level Security**: Database-level access control
- **Authentication Required**: All endpoints require valid tokens
- **Stripe Security**: PCI-compliant payment processing
- **Audit Trail**: Complete transaction logging
- **Atomic Operations**: Credit deductions are atomic

## 📊 **Monitoring & Analytics**

### **Credit Usage Dashboard**
- Track consumption by service type
- Monitor user spending patterns
- Identify high-usage customers
- Generate usage reports

### **Transaction Logs**
- All credit transactions logged
- Audit trail for compliance
- Support for refunds and adjustments
- Export functionality

## 🚀 **Deployment Checklist**

### **Frontend**
- [ ] Add credit dashboard to sidebar
- [ ] Integrate credit checks in voice agent
- [ ] Add credit balance to header
- [ ] Test purchase flow
- [ ] Verify transaction history

### **Backend**
- [ ] Implement credit API endpoints
- [ ] Set up Stripe webhook
- [ ] Configure database triggers
- [ ] Test credit usage functions
- [ ] Monitor webhook events

### **Database**
- [ ] Run SQL setup script
- [ ] Verify RLS policies
- [ ] Test credit functions
- [ ] Monitor transaction logs

## 🎯 **Next Steps**

1. **Backend Implementation**: Implement the credit API endpoints
2. **Stripe Setup**: Configure Stripe account and webhooks
3. **Integration Testing**: Test credit flow end-to-end
4. **User Testing**: Gather feedback on credit system
5. **Monitoring**: Set up alerts for low balances

## 📞 **Support**

For questions or issues:
1. Check the database logs for transaction errors
2. Verify Stripe webhook configuration
3. Test credit balance calculations
4. Review transaction history for discrepancies

---

**🎉 The credit system is now ready for integration!** 

Users can purchase credits, track usage, and manage their AI service consumption seamlessly. 