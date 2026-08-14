import { useEffect, useRef, useState } from 'react'
import './AudioBar.css'

interface AudioBarProps {
  src: string
  label?: string
}

function formatTime(seconds: number) {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioBar({ src, label }: AudioBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0-1
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0)
    const onLoaded = () => setDuration(audio.duration)
    const onEnd = () => { setPlaying(false); setProgress(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnd)
    }
  }, [src])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }

  return (
    <div className="audio-bar">
      <audio ref={audioRef} src={src} preload="metadata" />
      {label && <span className="audio-bar-label">{label}</span>}
      <button type="button" className="audio-bar-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="audio-bar-track">
        <div className="audio-bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="audio-bar-time">{formatTime(playing ? (audioRef.current?.currentTime ?? 0) : duration)}</span>
    </div>
  )
}
