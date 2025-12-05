"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause, Volume2, VolumeX } from "lucide-react"

// Extract YouTube videoId from common URL shapes
function extractVideoId(input) {
  if (!input) return null
  try {
    // If a raw id is supplied
    if (/^[a-zA-Z0-9_-]{6,}$/.test(input)) return input
    const u = new URL(input)
    const host = u.hostname.toLowerCase()
    if (host.includes("youtu.be")) {
      return u.pathname.replace("/", "") || null
    }
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v")
      if (v) return v
      // shorts/<id> or embed/<id>
      const parts = u.pathname.split("/").filter(Boolean)
      const idx = parts.findIndex(p => ["shorts", "embed", "live"].includes(p))
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
    }
    return null
  } catch {
    return null
  }
}

// Load YouTube IFrame API once and return a promise when ready
let ytApiPromise = null
function loadYouTubeIframeAPI() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"))
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev()
      resolve(window.YT)
    }
  })
  return ytApiPromise
}

export default function YouTubeAudioPlayer({ videoId, videoUrl, initialVolume = 60 }) {
  const resolvedId = videoId || extractVideoId(videoUrl)
  const playerRef = useRef(null)
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  // Keep UI volume normalized (0..1) like CompactAudioPlayer
  const [volume, setVolume] = useState(() => Math.max(0, Math.min(1, initialVolume / 100)))

  useEffect(() => {
    let intervalId = null
    let destroyed = false

    async function setup() {
      if (!resolvedId) return
      const YT = await loadYouTubeIframeAPI()
      if (!YT || destroyed) return

      playerRef.current = new YT.Player(containerRef.current, {
        height: "1",
        width: "1",
        videoId: resolvedId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            setReady(true)
            try { playerRef.current.setVolume(Math.round(volume * 100)) } catch {}
            setDuration(playerRef.current.getDuration() || 0)
          },
          onStateChange: (e) => {
            const state = e?.data
            // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            setPlaying(state === 1)
            setDuration(playerRef.current.getDuration() || 0)
          },
        },
      })

      intervalId = window.setInterval(() => {
        try {
          const t = playerRef.current?.getCurrentTime?.() || 0
          setCurrent(t)
        } catch {}
      }, 250)
    }

    setup()

    return () => {
      destroyed = true
      if (intervalId) window.clearInterval(intervalId)
      try {
        playerRef.current?.destroy?.()
      } catch {}
    }
  }, [resolvedId])

  function togglePlay() {
    if (!ready || !playerRef.current) return
    try {
      if (playing) playerRef.current.pauseVideo()
      else playerRef.current.playVideo()
    } catch {}
  }

  function onSeek(seconds) {
    if (!ready || !playerRef.current || !duration) return
    const target = Math.max(0, Math.min(duration, seconds))
    try { playerRef.current.seekTo(target, true) } catch {}
    setCurrent(target)
  }

  function onVolume(v) {
    const normalized = Math.max(0, Math.min(1, v))
    setVolume(normalized)
    try { playerRef.current?.setVolume?.(Math.round(normalized * 100)) } catch {}
  }

  const pct = duration ? current / duration : 0

  // Time formatter to match CompactAudioPlayer
  function formatTime(t) {
    const s = Math.floor(t || 0)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const pad = (n) => String(n).padStart(2, "0")
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
  }

  return (
    <div >
      {/* Hidden/offscreen YouTube player (audio will play) */}
      <div ref={containerRef} style={{ position: "absolute", left: "-9999px", top: 0 }} />

      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        {/* Progress */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={current}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 accent-primary"
            aria-label="Seek"
            disabled={!ready || duration === 0}
          />
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(current)} / {formatTime(duration)}
          </div>
        </div>

        {/* Volume */}
        <div className="hidden md:flex items-center gap-1 w-32">
          {volume > 0 ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            className="w-full h-2 accent-primary"
            aria-label="Volume"
            disabled={!ready}
          />
        </div>
      </div>
    </div>
  )
}