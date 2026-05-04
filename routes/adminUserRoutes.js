const express = require('express');
const router = express.Router();
const { protect, admin } = require('../config/authMiddleware');
const {
    createPersonnelUser,
    listPersonnelUsers,
    updatePersonnelUser,
    deletePersonnelUser
} = require('../controllers/adminUserController');

router.get('/admin/users', protect, admin, listPersonnelUsers);
router.post('/admin/users', protect, admin, createPersonnelUser);
router.patch('/admin/users/:id', protect, admin, updatePersonnelUser);
router.delete('/admin/users/:id', protect, admin, deletePersonnelUser);

module.exports = router;

