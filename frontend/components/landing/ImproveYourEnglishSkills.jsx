'use client'

import Link from 'next/link'
import { Volume2, MessageSquare, BookOpen, PenTool } from 'lucide-react'
import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"

const ImproveYourEnglishSkills = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const skills = [
    {
      icon: Volume2,
      title: "Listening",
      description: "Hear Everything. Understand Anything.",
      href: "/skills/listening"
    },
    {
      icon: MessageSquare,
      title: "Speaking",
      description: "Speak Powerfully. Express Your Thoughts.",
      href: "/skills/speaking"
    },
    {
      icon: BookOpen,
      title: "Reading",
      description: "Read Faster. Comprehend Deeper.",
      href: "/skills/reading"
    },
    {
      icon: PenTool,
      title: "Writing",
      description: "Write with Impact. No to Errors.",
      href: "/skills/writing"
    }
  ]

  return (
    <div className="pt-16 md:py-20 px-4" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Section Title */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
          >
            Improve Your English Skills
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto"
          >
            Master all four essential English language skills with our comprehensive training programs
          </motion.p>
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
          {skills.map((skill, index) => {
            const IconComponent = skill.icon
            return (
              <motion.div
                key={skill.title}
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + (index * 0.1) }}
                className="relative"
              >
                {/* Skill Item */}
                <Link href={skill.href}>
                  <div className="group py-12 px-6 text-center transition-all duration-300 cursor-pointer">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                      <IconComponent className="w-16 h-16 md:w-20 md:h-20 text-primary" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 group-hover:underline transition-all duration-300">
                      {skill.title}
                    </h3>

                    {/* Description */}
                    <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-xs mx-auto">
                      {skill.description}
                    </p>
                  </div>
                </Link>

                {/* Left border for first item (Listening) */}
                {index === 0 && (
                  <div className="hidden lg:block absolute top-0 left-0 w-px h-full bg-border"></div>
                )}

                {/* Vertical Separators for desktop - exclude first (left) and last (right) */}
                {index > 0 && (
                  <div className="hidden lg:block absolute top-0 left-0 w-px h-full bg-border"></div>
                )}

                {/* Right border for last item (Writing) */}
                {index === skills.length - 1 && (
                  <div className="hidden lg:block absolute top-0 right-0 w-px h-full bg-border"></div>
                )}

                {/* Vertical Separators for tablet - exclude first item in each row */}
                {index > 0 && index % 2 !== 0 && (
                  <div className="hidden md:block lg:hidden absolute top-0 left-0 w-px h-full bg-border"></div>
                )}

                {/* Vertical Separators for mobile - exclude first item in each row */}
                {index % 2 !== 0 && (
                  <div className="block md:hidden absolute top-0 left-0 w-px h-full bg-border"></div>
                )}

                {/* Horizontal Separators for mobile - exclude last row */}
                {index < 2 && (
                  <div className="block md:hidden absolute bottom-0 left-0 w-full h-px bg-border"></div>
                )}

                {/* Horizontal Separators for tablet - exclude last row */}
                {index < 2 && (
                  <div className="hidden md:block lg:hidden absolute bottom-0 left-0 w-full h-px bg-border"></div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ImproveYourEnglishSkills