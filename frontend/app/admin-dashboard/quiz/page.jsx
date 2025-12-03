'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Settings, FolderTree, FileQuestion, ArrowLeft, Loader2 } from 'lucide-react'
import BASE_URL from '@/app/config/url'
import { toast } from 'sonner'

export default function QuizDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSections: 0,
    totalQuestions: 0,
    totalQuestionsAllowed: 0,
    timeLimitMinutes: 0
  })

  useEffect(() => {
    fetchQuizStats()
  }, [])

  const fetchQuizStats = async () => {
    try {
      setLoading(true)
      
      // Fetch config (total questions allowed + time limit)
      const configRes = await fetch(`${BASE_URL}/api/admin/quiz/config`, {
        credentials: 'include'
      })
      const configData = await configRes.json()
      
      // Fetch sections (count sections)
      const sectionsRes = await fetch(`${BASE_URL}/api/admin/quiz/sections`, {
        credentials: 'include'
      })
      const sectionsData = await sectionsRes.json()
      
      // Fetch questions (count total questions in database)
      const questionsRes = await fetch(`${BASE_URL}/api/admin/quiz/questions?limit=1000`, {
        credentials: 'include'
      })
      const questionsData = await questionsRes.json()
      
      if (configData.success && sectionsData.success && questionsData.success) {
        setStats({
          totalSections: sectionsData.data?.length || 0,
          totalQuestions: questionsData.data?.questions?.length || 0,
          totalQuestionsAllowed: configData.data?.totalQuestions || 30,
          timeLimitMinutes: configData.data?.timeLimitMinutes || 20
        })
      } else {
        toast.error('Failed to load quiz statistics')
      }
    } catch (error) {
      console.error('Error fetching quiz stats:', error)
      toast.error('Failed to load quiz statistics')
    } finally {
      setLoading(false)
    }
  }

  const sections = [
    {
      title: 'Quiz Configuration',
      description: 'Manage global quiz settings: total questions, time limit, and activation status',
      icon: Settings,
      href: '/admin-dashboard/quiz/config',
      color: 'text-blue-500'
    },
    {
      title: 'Quiz Sections',
      description: 'Create and manage quiz sections (Grammar, Vocabulary, etc.) with question allocations',
      icon: FolderTree,
      href: '/admin-dashboard/quiz/sections',
      color: 'text-green-500'
    },
    {
      title: 'Quiz Questions',
      description: 'Add, edit, and organize quiz questions across all sections and difficulty levels',
      icon: FileQuestion,
      href: '/admin-dashboard/quiz/questions',
      color: 'text-purple-500'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with back button */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quiz Management</h1>
          <p className="text-muted-foreground mt-1">Configure and manage all aspects of the placement quiz</p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <div
            key={section.href}
            onClick={() => router.push(section.href)}
            className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors ${section.color}`}>
                <section.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {section.title}
                </h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.description}
            </p>
          </div>
        ))}
      </div>

      {/* Stats section */}
      <div className="mt-12 p-6 bg-muted/50 border border-border rounded-lg">
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Total Sections</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.totalSections}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Questions We Have</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.totalQuestions}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Questions Allowed in The Quiz</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.totalQuestionsAllowed}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Time Limit</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.timeLimitMinutes} min</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          * Click on each section above to manage detailed settings and content.
        </p>
      </div>
    </div>
  )
}
