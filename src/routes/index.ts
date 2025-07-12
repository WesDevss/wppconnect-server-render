import { Router } from 'express';
import healthRouter from './health';
import wppRouter from './wpp2';

const router = Router();

router.use('/health', healthRouter);
router.use('/wpp', wppRouter);
router.get('/', (_req, res) => res.send('WPPConnect Server Running!'));

export default router;