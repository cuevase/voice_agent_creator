"use client"

import React, { useEffect, useMemo, useState } from "react"
import { getAvailableVoiceModels, getUserVoicePref, saveUserVoicePref, type VoiceModel } from "@/lib/tts-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function VoiceModelPicker({ companyId, userId, onChange }: { companyId: string; userId: string; onChange?: (modelId: string) => void }) {
  const [models, setModels] = useState<VoiceModel[] | any>([])
  const [selected, setSelected] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deepgramTTS = useMemo(() => {
    const list: any[] = Array.isArray(models) ? models : (models?.models ?? models?.models?.tts ?? [])
    return list.filter((m) => m && m.type === 'tts' && (m.provider?.toLowerCase?.() === 'deepgram'))
  }, [models])

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true)
        setError(null)
        const [all, pref] = await Promise.all([
          getAvailableVoiceModels(),
          getUserVoicePref(companyId, userId)
        ])
        if (!mounted) return
        const normalized = Array.isArray(all) ? all : (all as any)?.models?.tts ?? (all as any)?.models ?? []
        setModels(normalized)
        if (pref.model) setSelected(pref.model)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message ?? 'Failed to load models')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [companyId, userId])

  const handleSave = async () => {
    try {
      setSaving(true)
      await saveUserVoicePref(companyId, userId, selected)
      if (onChange) onChange(selected)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save preference')
    } finally {
      setSaving(false)
    }
  }

  const selectedLabel = useMemo(() => {
    const m = deepgramTTS.find((x: any) => x?.id === selected)
    return m ? (m.model_name || m.name || m.id) : undefined
  }, [deepgramTTS, selected])

  return (
    <Card className="border-0 bg-white/70 backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">Voz del Agente (TTS)</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSave} disabled={!selected || saving || loading}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
        <div className="mt-2">
          <Select value={selected} onValueChange={setSelected} disabled={loading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? 'Cargando voces…' : 'Selecciona una voz'}>
                {selectedLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {deepgramTTS.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">{m.model_name || m.name || m.id}</span>
                    <span className="text-[11px] text-gray-500">{m.provider} • {m.language || '—'}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!loading && (
            <div className="mt-1 text-[11px] text-gray-500">Haz clic para ver y seleccionar entre todas las voces disponibles.</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 