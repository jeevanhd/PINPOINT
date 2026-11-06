import { Router } from 'express';
import { authRouter } from './auth.routes';
import { topicRouter, unitRouter } from './topic.routes';
import { placeRouter, flagRouter } from './palace.routes';
import { recallRouter } from './recall.routes';
import { dashboardRouter, examRouter } from './dashboard.routes';
import { fileRouter } from './file.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/units', unitRouter);
apiRouter.use('/topics', topicRouter);
apiRouter.use('/places', placeRouter);
apiRouter.use('/flags', flagRouter);
apiRouter.use('/recall', recallRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/exams', examRouter);
apiRouter.use('/files', fileRouter);
