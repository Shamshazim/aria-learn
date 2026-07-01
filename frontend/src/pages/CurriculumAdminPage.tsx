import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminSubject, api } from '../api'
import { useAuth } from '../auth'

type Kind = 'subjects' | 'grades' | 'units' | 'lessons' | 'topics'

interface TreeNode {
  kind: Kind
  id: string
  name: string
  active: boolean
  objectives?: string[]
  progress?: number
  children: TreeNode[]
  childKind?: Kind
  childParentField?: string
}

const CHILD_LABEL: Record<Kind, string> = {
  subjects: 'subject', grades: 'grade', units: 'unit', lessons: 'lesson', topics: 'topic',
}

function mapTree(subjects: AdminSubject[]): TreeNode[] {
  return subjects.map((s) => ({
    kind: 'subjects', id: s.id, name: s.name, active: s.active,
    childKind: 'grades', childParentField: 'subjectId',
    children: s.grades.map((g) => ({
      kind: 'grades', id: g.id, name: g.name, active: g.active,
      childKind: 'units', childParentField: 'gradeId',
      children: g.units.map((u) => ({
        kind: 'units', id: u.id, name: u.name, active: u.active,
        childKind: 'lessons', childParentField: 'unitId',
        children: u.lessons.map((l) => ({
          kind: 'lessons', id: l.id, name: l.name, active: l.active,
          childKind: 'topics', childParentField: 'unitId',
          children: l.topics.map((t) => ({
            kind: 'topics', id: t.id, name: t.name, active: t.active,
            objectives: t.objectives, progress: t.studentsWithProgress, children: [],
          })),
        })),
      })),
    })),
  }))
}

export default function CurriculumAdminPage() {
  const { logout } = useAuth()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const reload = () => api.adminCurriculum().then((s) => setTree(mapTree(s))).catch((e) => setError((e as Error).message))
  useEffect(() => { reload() }, [])

  const toggleExpand = (id: string) =>
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const addChild = async (node: TreeNode) => {
    const name = (adding[node.id] ?? '').trim()
    if (!name || !node.childKind || !node.childParentField) return
    try {
      await api.createCurriculum(node.childKind, { name, [node.childParentField]: node.id })
      setAdding((a) => ({ ...a, [node.id]: '' }))
      setExpanded((s) => new Set(s).add(node.id))
      await reload()
    } catch (e) { setError((e as Error).message) }
  }

  const rename = async (node: TreeNode) => {
    const name = window.prompt(`Rename this ${CHILD_LABEL[node.kind]}:`, node.name)
    if (!name || name.trim() === node.name) return
    try { await api.updateCurriculum(node.kind, node.id, { name: name.trim() }); await reload() }
    catch (e) { setError((e as Error).message) }
  }

  const editObjectives = async (node: TreeNode) => {
    const current = (node.objectives ?? []).join('\n')
    const input = window.prompt('Learning objectives (one per line):', current)
    if (input === null) return
    const objectives = input.split('\n').map((s) => s.trim()).filter(Boolean)
    try { await api.updateCurriculum('topics', node.id, { name: node.name, objectives }); await reload() }
    catch (e) { setError((e as Error).message) }
  }

  const toggleActive = async (node: TreeNode) => {
    if (node.active && node.kind === 'topics' && (node.progress ?? 0) > 0) {
      if (!window.confirm(`${node.progress} student(s) have progress on "${node.name}". `
        + `Deactivating hides it from students but keeps their history. Continue?`)) return
    } else if (node.active) {
      if (!window.confirm(`Deactivate "${node.name}"? It will be hidden from students.`)) return
    }
    try { await api.updateCurriculum(node.kind, node.id, { name: node.name, active: !node.active }); await reload() }
    catch (e) { setError((e as Error).message) }
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const open = expanded.has(node.id)
    const hasChildArea = !!node.childKind
    return (
      <div key={node.id} className="cur-node" style={{ marginLeft: depth * 18 }}>
        <div className={`cur-row ${node.active ? '' : 'cur-row--inactive'}`}>
          {hasChildArea ? (
            <button className="cur-caret" onClick={() => toggleExpand(node.id)}>{open ? '▾' : '▸'}</button>
          ) : <span className="cur-caret-spacer" />}
          <span className="cur-name">{node.name}</span>
          {!node.active && <span className="cur-badge">inactive</span>}
          {node.kind === 'topics' && (node.progress ?? 0) > 0 && (
            <span className="cur-progress" title="students with progress">👤 {node.progress}</span>
          )}
          <span className="cur-actions">
            <button className="cur-btn" onClick={() => rename(node)}>✏️</button>
            {node.kind === 'topics' && <button className="cur-btn" onClick={() => editObjectives(node)} title="Objectives">🎯</button>}
            <button className="cur-btn" onClick={() => toggleActive(node)} title={node.active ? 'Deactivate' : 'Reactivate'}>
              {node.active ? '⊘' : '↺'}
            </button>
          </span>
        </div>

        {open && hasChildArea && (
          <div className="cur-children">
            {node.children.map((c) => renderNode(c, depth + 1))}
            <div className="cur-add" style={{ marginLeft: (depth + 1) * 18 }}>
              <input
                placeholder={`New ${CHILD_LABEL[node.childKind!]} name`}
                value={adding[node.id] ?? ''}
                onChange={(e) => setAdding((a) => ({ ...a, [node.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addChild(node)}
              />
              <button className="btn btn--primary" onClick={() => addChild(node)}>Add {CHILD_LABEL[node.childKind!]}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">🦉 Aria <span className="muted">· Curriculum</span></div>
        <div className="topbar-right">
          <Link className="btn btn--ghost" to="/parent">← Dashboard</Link>
          <button className="btn btn--ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="container narrow">
        <h2>Curriculum</h2>
        <p className="muted">Add and edit subjects, grades, units, lessons, and topics. Deleting is a soft hide — student history is always kept.</p>
        {error && <div className="error">{error}</div>}

        <div className="card cur-tree">
          {tree.map((n) => renderNode(n, 0))}
          <div className="cur-add">
            <input
              placeholder="New subject name"
              value={adding['__root__'] ?? ''}
              onChange={(e) => setAdding((a) => ({ ...a, __root__: e.target.value }))}
            />
            <button className="btn btn--primary" onClick={async () => {
              const name = (adding['__root__'] ?? '').trim()
              if (!name) return
              try { await api.createCurriculum('subjects', { name }); setAdding((a) => ({ ...a, __root__: '' })); await reload() }
              catch (e) { setError((e as Error).message) }
            }}>Add subject</button>
          </div>
        </div>
      </main>
    </div>
  )
}
