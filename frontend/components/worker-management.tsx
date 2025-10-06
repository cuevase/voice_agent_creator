"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, User, Mail, Briefcase, AlertCircle, Loader2, CheckCircle } from "lucide-react"
import { createWorker, getWorkers } from "@/lib/api"

interface Worker {
  worker_id: string
  worker_name: string
  worker_email: string
  worker_role: string
  worker_available: boolean
  created_at?: string
}

interface WorkerManagementProps {
  companyId: string
  onWorkerAdded?: () => void
}

export function WorkerManagement({ companyId, onWorkerAdded }: WorkerManagementProps) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [showForm, setShowForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    worker_name: "",
    worker_email: "",
    worker_role: "",
    worker_available: true,
  })

  useEffect(() => {
    loadWorkers()
  }, [companyId])

  const loadWorkers = async () => {
    try {
      setIsLoadingWorkers(true)
      setError(null)
      console.log("Loading workers for company:", companyId)
      const result = await getWorkers(companyId)
      console.log("Workers API response:", result)
      setWorkers(result)
      console.log("Workers state set to:", result)
    } catch (error) {
      console.error("Error loading workers:", error)
      setError("Error al cargar los trabajadores. Por favor intenta de nuevo.")
    } finally {
      setIsLoadingWorkers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const workerData = {
        ...formData,
        company_id: companyId,
      }

      const result = await createWorker(workerData)

      if (result.message === "Worker created successfully") {
        setSuccess("¡Trabajador agregado exitosamente!")
        setFormData({
          worker_name: "",
          worker_email: "",
          worker_role: "",
          worker_available: true,
        })
        setShowForm(false)
        loadWorkers()
        
        // Notify parent component that a worker was added
        if (onWorkerAdded) {
          onWorkerAdded()
        }

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (error) {
      console.error("Error creating worker:", error)
      setError("Error al agregar trabajador. Por favor intenta de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingWorkers) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Cargando trabajadores...</span>
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
        <h3 className="text-lg font-semibold">Miembros del Equipo</h3>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar Trabajador
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Agregar Nuevo Trabajador</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="worker_name">Nombre *</Label>
                  <Input
                    id="worker_name"
                    value={formData.worker_name}
                    onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                    placeholder="Ingresa el nombre del trabajador"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="worker_email">Email *</Label>
                  <Input
                    id="worker_email"
                    type="email"
                    value={formData.worker_email}
                    onChange={(e) => setFormData({ ...formData, worker_email: e.target.value })}
                    placeholder="Ingresa el email del trabajador"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="worker_role">Rol *</Label>
                  <Select
                    value={formData.worker_role}
                    onValueChange={(value) => setFormData({ ...formData, worker_role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="support">Agente de Soporte</SelectItem>
                      <SelectItem value="sales">Representante de Ventas</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="technical">Soporte Técnico</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="available">Disponible</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="available"
                      checked={formData.worker_available}
                      onCheckedChange={(checked) => setFormData({ ...formData, worker_available: checked })}
                    />
                    <span className="text-sm text-gray-600">
                      {formData.worker_available ? "Disponible" : "No Disponible"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Agregando...
                    </>
                  ) : (
                    "Agregar Trabajador"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map((worker) => (
          <Card key={worker.worker_id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{worker.worker_name}</h4>
                    <div className="flex items-center space-x-1 text-sm text-gray-500 mt-1">
                      <Mail className="h-3 w-3" />
                      <span>{worker.worker_email}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-500 mt-1">
                      <Briefcase className="h-3 w-3" />
                      <span className="capitalize">{worker.worker_role}</span>
                    </div>
                  </div>
                </div>
                <Badge variant={worker.worker_available ? "default" : "secondary"}>
                  {worker.worker_available ? "Disponible" : "No Disponible"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workers.length === 0 && !isLoadingWorkers && (
        <div className="text-center py-8 text-gray-500">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No workers added yet. Click "Add Worker" to start.</p>
        </div>
      )}
    </div>
  )
}
