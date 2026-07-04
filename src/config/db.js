const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../db.json');

// Initialize database file if it doesn't exist
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

// Read database contents
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { cafes: [], users: [], coupons: [], transactions: [], otp_codes: [] };
  }
}

// Write database contents
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

module.exports = {
  // --- CAFES ---
  getAllCafes: async () => {
    return readDb().cafes;
  },

  getCafeById: async (id) => {
    const db = readDb();
    return db.cafes.find(c => c.id === id) || null;
  },

  getCafeBySlug: async (slug) => {
    const db = readDb();
    return db.cafes.find(c => c.slug === slug) || null;
  },

  getCafeByEmail: async (email) => {
    const db = readDb();
    return db.cafes.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
  },

  insertCafe: async (cafe) => {
    const db = readDb();
    db.cafes.push(cafe);
    writeDb(db);
    return cafe;
  },

  // --- USERS ---
  getAllUsers: async () => {
    return readDb().users;
  },

  getUserById: async (id) => {
    const db = readDb();
    return db.users.find(u => u.id === id) || null;
  },

  getUserByEmail: async (email) => {
    const db = readDb();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  getUserByPhone: async (phone) => {
    const db = readDb();
    return db.users.find(u => u.phone === phone) || null;
  },

  insertUser: async (user) => {
    const db = readDb();
    db.users.push(user);
    writeDb(db);
    return user;
  },

  // --- COUPONS ---
  getAllCoupons: async () => {
    return readDb().coupons;
  },

  getCouponsByCafeId: async (cafeId) => {
    const db = readDb();
    return db.coupons.filter(c => c.cafe_id === cafeId);
  },

  getCouponById: async (id) => {
    const db = readDb();
    return db.coupons.find(c => c.id === id) || null;
  },

  insertCoupon: async (coupon) => {
    const db = readDb();
    db.coupons.push(coupon);
    writeDb(db);
    return coupon;
  },

  // --- TRANSACTIONS ---
  getAllTransactions: async () => {
    return readDb().transactions;
  },

  getTransactionsByCafeId: async (cafeId) => {
    const db = readDb();
    return db.transactions.filter(t => t.cafe_id === cafeId);
  },

  insertTransaction: async (txn) => {
    const db = readDb();
    db.transactions.push(txn);
    writeDb(db);
    return txn;
  },

  // --- OTP VERIFICATION ---
  getOtpCodes: async () => {
    return readDb().otp_codes;
  },

  insertOtpCode: async (otp) => {
    const db = readDb();
    db.otp_codes.push(otp);
    writeDb(db);
    return otp;
  },

  verifyAndUseOtpCode: async (phone, code, purpose) => {
    const db = readDb();
    const index = db.otp_codes.findIndex(
      otp => otp.phone === phone && 
             otp.code === code && 
             otp.purpose === purpose && 
             new Date(otp.expires_at) > new Date()
    );
    if (index !== -1) {
      // Remove used OTP
      const usedOtp = db.otp_codes.splice(index, 1)[0];
      writeDb(db);
      return usedOtp;
    }
    return null;
  }
};
