"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Calendar,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  Clock,
  UserPlus,
  RotateCcw,
  Wrench,
} from "lucide-react"
import { WorkerManagement } from "./worker-management"
import { DragDropSchedule } from "./drag-drop-schedule"
import {
  enableSchedulingTool,
  enableCreateAppointmentTool,
  getWorkers,
  getTimeSlots,
  checkIfToolsExist,
  type Tool,
} from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/language-context"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://39e547b6a29c.ngrok-free.app"

interface WorkersScheduleSetupProps {
  companyId: string
  companyName: string
  onSetupComplete: () => void
  onSkip: () => void
  skipOnboarding?: boolean // New prop to bypass onboarding
}

export function WorkersScheduleSetup({ companyId, companyName, onSetupComplete, onSkip, skipOnboarding = false }: WorkersScheduleSetupProps) {
  const { t } = useLanguage()
  const [wantScheduling, setWantScheduling] = useState<boolean | null>(null)
  const [enableTool, setEnableTool] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workers, setWorkers] = useState<any[]>([])
  const [timeSlots, setTimeSlots] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [hasExistingData, setHasExistingData] = useState(false)
  const [existingTools, setExistingTools] = useState<Tool[]>([])
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [hasCheckAvailabilityTool, setHasCheckAvailabilityTool] = useState<boolean>(false)
  const [isCheckingTool, setIsCheckingTool] = useState(true)

  useEffect(() => {
    // Load data and check for existing tools
    loadAllData()
    checkCheckAvailabilityTool()
    
    // If skipping onboarding, automatically set wantScheduling to true
    if (skipOnboarding) {
      setWantScheduling(true)
    }
  }, [companyId, skipOnboarding])

  const loadAllData = async () => {
    try {
      setIsLoadingData(true)
      setIsLoadingTools(true)

      const [workersResult, timeSlotsResult, toolsResult] = await Promise.all([
        getWorkers(companyId),
        getTimeSlots(companyId),
        checkIfToolsExist(companyId),
      ])

      setWorkers(workersResult)
      setTimeSlots(timeSlotsResult)
      setExistingTools(Array.isArray(toolsResult) ? toolsResult : [])

      // Check if we have existing data
      const hasData = workersResult.length > 0 && timeSlotsResult.length > 0
      setHasExistingData(hasData)

      // If we have existing data and haven't made a choice yet, set to want scheduling
      if (hasData && wantScheduling === null) {
        setWantScheduling(true)
      }

      console.log("Existing tools:", toolsResult)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setIsLoadingData(false)
      setIsLoadingTools(false)
    }
  }

  const refreshData = async () => {
    await loadAllData()
  }

  const handleWorkerAdded = async () => {
    console.log("Worker added, refreshing data...")
    await refreshData()
  }

  const handleTimeSlotAdded = async () => {
    console.log("Time slot added, refreshing data...")
    await refreshData()
  }

  const hasSchedulingTools = () => {
    if (!Array.isArray(existingTools)) {
      return false
    }
    return (
      existingTools.some((tool) => tool.name === "add_check_availability_tool_to_company") &&
      existingTools.some((tool) => tool.name === "add_create_appointment_tool_to_company")
    )
  }

  const getExistingToolNames = () => {
    if (!Array.isArray(existingTools)) {
      return []
    }
    return existingTools.map((tool) => tool.name)
  }

  const handleConfirm = async () => {
    if (!wantScheduling) {
      onSkip()
      return
    }

    // If we have existing data and tools, just proceed
    if (hasExistingData && hasSchedulingTools()) {
      onSetupComplete()
      return
    }

    if (workers.length === 0) {
      setError("Por favor agrega al menos un trabajador antes de habilitar la herramienta de programación.")
      return
    }

    if (timeSlots.length === 0) {
      setError("Por favor agrega al menos un horario antes de habilitar la herramienta de programación.")
      return
    }

    // If tools already exist, just proceed
    if (hasSchedulingTools()) {
      onSetupComplete()
      return
    }

    if (!enableTool) {
      onSetupComplete()
      return
    }

    // Don't enable tools if check_availability tool already exists
    if (hasCheckAvailabilityTool) {
      onSetupComplete()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Enable both scheduling tools
      console.log("Enabling scheduling tools for company:", companyId)

      const [checkAvailabilityResult, createAppointmentResult] = await Promise.all([
        enableSchedulingTool(companyId),
        enableCreateAppointmentTool(companyId),
      ])

      console.log("Check availability tool result:", checkAvailabilityResult)
      console.log("Create appointment tool result:", createAppointmentResult)

      // Refresh tools data to reflect the changes
      await loadAllData()

      onSetupComplete()
    } catch (error) {
      console.error("Error enabling scheduling tools:", error)
      // If the error is about tool already being enabled, just proceed
      if (error instanceof Error && error.message.includes("already")) {
        onSetupComplete()
      } else {
        setError(error instanceof Error ? error.message : t('workers.setup.error'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const checkCheckAvailabilityTool = async () => {
    try {
      setIsCheckingTool(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No authenticated session found")
      }

      const response = await fetch(`${API_BASE_URL}/get_check_availability_and_schedule_tool?company_id=${companyId}`, {
        headers: {
          "ngrok-skip-browser-warning": "true",
          "Authorization": `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to check for check_availability tool")
      }

      const result = await response.text()
      setHasCheckAvailabilityTool(result === "tool found")
    } catch (error) {
      console.error("Error checking for check_availability tool:", error)
      setHasCheckAvailabilityTool(false)
    } finally {
      setIsCheckingTool(false)
    }
  }

  // Show loading while checking for existing data
  if ((isLoadingData || isLoadingTools) && wantScheduling === null) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">{t('workers.setup.checking')}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If no existing data and not skipping onboarding, show the choice
  if (wantScheduling === null && !hasExistingData && !skipOnboarding) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('workers.setup.title')}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {t('workers.setup.question')} <strong>{companyName}</strong>?
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="border-green-200 hover:border-green-300 cursor-pointer transition-colors"
              onClick={() => setWantScheduling(true)}
            >
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="font-semibold text-green-800 mb-2">{t('workers.setup.yes')}</h3>
                <p className="text-sm text-green-700">
                  {t('workers.setup.description')}
                </p>
              </CardContent>
            </Card>

            <Card
              className="border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
              onClick={() => setWantScheduling(false)}
            >
              <CardContent className="p-6 text-center">
                <ArrowRight className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <h3 className="font-semibold text-gray-800 mb-2">{t('workers.setup.skipNow')}</h3>
                <p className="text-sm text-gray-700">
                  {t('workers.setup.skipNow.desc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!wantScheduling) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ArrowRight className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('workers.setup.skip.title')}</h3>
          <p className="text-gray-600 mb-4">{t('workers.setup.skip.description')}</p>
          <Button onClick={onSkip}>{t('workers.setup.skip.button')}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('workers.setup.management')}
            {hasExistingData && <Badge variant="default">{t('workers.setup.existing.badge')}</Badge>}
            {hasSchedulingTools() && <Badge variant="secondary">{t('workers.setup.tools.badge')}</Badge>}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {hasExistingData
              ? `${t('workers.setup.existing.description')} ${companyName} o haz cambios según sea necesario.`
              : `${t('workers.setup.new.description')} ${companyName}`}
          </p>
        </CardHeader>
      </Card>

      {hasExistingData && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {t('workers.setup.existingFound')} {t('workers.setup.continue')}
          </AlertDescription>
        </Alert>
      )}

      {hasSchedulingTools() && (
        <Alert>
          <Wrench className="h-4 w-4" />
          <AlertDescription>
            {t('workers.setup.tools.enabled')}
            {t('workers.setup.tools.available')}
            <div className="mt-2 text-xs text-gray-600">
              {t('workers.setup.tools.list')} {getExistingToolNames().join(", ")}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Workers Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>{t('workers.setup.team.title')}</CardTitle>
              <Badge variant="outline" className="ml-2">
                {workers.length} {t('worker.add')}{workers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoadingData}>
              {isLoadingData ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('workers.setup.update')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">Cargando trabajadores...</span>
            </div>
          ) : (
            <WorkerManagement companyId={companyId} onWorkerAdded={handleWorkerAdded} />
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Schedule Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>{t('workers.setup.scheduleManagement')}</CardTitle>
              <Badge variant="outline" className="ml-2">
                {timeSlots.length} {t('workers.setup.schedules')}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoadingData || workers.length === 0}>
              {isLoadingData ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('workers.setup.update')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">Cargando horarios...</span>
            </div>
          ) : !workers || workers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                              <p>{t('workers.setup.schedule.required')}</p>
            </div>
          ) : (
            <DragDropSchedule companyId={companyId} workers={workers} onTimeSlotAdded={handleTimeSlotAdded} />
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Tool Configuration - Only show if tools don't exist and check_availability tool doesn't exist */}
      {!hasSchedulingTools() && !hasCheckAvailabilityTool && !isCheckingTool && (
        <Card>
          <CardHeader>
            <CardTitle>{t('workers.setup.tools.config.title')}</CardTitle>
            <p className="text-sm text-gray-600">
              {t('workers.setup.tools.config.description')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="enable-tool"
                checked={enableTool}
                onCheckedChange={setEnableTool}
                disabled={!workers || workers.length === 0 || timeSlots.length === 0}
              />
              <Label htmlFor="enable-tool" className="flex items-center gap-2">
                {t('workers.setup.tools.enable.button')}
                {enableTool && <Badge variant="default">Se Habilitará</Badge>}
              </Label>
            </div>

            {enableTool && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('workers.setup.tools.capabilities')}
                  {t('workers.setup.tools.manage')}
                  <div className="mt-2 text-xs text-gray-600">
                    Se habilitará: add_check_availability_tool_to_company, add_create_appointment_tool_to_company
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {(!workers || workers.length === 0 || timeSlots.length === 0) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('workers.setup.tools.requirements')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show message if check_availability tool already exists */}
      {hasCheckAvailabilityTool && !isCheckingTool && (
        <Card>
          <CardHeader>
            <CardTitle>{t('workers.setup.tools.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {t('workers.setup.tools.already.enabled')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Show loading state while checking */}
      {isCheckingTool && (
        <Card>
          <CardHeader>
            <CardTitle>{t('workers.setup.tools.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">{t('workers.setup.tools.checking')}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setWantScheduling(null)} disabled={hasExistingData}>
          {t('workers.setup.back')}
        </Button>

        <Button onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {enableTool ? t('workers.setup.tools.enabling') : t('workers.setup.tools.saving')}
            </>
          ) : (
            <>
              {hasSchedulingTools()
                ? t('workers.setup.continue.voice')
                : hasExistingData
                  ? t('workers.setup.continue.voice')
                  : enableTool
                    ? t('workers.setup.enable.and.continue')
                    : t('workers.setup.continue.without.tools')}
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
