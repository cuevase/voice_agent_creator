"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, Mic, Volume2 } from "lucide-react"
import { useLanguage } from "@/lib/language-context"
import { useAuth } from "@/lib/auth-context"
import { 
  getAvailableModels, 
  getUserEffectiveModels, 
  updateUserModelPreferences,
  type Model,
  type AvailableModelsResponse,
  type EffectiveModelsResponse
} from "@/lib/models-api"

interface ModelSelectorProps {
  companyId?: string
}

export function ModelSelector({ companyId }: ModelSelectorProps) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [availableModels, setAvailableModels] = useState<AvailableModelsResponse | null>(null)
  const [userModels, setUserModels] = useState<EffectiveModelsResponse | null>(null)
  
  const [selectedTtsModel, setSelectedTtsModel] = useState<string>("")
  const [selectedSttModel, setSelectedSttModel] = useState<string>("")

  useEffect(() => {
    if (user?.id) {
      loadModelData()
    }
  }, [user?.id])

  const loadModelData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)

      const [availableData, userModelsData] = await Promise.all([
        getAvailableModels(),
        getUserEffectiveModels(user.id)
      ])

      setAvailableModels(availableData)
      setUserModels(userModelsData)
      
      // Set current selections
      setSelectedTtsModel(userModelsData.effective_models.tts.id)
      setSelectedSttModel(userModelsData.effective_models.stt.id)
      
    } catch (err) {
      console.error("Error loading model data:", err)
      setError("Failed to load model information")
    } finally {
      setLoading(false)
    }
  }

  const handleModelChange = async (type: 'tts' | 'stt', modelId: string) => {
    if (!user?.id) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const newPreferences = {
        ttsModelId: type === 'tts' ? modelId : selectedTtsModel,
        sttModelId: type === 'stt' ? modelId : selectedSttModel
      }

      await updateUserModelPreferences(user.id, newPreferences)

      // Update local state
      if (type === 'tts') {
        setSelectedTtsModel(modelId)
      } else {
        setSelectedSttModel(modelId)
      }

      // Refresh user models to get updated data
      const updatedUserModels = await getUserEffectiveModels(user.id)
      setUserModels(updatedUserModels)

      setSuccess("Model preferences updated successfully!")
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)

    } catch (err) {
      console.error("Error updating model preferences:", err)
      setError("Failed to update model preferences")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading model settings...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!availableModels || !userModels) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            {error || "Failed to load model settings"}
          </div>
          <Button 
            onClick={loadModelData} 
            className="mt-4 w-full"
            variant="outline"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg shadow-blue-100/50 rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-b border-blue-100/50 pb-6">
          <CardTitle className="flex items-center gap-3 text-gray-900">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Mic className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Voice Model Settings</h3>
              <p className="text-sm text-gray-500 font-normal">Configure your AI voice models and pricing</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* TTS Model Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium text-gray-700">
                Text-to-Speech Model
              </Label>
            </div>
            <Select 
              value={selectedTtsModel}
              onValueChange={(value) => handleModelChange('tts', value)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select TTS model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.models.tts.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {model.provider} - {model.model_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ${model.price_per_unidad.toFixed(6)} per {model.unidad}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STT Model Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium text-gray-700">
                Speech-to-Text Model
              </Label>
            </div>
            <Select 
              value={selectedSttModel}
              onValueChange={(value) => handleModelChange('stt', value)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select STT model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.models.stt.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {model.provider} - {model.model_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ${model.price_per_unidad.toFixed(6)} per {model.unidad}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Settings Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Current settings source:</strong> {userModels.effective_models.source.replace('_', ' ')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium">Current TTS:</p>
                <p>{userModels.effective_models.tts.provider} - {userModels.effective_models.tts.model_name}</p>
                <p className="text-gray-500">${userModels.effective_models.tts.price_per_unidad.toFixed(6)} per character</p>
              </div>
              <div>
                <p className="font-medium">Current STT:</p>
                <p>{userModels.effective_models.stt.provider} - {userModels.effective_models.stt.model_name}</p>
                <p className="text-gray-500">${userModels.effective_models.stt.price_per_unidad.toFixed(6)} per minute</p>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          {saving && (
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Updating preferences...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 