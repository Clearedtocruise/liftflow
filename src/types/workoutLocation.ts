import type { EquipmentId, TrainingLocationId } from '@/constants/trainingProfile';
import type { BaseEntity } from './common';

export type WorkoutLocation = BaseEntity & {
  userId: string;
  name: string;
  locationType: TrainingLocationId;
  availableEquipment: EquipmentId[];
  isDefault: boolean;
  sortOrder: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  updatedAt?: string;
};

export type CreateWorkoutLocationPayload = {
  name: string;
  locationType: TrainingLocationId;
  availableEquipment?: EquipmentId[];
  isDefault?: boolean;
  notes?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
};

export type UpdateWorkoutLocationPayload = Partial<CreateWorkoutLocationPayload>;
