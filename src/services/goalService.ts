import { mapGoal } from '@/lib/db-mappers';
import { fail, fromError, ok } from '@/lib/serviceResult';
import type { IGoalService } from '@/services/interfaces';
import { supabase } from '@/supabase/client';

export const goalService: IGoalService = {
  async getGoals(userId) {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapGoal));
    } catch (e) {
      return fromError(e);
    }
  },

  async createGoal(userId, goal) {
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          goal_type: goal.goalType,
          title: goal.title,
          description: goal.description,
          target_value: goal.targetValue,
          current_value: goal.currentValue,
          unit: goal.unit,
          status: goal.status ?? 'active',
          target_date: goal.targetDate,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapGoal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async updateGoalProgress(goalId, currentValue) {
    try {
      const { data, error } = await supabase
        .from('goals')
        .update({ current_value: currentValue })
        .eq('id', goalId)
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapGoal(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async completeGoal(goalId) {
    try {
      const { data, error } = await supabase
        .from('goals')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', goalId)
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapGoal(data));
    } catch (e) {
      return fromError(e);
    }
  },
};
