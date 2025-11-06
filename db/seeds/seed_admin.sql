BEGIN;

-- Roles
INSERT INTO roles (role_name, description) VALUES
('admin', 'Admin role'),
('subadmin', 'Sub Admin role')
ON CONFLICT (role_name) DO NOTHING;

-- Permissions (extend as needed)
INSERT INTO permissions (permission_key, description) VALUES
('dashboard:read', 'Access admin dashboard'),
('analytics:read', 'Read analytics'),
('users:read', 'Read users'),
('users:write', 'Manage users'),
('roles:read', 'Read roles'),
('roles:write', 'Manage roles'),
('permissions:read', 'Read permissions'),
('permissions:write', 'Manage permissions'),
('settings:read', 'Read settings'),
('settings:write', 'Manage settings'),
('notifications:read', 'Read notifications'),
('notifications:write', 'Send/manage notifications'),
('holidays:read', 'Read holidays'),
('holidays:write', 'Manage holidays'),
('happyhours:read', 'Read happy hours'),
('happyhours:write', 'Manage happy hours'),
('attractions:read', 'Read attractions'),
('attractions:write', 'Manage attractions'),
('slots:read', 'Read slots'),
('slots:write', 'Manage slots'),
('bookings:read', 'Read bookings'),
('bookings:write', 'Manage bookings'),
('addons:read', 'Read addons'),
('addons:write', 'Manage addons'),
('combos:read', 'Read combos'),
('combos:write', 'Manage combos'),
('coupons:read', 'Read coupons'),
('coupons:write', 'Manage coupons'),
('offers:read', 'Read offers'),
('offers:write', 'Manage offers'),
('banners:read', 'Read banners'),
('banners:write', 'Manage banners'),
('pages:read', 'Read CMS pages'),
('pages:write', 'Manage CMS pages'),
('blogs:read', 'Read blogs'),
('blogs:write', 'Manage blogs')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant ALL permissions to admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.role_name) = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant a limited set to subadmin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON LOWER(p.permission_key) IN (
  'dashboard:read','analytics:read',
  'bookings:read','bookings:write',
  'notifications:read','notifications:write',
  'attractions:read','slots:read','slots:write'
)
WHERE LOWER(r.role_name) = 'subadmin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;