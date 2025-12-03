'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Award, BookOpen, Monitor, Stethoscope } from 'lucide-react'
import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"

const GlobalTestMastery = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const testCards = [
    {
      icon: Award,
      title: "IELTS Success",
      description: "IELTS Academic, IELTS General, IELTS for UKVI, IELTS Life Skills - comprehensive preparation for all IELTS test formats.",
      buttonText: "Find your IELTS Course",
      href: "/courses/Englishproficiencytests",
      borderStyle: "rounded-tl-3xl rounded-br-3xl"
    },
    {
      icon: BookOpen,
      title: "TOEFL",
      description: "Prove your academic English skills for study and university life with comprehensive TOEFL preparation.",
      buttonText: "Explore TOEFL Prep",
      href: "/courses/Englishproficiencytests",
      borderStyle: "rounded-tl-3xl rounded-br-3xl"
    },
    {
      icon: Monitor,
      title: "PTE",
      description: "A fast, computer-based test for study, work, or migration. Master the digital format with expert guidance.",
      buttonText: "Start PTE Training",
      href: "/courses/Englishproficiencytests",
      borderStyle: "rounded-tl-3xl rounded-br-3xl"
    },
    {
      icon: Stethoscope,
      title: "OET",
      description: "For healthcare professionals proving English in real medical settings. Specialized preparation for medical professionals.",
      buttonText: "Master OET",
      href: "/courses/Englishproficiencytests",
      borderStyle: "rounded-tl-3xl rounded-br-3xl"
    }
  ]

  return (
    <div className="py-12 md:pb-28 px-4" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Section Title */}
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
          >
            Global Test Mastery
          </motion.h2>
        </div>

        {/* Test Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {testCards.map((card, index) => {
            const IconComponent = card.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + (index * 0.1) }}
                className={`bg-gradient-to-br from-primary/10 via-accent/5 to-primary/20 border border-border rounded-lg px-6 py-8 shadow-md hover:shadow-lg transition-all duration-300 text-center ${card.borderStyle} p-6 py-10 text-center shadow-lg transition-all duration-300 flex flex-col min-h-[280px]`}
              >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <IconComponent className="w-12 h-12 text-primary" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-foreground mb-3">
                  {card.title}
                </h3>

                {/* Description */}
                <p className="text-muted-foreground text-xs leading-relaxed mb-6 flex-grow">
                  {card.description}
                </p>

                {/* Button */}
                <div className="mt-auto">
                  <Link href={card.href}>
                    <Button 
                      className="w-full cursor-pointer hover:shadow-md transition-all duration-300"
                      size="sm"
                    >
                      {card.buttonText}
                  </Button>
                </Link>
              </div>
            </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default GlobalTestMastery