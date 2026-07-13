/**
 * TASKS_V2 feature flag.
 * Set to true ONLY after running: node new-code/migration/apply-task-enhancements.cjs
 * This adds: completed_at, linked_interaction_id, outcome_note columns to the
 * public.task table.
 * While false, MyTasksPage and all detail pages behave exactly as before.
 * RecordActivityHub returns null (invisible). TasksKanbanView shows a placeholder.
 */
export const TASKS_V2 = false;
