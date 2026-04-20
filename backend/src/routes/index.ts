import { Router } from 'express';
import authRouter   from './auth';
import usersRouter  from './users';
import groupsRouter from './groups';
import labsRouter   from './labs';
import assignRouter from './assign';
import vmsRouter    from './vms';
import vmwareRouter     from './vmware';
import vmwareSoapRouter from './vmware-soap';
import cronRouter       from './cron';
import configRouter from './config';

const router = Router();

router.use('/config',  configRouter);  // 公开配置接口，无需鉴权
router.use('/auth',    authRouter);
router.use('/users',   usersRouter);
router.use('/groups',  groupsRouter);
router.use('/labs',    labsRouter);
router.use('/assign',  assignRouter);
router.use('/vms',     vmsRouter);
router.use('/vmware',      vmwareRouter);       // mirrors VMware vCenter REST API paths
router.use('/vmware-soap', vmwareSoapRouter);   // SOAP-only operations: snapshots, linked clone
router.use('/cron',        cronRouter);

export default router;
