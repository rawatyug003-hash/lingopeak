const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  sendMessage,
  listConversations,
  getConversation,
  endConversation,
} = require('../controllers/conversationController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listConversations);
router.get('/:id', getConversation);
router.post('/message', sendMessage);
router.post('/:id/end', endConversation);

module.exports = router;
