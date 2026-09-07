'use client'

import { useState } from 'react'
import { supabase, type Blog, type Section } from '@/lib/supabase'

type Props = {
  blog: Blog
  sections: Section[]
}

type Format = 'rich' | 'markdown' | 'plain'

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function bodyOf(s: Section) {
  return s.content_final || s.content || ''
}

// Split a section body into ordered blocks.
// A line beginning with "### " becomes an H3; everything else is a paragraph.
function parseBlocks(text: string): { type: 'h3' | 'p'; text: string }[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line =>
      line.startsWith('### ')
        ? { type: 'h3' as const, text: line.slice(4).trim() }
        : { type: 'p' as const, text: line }
    )
}

function buildHtml(blog: Blog, sections: Section[]) {
  let html = `<h1>${esc(blog.title)}</h1>`
  for (const s of sections) {
    if (s.h2) html += `<h2>${esc(s.h2)}</h2>`
    for (const b of parseBlocks(bodyOf(s))) {
      html += b.type === 'h3' ? `<h3>${esc(b.text)}</h3>` : `<p>${esc(b.text)}</p>`
    }
  }
  return html
}

function buildMarkdown(blog: Blog, sections: Section[]) {
  let md = `# ${blog.title}\n\n`
  for (const s of sections) {
    if (s.h2) md += `## ${s.h2}\n\n`
    for (const b of parseBlocks(bodyOf(s))) {
      md += b.type === 'h3' ? `### ${b.text}\n\n` : `${b.text}\n\n`
    }
  }
  return md.trim()
}

function buildPlain(blog: Blog, sections: Section[]) {
  let t = `${blog.title}\n\n`
  for (const s of sections) {
    if (s.h2) t += `${s.h2}\n\n`
    for (const b of parseBlocks(bodyOf(s))) {
      t += `${b.text}\n\n`
    }
  }
  return t.trim()
}

export default function ExportView({ blog, sections }: Props) {
  const [format, setFormat] = useState<Format>('rich')
  const [copied, setCopied] = useState(false)
  const [approved, setApproved] = useState(blog.status === 'approved')

  const ordered = [...sections].sort((a, b) => a.position - b.position)
  const html = buildHtml(blog, ordered)
  const markdown = buildMarkdown(blog, ordered)
  const plain = buildPlain(blog, ordered)

  async function copy() {
    try {
      if (format === 'rich') {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        })
        await navigator.clipboard.write([item])
      } else {
        await navigator.clipboard.writeText(format === 'markdown' ? markdown : plain)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Copy failed', e)
    }
  }

  async function approve() {
    const { error } = await supabase
      .from('blogs')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', blog.id)
    if (!error) setApproved(true)
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {(['rich', 'markdown', 'plain'] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`text-sm px-3 py-1.5 rounded border ${
                format === f
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f === 'rich' ? 'Rich text' : f === 'markdown' ? 'Markdown' : 'Plain text'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {copied && <span className="text-xs text-green-600">Copied</span>}
          <button onClick={copy} className="text-sm px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
            Copy to clipboard
          </button>
          <button
            onClick={approve}
            disabled={approved}
            className="text-sm px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300"
          >
            {approved ? 'Approved' : 'Mark approved'}
          </button>
        </div>
      </div>

      {format === 'rich' ? (
        <div className="export-preview border border-gray-200 rounded-lg p-8 bg-white"
          dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="border border-gray-200 rounded-lg p-8 bg-white text-sm whitespace-pre-wrap font-mono">
          {format === 'markdown' ? markdown : plain}
        </pre>
      )}

      <style jsx global>{`
        .export-preview h1 { font-size: 1.875rem; font-weight: 700; margin: 0 0 1rem; }
        .export-preview h2 { font-size: 1.375rem; font-weight: 700; margin: 1.75rem 0 0.75rem; }
        .export-preview h3 { font-size: 1.125rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .export-preview p { margin: 0 0 0.85rem; line-height: 1.65; }
      `}</style>
    </div>
  )
}