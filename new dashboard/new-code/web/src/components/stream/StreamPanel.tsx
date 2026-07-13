/**
 * StreamPanel — ALT-476 record stream / chatter + follow.
 *
 * Rendered ONLY when STREAM_V1 is true (gated by the calling detail page).
 * Self-contained: loads notes + followers + notifiable users on mount.
 *
 *   • Post a free-form note on the record.
 *   • "Notify" picker adds people (chips) who get an in-app notification on post
 *     (the structured equivalent of @mention; no-op unless NOTIFICATIONS is on).
 *   • Follow / Unfollow — followers are notified of every new post.
 *   • Author can delete their own note.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Send, Bell, BellOff, X, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { SectionCard } from '../admin/primitives';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';
import { STREAM_V1 } from '../../lib/streamFlag';
import {
  listStreamNotes,
  listFollowers,
  setFollow,
  postStreamNote,
  deleteStreamNote,
  type StreamNote,
} from '../../data/stream';
import { fetchAssignableUsers } from '../../data/assignment';
import type { RecordType } from '../../lib/collabAssoc';

interface Props {
  recordType: RecordType;
  recordId: number;
  /** Human label for the record (used in the notification body, e.g. company name). */
  recordLabel: string;
  actorUserId: number | null;
  actorName: string | null;
  /** Whether the current user may post / follow (any linked user). */
  canPost: boolean;
}

export function StreamPanel({ recordType, recordId, recordLabel, actorUserId, actorName, canPost }: Props) {
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<StreamNote[]>([]);
  const [following, setFollowing] = useState(false);
  const [userOptions, setUserOptions] = useState<SearchSelectOption[]>([]);

  const [draft, setDraft] = useState('');
  const [mentionIds, setMentionIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, followers, users] = await Promise.all([
        listStreamNotes(recordType, recordId),
        listFollowers(recordType, recordId),
        canPost ? fetchAssignableUsers(null) : Promise.resolve([]),
      ]);
      setNotes(n);
      setFollowing(actorUserId != null && followers.includes(actorUserId));
      setUserOptions(users.map((u) => ({ id: u.id, label: u.label })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load discussion');
    } finally {
      setLoading(false);
    }
  }, [recordType, recordId, actorUserId, canPost]);

  useEffect(() => {
    if (!STREAM_V1) return;
    void load();
  }, [load]);

  const toggleFollow = useCallback(async () => {
    if (actorUserId == null) return;
    const next = !following;
    setFollowing(next); // optimistic
    const res = await setFollow(recordType, recordId, actorUserId, next);
    if (!res.ok) {
      setFollowing(!next);
      setError(res.error);
    }
  }, [following, recordType, recordId, actorUserId]);

  const addMention = useCallback((id: number | null) => {
    if (id == null) return;
    setMentionIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const post = useCallback(async () => {
    if (!draft.trim() || actorUserId == null || posting) return;
    setPosting(true);
    setError(null);
    const res = await postStreamNote({
      entityType: recordType,
      entityId: recordId,
      authorId: actorUserId,
      authorName: actorName ?? `User #${actorUserId}`,
      content: draft.trim(),
      mentionIds,
      recordLabel,
    });
    if (res.ok) {
      setDraft('');
      setMentionIds([]);
      await load();
    } else {
      setError(res.error);
    }
    setPosting(false);
  }, [draft, actorUserId, posting, recordType, recordId, actorName, mentionIds, recordLabel, load]);

  const remove = useCallback(
    async (noteId: number) => {
      if (actorUserId == null) return;
      const res = await deleteStreamNote(noteId, String(actorUserId));
      if (res.ok) setNotes((prev) => prev.filter((n) => n.note_id !== noteId));
      else setError(res.error);
    },
    [actorUserId],
  );

  if (!STREAM_V1) return null;

  const labelFor = (id: number) => userOptions.find((u) => u.id === id)?.label ?? `User #${id}`;

  const followBtn = (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={actorUserId == null}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${following ? '#1A7EE8' : '#E5E7EB'}`,
        background: following ? '#EFF6FF' : '#FFFFFF',
        color: following ? '#1D4ED8' : '#374151',
        fontSize: 12,
        fontWeight: 500,
        cursor: actorUserId == null ? 'default' : 'pointer',
      }}
    >
      {following ? <Bell size={13} /> : <BellOff size={13} />}
      {following ? 'Following' : 'Follow'}
    </button>
  );

  return (
    <SectionCard title="Discussion" action={followBtn}>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Composer */}
        {canPost && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a note…"
              rows={2}
              style={{
                width: '100%',
                resize: 'vertical',
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
            {mentionIds.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {mentionIds.map((id) => (
                  <span
                    key={id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      fontSize: 12,
                    }}
                  >
                    @{labelFor(id)}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setMentionIds((prev) => prev.filter((x) => x !== id))}
                    />
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, maxWidth: 260 }}>
                <SearchSelect
                  options={userOptions.filter((u) => !mentionIds.includes(u.id))}
                  value={null}
                  onChange={addMention}
                  placeholder="Notify someone…"
                />
              </div>
              <button
                type="button"
                onClick={post}
                disabled={!draft.trim() || posting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: !draft.trim() || posting ? '#93C5FD' : '#1A7EE8',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !draft.trim() || posting ? 'default' : 'pointer',
                }}
              >
                {posting ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                Post
              </button>
            </div>
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: '#B91C1C' }}>{error}</div>}

        {/* Feed */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 13 }}>
            <Loader2 size={14} className="spin" /> Loading…
          </div>
        ) : notes.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#9CA3AF',
              fontSize: 13,
              padding: '8px 0',
            }}
          >
            <MessageSquare size={14} /> No notes yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.map((n) => (
              <div key={n.note_id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{n.author_name}</span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {new Date(n.created_date).toLocaleString()}
                  </span>
                  {actorUserId === n.author_id && (
                    <Trash2
                      size={12}
                      style={{ cursor: 'pointer', color: '#9CA3AF', marginLeft: 'auto' }}
                      onClick={() => remove(n.note_id)}
                    />
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{n.content}</div>
                {n.mention_ids.length > 0 && (
                  <div style={{ fontSize: 11, color: '#6B7280' }}>
                    Notified: {n.mention_ids.map(labelFor).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
