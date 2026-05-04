const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const itemController = require('../controllers/itemController');
const { protect, admin, personnel } = require('../config/authMiddleware');

// Multer configuration for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb('Error: Images Only!');
        }
    }
});

// User routes
router.post('/report-item', upload.single('image'), itemController.reportItem);
router.get('/track-item/:id', itemController.trackItem);
router.get('/public-items', itemController.getPublicFoundItems);
router.post('/claim-item', protect, upload.single('identityProof'), itemController.claimItem);
router.post('/contact', itemController.submitContact);
router.get('/user/history', protect, itemController.getUserHistory);

// Admin & Staff routes
router.get('/items', protect, personnel, itemController.getAllItems);
router.get('/analytics', protect, personnel, itemController.getAnalytics);
router.put('/items/:id', protect, admin, itemController.updateItem);
router.put('/items/:id/status', protect, personnel, itemController.updateItemStatus);
router.delete('/items/:id', protect, personnel, itemController.deleteItem);
router.get('/claims', protect, personnel, itemController.getAllClaims);
router.put('/claims/:id', protect, personnel, itemController.updateClaimStatus);
router.delete('/claims/:id/case', protect, personnel, itemController.deleteClaimCase);
router.post('/upload-found-item', protect, personnel, upload.single('image'), itemController.uploadFoundItem);

module.exports = router;
