const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listLanguages,
  createLearningProfile,
  listMyLearningProfiles,
} = require('../controllers/learningProfileController');

const router = express.Router();

router.get('/languages', listLanguages);
router.get('/me', requireAuth, listMyLearningProfiles);
router.post('/', requireAuth, createLearningProfile);

module.exports = router;
