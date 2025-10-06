"use client"

import { DragDropSchedule } from "./drag-drop-schedule"

interface ScheduleDashboardProps {
  companyId: string
}

export function ScheduleDashboard({ companyId }: ScheduleDashboardProps) {
  return <DragDropSchedule companyId={companyId} workers={[]} />
}
