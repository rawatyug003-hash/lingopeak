const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  reviewVocabularyItem,
  getDueVocabulary,
  getNewVocabulary,
  startTrackingVocabulary,
  getProgressSummary,
} = require('../controllers/progressController');

const router = express.Router();

router.use(requireAuth);

router.get('/vocabulary/due', getDueVocabulary);
router.get('/vocabulary/new', getNewVocabulary);
router.post('/vocabulary/start', startTrackingVocabulary);
router.post('/vocabulary/review', reviewVocabularyItem);
router.get('/:learningProfileId/summary', getProgressSummary);

module.exports = router;
