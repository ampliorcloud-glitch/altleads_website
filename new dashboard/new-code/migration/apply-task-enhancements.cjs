/**
 * apply-task-enhancements.cjs
 *
 * STAGED — NOT executed yet. Run ONLY after owner sign-off (ALT-431).
 *
 * Adds 3 new columns to public.task + compound indexes to speed up
 * the RecordActivityHub's "open tasks on a record" query.
 *
 * Real task table name discovered 2026-06-28: public.task (PK: task_id)
 * Real interaction table:  public.interaction (PK: interaction_id)
 *
 * After running this script, flip TASKS_V2 = true in:
 *   new-code/web/src/lib/tasksFlags.ts
 * and re-deploy the frontend.
 *
 * Run: node new-code/migration/apply-task-enhancements.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.PG_CONNECTION_STRING });
  await client.connect();
  console.log('Connected to database. Applying task enhancements (ALT-431)...');

  try {
    await client.query('BEGIN');

    // 1. Add completed_at — exact timestamp when task was completed by the
    //    auto-complete flow (distinct from updated_date which changes on every edit).
    await client.query(`
      ALTER TABLE public.task
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ
    `);
    console.log('OK  completed_at column added');

    // 2. Add linked_interaction_id — FK to the interaction row (call disposition)
    //    that triggered completion of a CALL-type task.
    //    ON DELETE SET NULL: safe — if the interaction row is ever purged, the
    //    task stays closed but loses its link (acceptable).
    await client.query(`
      ALTER TABLE public.task
      ADD COLUMN IF NOT EXISTS linked_interaction_id BIGINT
      REFERENCES public.interaction(interaction_id) ON DELETE SET NULL
    `);
    console.log('OK  linked_interaction_id column added');

    // 3. Add outcome_note — short outcome text for TODO/MEETING completions.
    //    Separate from body (which is the pre-task prep note).
    await client.query(`
      ALTER TABLE public.task
      ADD COLUMN IF NOT EXISTS outcome_note TEXT
    `);
    console.log('OK  outcome_note column added');

    // 4. Compound index for RecordActivityHub's "open tasks on a lead" query.
    await client.query(`
      CREATE INDEX IF NOT EXISTS task_lead_status_due_idx
      ON public.task (lead_id, status, due_at)
      WHERE lead_id IS NOT NULL AND deleted_date IS NULL
    `);
    console.log('OK  task_lead_status_due_idx created');

    // 5. Same for company tasks.
    await client.query(`
      CREATE INDEX IF NOT EXISTS task_company_status_due_idx
      ON public.task (company_id, status, due_at)
      WHERE company_id IS NOT NULL AND deleted_date IS NULL
    `);
    console.log('OK  task_company_status_due_idx created');

    // 6. Same for contact tasks.
    await client.query(`
      CREATE INDEX IF NOT EXISTS task_contact_status_due_idx
      ON public.task (contact_id, status, due_at)
      WHERE contact_id IS NOT NULL AND deleted_date IS NULL
    `);
    console.log('OK  task_contact_status_due_idx created');

    await client.query('COMMIT');
    console.log('\nMigration complete. Next steps:');
    console.log('  1. Flip TASKS_V2 = true in new-code/web/src/lib/tasksFlags.ts');
    console.log('  2. Build + deploy the frontend');
    console.log('  3. Verify RecordActivityHub shows tasks on a Lead detail page');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('\nMigration ROLLED BACK due to error:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
