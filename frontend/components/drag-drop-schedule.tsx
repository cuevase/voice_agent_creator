"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Clock, Plus, GripVertical, AlertCircle, Loader2, User, CheckCircle } from "lucide-react"
import { getWorkers, createTimeSlot, getTimeSlots } from "@/lib/api"

interface Worker {
  id: string // UUID string
  worker_id?: string // UUID string (for backward compatibility)
  worker_name: string
  worker_email: string
  worker_role: string
  worker_available: boolean
}

interface TimeSlot {
  id: string
  worker_id: string // UUID string
  day: string
  start_time: string
  end_time: string
  available: boolean
  workers?: {
    worker_name: string
  }
}

interface DragDropScheduleProps {
  companyId: string
  workers: any[]
  onTimeSlotAdded?: () => void
}

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const SPANISH_TO_ENGLISH_DAYS: { [key: string]: string } = {
  Lunes: "Monday",
  Martes: "Tuesday",
  Miércoles: "Wednesday",
  Jueves: "Thursday",
  Viernes: "Friday",
  Sábado: "Saturday",
  Domingo: "Sunday",
}

const ENGLISH_TO_SPANISH_DAYS: { [key: string]: string } = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
}

const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]

export function DragDropSchedule({ companyId, workers, onTimeSlotAdded }: DragDropScheduleProps) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string>("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggedSlot, setDraggedSlot] = useState<TimeSlot | null>(null)
  const [formData, setFormData] = useState({
    day: "",
    start_time: "",
    end_time: "",
    available: true,
  })
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (workers && workers.length > 0) {
      loadData()
    }
  }, [companyId, workers])

  // Helper function to get worker ID safely - now returns UUID string
  const getWorkerId = (worker: Worker): string => {
    return worker.id || worker.worker_id || ""
  }

  // Helper function to normalize day names
  const normalizeDay = (day: string): string => {
    return SPANISH_TO_ENGLISH_DAYS[day] || day
  }

  // Helper function to format time
  const formatTime = (time: string): string => {
    if (time.includes(":")) {
      return time.substring(0, 5) // Get HH:MM from HH:MM:SS
    }
    return time
  }

  const loadData = async () => {
    try {
      setIsLoadingData(true)
      setError(null)

      // Only load time slots since workers are passed as props
      const timeSlotsResult = await getTimeSlots(companyId)

      // Process time slots - worker_id is already a UUID string
      const processedTimeSlots = Array.isArray(timeSlotsResult) ? timeSlotsResult.map((slot: any) => {
        const normalizedDay = normalizeDay(slot.day)
        const processedSlot = {
          ...slot,
          day: normalizedDay,
          start_time: formatTime(slot.start_time),
          end_time: formatTime(slot.end_time),
          worker_id: slot.worker_id, // Already a UUID string
        }
        return processedSlot
      }) : []

      setTimeSlots(processedTimeSlots)
    } catch (error) {
      console.error("DragDropSchedule: Error loading data:", error)
      setError(`Error al cargar los datos del horario: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWorker) {
      setError("Por favor selecciona un trabajador")
      return
    }

    if (!formData.day || !formData.start_time || !formData.end_time) {
      setError("Por favor completa todos los campos requeridos")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // selectedWorker is already a UUID string, no need to convert
      const result = await createTimeSlot({
        worker_id: selectedWorker, // UUID string
        day: normalizeDay(formData.day),
        start_time: formData.start_time,
        end_time: formData.end_time,
        available: formData.available,
      })

      if (result.message === "Time slot created successfully") {
        setSuccess("¡Horario agregado exitosamente!")
        setFormData({
          day: "",
          start_time: "",
          end_time: "",
          available: true,
        })
        setSelectedWorker("")
        setIsDialogOpen(false)
        await loadData()

        // Notify parent component that a timeslot was added
        if (onTimeSlotAdded) {
          onTimeSlotAdded()
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError("Error al crear el horario. Por favor intenta de nuevo.")
      }
    } catch (error) {
      console.error("Error creating time slot:", error)
      setError(`Error al agregar horario: ${error instanceof Error ? error.message : "Error desconocido"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, slot: TimeSlot) => {
    setDraggedSlot(slot)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetDay: string, targetWorker: Worker) => {
    e.preventDefault()
    if (!draggedSlot) return

    // Remove this alert and implement actual functionality or just remove it:
    // alert(`Moviendo horario ${draggedSlot.start_time}-${draggedSlot.end_time} a ${ENGLISH_TO_SPANISH_DAYS[targetDay] || targetDay} para ${targetWorker.worker_name}`)

    setDraggedSlot(null)
  }

  const getWorkerTimeSlots = (workerId: string, day: string) => {
    const slots = timeSlots.filter((slot) => {
      // Both are now UUID strings, direct comparison
      return slot.worker_id === workerId && slot.day === day
    })
    return slots
  }

  const getWorkerName = (workerId: string): string => {
    const worker = workers.find((w) => getWorkerId(w) === workerId)
    return worker?.worker_name || `Trabajador ${workerId}`
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Cargando horarios...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Horario Semanal - Arrastrar y Soltar</h3>
          <p className="text-sm text-gray-600">
            {timeSlots.length} horarios encontrados para {workers.length} trabajadores
          </p>
        </div>
        <Button
          onClick={() => {
            if (!workers || workers.length === 0) {
              setError("No hay trabajadores disponibles. Por favor agrega trabajadores primero.")
              return
            }
            setIsDialogOpen(true)
          }}
          disabled={isLoadingData}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Horario
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Horario</DialogTitle>
          </DialogHeader>
          {isLoadingData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">Cargando trabajadores...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Trabajador</Label>
              <Select value={selectedWorker} onValueChange={setSelectedWorker} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona trabajador" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map((worker) => (
                    <SelectItem key={getWorkerId(worker)} value={getWorkerId(worker)}>
                      {worker.worker_name} ({worker.worker_email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workers.length === 0 && (
                <p className="text-sm text-red-500">
                  No se encontraron trabajadores. Por favor agrega trabajadores primero.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Día</Label>
              <Select value={formData.day} onValueChange={(value) => setFormData({ ...formData, day: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona día" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora de Inicio</Label>
                <Select
                  value={formData.start_time}
                  onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hora inicio" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Hora de Fin</Label>
                <Select
                  value={formData.end_time}
                  onValueChange={(value) => setFormData({ ...formData, end_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Hora fin" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.available}
                onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
              />
              <Label>Disponible</Label>
            </div>

            <div className="flex space-x-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  "Agregar Horario"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {!workers || workers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No hay trabajadores disponibles. Por favor agrega trabajadores primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day) => (
            <Card key={day} className="min-h-[400px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-center">{day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {workers.map((worker, index) => {
                  const workerId = getWorkerId(worker)
                  const normalizedDay = SPANISH_TO_ENGLISH_DAYS[day] || day
                  const workerSlots = getWorkerTimeSlots(workerId, normalizedDay)

                  return (
                    <div
                      key={`worker-${index}-${workerId}`}
                      className="space-y-1 p-2 border rounded-lg bg-gray-50 min-h-[80px]"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, normalizedDay, worker)}
                    >
                      <div className="flex items-center space-x-1 text-xs font-medium text-gray-600">
                        <User className="h-3 w-3" />
                        <span className="truncate">{worker.worker_name || "Trabajador Desconocido"}</span>
                      </div>
                      {workerSlots.length > 0 ? (
                        workerSlots.map((slot, slotIndex) => (
                          <div
                            key={`slot-${slot.id}-${slotIndex}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, slot)}
                            className="cursor-move hover:shadow-md transition-shadow"
                          >
                            <Badge
                              variant={slot.available ? "default" : "destructive"}
                              className={`text-xs w-full justify-center flex items-center gap-1 py-1 ${
                                slot.available
                                  ? "bg-green-500 hover:bg-green-600 text-white border-green-500"
                                  : "bg-red-500 hover:bg-red-600 text-white border-red-500"
                              }`}
                            >
                              <GripVertical className="h-3 w-3" />
                              <Clock className="h-3 w-3" />
                              <span>
                                {slot.start_time}-{slot.end_time}
                              </span>
                              {slot.available ? (
                                <span className="ml-1 text-xs">✓</span>
                              ) : (
                                <span className="ml-1 text-xs">✗</span>
                              )}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-400 text-center py-2 border-2 border-dashed border-gray-200 rounded">
                          Suelta horarios aquí
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}