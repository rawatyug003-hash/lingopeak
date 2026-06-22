const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  reviewVocabularyItem,
  getDueVocabulary,
  getProgressSummary,
} = require('../controllers/progressController');

const router = express.Router();

router.use(requireAuth);

router.get('/vocabulary/due', getDueVocabulary);
router.post('/vocabulary/review', reviewVocabularyItem);
router.get('/:learningProfileId/summary', getProgressSummary);

module.exports = router;
