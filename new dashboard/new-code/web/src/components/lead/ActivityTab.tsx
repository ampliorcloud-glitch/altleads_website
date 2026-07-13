/**
 * ActivityTab — chronological lead_activity feed + add-comment box.
 * System-generated entries are styled differently from human comments.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Send } from 'lucide-react';
import {
  fetchActivity,
  addActivityComment,
  fmtDateTime,
  type WorkspaceActivity,
} from '../../data/leadWorkspace';
import { Avatar, LoadingBlock, EmptyBlock, PrimaryButton, InlineNote, card } from './primitives';

const MAX = 500;

export function ActivityTab({ leadId, actor }: { leadId: number; actor: string }) {
  const [items, setItems] = useState<WorkspaceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setItems(await fetchActivity(leadId));
    } catch {
      setLoadError('Could not load activity. Please try again.');
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const text = comment.trim();
    if (!text) {
      setError('Comment is required.');
      return;
    }
    if (!actor) {
      setError('Your account isn’t linked to a user profile yet, so comments can’t be saved.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await addActivityComment(leadId, text, actor);
    setSaving(false);
    if ('error' in res) {
      setError(res.error);
      return;
    }
    setComment('');
    await load();
  };

  return (
    <div className="space-y-4">
      {/* Add comment */}
      <div className={`${card} p-4`}>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX))}
          placeholder="Add a comment to this lead..."
          rows={3}
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-stone-800 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-y"
          style={{ fontSize: 13 }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-stone-400" style={{ fontSize: 11 }}>
            {comment.length}/{MAX}
          </span>
          <PrimaryButton onClick={handleAdd} loading={saving} disabled={!comment.trim()}>
            <Send size={13} />
            Comment
          </PrimaryButton>
        </div>
        {error && <InlineNote kind="error">{error}</InlineNote>}
      </div>

      {/* Timeline */}
      <div className={`${card} p-4`}>
        {loading ? (
          <LoadingBlock />
        ) : loadError ? (
          <InlineNote kind="error">{loadError}</InlineNote>
        ) : items.length === 0 ? (
          <EmptyBlock message="No activity recorded for this lead yet." />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.activity_id} className="flex gap-3">
                <Avatar name={item.created_by_name} system={item.is_generated} />
                <div className="flex-1 min-w-0">
                  <p
                    className={
                      item.is_generated
                        ? 'text-stone-500 italic leading-snug whitespace-pre-wrap'
                        : 'text-stone-800 leading-snug whitespace-pre-wrap'
                    }
                    style={{ fontSize: 13 }}
                  >
                    {item.lead_comments}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-stone-400" style={{ fontSize: 11 }}>
                    <span className="font-medium text-stone-500">
                      {item.is_generated ? 'System' : item.created_by_name}
                    </span>
                    <span>·</span>
                    <span>{fmtDateTime(item.created_date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
