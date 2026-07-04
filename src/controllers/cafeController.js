const CafeModel = require('../models/cafeModel');
const db = require('../config/db');

class CafeController {
    static async getBySlug(req, res) {
        try {
            const { slug } = req.params;
            const cafe = await CafeModel.findBySlug(slug);

            if (!cafe) {
                return res.status(404).json({
                    success: false,
                    message: 'Cafe not found'
                });
            }

            // Fetch coupons for this cafe (will be empty for now but matches schema)
            const coupons = await db.getCouponsByCafeId(cafe.id);

            return res.status(200).json({
                success: true,
                cafe,
                coupons
            });
        } catch (error) {
            console.error('Error fetching cafe by slug:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // Update Cafe details (optional, but extremely useful for Cafe Owner Dashboard settings check!)
    static async updateDetails(req, res) {
        try {
            const { name, owner_name, email, address, upi_id } = req.body;
            const cafeId = req.cafe.id;

            const database = require('../config/db');
            const allDb = require('fs').readFileSync(require('path').join(__dirname, '../../db.json'), 'utf8');
            const dbObj = JSON.parse(allDb);

            const cafeIndex = dbObj.cafes.findIndex(c => c.id === cafeId);
            if (cafeIndex === -1) {
                return res.status(404).json({ success: false, message: 'Cafe not found' });
            }

            // Update fields if provided
            if (name) dbObj.cafes[cafeIndex].name = name;
            if (owner_name) dbObj.cafes[cafeIndex].owner_name = owner_name;
            if (email) dbObj.cafes[cafeIndex].email = email;
            if (address) dbObj.cafes[cafeIndex].address = address;
            if (upi_id !== undefined) dbObj.cafes[cafeIndex].upi_id = upi_id;

            require('fs').writeFileSync(require('path').join(__dirname, '../../db.json'), JSON.stringify(dbObj, null, 2), 'utf8');

            const { password: _, ...updatedCafe } = dbObj.cafes[cafeIndex];

            return res.status(200).json({
                success: true,
                message: 'Cafe details updated successfully',
                cafe: updatedCafe
            });
        } catch (error) {
            console.error('Error updating cafe details:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}

module.exports = CafeController;
