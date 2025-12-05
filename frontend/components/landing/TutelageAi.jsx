'use client'

import Image from "next/image"
import Link from "next/link"
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"
import BASE_URL, { BASE_URL_PROD } from "@/app/config/url"

const TutelageAi = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <>
      {/* Learn a New Language the Fun Way Section */}
      <div className="py-12 md:py-20 px-4" ref={ref}>
        {/* Section Title */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="text-center">
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
            >
              Introducing Tutelage AI
            </motion.h2>
          </div>
        </div>

        <div className="max-w-7xl h-full mx-auto border border-border rounded-sm shadow-lg lg:rounded-tr-[4rem] lg:rounded-bl-[4rem] max-lg:rounded-tl-[2rem] max-lg:rounded-br-[2rem]">
          <div className="flex flex-col-reverse lg:flex-row items-stretch gap-0">
            {/* Left Content */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full lg:w-1/2 flex items-center px-4 sm:px-6 lg:ml-10"
            >
              <div className="w-full py-10 lg:py-0 lg:pr-12">
                <motion.h2 
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-4 sm:mb-6"
                >
                    For the first time!!  Tutelage AI is here.
                </motion.h2>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed mb-6"
                >
                    Ace your English language skills with our specialized AI tool that is designed to meet your goals. Experience personalized learning powered by advanced artificial intelligence that adapts to your unique learning style and pace.
                </motion.p>

                {/* Bullet Points */}
                <ul className="space-y-3 mb-8">
                 {["Immediate detailed feedback", "24/7 available, practice nonstop!", "Designed for core language purposes", "Tracks your learning progress"].map((item, index) => (
                    <motion.li 
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 + (index * 0.1) }}
                      className="flex items-start"
                    >
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span className="text-sm sm:text-base text-foreground font-medium">{item}</span>
                    </motion.li>
                  ))}
                </ul>

                {/* Practice Now Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                    <Link href={BASE_URL_PROD} target="_blank" rel="noopener noreferrer">
                  <Button 
                    size="lg" 
                    className="px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                  >
                    Practice Now
                  </Button>
                    </Link>
                </motion.div>

              </div>
            </motion.div>
    
            {/* Right Image */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-full lg:w-1/2"
            >
              <div className="relative w-full h-96 sm:h-[28rem] lg:h-[32rem] xl:h-[36rem]">
                <Image
                  src="https://1051thebounce.com/uploads/2025/05/GettyImages-1515913422.jpg?format=auto&optimize=high&width=1920"
                  alt="Fun language learning for kids and teens"
                  fill
                  className="object-cover lg:rounded-tr-[4rem] max-lg:rounded-tl-[2rem]"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}

export default TutelageAi