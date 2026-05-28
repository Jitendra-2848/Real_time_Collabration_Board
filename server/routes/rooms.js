import express from 'express';
import * as roomsController from '../controllers/roomsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', roomsController.listRooms);
router.post('/', roomsController.createRoom);
router.get('/:roomId', roomsController.getRoomById);

export default router;
