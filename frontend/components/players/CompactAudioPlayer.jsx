'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import YouTubeAudioPlayer from './YouTubeAudioPlayer'

// Utility: time formatting mm:ss or hh:mm:ss
function formatTime(seconds) {
  const s = Math.floor(seconds || 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

function isYouTubeUrl(url) {
  if (!url) return false
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    return host.includes('youtube.com') || host.includes('youtu.be') || host.includes('youtube-nocookie.com')
  } catch {
    return false
  }
}

export default function CompactAudioPlayer({
  src,
  youtubeUrl,
  className = '',
}) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.9)
  
  const isYouTube = isYouTubeUrl(youtubeUrl)

  // Bind audio events
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = volume

    const onTime = () => setCurrentTime(el.currentTime || 0)
    const onLoaded = () => setDuration(el.duration || 0)
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)

    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [src])

  const togglePlay = async () => {
    const el = audioRef.current
    if (!el) return
    try {
      if (el.paused) {
        await el.play()
      } else {
        el.pause()
      }
    } catch (e) {
      console.error('Playback error:', e)
    }
  }

  const onSeek = (e) => {
    const el = audioRef.current
    if (!el) return
    const value = parseFloat(e.target.value)
    el.currentTime = value
    setCurrentTime(value)
  }

  const onVolume = (e) => {
    const el = audioRef.current
    if (!el) return
    const value = parseFloat(e.target.value)
    el.volume = value
    setVolume(value)
  }

  const effectiveSrc = src || null

  return (
    <div >
      {/* If YouTube URL provided, render audio-only YouTube player */}
      {isYouTube && (
        <YouTubeAudioPlayer videoUrl={youtubeUrl} />
      )}

      {/* Hidden audio element used for non-YouTube playback */}
      {!isYouTube && effectiveSrc && (
        <audio ref={audioRef} src={effectiveSrc} preload="auto" className="hidden" />
      )}

      {!isYouTube && (
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
          disabled={!effectiveSrc}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        {/* Progress bar */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.1}
            value={currentTime}
            onChange={onSeek}
            className="w-full h-2 accent-primary"
            aria-label="Seek"
          />
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
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
            onChange={onVolume}
            className="w-full h-2 accent-primary"
            aria-label="Volume"
          />
        </div>
      </div>
      )}

      {/* Status & error */}
      <div className="mt-2 text-xs text-muted-foreground">
        {!isYouTube && !effectiveSrc && <span>No audio source</span>}
      </div>
    </div>
  )
}