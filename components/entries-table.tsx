'use client'

import { Entry } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

interface EntriesTableProps {
  entries: Entry[]
  isLoading: boolean
}

const statusConfig = {
  CREATED: { label: 'Created', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  STAGE_1: { label: 'Processing Stage 1', className: 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-200' },
  STAGE_2: { label: 'Processing Stage 2', className: 'bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-200' },
  COMPLETED: { label: 'Completed', className: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-200' }
}

export function EntriesTable({ entries, isLoading }: EntriesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 border rounded-lg overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border-b last:border-b-0 flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-32" />
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No entries yet. Create one to get started!</p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/3">Title</TableHead>
            <TableHead className="w-1/6">Status</TableHead>
            <TableHead className="w-1/4">Progress</TableHead>
            <TableHead className="w-1/4">Result</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const config = statusConfig[entry.status as keyof typeof statusConfig]
            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium truncate">{entry.title}</TableCell>
                <TableCell>
                  <Badge className={config.className}>
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Progress value={entry.progress} className="h-2" />
                    <span className="text-xs text-muted-foreground">{entry.progress}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                  {entry.result || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(entry.createdAt), 'MMM dd, HH:mm:ss')}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
