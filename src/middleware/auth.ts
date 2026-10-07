import type { NextFunction, Request, Response } from 'express';
import type { Role, SkillHubUser } from '../../shared/types.js';
import { firebaseAdminEnabled, verifyFirebaseToken } from '../config/firebase.js';
import { mongoConnected } from '../config/database.js';
import { UserModel } from '../models/index.js';
import { demoMode, store } from '../services/memoryStore.js';

export interface AuthRequest extends Request { authUser?: SkillHubUser; firebaseUid?: string; newFirebaseUser?: boolean }

export function authOptional(req: Request, res: Response, next: NextFunction) {
  if (!req.header('authorization')) return next();
  return authRequired(req, res, next);
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
      const raw = req.header('authorization') ?? '';
      const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
      if (!token) return res.status(401).json({ message: 'Sign in to continue.' });
      const authReq = req as AuthRequest;
      if (token.startsWith('demo:') && demoMode()) {
        const user = store.users.find((item) => item.id === token.slice(5));
        if (!user) return res.status(401).json({ message: 'That demo account is not available.' });
        authReq.authUser = user;
        return next();
      }
      if (!firebaseAdminEnabled) return res.status(401).json({ message: 'This session is not valid. Configure Firebase Authentication or use a demo account.' });
      const decoded = await verifyFirebaseToken(token);
      const email = (decoded.email ?? '').toLowerCase();
      let user = mongoConnected ? await UserModel.findOne({ firebaseUid: decoded.uid }).lean() : store.users.find((item) => item.id === decoded.uid || item.email.toLowerCase() === email);
      if (!user) {
        authReq.newFirebaseUser = true;
        const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase());
        const role: Role = adminEmails.includes(email) ? 'admin' : 'student';
        const displayName = typeof decoded.name === 'string' ? decoded.name : (email.split('@')[0] || 'Learner');
        user = { id: decoded.uid, firebaseUid: decoded.uid, name: displayName, email, role, avatar: displayName.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase(), createdAt: new Date().toISOString().slice(0, 10) } as SkillHubUser & { firebaseUid: string };
        if (mongoConnected) await UserModel.create(user);
        else store.users.push(user);
      } else {
        const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase());
        if (adminEmails.includes(email) && user.role !== 'admin') {
          if (mongoConnected) await UserModel.updateOne({ id: user.id }, { $set: { role: 'admin' } });
          else user.role = 'admin';
        }
      }
      authReq.authUser = user as SkillHubUser;
      authReq.firebaseUid = decoded.uid;
      return next();
    } catch (error) {
      console.error('[SkillHub] Authentication check failed.', error instanceof Error ? error.message : error);
      return res.status(401).json({ message: 'Sign in again to continue.' });
    }
  })();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).authUser;
    if (!user) return res.status(401).json({ message: 'Sign in to continue.' });
    if (!roles.includes(user.role)) return res.status(403).json({ message: 'Your account does not have permission for this action.' });
    next();
  };
}
