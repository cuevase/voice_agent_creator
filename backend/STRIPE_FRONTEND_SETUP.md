# Stripe Frontend Integration Guide

## 🔑 Required Environment Variables

### Backend (.env)
```bash
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook secret for payment confirmation
```

### Frontend (.env)
```bash
NEXT_APP_STRIPE_PUBLISHABLE_KEY=already set up this
NEXT_PUBLIC_API_BASE_URL=already set up this
```

## 📦 Frontend Dependencies

Install Stripe React components:
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## 🎯 Frontend Implementation

### 1. Stripe Provider Setup (App.js/App.tsx)

```jsx
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT);

function App() {
  return (
    <Elements stripe={stripePromise}>
      {/* Your app components */}
    </Elements>
  );
}
```

### 2. Credit Packages Component

```jsx
import React, { useState, useEffect } from 'react';
import { useStripe } from '@stripe/react-stripe-js';

const CreditPackages = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const stripe = useStripe();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_APP_STRIPE_PUBLISHABLE_KEY}/api/credits/packages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setPackages(data.packages);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const handlePurchase = async (packageId) => {
    setLoading(true);
    try {
      // Create checkout session
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/credits/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ package_id: packageId })
      });

      const { checkout_url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = checkout_url;
      
    } catch (error) {
      console.error('Error creating checkout:', error);
      setLoading(false);
    }
  };

  return (
    <div className="credit-packages">
      <h2>Purchase Credits</h2>
      <div className="packages-grid">
        {packages.map((pkg) => (
          <div key={pkg.id} className="package-card">
            <h3>{pkg.name}</h3>
            <p className="credits">{pkg.credits_amount} Credits</p>
            <p className="price">${(pkg.price_cents / 100).toFixed(2)}</p>
            <button 
              onClick={() => handlePurchase(pkg.id)}
              disabled={loading}
              className="purchase-btn"
            >
              {loading ? 'Processing...' : 'Purchase'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreditPackages;
```

### 3. Credit Balance Component

```jsx
import React, { useState, useEffect } from 'react';

const CreditBalance = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/credits/balance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading balance...</div>;

  return (
    <div className="credit-balance">
      <h3>Your Credits</h3>
      <div className="balance-info">
        <p><strong>Available:</strong> {balance?.credits_balance || 0} credits</p>
        <p><strong>Total Purchased:</strong> {balance?.total_purchased || 0} credits</p>
        <p><strong>Total Used:</strong> {balance?.total_used || 0} credits</p>
      </div>
    </div>
  );
};

export default CreditBalance;
```

### 4. Transaction History Component

```jsx
import React, { useState, useEffect } from 'react';

const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/credits/transactions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTransactions(data.transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading transactions...</div>;

  return (
    <div className="transaction-history">
      <h3>Transaction History</h3>
      <div className="transactions-list">
        {transactions.map((tx) => (
          <div key={tx.id} className="transaction-item">
            <div className="transaction-info">
              <p className="description">{tx.description}</p>
              <p className="amount">{tx.credits_amount > 0 ? '+' : ''}{tx.credits_amount} credits</p>
              <p className="date">{new Date(tx.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionHistory;
```

### 5. Success/Cancel Pages

```jsx
// Success page (after payment)
const PaymentSuccess = () => {
  useEffect(() => {
    // Redirect back to main app after successful payment
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 3000);
  }, []);

  return (
    <div className="payment-success">
      <h2>Payment Successful! 🎉</h2>
      <p>Your credits have been added to your account.</p>
      <p>Redirecting to dashboard...</p>
    </div>
  );
};

// Cancel page (if payment cancelled)
const PaymentCancel = () => {
  return (
    <div className="payment-cancel">
      <h2>Payment Cancelled</h2>
      <p>Your payment was cancelled. No charges were made.</p>
      <button onClick={() => window.location.href = '/credits'}>
        Try Again
      </button>
    </div>
  );
};
```

## 🎨 CSS Styling Example

```css
.credit-packages {
  padding: 20px;
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.package-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.package-card h3 {
  color: #333;
  margin-bottom: 10px;
}

.package-card .credits {
  font-size: 24px;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 10px;
}

.package-card .price {
  font-size: 20px;
  color: #28a745;
  margin-bottom: 15px;
}

.purchase-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

.purchase-btn:hover {
  background: #0056b3;
}

.purchase-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.credit-balance {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.balance-info p {
  margin: 5px 0;
  font-size: 16px;
}

.transaction-history {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.transaction-item {
  border-bottom: 1px solid #eee;
  padding: 10px 0;
}

.transaction-item:last-child {
  border-bottom: none;
}

.transaction-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.transaction-info .amount {
  font-weight: bold;
  color: #28a745;
}

.transaction-info .amount.negative {
  color: #dc3545;
}
```

## 🔧 Backend Configuration Updates

### Update your main.py to include BASE_URL:

```python
# Add this to your environment variables
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")  # Your frontend URL
```

### Update success/cancel URLs in checkout endpoint:

```python
success_url=f"{BASE_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
cancel_url=f"{BASE_URL}/payment/cancel",
```

## 🚀 Deployment Checklist

1. **Environment Variables:**
   - ✅ `STRIPE_SECRET_KEY` (backend)
   - ✅ `STRIPE_WEBHOOK_SECRET` (backend)
   - ✅ `REACT_APP_STRIPE_PUBLISHABLE_KEY` (frontend)
   - ✅ `REACT_APP_BACKEND_URL` (frontend)

2. **Stripe Dashboard Setup:**
   - ✅ Create account at https://dashboard.stripe.com
   - ✅ Get publishable and secret keys
   - ✅ Set up webhook endpoint: `https://your-backend.com/api/credits/webhook`
   - ✅ Configure webhook events: `checkout.session.completed`

3. **Database:**
   - ✅ Run credit system SQL scripts
   - ✅ Insert credit packages

4. **Testing:**
   - ✅ Use Stripe test cards (4242 4242 4242 4242)
   - ✅ Test complete payment flow
   - ✅ Verify credits are added after payment

## 💳 Test Card Numbers

For testing, use these Stripe test cards:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Expiry:** Any future date
- **CVC:** Any 3 digits

## 🔍 Troubleshooting

**Common Issues:**
1. **"Invalid API key"** - Check your publishable key
2. **"Webhook signature verification failed"** - Verify webhook secret
3. **"Package not found"** - Ensure credit packages are inserted in database
4. **"Authentication required"** - Check JWT token in Authorization header 