"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Wrench,
  Calendar,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  Settings,
  Code,
  Trash2,
  Copy,
} from "lucide-react"
import { enableSchedulingTool, enableCreateAppointmentTool, type Tool } from "@/lib/api"
import { createCustomTool, getCompanyTools, type ToolCreate, type ToolArgCreate } from "@/lib/tools-api"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/language-context"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"

interface ToolsConfigurationProps {
  companyId: string
  companyName: string
}

export function ToolsConfiguration({ companyId, companyName }: ToolsConfigurationProps) {
  const { t } = useLanguage()
  const [wantTools, setWantTools] = useState<boolean>(true) // Set to true by default to skip intermediate step
  const [customTools, setCustomTools] = useState<ToolCreate[]>([])
  const [existingTools, setExistingTools] = useState<Tool[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTools, setIsLoadingTools] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadExistingTools()
  }, [companyId])

  const loadExistingTools = async () => {
    try {
      setIsLoadingTools(true)
      const tools = await getCompanyTools(companyId)
      setExistingTools(tools)
    } catch (error) {
      console.error("Error loading existing tools:", error)
    } finally {
      setIsLoadingTools(false)
    }
  }

  const addCustomTool = () => {
    const newTool: ToolCreate = {
      name: "",
      description: "",
      method: "POST",
      endpoint_template: "",
      api_base_url: "",
      auth: {
        type: "none"
      },
      args: [],
    }
    setCustomTools([...customTools, newTool])
  }

  const updateCustomTool = (index: number, field: keyof ToolCreate, value: any) => {
    const updatedTools = customTools.map((tool, i) => (i === index ? { ...tool, [field]: value } : tool))
    setCustomTools(updatedTools)
  }

  const removeCustomTool = (index: number) => {
    setCustomTools(customTools.filter((_, i) => i !== index))
  }

  const addToolArg = (toolIndex: number) => {
    const newArg: ToolArgCreate = {
      name: "",
      type: "string",
      location: "query",
      required: true,
      description: "",
      example: "",
    }

    const updatedTools = customTools.map((tool, i) =>
      i === toolIndex ? { ...tool, args: [...(tool.args || []), newArg] } : tool,
    )
    setCustomTools(updatedTools)
  }

  const updateToolArg = (toolIndex: number, argIndex: number, field: keyof ToolArgCreate, value: any) => {
    const updatedTools = customTools.map((tool, i) => {
      if (i === toolIndex) {
        const updatedArgs = (tool.args || []).map((arg, j) => (j === argIndex ? { ...arg, [field]: value } : arg))
        return { ...tool, args: updatedArgs }
      }
      return tool
    })
    setCustomTools(updatedTools)
  }

  const removeToolArg = (toolIndex: number, argIndex: number) => {
    const updatedTools = customTools.map((tool, i) => {
      if (i === toolIndex) {
        return { ...tool, args: (tool.args || []).filter((_, j) => j !== argIndex) }
      }
      return tool
    })
    setCustomTools(updatedTools)
  }

  const copyExampleTool = () => {
    const exampleTool: ToolCreate = {
      name: "create_appointment",
      description: "Create a new appointment for a customer",
      method: "POST",
      endpoint_template: "/create_appointment?company_id={company_id}&day={day}&start_time={start_time}",
      api_base_url: "https://api.example.com",
      auth: {
        type: "bearer",
        token: "your-api-token"
      },
      args: [
        {
          name: "company_id",
          type: "string",
          location: "query",
          required: true,
          description: "Company ID for the appointment",
          example: "company-uuid-here",
        },
        {
          name: "day",
          type: "string",
          location: "query",
          required: true,
          description: "Day of the week for the appointment",
          example: "Monday",
        },
        {
          name: "start_time",
          type: "string",
          location: "query",
          required: true,
          description: "Start time for the appointment",
          example: "09:00",
        },
      ],
    }
    setCustomTools([...customTools, exampleTool])
  }



  // Show loading while checking for existing tools
  if (isLoadingTools) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-500">{t('tools.config.checking')}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {t('tools.config.title')}
            {existingTools.length > 0 && <Badge variant="default">{existingTools.length} {t('tools.config.existing.badge')}</Badge>}
          </CardTitle>
          <p className="text-sm text-gray-600">
            {t('tools.config.subtitle')}
          </p>
        </CardHeader>
      </Card>

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

      {/* Existing Tools */}
      {existingTools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('tools.config.existing.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {existingTools.map((tool) => (
                <div key={tool.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{tool.name}</span>
                    <p className="text-sm text-gray-600">{t('tools.config.created')} {new Date(tool.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="secondary">{t('tools.config.active')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}



      {/* Custom Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                {t('tools.config.custom')}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {t('tools.config.custom.desc')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyExampleTool}>
                <Copy className="h-4 w-4 mr-1" />
                {t('tools.config.custom.example')}
              </Button>
              <Button variant="outline" size="sm" onClick={addCustomTool}>
                <Plus className="h-4 w-4 mr-1" />
                {t('tools.config.custom.add')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {customTools.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Code className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>{t('tools.config.custom.none')}</p>
              <p className="text-sm">{t('tools.config.custom.none.desc')}</p>
            </div>
          ) : (
            customTools.map((tool, toolIndex) => (
              <Card key={toolIndex} className="border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{t('tools.config.custom.tool.badge').replace('{NUMBER}', (toolIndex + 1).toString())}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => removeCustomTool(toolIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Basic Tool Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('tools.config.custom.name')}</Label>
                      <Input
                        placeholder={t('tools.config.custom.name.placeholder')}
                        value={tool.name}
                        onChange={(e) => updateCustomTool(toolIndex, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('tools.config.custom.method')}</Label>
                      <Select
                        value={tool.method}
                        onValueChange={(value) => updateCustomTool(toolIndex, "method", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('tools.config.custom.desc.label')}</Label>
                    <Input
                      placeholder={t('tools.config.custom.desc.placeholder')}
                      value={tool.description}
                      onChange={(e) => updateCustomTool(toolIndex, "description", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('tools.config.custom.api_base_url')}</Label>
                    <Input
                      placeholder="https://api.example.com"
                      value={tool.api_base_url}
                      onChange={(e) => updateCustomTool(toolIndex, "api_base_url", e.target.value)}
                    />
                    <p className="text-xs text-gray-500">Base URL for the API (e.g., https://api.example.com)</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('tools.config.custom.endpoint')}</Label>
                    <Input
                      placeholder={t('tools.config.custom.endpoint.placeholder')}
                      value={tool.endpoint_template}
                      onChange={(e) => updateCustomTool(toolIndex, "endpoint_template", e.target.value)}
                    />
                    <p className="text-xs text-gray-500">{t('tools.config.custom.endpoint.help')}</p>
                  </div>

                  {/* Authentication Settings */}
                  <div className="space-y-3">
                    <Label>{t('tools.config.custom.auth')}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Auth Type</Label>
                        <Select
                          value={tool.auth?.type || "none"}
                          onValueChange={(value) => updateCustomTool(toolIndex, "auth", { ...tool.auth, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Authentication</SelectItem>
                            <SelectItem value="bearer">Bearer Token</SelectItem>
                            <SelectItem value="basic">Basic Auth</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(tool.auth?.type === "bearer" || tool.auth?.type === "basic") && (
                        <div className="space-y-2">
                          <Label className="text-sm">Token/Password</Label>
                          <Input
                            type="password"
                            placeholder={tool.auth?.type === "bearer" ? "Bearer token" : "Password"}
                            value={tool.auth?.token || ""}
                            onChange={(e) => updateCustomTool(toolIndex, "auth", { ...tool.auth, token: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tool Arguments */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>{t('tools.config.custom.args')}</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => addToolArg(toolIndex)}>
                        <Plus className="h-4 w-4 mr-1" />
                        {t('tools.config.custom.args.add')}
                      </Button>
                    </div>

                    {(tool.args || []).map((arg, argIndex) => (
                      <Card key={argIndex} className="border-gray-200 bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="secondary" className="text-xs">
                              {t('tools.config.custom.arg.badge').replace('{NUMBER}', (argIndex + 1).toString())}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeToolArg(toolIndex, argIndex)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                            <div className="space-y-1">
                              <Label className="text-xs">{t('tools.config.custom.args.name')}</Label>
                              <Input
                                placeholder={t('tools.config.custom.arg.name.placeholder')}
                                value={arg.name}
                                onChange={(e) => updateToolArg(toolIndex, argIndex, "name", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('tools.config.custom.args.type')}</Label>
                              <Select
                                value={arg.type}
                                onValueChange={(value) => updateToolArg(toolIndex, argIndex, "type", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="integer">Integer</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('tools.config.custom.args.location')}</Label>
                              <Select
                                value={arg.location}
                                onValueChange={(value) => updateToolArg(toolIndex, argIndex, "location", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="query">Query</SelectItem>
                                  <SelectItem value="body">Body</SelectItem>
                                  <SelectItem value="path">Path</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('tools.config.custom.args.required')}</Label>
                              <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                  checked={arg.required}
                                  onCheckedChange={(checked) => updateToolArg(toolIndex, argIndex, "required", checked)}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">{t('tools.config.custom.args.desc')}</Label>
                              <Input
                                placeholder={t('tools.config.custom.arg.desc.placeholder')}
                                value={arg.description}
                                onChange={(e) => updateToolArg(toolIndex, argIndex, "description", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t('tools.config.custom.args.example')}</Label>
                              <Input
                                placeholder={t('tools.config.custom.arg.example.placeholder')}
                                value={arg.example}
                                onChange={(e) => updateToolArg(toolIndex, argIndex, "example", e.target.value)}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>


    </div>
  )
}
