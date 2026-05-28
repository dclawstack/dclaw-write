"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ApiError,
  Document,
  Project,
  createDocument,
  createProject,
  deleteProject,
  listDocuments,
  listProjects,
} from "@/lib/api"

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState("")
  const [newDocumentTitle, setNewDocumentTitle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (preferProjectId?: string | null) => {
    setError(null)
    try {
      const projectsResp = await listProjects()
      setProjects(projectsResp.items)
      const nextActive =
        preferProjectId !== undefined
          ? preferProjectId
          : projectsResp.items.find((p) => p.id === activeProjectId)?.id ??
            projectsResp.items[0]?.id ??
            null
      setActiveProjectId(nextActive)
      const docsResp = nextActive ? await listDocuments(nextActive) : { items: [], total: 0 }
      setDocuments(docsResp.items)
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Failed to load data"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [activeProjectId])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    try {
      const created = await createProject({ name: newProjectName.trim() })
      setNewProjectName("")
      await refresh(created.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create project")
    }
  }

  const onSelectProject = async (id: string) => {
    setActiveProjectId(id)
    try {
      const docsResp = await listDocuments(id)
      setDocuments(docsResp.items)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load documents")
    }
  }

  const onDeleteProject = async (id: string) => {
    try {
      await deleteProject(id)
      await refresh(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete project")
    }
  }

  const onCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProjectId || !newDocumentTitle.trim()) return
    try {
      await createDocument({
        project_id: activeProjectId,
        title: newDocumentTitle.trim(),
      })
      setNewDocumentTitle("")
      const docsResp = await listDocuments(activeProjectId)
      setDocuments(docsResp.items)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create document")
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-700">
              ← Landing
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">DClaw Write</h1>
            <p className="text-slate-600">
              Long-form writing with Voice DNA, citation-grounded AI, and multi-agent drafting.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/brand"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              Voice DNA →
            </Link>
            <Link
              href="/analytics"
              className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              Analytics →
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Group related documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && <p className="text-sm text-slate-500">Loading…</p>}
              {!loading && projects.length === 0 && (
                <p className="text-sm text-slate-500">
                  No projects yet. Create your first one below.
                </p>
              )}
              <ul className="space-y-1">
                {projects.map((project) => {
                  const isActive = project.id === activeProjectId
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                        className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                          isActive
                            ? "bg-blue-100 text-blue-900"
                            : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{project.name}</span>
                        {isActive && (
                          <span className="text-xs uppercase tracking-wide text-blue-700">
                            active
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <form onSubmit={onCreateProject} className="w-full space-y-2">
                <Label htmlFor="new-project">New project</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-project"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Q3 Newsletters"
                  />
                  <Button type="submit" disabled={!newProjectName.trim()}>
                    Add
                  </Button>
                </div>
              </form>
              {activeProjectId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onDeleteProject(activeProjectId)}
                >
                  Delete active project
                </Button>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {activeProjectId
                  ? "Open a document to edit, or create a new one."
                  : "Create a project to start writing."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeProjectId && documents.length === 0 && (
                <p className="text-sm text-slate-500">
                  No documents in this project yet.
                </p>
              )}
              <ul className="divide-y divide-slate-200">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700"
                      >
                        {doc.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {doc.word_count} words · {Math.max(1, Math.round(doc.reading_time_seconds / 60))} min read · {doc.status}
                      </div>
                    </div>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="text-sm text-blue-700 hover:underline"
                    >
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
            {activeProjectId && (
              <CardFooter>
                <form onSubmit={onCreateDocument} className="flex w-full gap-2">
                  <Input
                    value={newDocumentTitle}
                    onChange={(e) => setNewDocumentTitle(e.target.value)}
                    placeholder="New document title"
                  />
                  <Button type="submit" disabled={!newDocumentTitle.trim()}>
                    New document
                  </Button>
                </form>
              </CardFooter>
            )}
          </Card>
        </section>
      </div>
    </main>
  )
}
