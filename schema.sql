-- Database Schema for Cafe Loyalty PWA (PostgreSQL / Supabase)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Cafes Table
create table if not exists cafes (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text unique not null,
    owner_name text not null,
    email text unique not null,
    password text not null,
    address text not null,
    logo_url text,
    upi_id text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Coupons Table
create table if not exists coupons (
    id text primary key, -- Supporting both UUIDv4 strings and custom codes (e.g. c-123456)
    cafe_id uuid references cafes(id) on delete cascade not null,
    title text not null,
    desc_text text not null,
    badge_label text default 'Save',
    discount_type text not null, -- 'percent' or 'flat'
    discount_value numeric not null,
    frequency_per_day integer default 1,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Users Table
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    phone text unique not null,
    name text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Transactions Table
create table if not exists transactions (
    id uuid primary key default gen_random_uuid(),
    cafe_id uuid references cafes(id) on delete cascade not null,
    user_id uuid references users(id) on delete set null,
    coupon_id text references coupons(id) on delete set null,
    bill_amount numeric not null,
    discount_amount numeric not null,
    payable_amount numeric not null,
    status text default 'pending', -- 'pending', 'completed', 'cancelled'
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. OTP verification codes Table
create table if not exists otp_codes (
    phone text not null,
    code text not null,
    purpose text not null,
    expires_at timestamp with time zone not null,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexes for performance
create index if not exists idx_cafes_slug on cafes(slug);
create index if not exists idx_coupons_cafe_id on coupons(cafe_id);
create index if not exists idx_transactions_cafe_id on transactions(cafe_id);
create index if not exists idx_otp_codes_phone on otp_codes(phone);

-- Disable Row Level Security (RLS) so backend can insert/read data without complex JWT policies
alter table cafes disable row level security;
alter table coupons disable row level security;
alter table users disable row level security;
alter table transactions disable row level security;
alter table otp_codes disable row level security;
