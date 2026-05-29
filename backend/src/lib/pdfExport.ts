import PDFDocument from 'pdfkit';
import { requireAdmin } from './supabase.js';

type ExportPayload = {
  userId: string;
  contentType: string;
  title: string;
};

function buildPdfBuffer(title: string, lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text(title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);
    for (const line of lines) {
      doc.text(line);
      doc.moveDown(0.3);
    }
    doc.end();
  });
}

export async function generateWorkoutPdf(userId: string, sessionId?: string) {
  const db = requireAdmin();
  let query = db
    .from('workout_sessions')
    .select('*, workout_exercises(*, exercises(name), workout_sets(*))')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false });

  if (sessionId) query = query.eq('id', sessionId);

  const { data: sessions } = await query.limit(sessionId ? 1 : 10);
  const lines: string[] = [`Generated ${new Date().toLocaleDateString()}`, ''];

  for (const session of sessions ?? []) {
    lines.push(`Session: ${session.name}`);
    lines.push(`Date: ${new Date(session.started_at).toLocaleString()}`);
    lines.push(`Volume: ${session.total_volume ?? 0} · Sets: ${session.total_sets ?? 0}`);
    lines.push('');

    for (const we of session.workout_exercises ?? []) {
      lines.push(`  ${we.exercises?.name ?? 'Exercise'}`);
      for (const set of we.workout_sets ?? []) {
        lines.push(`    Set ${set.set_number}: ${set.weight ?? '-'} lbs × ${set.reps ?? '-'} reps`);
      }
      lines.push('');
    }
    lines.push('---');
  }

  const buffer = await buildPdfBuffer('LiftFlow Workout Export', lines);
  return uploadPdf(userId, 'workout-export.pdf', buffer, 'Workout History');
}

export async function generateNutritionPdf(userId: string) {
  const db = requireAdmin();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: meals } = await db
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', weekAgo.toISOString().slice(0, 10))
    .order('scheduled_date', { ascending: false });

  const lines: string[] = [`Generated ${new Date().toLocaleDateString()}`, ''];
  let currentDate = '';

  for (const meal of meals ?? []) {
    if (meal.scheduled_date !== currentDate) {
      currentDate = meal.scheduled_date;
      lines.push(`Date: ${currentDate}`);
    }
    lines.push(`  ${meal.meal_type}: ${meal.name} — ${meal.calories ?? 0} cal, ${meal.protein_g ?? 0}g protein`);
  }

  const buffer = await buildPdfBuffer('LiftFlow Nutrition Export', lines);
  return uploadPdf(userId, 'nutrition-export.pdf', buffer, 'Nutrition Log');
}

export async function generateProgressPdf(userId: string) {
  const db = requireAdmin();
  const { data: metrics } = await db
    .from('user_metrics')
    .select('recorded_at, weight_kg, body_fat_pct')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(30);

  const { data: body } = await db
    .from('body_composition_records')
    .select('recorded_at, weight_kg, body_fat_pct, waist_cm, chest_cm')
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(20);

  const lines: string[] = [`Generated ${new Date().toLocaleDateString()}`, '', 'Weight History:'];
  for (const m of metrics ?? []) {
    lines.push(`  ${new Date(m.recorded_at).toLocaleDateString()}: ${m.weight_kg ?? '-'} kg`);
  }

  lines.push('', 'Body Measurements:');
  for (const b of body ?? []) {
    lines.push(
      `  ${new Date(b.recorded_at).toLocaleDateString()}: ${b.weight_kg ?? '-'} kg, BF ${b.body_fat_pct ?? '-'}%, waist ${b.waist_cm ?? '-'} cm`,
    );
  }

  const buffer = await buildPdfBuffer('LiftFlow Progress Export', lines);
  return uploadPdf(userId, 'progress-export.pdf', buffer, 'Progress Report');
}

async function uploadPdf(userId: string, filename: string, buffer: Buffer, title: string) {
  const db = requireAdmin();
  const path = `${userId}/exports/${Date.now()}-${filename}`;

  const { error } = await db.storage.from('progress-photos').upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (error) {
    const base64 = buffer.toString('base64');
    return {
      title,
      fileUrl: `data:application/pdf;base64,${base64}`,
      fileSizeBytes: buffer.length,
    };
  }

  const { data } = db.storage.from('progress-photos').getPublicUrl(path);
  return {
    title,
    fileUrl: data.publicUrl,
    fileSizeBytes: buffer.length,
  };
}

export async function exportByType(payload: ExportPayload & { sourceEntityId?: string }) {
  switch (payload.contentType) {
    case 'workout':
      return generateWorkoutPdf(payload.userId, payload.sourceEntityId);
    case 'meal_plan':
    case 'grocery_list':
      return generateNutritionPdf(payload.userId);
    case 'progress_summary':
    case 'body_composition':
      return generateProgressPdf(payload.userId);
    default:
      return generateWorkoutPdf(payload.userId);
  }
}
