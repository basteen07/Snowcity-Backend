BEGIN;

-- Sample users (dev only). Password hashes are placeholders for demo.
INSERT INTO users (name, email, phone, password_hash, otp_verified)
VALUES
('Alice', 'alice@example.com', '+10000000001', '$2a$10$abcdefghijklmnopqrstuvCDEFGHIJKLMNOPQRSTUV123456', TRUE),
('Bob', 'bob@example.com', '+10000000002', '$2a$10$abcdefghijklmnopqrstuvCDEFGHIJKLMNOPQRSTUV123456', TRUE),
('Charlie', 'charlie@example.com', '+10000000003', '$2a$10$abcdefghijklmnopqrstuvCDEFGHIJKLMNOPQRSTUV123456', TRUE)
ON CONFLICT (email) DO NOTHING;

COMMIT;