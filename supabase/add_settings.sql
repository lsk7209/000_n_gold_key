
-- Create a settings table for system configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default mining mode (TURBO)
INSERT INTO settings (key, value)
VALUES ('mining_mode', '"TURBO"')
ON CONFLICT (key) DO NOTHING;
