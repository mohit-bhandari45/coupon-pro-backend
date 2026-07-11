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
  supabase,
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

  deductUserWalletBalance: async (userId, amount) => {
    const balance = parseFloat(amount || 0);
    if (balance <= 0) return;
    if (useSupabase) {
      const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (fetchError || !user) throw new Error('User not found');
      const newBal = Math.max(0, parseFloat(user.wallet_balance || 0) - balance);
      const { data, error } = await supabase
        .from('users')
        .update({ wallet_balance: newBal })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      db.users[userIndex].wallet_balance = Math.max(0, parseFloat(db.users[userIndex].wallet_balance || 0) - balance);
      writeDb(db);
      return db.users[userIndex];
    }
    throw new Error('User not found');
  },

  incrementUserWalletBalance: async (userId, amount) => {
    const balance = parseFloat(amount || 0);
    if (balance <= 0) return;
    if (useSupabase) {
      const { data: user, error: fetchError } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (fetchError || !user) throw new Error('User not found');
      const newBal = parseFloat(user.wallet_balance || 0) + balance;
      const { data, error } = await supabase
        .from('users')
        .update({ wallet_balance: newBal })
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const db = readDb();
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      db.users[userIndex].wallet_balance = parseFloat(db.users[userIndex].wallet_balance || 0) + balance;
      writeDb(db);
      return db.users[userIndex];
    }
    throw new Error('User not found');
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
      const { data, error } = await supabase.from('coupons').select('*').ilike('id', id).maybeSingle();
      if (error) throw error;
      coupon = data;
    } else {
      const db = readDb();
      coupon = db.coupons.find(c => c.id.toLowerCase() === id.toLowerCase()) || null;
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
    return (db.transactions || []).filter(t => t.user_id === userId && t.coupon_id !== null).length;
  },

  getCafeCustomerMetrics: async (cafeId) => {
    const transactions = await module.exports.getTransactionsByCafeId(cafeId);
    const userTxns = (transactions || []).filter(t => t.user_id);

    // Sort chronologically
    userTxns.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const seenUsers = new Set();
    let newCustomers = 0;
    let repeatCustomers = 0;

    userTxns.forEach(t => {
      const uId = String(t.user_id);
      if (seenUsers.has(uId)) {
        repeatCustomers++;
      } else {
        newCustomers++;
        seenUsers.add(uId);
      }
    });

    return {
      newCustomers,
      repeatCustomers,
      totalCustomers: seenUsers.size,
      totalTransactions: userTxns.length
    };
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
  },

  seedWelcomeCoupons: async (userId) => {
    const welcomeIds = ['WELCOME10', 'FREEBUI', 'FEST25'];
    if (useSupabase) {
      const { data: existing } = await supabase
        .from('user_claimed_coupons')
        .select('coupon_id')
        .eq('user_id', userId)
        .in('coupon_id', welcomeIds);

      const claimedSet = new Set((existing || []).map(r => r.coupon_id));
      const toClaim = welcomeIds.filter(id => !claimedSet.has(id));

      if (toClaim.length > 0) {
        const rows = toClaim.map(id => ({
          user_id: userId,
          coupon_id: id,
          status: 'available'
        }));
        const { error } = await supabase.from('user_claimed_coupons').insert(rows);
        if (error) throw error;
      }
      return;
    }

    const db = readDb();
    if (!db.user_claimed_coupons) db.user_claimed_coupons = [];
    for (const id of welcomeIds) {
      const exists = db.user_claimed_coupons.some(r => r.user_id === userId && r.coupon_id === id);
      if (!exists) {
        db.user_claimed_coupons.push({
          id: 'ucc-' + Math.floor(100000 + Math.random() * 900000),
          user_id: userId,
          coupon_id: id,
          status: 'available',
          claimed_at: new Date().toISOString()
        });
      }
    }
    writeDb(db);
  },

  getUserClaimedCoupons: async (userId, cafeId) => {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('user_claimed_coupons')
        .select('*, coupons(*)')
        .eq('user_id', userId)
        .eq('status', 'available');

      if (error) throw error;

      return (data || []).map(record => record.coupons).filter(c => {
        if (!c) return false;
        return c.cafe_id === null || c.cafe_id === cafeId;
      });
    }

    const db = readDb();
    const claims = (db.user_claimed_coupons || []).filter(r => r.user_id === userId && r.status === 'available');
    return claims.map(r => {
      const coupon = (db.coupons || []).find(c => c.id === r.coupon_id);
      return coupon;
    }).filter(c => {
      if (!c) return false;
      return c.cafe_id === null || c.cafe_id === cafeId;
    });
  },

  getAdvertisedCoupons: async (userId) => {
    const welcomeIds = ['WELCOME10', 'FREEBUI', 'FEST25'];

    if (useSupabase) {
      const { data: allCoupons, error: couponError } = await supabase
        .from('coupons')
        .select(`
          *,
          cafes (
            name
          )
        `)
        .eq('is_active', true)
        .not('id', 'in', `(${welcomeIds.join(',')})`);

      if (couponError) throw couponError;

      const { data: userClaims, error: claimsError } = await supabase
        .from('user_claimed_coupons')
        .select('coupon_id')
        .eq('user_id', userId);

      if (claimsError) throw claimsError;

      const claimedSet = new Set((userClaims || []).map(r => r.coupon_id));

      const { data: globalShares, error: shareError } = await supabase
        .from('user_claimed_coupons')
        .select('coupon_id');

      if (shareError) throw shareError;

      const claimCounts = {};
      (globalShares || []).forEach(r => {
        claimCounts[r.coupon_id] = (claimCounts[r.coupon_id] || 0) + 1;
      });

      return (allCoupons || [])
        .filter(c => {
          if (c.cafe_id === null || c.cafe_id === undefined) return false; // Hide platform/admin coupons
          if (claimedSet.has(c.id)) return false;
          if (c.max_claims !== null && c.max_claims !== undefined) {
            const currentClaims = claimCounts[c.id] || 0;
            if (currentClaims >= c.max_claims) return false;
          }
          return true;
        })
        .map(c => ({
          ...c,
          cafe_name: c.cafes ? c.cafes.name : 'Platform Promo'
        }))
        .slice(0, 5);
    }

    const db = readDb();
    const claimedSet = new Set(
      (db.user_claimed_coupons || [])
        .filter(r => r.user_id === userId)
        .map(r => r.coupon_id)
    );

    const claimCounts = {};
    (db.user_claimed_coupons || []).forEach(r => {
      claimCounts[r.coupon_id] = (claimCounts[r.coupon_id] || 0) + 1;
    });

    const activeCoupons = (db.coupons || []).filter(c => {
      return c.is_active && c.cafe_id !== null && !welcomeIds.includes(c.id) && !claimedSet.has(c.id);
    });

    return activeCoupons.filter(c => {
      if (c.max_claims !== undefined && c.max_claims !== null) {
        const count = claimCounts[c.id] || 0;
        return count < c.max_claims;
      }
      return true;
    }).map(c => {
      const cafe = (db.cafes || []).find(f => String(f.id) === String(c.cafe_id));
      return {
        ...c,
        cafe_name: cafe ? cafe.name : 'Platform Promo'
      };
    }).slice(0, 5);
  },

  claimCouponForUser: async (userId, couponId) => {
    if (useSupabase) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', couponId)
        .maybeSingle();

      if (couponError) throw couponError;
      if (!coupon) throw new Error('Coupon not found');

      if (coupon.max_claims !== null && coupon.max_claims !== undefined) {
        const { count, error: countError } = await supabase
          .from('user_claimed_coupons')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', couponId);

        if (countError) throw countError;
        if (count >= coupon.max_claims) {
          throw new Error('This coupon has reached its maximum claims limit');
        }
      }

      const { error } = await supabase
        .from('user_claimed_coupons')
        .insert({ user_id: userId, coupon_id: couponId, status: 'available' });

      if (error) {
        if (error.code === '23505') {
          return { success: true, message: 'Already claimed' };
        }
        throw error;
      }
      return { success: true };
    }

    const db = readDb();
    if (!db.user_claimed_coupons) db.user_claimed_coupons = [];

    const existingIndex = db.user_claimed_coupons.findIndex(r => r.user_id === userId && r.coupon_id === couponId);
    if (existingIndex !== -1) {
      return { success: true, message: 'Already claimed' };
    }

    const coupon = (db.coupons || []).find(c => c.id === couponId);
    if (!coupon) throw new Error('Coupon not found');

    if (coupon.max_claims !== undefined && coupon.max_claims !== null) {
      const count = db.user_claimed_coupons.filter(r => r.coupon_id === couponId).length;
      if (count >= coupon.max_claims) {
        throw new Error('This coupon has reached its maximum claims limit');
      }
    }

    db.user_claimed_coupons.push({
      id: 'ucc-' + Math.floor(100000 + Math.random() * 900000),
      user_id: userId,
      coupon_id: couponId,
      status: 'available',
      claimed_at: new Date().toISOString()
    });

    writeDb(db);
    return { success: true };
  },

  useClaimedCoupon: async (userId, couponId) => {
    if (useSupabase) {
      const { error } = await supabase
        .from('user_claimed_coupons')
        .update({ status: 'used' })
        .eq('user_id', userId)
        .eq('coupon_id', couponId);

      if (error) throw error;
      return true;
    }

    const db = readDb();
    const record = (db.user_claimed_coupons || []).find(r => r.user_id === userId && r.coupon_id === couponId);
    if (record) {
      record.status = 'used';
      writeDb(db);
    }
    return true;
  }
};
