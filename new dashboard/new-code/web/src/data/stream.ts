/**
 * stream.ts — data layer for ALT-476 (record stream / chatter + follow).
 *
 * Called ONLY when STREAM_V1 is true (panel is flag-gated at the page).
 * Until `apply-record-stream.cjs` is applied, stream_note / record_follow don't
 * exist and these queries error — which is why the flag stays off in prod first.
 *
 * Notification fan-out on post (mentions + followers, minus author) goes through
 * createNotification, which itself no-ops unless the NOTIFICATIONS flag is on.
 */

import { supabase } from '../lib/supabase';
import { createNotification } from './notifications';
import { recordRouteBase } from '../lib/streamFlag';
import type { RecordType } from '../lib/collabAssoc';

export interface StreamNote {
  note_id: number;
  entity_type: RecordType;
  entity_id: number;
  author_id: number;
  author_name: string;
  content: string;
  mention_ids: number[];
  created_date: string;
}

/** Resolve app user_ids → display names from user_master. */
async function resolveNames(userIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const unique = [...new Set(userIds)].filter((id) => id != null);
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from('user_master')
    .select('user_id, full_name')
    .in('user_id', unique);
  ((data ?? []) as { user_id: number; full_name: string | null }[]).forEach((u) =>
    map.set(u.user_id, (u.full_name ?? '').trim() || `User #${u.user_id}`),
  );
  return map;
}

/** All live notes on a record, newest first, with author names resolved. */
export async function listStreamNotes(
  entityType: RecordType,
  entityId: number,
): Promise<StreamNote[]> {
  const { data, error } = await supabase
    .from('stream_note')
    .select('note_id, entity_type, entity_id, author_id, content, mention_ids, created_date')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .is('deleted_date', null)
    .order('created_date', { ascending: false });
  if (error || !data) return [];
  const rows = data as Omit<StreamNote, 'author_name'>[];
  const names = await resolveNames(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, author_name: names.get(r.author_id) ?? `User #${r.author_id}` }));
}

/** Live follower user_ids for a record. */
export async function listFollowers(entityType: RecordType, entityId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('record_follow')
    .select('user_id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .is('deleted_date', null);
  if (error || !data) return [];
  return (data as { user_id: number }[]).map((r) => r.user_id);
}

export async function isFollowing(
  entityType: RecordType,
  entityId: number,
  userId: number,
): Promise<boolean> {
  return (await listFollowers(entityType, entityId)).includes(userId);
}

/** Follow / unfollow a record for one user (soft-delete on unfollow). */
export async function setFollow(
  entityType: RecordType,
  entityId: number,
  userId: number,
  follow: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (follow) {
    // Re-activate a soft-deleted row if present, else insert.
    const { data: existing } = await supabase
      .from('record_follow')
      .select('follow_id, deleted_date')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('user_id', userId)
      .limit(1);
    const row = (existing ?? [])[0] as { follow_id: number; deleted_date: string | null } | undefined;
    if (row && row.deleted_date != null) {
      const { error } = await supabase
        .from('record_follow')
        .update({ deleted_date: null })
        .eq('follow_id', row.follow_id);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    if (row) return { ok: true }; // already following
    const { error } = await supabase
      .from('record_follow')
      .insert({ entity_type: entityType, entity_id: entityId, user_id: userId });
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { error } = await supabase
    .from('record_follow')
    .update({ deleted_date: new Date().toISOString() })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('user_id', userId)
    .is('deleted_date', null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Post a note. Inserts the row, then fans out a notification to mentioned users
 * + followers (minus the author, deduped). Notifications no-op unless the
 * NOTIFICATIONS flag is on.
 */
export async function postStreamNote(input: {
  entityType: RecordType;
  entityId: number;
  authorId: number;
  authorName: string;
  content: string;
  mentionIds: number[];
  recordLabel: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { entityType, entityId, authorId, authorName, content, mentionIds, recordLabel } = input;
  const { error } = await supabase.from('stream_note').insert({
    entity_type: entityType,
    entity_id: entityId,
    author_id: authorId,
    content,
    mention_ids: mentionIds,
    created_by: String(authorId),
  });
  if (error) return { ok: false, error: error.message };

  // Fan-out: mentioned + followers, minus author.
  const followers = await listFollowers(entityType, entityId);
  const recipients = [...new Set([...mentionIds, ...followers])].filter((id) => id !== authorId);
  const route = `${recordRouteBase(entityType)}/${entityId}`;
  await Promise.all(
    recipients.map((rid) =>
      createNotification({
        recipientUserId: rid,
        type: 'New comment',
        title: `${authorName} posted on ${recordLabel}`,
        body: content.length > 80 ? `${content.slice(0, 80)}…` : content,
        route,
        leadId: entityType === 'lead' ? entityId : undefined,
        actor: String(authorId),
      }),
    ),
  );
  return { ok: true };
}

/** Soft-delete a note (author or admin). */
export async function deleteStreamNote(
  noteId: number,
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('stream_note')
    .update({ deleted_date: new Date().toISOString(), deleted_by: actor })
    .eq('note_id', noteId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
