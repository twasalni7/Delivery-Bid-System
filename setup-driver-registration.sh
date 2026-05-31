#!/bin/bash

# Driver Registration System - Database Setup Script
# This script applies the database schema for the driver registration feature

echo "=========================================="
echo "Driver Registration Database Setup"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$SUPABASE_DATABASE_URL" ] && [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: Database URL not set!"
    echo ""
    echo "Please set either SUPABASE_DATABASE_URL or DATABASE_URL:"
    echo "  export SUPABASE_DATABASE_URL='postgresql://user:pass@host:port/db'"
    echo "  # or"
    echo "  export DATABASE_URL='postgresql://user:pass@host:port/db'"
    echo ""
    exit 1
fi

echo "✅ Database URL is set"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    corepack pnpm install
    echo ""
fi

# Apply database schema using Drizzle
echo "🔄 Applying database schema changes..."
echo ""
echo "This will:"
echo "  - Add columns to 'drivers' table: password_hash, requires_password_reset, car_year, city"
echo "  - Create 'password_reset_tokens' table"
echo "  - Create 'driver_registration_requests' table"
echo "  - Create 'registration_request_status' enum"
echo ""

read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "Pushing schema to database..."
corepack pnpm --filter @workspace/db run push

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Database setup completed successfully!"
    echo "=========================================="
    echo ""
    echo "What's next:"
    echo "  1. New drivers can register at: /driver/register"
    echo "  2. Admins can review requests at: /admin/driver-registrations"
    echo "  3. Upon approval, drivers receive loginCode and temporary password"
    echo ""
else
    echo ""
    echo "❌ Database setup failed!"
    echo ""
    echo "If you prefer to apply changes manually, you can run:"
    echo "  cat migrations/add-driver-password-system.sql"
    echo ""
    exit 1
fi
