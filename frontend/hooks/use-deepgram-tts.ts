"use client"

import { useEffect, useRef } from "react"

interface UseDeepgramTTSArgs {
  companyId: string
  userId: string
  sessionId: string
  lang?: string
  wsBase?: string
  model?: string
}

export function useDeepgramTTS({ companyId, userId, sessionId, lang = "es", wsBase, model }: UseDeepgramTTSArgs) {
  const wsRef = useRef<WebSocket | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const nextStartRef = useRef(0)
  const pcmStashRef = useRef<Int16Array | null>(null)
  let STASH_MIN_FRAMES = 1600 // default ~100ms at 16kHz; will be recalculated dynamically
  const sourceRateRef = useRef<number>(16000) // assume 16k PCM unless server confirms otherwise
  const watchdogRef = useRef<number | null>(null)
  const lastTailRef = useRef<Float32Array | null>(null)

  useEffect(() => {
    if (!companyId || !userId || !sessionId) return

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ctxRef.current = ctx
    nextStartRef.current = 0
    pcmStashRef.current = null
    const OUTPUT_RATE = ctx.sampleRate
    // Start with ~150ms stash at the assumed source rate
    STASH_MIN_FRAMES = Math.max(256, Math.floor(sourceRateRef.current * 0.15))

    const base = wsBase || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}` : '')
    const ws_base = 'wss://f0ae0fa37d8e.ngrok-free.app'
    const url = `${ws_base}/tts/deepgram/stream?company_id=${encodeURIComponent(companyId)}&user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(sessionId)}&language=${encodeURIComponent(lang)}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    let openAt = 0
    let firstAudioAt = 0
    let bytesTotal = 0

    const resumeContext = async () => {
      try { await ctx.resume() } catch {}
    }

    const scheduleBridgeFromTail = () => {
      const ctx = ctxRef.current
      const tail = lastTailRef.current
      if (!ctx || !tail || tail.length === 0) return
      // Convert tail to Int16 and reuse normal scheduling logic
      const pcm = new Int16Array(tail.length)
      for (let i = 0; i < tail.length; i++) {
        let v = tail[i]
        if (v > 1) v = 1
        if (v < -1) v = -1
        pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32768)))
      }
      try { drainPcmToBuffer(pcm) } catch {}
    }

    const watchdogTick = () => {
      const context = ctxRef.current
      if (!context) return
      // Try to keep context running
      if (context.state !== 'running') {
        void resumeContext()
      }
      // Bridge tiny gaps if we have stash available
      const now = context.currentTime
      const queueAhead = Math.max(0, (nextStartRef.current || now) - now)
      const stash = pcmStashRef.current
      if (stash && queueAhead < 0.06) {
        // If we are about to underrun, schedule immediately using the stashed audio
        try {
          const toPlay = stash.slice()
          pcmStashRef.current = null
          drainPcmToBuffer(toPlay)
        } catch {}
      } else if (!stash && queueAhead < 0.06) {
        // No stash available; use tail bridge to mask the gap
        scheduleBridgeFromTail()
      }
    }

    const startWatchdog = () => {
      if (watchdogRef.current) window.clearInterval(watchdogRef.current)
      // Check more frequently to bridge gaps faster
      watchdogRef.current = window.setInterval(watchdogTick, 250)
    }

    const drainPcmToBuffer = (pcm: Int16Array) => {
      const ctx = ctxRef.current
      if (!ctx) return
      const SRC_RATE = sourceRateRef.current
      const f32 = new Float32Array(pcm.length)
      for (let i = 0; i < pcm.length; i++) {
        let v = pcm[i] / 32768
        if (v > 1) v = 1
        if (v < -1) v = -1
        f32[i] = v
      }
      const buffer = ctx.createBuffer(1, f32.length, SRC_RATE)
      buffer.getChannelData(0).set(f32)
      const now = ctx.currentTime
      const MIN_AHEAD = 0.10
      const MAX_AHEAD = 0.20
      const desired = (nextStartRef.current || now)
      // Never schedule earlier than the current playhead
      let startAt = Math.max(desired, now + MIN_AHEAD)
      // If the queue-ahead is already too large, postpone scheduling and stash more audio instead of trimming
      if (startAt - now > MAX_AHEAD) {
        const prev = pcmStashRef.current
        if (!prev) {
          pcmStashRef.current = pcm.slice()
        } else {
          const merged = new Int16Array(prev.length + pcm.length)
          merged.set(prev, 0)
          merged.set(pcm, prev.length)
          pcmStashRef.current = merged
        }
        return
      }
      nextStartRef.current = startAt + buffer.duration
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const gain = ctx.createGain()
      // Short crossfade windows to reduce edge clicks
      const fade = 0.013 // 13ms
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(1, startAt + fade)
      // Fade-out at the tail
      const endAt = startAt + buffer.duration
      gain.gain.setValueAtTime(1, Math.max(startAt, endAt - fade))
      gain.gain.linearRampToValueAtTime(0.0001, endAt)
      src.connect(gain)
      gain.connect(ctx.destination)
      try { src.start(startAt) } catch {}
      // Save last ~25ms tail for potential bridge
      const tailFrames = Math.max(1, Math.floor(SRC_RATE * 0.025))
      if (f32.length >= tailFrames) {
        lastTailRef.current = f32.slice(f32.length - tailFrames)
      }
    }

    // Parse incoming ArrayBuffer as either WAV (strip header, adopt sample rate) or raw PCM16
    const parseIncomingToPcm = (ab: ArrayBuffer): { pcm: Int16Array; sampleRate?: number } => {
      const u8 = new Uint8Array(ab)
      // Detect simple WAV header: 'RIFF....WAVE'
      const isWav = u8.length >= 44 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x41 && u8[10] === 0x56 && u8[11] === 0x45
      if (isWav) {
        // Sample rate is 4 bytes LE at offset 24
        const sr = (u8[24] | (u8[25] << 8) | (u8[26] << 16) | (u8[27] << 24)) >>> 0
        // Assume PCM16 with header size 44 bytes (common for simple WAV)
        const dataOffset = 44
        const pcm = new Int16Array(ab.slice(dataOffset))
        return { pcm, sampleRate: sr }
      }
      return { pcm: new Int16Array(ab) }
    }

    const handleBinary = async (ab: ArrayBuffer) => {
      const ctx = ctxRef.current
      if (!ctx) return
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch {} }
      bytesTotal += ab.byteLength
      if (!firstAudioAt) firstAudioAt = performance.now()
      const { pcm: incoming, sampleRate } = parseIncomingToPcm(ab)
      if (typeof sampleRate === 'number' && sampleRate > 0 && sampleRate !== sourceRateRef.current) {
        // Adopt server-provided sample rate for correct playback speed
        sourceRateRef.current = sampleRate
        STASH_MIN_FRAMES = Math.max(256, Math.floor(sourceRateRef.current * 0.15))
      }
      const stash = pcmStashRef.current
      if (!stash) {
        if (incoming.length < STASH_MIN_FRAMES) { pcmStashRef.current = incoming.slice(); return }
        drainPcmToBuffer(incoming); return
      }
      const merged = new Int16Array(stash.length + incoming.length)
      merged.set(stash, 0); merged.set(incoming, stash.length)
      if (merged.length >= STASH_MIN_FRAMES) {
        pcmStashRef.current = null; drainPcmToBuffer(merged)
      } else {
        pcmStashRef.current = merged
      }
    }

    ws.onopen = () => {
      openAt = performance.now()
      console.log('[TTS] WS open', { url })
      try {
        // Request a fixed server sample rate to reduce latency and avoid resampling drift
        const cfg = { model: model || 'aura-2-celeste-es', encoding: 'linear16', sample_rate: 16000, container: 'wav', language: lang }
        ws.send(JSON.stringify(cfg))
      } catch {}
      startWatchdog()
    }

    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const msg = JSON.parse(ev.data as string)
          const sr = msg?.sample_rate || msg?.sr || msg?.rate || msg?.config?.sample_rate
          if (typeof sr === 'number' && sr > 0) {
            sourceRateRef.current = sr
            STASH_MIN_FRAMES = Math.max(256, Math.floor(sourceRateRef.current * 0.15))
            console.log('[TTS] effective sample_rate from server', sr)
          }
        } catch {}
        return
      }
      void handleBinary(ev.data as ArrayBuffer)
    }

    ws.onerror = (e) => {
      console.error('[TTS] WebSocket error', e)
    }
    ws.onclose = () => {
      const closedAt = performance.now()
      console.log('[TTS] WS closed', {
        openToCloseMs: openAt ? Math.round(closedAt - openAt) : undefined,
        openToFirstAudioMs: openAt && firstAudioAt ? Math.round(firstAudioAt - openAt) : undefined,
        totalBytes: bytesTotal
      })
    }

    const onVisibility = () => { if (document.visibilityState === 'visible') void resumeContext() }
    const onFocus = () => { void resumeContext() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    startWatchdog()

    return () => {
      try { ws.close() } catch {}
      ctxRef.current?.close().catch(() => {})
      wsRef.current = null
      ctxRef.current = null
      pcmStashRef.current = null
      nextStartRef.current = 0
      if (watchdogRef.current) { window.clearInterval(watchdogRef.current); watchdogRef.current = null }
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [companyId, userId, sessionId, lang, wsBase, model])

  const speak = (text: string) => { const ws = wsRef.current; if (!ws || ws.readyState !== 1 || !text) return; console.log('[TTS] speak len', text.length); ws.send(JSON.stringify({ type: 'Speak', text })) }
  const flush = () => { const ws = wsRef.current; console.log('[TTS] flush'); if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'Flush' })) }
  const close = () => { const ws = wsRef.current; console.log('[TTS] close'); if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'Close' })) }

  return { speak, flush, close }
} 