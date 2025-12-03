'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import BASE_URL from '@/app/config/url'
import { Loader2, Plus, ArrowLeft, RefreshCw } from 'lucide-react'
import QuestionTable from '@/components/admin/quiz/QuestionTable'
import QuestionFormModal from '@/components/admin/quiz/QuestionFormModal'

export default function QuizQuestionsPage() {
  const router = useRouter()
  const [questions, setQuestions] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)

  // Filters
  const [filterSection, setFilterSection] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')

  useEffect(() => {
    Promise.all([fetchSections(), fetchQuestions()])
  }, [filterSection, filterLevel])

  const fetchSections = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/quiz/sections`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        setSections(data.data)
      }
    } catch (error) {
      console.error(error)
    }
  }

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      let url = `${BASE_URL}/api/admin/quiz/questions?limit=100`
      if (filterSection !== 'all') url += `&sectionId=${filterSection}`
      if (filterLevel !== 'all') url += `&level=${filterLevel}`

      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setQuestions(data.data.questions || [])
      } else {
        toast.error('Failed to load questions')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to load questions')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchQuestions()
    setRefreshing(false)
    toast.success('Questions refreshed')
  }

  const handleCreate = () => {
    setEditingQuestion(null)
    setModalOpen(true)
  }

  const handleEdit = (question) => {
    setEditingQuestion(question)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/quiz/questions/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Question deleted successfully')
        fetchQuestions()
      } else {
        toast.error(data.message || 'Failed to delete question')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to delete question')
    }
  }

  const handleSave = () => {
    setModalOpen(false)
    fetchQuestions()
  }

  return (
    <div className="p-6">
      {/* Header with back button, refresh, and add button */}
      <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quiz Questions</h1>
            <p className="text-muted-foreground mt-1">Manage quiz questions</p>
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
              Add Question
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-foreground mb-2 block">Section</label>
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger>
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sections.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-foreground mb-2 block">Level</label>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger>
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="A1">A1</SelectItem>
              <SelectItem value="A2">A2</SelectItem>
              <SelectItem value="B1">B1</SelectItem>
              <SelectItem value="B2">B2</SelectItem>
              <SelectItem value="C1">C1</SelectItem>
              <SelectItem value="C2">C2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <QuestionTable
          questions={questions}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <QuestionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        question={editingQuestion}
        sections={sections}
        onSave={handleSave}
      />
    </div>
  )
}
