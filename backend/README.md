# Phone Number Provisioning Flow

## New Safer Flow (Option 2)

The phone number provisioning now follows a **two-step process** for better risk management:

### **Step 1: Bundle Submission**
Call `/twilio/numbers/provision` with all required information:
- Company details
- Address information  
- Supporting documents
- Regulatory requirements

**Response:**
```json
{
  "status": "bundle-submitted",
  "subaccount_sid": "AC...",
  "api_key_sid": "SK...", 
  "address_sid": "AD...",
  "bundle_sid": "BU...",
  "bundle_submitted": true,
  "message": "Bundle submitted for regulatory approval. Number will be purchased automatically upon approval."
}
```

### **Step 2: Automatic Number Purchase**
When Twilio approves the bundle, the system automatically:
1. Searches for available numbers
2. Purchases the first available number
3. Configures voice/SMS URLs
4. Sends notification (TODO: implement)

### **Status Checking**
Use `/twilio/bundle/{bundle_sid}/status` to check bundle status and get phone number details.

### **Benefits of This Approach:**
- ✅ **No wasted numbers**: Only purchase after approval
- ✅ **Regulatory compliance**: Wait for official approval
- ✅ **Automatic processing**: No manual intervention needed
- ✅ **Better error handling**: Clear status updates

### **Frontend Integration:**
1. Call `/twilio/numbers/provision` with user data
2. Show "Pending Approval" status to user
3. Optionally poll `/twilio/bundle/{bundle_sid}/status` for updates
4. Notify user when number is ready (via webhook or polling) 