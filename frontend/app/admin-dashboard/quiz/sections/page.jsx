'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import BASE_URL from '@/app/config/url'
import { Loader2, Plus, ArrowLeft, RefreshCw } from 'lucide-react'
import SectionTable from '@/components/admin/quiz/SectionTable'
import SectionFormModal from '@/components/admin/quiz/SectionFormModal'

export default function QuizSectionsPage() {
  const router = useRouter()
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSection, setEditingSection] = useState(null)

  useEffect(() => {
    fetchSections()
  }, [])

  const fetchSections = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${BASE_URL}/api/admin/quiz/sections`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        setSections(data.data)
      } else {
        toast.error('Failed to load sections')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to load sections')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchSections()
    setRefreshing(false)
    toast.success('Sections refreshed')
  }

  const handleCreate = () => {
    setEditingSection(null)
    setModalOpen(true)
  }

  const handleEdit = (section) => {
    setEditingSection(section)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/quiz/sections/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Section deleted successfully')
        fetchSections()
      } else {
        toast.error(data.message || 'Failed to delete section')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete section')
    }
  }

  const handleSave = () => {
    setModalOpen(false)
    fetchSections()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header with back button, refresh, and add button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quiz Sections</h1>
            <p className="text-muted-foreground mt-1">Manage quiz sections</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          {/* BACK BUTTON */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin-dashboard/quiz')}
                className="cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {/* REFRESH AND ADD BUTTONS */}
            <div className='flex items-center justify-center gap-2'>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={handleCreate} className="cursor-pointer">
                <Plus className="w-4 h-4 mr-2" />
                Add Section
              </Button>
            </div>
        </div>
      </div>

      <SectionTable
        sections={sections}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <SectionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        section={editingSection}
        onSave={handleSave}
      />
    </div>
  )
}
