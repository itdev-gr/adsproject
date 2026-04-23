'use client'

interface WorkspaceSummary {
  id: string
  name: string
  slug: string
}

export function WorkspaceSwitcher({
  workspaces,
  activeSlug,
}: {
  workspaces: WorkspaceSummary[]
  activeSlug: string | null
}) {
  const active = activeSlug ? workspaces.find((w) => w.slug === activeSlug) : null
  return <div className="text-sm font-medium">{active?.name ?? 'Personal'}</div>
}
