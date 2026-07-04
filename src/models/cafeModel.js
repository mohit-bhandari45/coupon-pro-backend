const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Helper to generate a UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Helper to create slug from cafe name
function slugify(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')     // Remove non-word chars except space and hyphen
        .replace(/[\s_]+/g, '-')       // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
}

class CafeModel {
    static async create({ name, owner_name, email, password, address }) {
        // Generate unique slug
        let slug = slugify(name);
        const existingSlug = await db.getCafeBySlug(slug);
        if (existingSlug) {
            // Append a small random string or number if slug conflicts
            slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Check if email already registered
        const existingEmail = await db.getCafeByEmail(email);
        if (existingEmail) {
            throw new Error('Email is already registered to a cafe');
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newCafe = {
            id: generateUUID(),
            name,
            slug,
            owner_name,
            email,
            password: hashedPassword,
            address,
            logo_url: null,
            upi_id: null,
            created_at: new Date().toISOString()
        };

        const savedCafe = await db.insertCafe(newCafe);

        // Seed 2 mock coupons for development/testing
        await db.insertCoupon({
            id: generateUUID(),
            cafe_id: newCafe.id,
            title: "10% off right now",
            desc_text: "Instant · Applied to this bill",
            badge_label: "Save",
            discount_type: "percent",
            discount_value: 10,
            frequency_per_day: 15,
            is_active: true,
            created_at: new Date().toISOString()
        });

        await db.insertCoupon({
            id: generateUUID(),
            cafe_id: newCafe.id,
            title: "Add Brownie for ₹49",
            desc_text: "Flat rate combos applied at counter",
            badge_label: "Combo",
            discount_type: "flat",
            discount_value: 49,
            frequency_per_day: 10,
            is_active: true,
            created_at: new Date().toISOString()
        });

        // Return saved cafe detail without password
        const { password: _, ...cafeWithoutPassword } = savedCafe;
        return cafeWithoutPassword;
    }

    static async findBySlug(slug) {
        const cafe = await db.getCafeBySlug(slug);
        if (!cafe) return null;
        const { password: _, ...cafeWithoutPassword } = cafe;
        return cafeWithoutPassword;
    }

    static async findByEmail(email) {
        const cafe = await db.getCafeByEmail(email);
        return cafe; // Return full cafe details (for password comparison in controller)
    }

    static async authenticate(email, password) {
        const cafe = await db.getCafeByEmail(email);
        if (!cafe) {
            throw new Error('Invalid email or password');
        }

        const isMatch = await bcrypt.compare(password, cafe.password);
        if (!isMatch) {
            throw new Error('Invalid email or password');
        }

        const { password: _, ...cafeWithoutPassword } = cafe;
        return cafeWithoutPassword;
    }
}

module.exports = CafeModel;
