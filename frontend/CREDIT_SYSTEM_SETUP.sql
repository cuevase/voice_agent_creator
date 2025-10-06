-- Credit System Database Setup
-- This script creates the necessary tables for the credit system

-- Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credits_balance INTEGER NOT NULL DEFAULT 0,
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund')),
    credits_amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and created_at for efficient queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Create credit_packages table
CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    credits_amount INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default credit packages
INSERT INTO credit_packages (name, credits_amount, price_cents, is_active) VALUES
    ('Starter', 100, 1000, true),
    ('Pro', 500, 5000, true),
    ('Enterprise', 1000, 10000, true)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_credits_updated_at 
    BEFORE UPDATE ON user_credits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_packages_updated_at 
    BEFORE UPDATE ON credit_packages 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create credit account for new users
CREATE OR REPLACE FUNCTION create_user_credit_account()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_credits (user_id, credits_balance, total_purchased, total_used)
    VALUES (NEW.id, 0, 0, 0);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to create credit account for new users
CREATE TRIGGER create_user_credit_account_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_credit_account();

-- Create function to update user credits after transaction
CREATE OR REPLACE FUNCTION update_user_credits_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type = 'purchase' THEN
        UPDATE user_credits 
        SET 
            credits_balance = credits_balance + NEW.credits_amount,
            total_purchased = total_purchased + NEW.credits_amount,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    ELSIF NEW.transaction_type = 'usage' THEN
        UPDATE user_credits 
        SET 
            credits_balance = credits_balance - NEW.credits_amount,
            total_used = total_used + NEW.credits_amount,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    ELSIF NEW.transaction_type = 'refund' THEN
        UPDATE user_credits 
        SET 
            credits_balance = credits_balance + NEW.credits_amount,
            total_used = total_used - NEW.credits_amount,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update user credits after transaction
CREATE TRIGGER update_user_credits_after_transaction_trigger
    AFTER INSERT ON credit_transactions
    FOR EACH ROW EXECUTE FUNCTION update_user_credits_after_transaction();

-- Create RLS policies for user_credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit balance" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit balance" ON user_credits
    FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON credit_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for credit_packages
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active credit packages" ON credit_packages
    FOR SELECT USING (is_active = true);

-- Create view for credit usage statistics
CREATE OR REPLACE VIEW credit_usage_stats AS
SELECT 
    user_id,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN transaction_type = 'purchase' THEN credits_amount ELSE 0 END) as total_purchased,
    SUM(CASE WHEN transaction_type = 'usage' THEN credits_amount ELSE 0 END) as total_used,
    SUM(CASE WHEN transaction_type = 'refund' THEN credits_amount ELSE 0 END) as total_refunded,
    MAX(created_at) as last_transaction_date
FROM credit_transactions
GROUP BY user_id;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON credit_transactions(user_id, transaction_type);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON user_credits TO authenticated;
GRANT SELECT, INSERT ON credit_transactions TO authenticated;
GRANT SELECT ON credit_packages TO authenticated;
GRANT SELECT ON credit_usage_stats TO authenticated;

-- Create function to check if user has enough credits
CREATE OR REPLACE FUNCTION has_enough_credits(
    p_user_id UUID,
    p_required_credits INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    SELECT credits_balance INTO current_balance
    FROM user_credits
    WHERE user_id = p_user_id;
    
    RETURN COALESCE(current_balance, 0) >= p_required_credits;
END;
$$ language 'plpgsql';

-- Create function to use credits
CREATE OR REPLACE FUNCTION use_credits(
    p_user_id UUID,
    p_credits_amount INTEGER,
    p_description TEXT,
    p_usage_type TEXT DEFAULT 'usage'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    -- Get current balance
    SELECT credits_balance INTO current_balance
    FROM user_credits
    WHERE user_id = p_user_id;
    
    -- Check if user has enough credits
    IF COALESCE(current_balance, 0) < p_credits_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Insert transaction record
    INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description, metadata)
    VALUES (p_user_id, p_usage_type, p_credits_amount, p_description, jsonb_build_object('usage_type', p_usage_type));
    
    RETURN TRUE;
END;
$$ language 'plpgsql';

-- Create function to add credits (purchase)
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_credits_amount INTEGER,
    p_description TEXT,
    p_package_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert transaction record
    INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description, metadata)
    VALUES (p_user_id, 'purchase', p_credits_amount, p_description, 
            CASE WHEN p_package_id IS NOT NULL 
                 THEN jsonb_build_object('package_id', p_package_id)
                 ELSE '{}'::jsonb
            END);
    
    RETURN TRUE;
END;
$$ language 'plpgsql'; 