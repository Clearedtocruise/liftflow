import type { EquipmentId, TrainingLocationId } from '@/constants/trainingProfile';
import { defaultRadiusForLocationType } from '@/lib/geo';
import { fail, fromError, ok } from '@/lib/serviceResult';
import { supabase } from '@/supabase/client';
import type { ServiceResult } from '@/types/common';
import type {
    CreateWorkoutLocationPayload,
    UpdateWorkoutLocationPayload,
    WorkoutLocation,
} from '@/types/workoutLocation';

type LocationRow = {
  id: string;
  user_id: string;
  name: string;
  location_type: string;
  available_equipment: string[] | null;
  is_default: boolean;
  sort_order: number;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  created_at: string;
  updated_at: string;
};

function mapLocation(row: LocationRow): WorkoutLocation {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    locationType: row.location_type as TrainingLocationId,
    availableEquipment: (row.available_equipment ?? []) as EquipmentId[],
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    notes: row.notes ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    radiusMeters: row.radius_meters ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function clearOtherDefaults(userId: string, exceptId?: string): Promise<void> {
  let query = supabase.from('workout_locations').update({ is_default: false }).eq('user_id', userId);
  if (exceptId) query = query.neq('id', exceptId);
  await query;
}

export const workoutLocationService = {
  async list(userId: string): Promise<ServiceResult<WorkoutLocation[]>> {
    try {
      const { data, error } = await supabase
        .from('workout_locations')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) return fail(error.message);
      return ok((data ?? []).map(mapLocation));
    } catch (e) {
      return fromError(e);
    }
  },

  async getDefault(userId: string): Promise<ServiceResult<WorkoutLocation | null>> {
    const list = await this.list(userId);
    if (!list.success) return fail(list.error);
    if (list.data.length === 0) return ok(null);
    return ok(list.data.find((l) => l.isDefault) ?? list.data[0]);
  },

  async create(userId: string, payload: CreateWorkoutLocationPayload): Promise<ServiceResult<WorkoutLocation>> {
    try {
      const name = payload.name.trim();
      if (!name) return fail('Location name is required');

      const { count } = await supabase
        .from('workout_locations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const isFirst = (count ?? 0) === 0;
      const makeDefault = payload.isDefault ?? isFirst;

      if (makeDefault) await clearOtherDefaults(userId);

      const radius =
        payload.radiusMeters ?? defaultRadiusForLocationType(payload.locationType);

      const { data, error } = await supabase
        .from('workout_locations')
        .insert({
          user_id: userId,
          name,
          location_type: payload.locationType,
          available_equipment: payload.availableEquipment ?? [],
          is_default: makeDefault,
          sort_order: count ?? 0,
          notes: payload.notes?.trim() || null,
          latitude: payload.latitude ?? null,
          longitude: payload.longitude ?? null,
          radius_meters: radius,
        })
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapLocation(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async update(locationId: string, userId: string, payload: UpdateWorkoutLocationPayload): Promise<ServiceResult<WorkoutLocation>> {
    try {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (payload.name !== undefined) patch.name = payload.name.trim();
      if (payload.locationType !== undefined) patch.location_type = payload.locationType;
      if (payload.availableEquipment !== undefined) patch.available_equipment = payload.availableEquipment;
      if (payload.notes !== undefined) patch.notes = payload.notes?.trim() || null;
      if (payload.latitude !== undefined) patch.latitude = payload.latitude;
      if (payload.longitude !== undefined) patch.longitude = payload.longitude;
      if (payload.radiusMeters !== undefined) patch.radius_meters = payload.radiusMeters;
      if (payload.isDefault === true) {
        await clearOtherDefaults(userId, locationId);
        patch.is_default = true;
      } else if (payload.isDefault === false) {
        patch.is_default = false;
      }

      const { data, error } = await supabase
        .from('workout_locations')
        .update(patch)
        .eq('id', locationId)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) return fail(error.message);
      return ok(mapLocation(data));
    } catch (e) {
      return fromError(e);
    }
  },

  async setDefault(locationId: string, userId: string): Promise<ServiceResult<WorkoutLocation>> {
    return this.update(locationId, userId, { isDefault: true });
  },

  async remove(locationId: string, userId: string): Promise<ServiceResult<void>> {
    try {
      const { data: existing } = await supabase
        .from('workout_locations')
        .select('id, is_default')
        .eq('user_id', userId);

      if ((existing?.length ?? 0) <= 1) {
        return fail('Keep at least one workout location.');
      }

      const target = existing?.find((r) => r.id === locationId);
      const { error } = await supabase.from('workout_locations').delete().eq('id', locationId).eq('user_id', userId);
      if (error) return fail(error.message);

      if (target?.is_default) {
        const next = existing?.find((r) => r.id !== locationId);
        if (next) await this.setDefault(next.id, userId);
      }

      return ok(undefined);
    } catch (e) {
      return fromError(e);
    }
  },

  /** Seed first location from onboarding profile fields. */
  async ensureFromProfile(
    userId: string,
    profile: { primaryGymName?: string; trainingLocation?: TrainingLocationId; availableEquipment?: EquipmentId[] },
  ): Promise<ServiceResult<WorkoutLocation | null>> {
    const list = await this.list(userId);
    if (!list.success) return fail(list.error);
    if (list.data.length > 0) return ok(list.data.find((l) => l.isDefault) ?? list.data[0]);

    if (!profile.trainingLocation && !profile.primaryGymName?.trim()) {
      return ok(null);
    }

    const name =
      profile.primaryGymName?.trim() ||
      (profile.trainingLocation === 'home_gym' ? 'Home Gym' : 'Commercial Gym');

    return this.create(userId, {
      name,
      locationType: profile.trainingLocation ?? 'commercial_gym',
      availableEquipment: profile.availableEquipment,
      isDefault: true,
    });
  },
};
