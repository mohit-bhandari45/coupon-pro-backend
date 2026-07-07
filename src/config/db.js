const fs = require('fs');
const path = require('path');
const supabase = require('./supabase');

const DB_PATH = path.join(__dirname, '../../db.json');

// Check if Supabase parameters are set to proper, non-placeholder credentials
const useSupabase = process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes('your-project') &&
  process.env.SUPABASE_KEY &&
  !process.env.SUPABASE_KEY.includes('placeholder');

if (useSupabase) {
  console.log('⚡ [Database] Running on Supabase PostgreSQL remote engine.');
} else {
  console.log('📁 [Database] Running on local JSON file-based database (db.json) (Fallback active).');
}

// --- JSON FALLBACK STORAGE HELPERS ---
function initDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      cafes: [],
      users: [],
      coupons: [],
      transactions: [],
      otp_codes: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { cafes: [], users: [], coupons: [], transactions: [], otp_codes: [] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  useSupabase,
  // --- CAFES ---
  getAllCafes: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('cafes').select('*');
      if (error) throw error;
      return data || [];
    }
    return readDb().cafes;
  },

  getCafeById: async (id) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('cafes').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.cafes.find(c => c.id === id) || null;
  },

  getCafeBySlug: async (slug) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('cafes').select('*').eq('slug', slug).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.cafes.find(c => c.slug === slug) || null;
  },

  getCafeByEmail: async (email) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('cafes').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.cafes.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
  },

  insertCafe: async (cafe) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('cafes').insert(cafe).select().single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    db.cafes.push(cafe);
    writeDb(db);
    return cafe;
  },

  updateCafe: async (id, updates) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('cafes').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    const index = db.cafes.findIndex(c => c.id === id);
    if (index !== -1) {
      db.cafes[index] = { ...db.cafes[index], ...updates };
      writeDb(db);
      return db.cafes[index];
    }
    throw new Error('Cafe not found');
  },

  // --- USERS ---
  getAllUsers: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data || [];
    }
    return readDb().users;
  },

  getUserById: async (id) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.users.find(u => u.id === id) || null;
  },

  getUserByEmail: async (email) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  insertUser: async (user) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('users').insert(user).select().single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    db.users.push(user);
    writeDb(db);
    return user;
  },

  // --- COUPONS ---
  getAllCoupons: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('coupons').select('*');
      if (error) throw error;
      return data || [];
    }
    return readDb().coupons;
  },

  getCouponUseCount: async (couponId) => {
    let createdAt = null;
    if (useSupabase) {
      const { data: coupon, error: cErr } = await supabase.from('coupons').select('created_at').eq('id', couponId).maybeSingle();
      if (!cErr && coupon) createdAt = coupon.created_at;
    } else {
      const db = readDb();
      const coupon = db.coupons.find(c => c.id === couponId);
      if (coupon) createdAt = coupon.created_at;
    }

    if (useSupabase) {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', couponId);
      if (createdAt) {
        query = query.gte('created_at', createdAt);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    }
    const db = readDb();
    return db.transactions.filter(t => t.coupon_id === couponId && (!createdAt || new Date(t.created_at) >= new Date(createdAt))).length;
  },

  getCouponsByCafeId: async (cafeId, onlyActive = false, onlyPublic = false) => {
    let coupons = [];
    if (useSupabase) {
      let query = supabase.from('coupons').select('*').eq('cafe_id', cafeId);
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      if (onlyPublic) {
        query = query.eq('is_public', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      coupons = data || [];
    } else {
      const db = readDb();
      coupons = db.coupons.filter(c => c.cafe_id === cafeId &&
        (!onlyActive || c.is_active === true) &&
        (!onlyPublic || c.is_public !== false)
      );
    }

    const couponsWithRemaining = [];
    for (const coupon of coupons) {
      const useCount = await module.exports.getCouponUseCount(coupon.id);
      couponsWithRemaining.push({
        ...coupon,
        remaining_uses: Math.max(0, (coupon.max_uses ?? coupon.frequency_per_day) - useCount)
      });
    }
    return couponsWithRemaining;
  },

  getCouponById: async (id) => {
    let coupon = null;
    if (useSupabase) {
      const { data, error } = await supabase.from('coupons').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      coupon = data;
    } else {
      const db = readDb();
      coupon = db.coupons.find(c => c.id === id) || null;
    }

    if (coupon) {
      const useCount = await module.exports.getCouponUseCount(coupon.id);
      coupon.remaining_uses = Math.max(0, (coupon.max_uses ?? coupon.frequency_per_day) - useCount);
    }
    return coupon;
  },

  insertCoupon: async (coupon) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('coupons').insert(coupon).select().single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    db.coupons.push(coupon);
    writeDb(db);
    return coupon;
  },

  updateCoupon: async (id, updates) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('coupons').update(updates).eq('id', id).select().maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    const index = db.coupons.findIndex(c => c.id === id);
    if (index !== -1) {
      db.coupons[index] = { ...db.coupons[index], ...updates };
      writeDb(db);
      return db.coupons[index];
    }
    throw new Error('Coupon not found');
  },

  // --- TRANSACTIONS ---
  getAllTransactions: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('transactions').select('*');
      if (error) throw error;
      return data || [];
    }
    return readDb().transactions;
  },

  getTransactionsByCafeId: async (cafeId) => {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, users(name, email), coupons(title)')
        .eq('cafe_id', cafeId);
      if (error) throw error;
      return data || [];
    }
    const db = readDb();
    const txs = db.transactions.filter(t => t.cafe_id === cafeId);
    return txs.map(t => {
      const user = db.users.find(u => u.id === t.user_id);
      const coupon = db.coupons.find(c => c.id === t.coupon_id);
      return {
        ...t,
        users: user ? { name: user.name, email: user.email } : null,
        coupons: coupon ? { title: coupon.title } : null
      };
    });
  },

  getUserCouponRedemptionCount: async (userId) => {
    if (useSupabase) {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('coupon_id', 'is', null);
      if (error) throw error;
      return count || 0;
    }
    const db = readDb();
    return db.transactions.filter(t => t.user_id === userId && t.coupon_id !== null).length;
  },

  insertTransaction: async (txn) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('transactions').insert(txn).select().single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    db.transactions.push(txn);
    writeDb(db);
    return txn;
  },

  // --- OTP VERIFICATION ---
  getOtpCodes: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('otp_codes').select('*');
      if (error) throw error;
      return data || [];
    }
    return readDb().otp_codes;
  },

  insertOtpCode: async (otp) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('otp_codes').insert(otp).select().single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    db.otp_codes.push(otp);
    writeDb(db);
    return otp;
  },

  verifyAndUseOtpCode: async (email, code, purpose) => {
    if (useSupabase) {
      const nowStr = new Date().toISOString();
      const { data, error } = await supabase.from('otp_codes')
        .select('*')
        .eq('email', email)
        .eq('code', code)
        .eq('purpose', purpose)
        .gt('expires_at', nowStr)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const otp = data && data[0];
      if (otp) {
        // Consume the OTP
        await supabase.from('otp_codes')
          .delete()
          .eq('email', email)
          .eq('code', code)
          .eq('purpose', purpose);
        return otp;
      }
      return null;
    }

    const db = readDb();
    const index = db.otp_codes.findIndex(
      otp => otp.email === email &&
        otp.code === code &&
        otp.purpose === purpose &&
        new Date(otp.expires_at) > new Date()
    );
    if (index !== -1) {
      const usedOtp = db.otp_codes.splice(index, 1)[0];
      writeDb(db);
      return usedOtp;
    }
    return null;
  },

  getAdminById: async (id) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('admins').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.admins?.find(a => a.id === id) || null;
  },

  getAdminByEmail: async (email) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    return db.admins?.find(a => a.email === email) || null;
  },

  getRegisteredUsers: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    const db = readDb();
    return db.users || [];
  }
};
