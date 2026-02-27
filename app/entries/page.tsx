'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEntries } from '@/lib/api'
import { EntriesTable } from '@/components/entries-table'
import { CreateEntryDialog } from '@/components/create-entry-dialog'
import { useState } from 'react'

const queryClient = new QueryClient()

function EntriesContent() {
  const { data: entries = [], isLoading, error } = useEntries()

  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Async Workflow Demo</h1>
          <p className="text-muted-foreground">
            Create entries and watch them progress through automated workflow stages.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6">
          <CreateEntryDialog />
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-destructive text-sm">
              Error loading entries. Please try refreshing the page.
            </p>
          </div>
        )}

        {/* Table */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Entries</h2>
          <EntriesTable entries={entries} isLoading={isLoading} />
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-card border rounded-lg">
          <h3 className="font-semibold text-foreground mb-2">How it works</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Each entry starts in CREATED status</li>
            <li>• The background worker processes it through STAGE_1 → STAGE_2 → COMPLETED</li>
            <li>• Each stage takes 2 seconds and updates the progress bar</li>
            <li>• The table refreshes every 2 seconds to show live updates</li>
            <li>• Database-level locking prevents concurrent processing</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

export default function EntriesPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <EntriesContent />
    </QueryClientProvider>
  )
}