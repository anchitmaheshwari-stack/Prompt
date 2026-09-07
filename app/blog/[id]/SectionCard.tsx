'use client'

import { useState } from 'react'
import { getSupabase, type Section, type Issue } from '@/lib/supabase'

type Props = {
  section: Section
  issues: Issue[]
  index: number
}

type IssueStatus = 'active' | 'applied' | 'dismissed'

export default function SectionCard({ section, issues, index }: Props) {
  const [content, setContent] = useState(section.content_final || section.content)
  const [issueStatus, setIssueStatus] = useState<Record<string, IssueStatus>>(
    Object.fromEntries(issues.map(i => [i.id, 'active' as IssueStatus]))
  )
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [resolved, setResolved] = useState(section.resolved)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const activeIssues = issues.filter(i => issueStatus[i.id] === 'active')
  const appliedCount = issues.filter(i => issueStatus[i.id] === 'applied').length
  const dismissedCount = issues.filter(i => issueStatus[i.id] === 'dismissed').length

  function applyFix(issue: Issue) {
    if (content.includes(issue.quote)) {
      setContent(content.replace(issue.quote, issue.suggested_fix))
    }
    setIssueStatus(prev => ({ ...prev, [issue.id]: 'applied' }))
    setActiveIssueId(null)
  }

  function dismissIssue(issue: Issue) {
    setIssueStatus(prev => ({ ...prev, [issue.id]: 'dismissed' }))
    setActiveIssueId(null)
  }

  async function saveSection() {
    setSaving(true)
    const { error } = await getSupabase()
      .from('sections')
      .update({ content_final: content, resolved })
      .eq('id', section.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  function renderContent() {
    if (editMode) {
      return (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full min-h-[200px] p-3 border border-gray-300 rounded-md text-sm leading-relaxed font-mono"
        />
      )
    }

    // Find all active issue quote positions
    const matches: { start: number; end: number; issue: Issue }[] = []
    for (const issue of activeIssues) {
      const idx = content.indexOf(issue.quote)
      if (idx !== -1) {
        matches.push({ start: idx, end: idx + issue.quote.length, issue })
      }
    }
    matches.sort((a, b) => a.start - b.start)

    // Drop overlapping matches (keep earliest)
    const filtered: typeof matches = []
    let lastEnd = 0
    for (const m of matches) {
      if (m.start >= lastEnd) {
        filtered.push(m)
        lastEnd = m.end
      }
    }

    // Build JSX with highlights
    const parts: React.ReactNode[] = []
    let cursor = 0
    for (const m of filtered) {
      if (m.start > cursor) {
        parts.push(<span key={`t-${cursor}`}>{content.slice(cursor, m.start)}</span>)
      }
      const isActive = activeIssueId === m.issue.id
      parts.push(
        <mark
          key={m.issue.id}
          onClick={() => setActiveIssueId(isActive ? null : m.issue.id)}
          className={`cursor-pointer rounded px-0.5 transition-colors ${
            isActive
              ? 'bg-yellow-400'
              : 'bg-yellow-200 hover:bg-yellow-300'
          }`}
        >
          {content.slice(m.start, m.end)}
        </mark>
      )
      cursor = m.end
    }
    if (cursor < content.length) {
      parts.push(<span key={`t-end`}>{content.slice(cursor)}</span>)
    }

    return <div className="text-sm leading-relaxed whitespace-pre-wrap">{parts}</div>
  }

  const activeIssue = issues.find(i => i.id === activeIssueId)

  const categoryColors: Record<string, string> = {
    FACTUAL_ERROR: 'bg-red-100 text-red-700',
    OUTDATED: 'bg-orange-100 text-orange-700',
    MISSING_CONTEXT: 'bg-blue-100 text-blue-700',
    WEAK_CLAIM: 'bg-purple-100 text-purple-700',
    INTERNAL_CONTRADICTION: 'bg-pink-100 text-pink-700',
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {index + 1}. {section.h2}
          </h3>
          {section.h3 && (
            <p className="text-xs text-gray-500 mt-0.5">under {section.h3}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeIssues.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">
              {activeIssues.length} {activeIssues.length === 1 ? 'issue' : 'issues'}
            </span>
          )}
          {appliedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">
              {appliedCount} applied
            </span>
          )}
          {dismissedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {dismissedCount} dismissed
            </span>
          )}
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            {editMode ? 'Done editing' : 'Edit manually'}
          </button>
        </div>
      </div>

      <div className="mt-4">{renderContent()}</div>

      {activeIssue && !editMode && (
        <div className="mt-4 border border-yellow-300 bg-yellow-50 rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${
                categoryColors[activeIssue.category] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {activeIssue.category}
            </span>
            <span className="text-xs text-gray-500">
              confidence: {activeIssue.confidence}
            </span>
          </div>
          <p className="text-sm text-gray-800 mb-2">
            <strong>Issue:</strong> {activeIssue.issue_text}
          </p>
          <p className="text-sm text-gray-800 mb-3">
            <strong>Suggested fix:</strong> {activeIssue.suggested_fix}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => applyFix(activeIssue)}
              disabled={!content.includes(activeIssue.quote)}
              className="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Apply fix
            </button>
            <button
              onClick={() => dismissIssue(activeIssue)}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Dismiss
            </button>
            <button
              onClick={() => setActiveIssueId(null)}
              className="text-sm px-3 py-1.5 rounded text-gray-500 hover:text-gray-700 ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={resolved}
            onChange={e => setResolved(e.target.checked)}
            className="rounded"
          />
          Mark resolved
        </label>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button
            onClick={saveSection}
            disabled={saving}
            className="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save section'}
          </button>
        </div>
      </div>
    </div>
  )
}