import { Router } from 'express';

import { requireAdmin } from '../lib/supabase.js';
import type { AuthedRequest } from '../middleware/authUser.js';
import { requireUser } from '../middleware/authUser.js';

export const userRouter = Router();

userRouter.delete('/account', requireUser, async (req: AuthedRequest, res) => {
  try {
    const db = requireAdmin();
    const userId = req.userId!;

    await db.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', userId);

    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) throw error;

    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Account deletion failed' });
  }
});
