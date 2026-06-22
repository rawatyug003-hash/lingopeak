const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { checkPronunciation, getPracticePhrase } = require('../controllers/voiceController');

const router = express.Router();

router.use(requireAuth);

router.get('/practice-phrase', getPracticePhrase);
router.post('/check-pronunciation', checkPronunciation);

module.exports = router;
