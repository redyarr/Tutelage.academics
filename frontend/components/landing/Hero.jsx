'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SlidersHorizontal } from 'lucide-react'

export default function HeroSection({ title, subtitle, imageUrl }) {
  const [heroSearchQuery, setHeroSearchQuery] = useState('')
  const [heroSearchFilter, setHeroSearchFilter] = useState('')
  const router = useRouter()

  const safeTitle = title || 'Empowering learners worldwide with virtual education'
  const safeSubtitle = subtitle || 'High-quality courses, engaging tests, and curated resources for success.'
  const imageSrc = imageUrl || 'https://www.selectenglish.co.uk/wp-content/uploads/2020/10/online-class-e1603379051771.jpg'

  const handleHeroSearch = (e) => {
    e.preventDefault()
    if (heroSearchQuery.trim()) {
      const params = new URLSearchParams({
        query: heroSearchQuery.trim()
      })
      if (heroSearchFilter && heroSearchFilter !== '') {
        params.append('filter', heroSearchFilter)
      }
      router.push(`/search?${params.toString()}`)
    }
  }

  return (
    <>
      <div className="relative w-full min-h-[300px] h-[100vh]">
        <Image
          src={imageSrc}
          alt="Landing Hero"
          fill
          priority
          quality={100}
          className="object-cover object-center w-full h-full"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw"
        />
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div
          className="absolute inset-0 flex flex-col items-start justify-center z-20 px-4 text-left md:text-center md:items-center mt-14 md:mt-40"
        >
          <div className='w-full bg-transparent max-md:h-[58px]'/>
          <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          className="text-6xl sm:text-7xl max-md:leading-20 md:text-5xl max-w-5xl font-semibold text-white drop-shadow mb-10 md:mb-4">{safeTitle}
          </motion.h1>
          <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
          className="text-lg sm:text-xl md:text-lg text-white/80 font-normal max-w-4xl mx-auto mb-7">{safeSubtitle}</motion.p>
          <motion.form
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.7 }}
          onSubmit={handleHeroSearch}
           className="hidden w-full max-w-2xl md:flex flex-col sm:flex-row items-stretch gap-2 sm:gap-0 mx-auto">
            <Input
              type="text"
              placeholder="Search Tutelage..."
              value={heroSearchQuery}
              onChange={(e) => setHeroSearchQuery(e.target.value)}
              className="rounded-l-sm rounded-r-none bg-background/90 py-6 text-foreground placeholder:text-muted-foreground focus:ring-0 focus:ring-transparent focus:border-transparent focus-visible:ring-transparent focus-visible:border-transparent flex-1 min-w-0"
            />
            <Select value={heroSearchFilter} onValueChange={setHeroSearchFilter}>
              <SelectTrigger className="sm:rounded-l-none rounded-sm py-6 bg-background/90 border border-border text-foreground focus:ring-0 focus:ring-transparent min-w-[40px]">
                <SelectValue placeholder={<SlidersHorizontal />} />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground">
                <SelectItem value="tests">Tests</SelectItem>
                <SelectItem value="courses">Courses</SelectItem>
                <SelectItem value="blogs">Blogs</SelectItem>
                <SelectItem value="levels">Levels</SelectItem>
                <SelectItem value="skills">Skills</SelectItem>
                <SelectItem value="esl">ESL Resources</SelectItem>
              </SelectContent>
            </Select>
          </motion.form>
        </div>
      </div>
    </>
  )
}
