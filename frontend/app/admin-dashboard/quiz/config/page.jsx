'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import BASE_URL from '@/app/config/url'
import { Loader2, Save, ArrowLeft, RefreshCw } from 'lucide-react'

const configSchema = z.object({
  totalQuestions: z.coerce.number().min(1, 'Must be at least 1').max(500, 'Max 500 questions'),
  timeLimitMinutes: z.coerce.number().min(1, 'Must be at least 1 minute').max(300, 'Max 300 minutes'),
  isActive: z.boolean()
})

export default function QuizConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    resolver: zodResolver(configSchema),
    defaultValues: {
      totalQuestions: 30,
      timeLimitMinutes: 20,
      isActive: true
    }
  })

  const isActive = watch('isActive')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${BASE_URL}/api/admin/quiz/config`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        reset(data.data)
      } else {
        toast.error('Failed to load configuration')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchConfig()
    setRefreshing(false)
    toast.success('Configuration refreshed')
  }

  const onSubmit = async (values) => {
    try {
      setSaving(true)
      const res = await fetch(`${BASE_URL}/api/admin/quiz/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(values)
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Configuration updated successfully')
        reset(data.data)
      } else {
        toast.error(data.message || 'Failed to update configuration')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to update configuration')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header with back button and refresh */}
        <div className="flex items-start sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Quiz Configuration</h1>
            <p className="text-muted-foreground mt-1">Manage global quiz settings</p>
          </div>
          <div className='flex flex-col sm:flex-row gap-2'>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin-dashboard/quiz')}
                className="cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="totalQuestions">Total Questions Allowed</Label>
            <Input
              id="totalQuestions"
              type="number"
              {...register('totalQuestions')}
              className="mt-1"
            />
            {errors.totalQuestions && (
              <p className="text-sm text-destructive mt-1">{errors.totalQuestions.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Sum of all section question counts must not exceed this value
            </p>
          </div>

          <div>
            <Label htmlFor="timeLimitMinutes">Time Limit (Minutes)</Label>
            <Input
              id="timeLimitMinutes"
              type="number"
              {...register('timeLimitMinutes')}
              className="mt-1"
            />
            {errors.timeLimitMinutes && (
              <p className="text-sm text-destructive mt-1">{errors.timeLimitMinutes.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Total time allowed for the entire quiz
            </p>
          </div>

          <div>
            <Label htmlFor="isActive">Quiz Status</Label>
            <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setValue('isActive', v === 'active')}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Published)</SelectItem>
                <SelectItem value="inactive">Inactive (Draft)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Only active quizzes are visible to users on the frontend
            </p>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={saving} className="cursor-pointer">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              className="cursor-pointer"
            >
              Reset
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
