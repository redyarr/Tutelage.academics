'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import EslVideoForm from "@/components/forms/EslVideoForm"
import { Plus, RefreshCw, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useInfiniteScroll } from "@/app/config/useInfiniteScroll"
import BASE_URL from "@/app/config/url"
import Image from "next/image"
import Link from "next/link"

const EslVideos = () => {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState(null)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editVideo, setEditVideo] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteVideo, setDeleteVideo] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchVideos = async (reset = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append("limit", 9)
      if (searchTerm) params.append("search", searchTerm)
      if (!reset && nextCursor) params.append("cursor", nextCursor)
      const res = await fetch(`${BASE_URL}/api/esl-videos?${params.toString()}`, { credentials: "include" })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || "Failed to fetch videos")
      setVideos(prev => reset ? data.data || [] : [...prev, ...(data.data || [])])
      // Assume backend returns cursor-based pagination similar to readings
      setHasMore(data.pagination?.hasMore ?? false)
      setNextCursor(data.pagination?.nextCursor ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const resetAndFetch = () => {
    setVideos([])
    setNextCursor(null)
    setHasMore(true)
    fetchVideos(true)
  }

  useEffect(() => {
    resetAndFetch()
  }, [searchTerm])

  const lastVideoRef = useInfiniteScroll({ loading, hasMore, onLoadMore: fetchVideos })

  const handleCreateSuccess = async (values) => {
    try {
      const fd = new FormData()
      fd.append('title', values.title ?? '')
      fd.append('videoRef', values.videoRef ?? '')
      fd.append('description', values.description ?? '')
      fd.append('level', values.level ?? '')
      fd.append('tags', values.tags?.join(',') ?? '')
      if (values.pdf) fd.append('pdfFile', values.pdf)
      if (values.taskPdf) fd.append('taskPdfFile', values.taskPdf)
      
      const res = await fetch(`${BASE_URL}/api/esl-videos`, {
        method: "POST",
        credentials: "include",
        body: fd
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)
      setShowCreate(false)
      resetAndFetch()
      toast(data.message, { variant: "success" })
    } catch (e) {
      toast(e.message, { variant: "destructive" })
    }
  }

  const handleEdit = (video) => {
    setEditVideo(video)
    setShowEdit(true)
  }

  const handleEditSuccess = async (values) => {
    if (!editVideo) return
    try {
      const fd = new FormData()
      fd.append('title', values.title ?? '')
      fd.append('videoRef', values.videoRef ?? '')
      fd.append('description', values.description ?? '')
      fd.append('level', values.level ?? '')
      fd.append('tags', values.tags?.join(',') ?? '')
      if (values.pdf) fd.append('pdfFile', values.pdf)
      if (values.taskPdf) fd.append('taskPdfFile', values.taskPdf)
      
      const res = await fetch(`${BASE_URL}/api/esl-videos/${editVideo.id}`, {
        method: "PUT",
        credentials: "include",
        body: fd
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)
      setShowEdit(false)
      setEditVideo(null)
      resetAndFetch()
      toast(data.message, { variant: "success" })
    } catch (e) {
      toast(e.message, { variant: "destructive" })
    }
  }

  const handleDelete = (video) => {
    setDeleteVideo(video)
    setShowDelete(true)
  }

  const confirmDelete = async () => {
    if (!deleteVideo) return
    try {
      const res = await fetch(`${BASE_URL}/api/esl-videos/${deleteVideo.id}`, { method: "DELETE", credentials: "include" })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)
      setShowDelete(false)
      setDeleteVideo(null)
      resetAndFetch()
      toast(data.message, { variant: "destructive" })
    } catch (e) {
      toast(e.message, { variant: "destructive" })
    }
  }

  const truncate = (text, maxLength = 80) => {
    if (!text) return ''
    return text.length <= maxLength ? text : text.slice(0, maxLength) + '...'
  }

  // Extract YouTube thumbnail from videoRef
  const getYouTubeThumbnail = (url) => {
    if (!url) return null
    try {
      const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{6,})/)
      if (match && match[1]) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`
    } catch (_) {}
    return null
  }

  return (
    <div className="mx-auto w-full h-full flex flex-col">
      <div className="flex flex-row justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-foreground">ESL Videos</h1>
          <Button onClick={() => setShowCreate(true)} className="gap-2 max-w-48">
            <Plus className="h-5 w-5" />Create ESL Video
          </Button>
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Input placeholder="Search ESL videos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-xs" />
        <Button variant="ghost" size="icon" onClick={resetAndFetch} title="Refresh videos" className="ml-2" disabled={loading}>
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && <div className="text-destructive text-center mb-4">{error}</div>}

      {loading && videos.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Loading ESL videos...</div>
      ) : videos.length === 0 && !loading ? (
        <div className="text-center text-muted-foreground py-12">No ESL videos found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video, idx) => {
            const thumbnail = video.thumbnailUrl || getYouTubeThumbnail(video.videoRef) || '/placeholder-16-9.png'
            return (
              <Link key={idx} href={`/admin-dashboard/eslVideos/${video.id}`} ref={idx === videos.length - 1 ? lastVideoRef : null} className="relative group bg-card border border-border rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 block">
                <div className="relative h-44 w-full overflow-hidden">
                  <Image src={thumbnail} alt={video.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold text-foreground mb-2 truncate">{video.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{truncate(video.description)}</p>
                  {video.level && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(Array.isArray(video.level) ? video.level : [video.level]).map((lvl, i) => (
                        <span key={i} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">{lvl}</span>
                      ))}
                    </div>
                  )}
                </div>
                  <div className="absolute top-2 right-2 flex gap-1" onClick={(e) => e.preventDefault()}>
                    <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); handleEdit(video); }} className="h-8 px-2"><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="destructive" onClick={(e) => { e.preventDefault(); handleDelete(video); }} className="h-8 px-2"><Trash2 className="h-4 w-4" /></Button>
                  </div>
              </Link>
            )
          })}
        </div>
      )}

      {loading && videos.length > 0 && (
        <div className="flex justify-center p-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
            <span className="text-muted-foreground text-sm">Loading more...</span>
          </div>
        </div>
      )}

      {hasMore && videos.length !== 0 && !loading && (
        <div className="flex justify-center mt-8 mb-4">
          <Button variant="outline" onClick={() => fetchVideos()}>Show More</Button>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md w-full" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Create ESL Video</DialogTitle></DialogHeader>
          <EslVideoForm onSuccess={handleCreateSuccess} onCancel={() => setShowCreate(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={(v) => { setShowEdit(v); if (!v) setEditVideo(null) }}>
        <DialogContent className="max-w-md w-full" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Edit ESL Video</DialogTitle></DialogHeader>
          <EslVideoForm mode="edit" initialValues={editVideo} onSuccess={handleEditSuccess} onCancel={() => { setShowEdit(false); setEditVideo(null) }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="max-w-sm w-full" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Delete ESL Video</DialogTitle></DialogHeader>
          <div className="py-4 text-sm">Are you sure you want to delete <span className="font-semibold text-foreground">{deleteVideo?.title}</span>?</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EslVideos
