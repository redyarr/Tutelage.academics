"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { CreditCard, HelpCircle, Zap, Clock, ChevronDown } from 'lucide-react' 
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import BASE_URL from "@/app/config/url"


const FreePracticeTest = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalQuestions: 0,
    timeLimitMinutes: 0
  })
  console.log('stats:', stats);
  

  const fetchQuizStats = async () => {
    setLoading(true)
    try{
      const configRes = await fetch(`${BASE_URL}/api/admin/quiz/config`, {
        credentials: 'include'
      })
      const configData = await configRes.json()
      console.log('configData:', configData);
      setStats({
        totalQuestions: configData.data.totalQuestions,
        timeLimitMinutes: configData.data.timeLimitMinutes
      })
    }catch(err){
      console.error('Error fetching quiz stats:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
      fetchQuizStats()
    }, [])


  return (
  <div className="relative min-h-screen bg-background pt-4"> 
        <FreeTestHero stats={stats}/>
        <DiscoverSection stats={stats}/>
        <TestInstructions stats={stats}/>
        <FAQSection stats={stats}/>
        <CallToAction stats={stats}/>
  </div>
    
     )
}

export default FreePracticeTest


const FreeTestHero = ({ stats }) => {
  console.log('stats in hero:', stats);
  const title = "Discover Your English Level Online – Free Test"
  const heroImage = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=1400"
  const description = `Our free ${stats.timeLimitMinutes}-minutes English practice test helps you identify your current level of English proficiency. It assesses grammar, vocabulary, and comprehension to provide an accurate overview of your strengths and areas for development.`
  return (
    <>
      {/* Header Section */}
      <div className="bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-between gap-6 py-6">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl flex items-center justify-between font-bold text-foreground mb-2">
                {title}
                <Link href="/tutelage-tests/free-practice-test/start">
                    <Button size="lg" className="bg-primary text-primary-foreground px-6 py-3 cursor-pointer">
                         Start the test
                    </Button>
                </Link>
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Image Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="relative w-full h-64 sm:h-80 md:h-96 lg:h-[28rem] rounded-lg overflow-hidden shadow-lg">
          <Image
            src={heroImage}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 1200px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      </div>

      {/* Description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-5xl">
          <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </>
  )
}

function DiscoverSection({ stats }) {
  const title = 'Discover Your English Level Online – Free Test'
  const desc = `Our ${stats.timeLimitMinutes}-minutes free placement test provides an accurate assessment of your
                English proficiency. Analyze your grammar knowledge, highlight areas for
                improvement, and gain a clear understanding of your language level.`

  const images = [
    'https://www.fsp-law.com/wp-content/uploads/2022/05/Exam.jpg',
    'https://www.fsp-law.com/wp-content/uploads/2022/05/Exam.jpg',
    'https://www.fsp-law.com/wp-content/uploads/2022/05/Exam.jpg'
  ]

  return (
    <section className="py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          
          {/* --- MOBILE IMAGE (single big image on top) --- */}
          <div className="block lg:hidden w-full mb-6">
            <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-lg overflow-hidden shadow-lg">
              <Image
                src={images[2]}
                alt="English Level Test"
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
            </div>
          </div>

          {/* --- TEXT SECTION --- */}
          <div className="order-2 lg:order-1 text-left">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              {title}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-line mb-6 max-w-2xl">
              {desc}
            </p>
            <div>
              <Link href="/tutelage-tests/free-practice-test/start">
                <Button size="lg" className="bg-primary text-primary-foreground px-6 py-3 cursor-pointer">
                  Start the test
                </Button>
              </Link>
            </div>
          </div>

          {/* --- DESKTOP IMAGE STACK --- */}
          <div className="hidden lg:flex items-center justify-center order-1">
            <div className="relative w-full max-w-[560px] h-[420px]">
              {/* Back image */}
              <div className="absolute -left-4 xl:-left-6 top-10 w-[50%] h-[50%] xl:w-[64%] xl:h-[64%] transform translate-x-6 overflow-hidden shadow-lg z-10">
                <Image src={images[0]} alt="image-1" fill className="object-cover" />
              </div>

              {/* Middle image */}
              <div className="absolute left-0 xl:left-2 top-6 w-[64%] h-[64%] xl:w-[78%] xl:h-[78%] transform translate-x-10 overflow-hidden shadow-2xl z-20">
                <Image src={images[1]} alt="image-2" fill className="object-cover" />
              </div>

              {/* Front image */}
              <div className="absolute max-xl:left-6 xl:right-0 top-0 w-[76%] h-[76%] xl:w-[90%] xl:h-[90%] transform translate-x-12 overflow-hidden shadow-2xl z-30">
                <Image src={images[2]} alt="image-3" fill className="object-cover" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

function TestInstructions({ stats }) {
  const instructions = [
    {
      title: 'Complete every question',
      desc: `The test contains ${stats.totalQuestions} multiple-choice questions. Make sure you answer each one.`
    },
    {
      title: 'Answer honestly',
      desc: "To get the most accurate result, answer truthfully — there's no judgment!"
    },
    {
      title: `Complete within ${stats.timeLimitMinutes} minutes`,
      desc: `The test is designed to be completed in roughly ${stats.timeLimitMinutes} minutes. Read each question carefully before answering.`
    },
    {
      title: 'Review your outcome',
      desc: "After completing the test, you'll receive an estimate of your current English level."
    },
    {
      title: 'Check your results 📊',
      desc: "Once you finish, you'll receive an approximate assessment of your current English level."
    }
  ]

  const features = [
    { Icon: CreditCard, title: 'No fees' },
    { Icon: HelpCircle, title: `${stats.totalQuestions} questions` },
    { Icon: Zap, title: 'Immediate result' },
    { Icon: Clock, title: `${stats.timeLimitMinutes} minutes` }
  ]

  return (
    <section className="py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Two-column layout: left = test overview, right = instructions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side */}
          <div className="flex flex-col">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              How does Tutelage's English placement test work?
            </h2>
            <p className="text-base text-muted-foreground mb-6">
              Test your English grammar with this Tutelage placement test
            </p>

            {/* Four feature icons */}
            <div className="grid grid-cols-2 gap-6 mb-2">
              {features.map((feat, i) => (
                <div key={i} className="flex items-center gap-3">
                  <feat.Icon className="w-8 h-8 sm:w-10 sm:h-10 text-foreground flex-shrink-0" />
                  <div className="text-base sm:text-lg font-semibold text-foreground">{feat.title}</div>
                </div>
              ))}
            </div>

            {/* CTA button */}
            <div className="mt-4">
              <Link href="/tutelage-tests/free-practice-test/start">
                <Button size="lg" className="w-fit sm:w-auto px-6 py-2 text-base font-semibold cursor-pointer">
                  Start the test
                </Button>
              </Link>
            </div>
          </div>

          {/* Right side */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-md">
            <h3 className="text-xl font-bold text-foreground mb-4">Test Instructions</h3>
            <ol className="space-y-3">
              {instructions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}

function FAQSection({ stats }) {
  return (
    <div className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions (FAQ)
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {[
            {
              question: 'How long does the test take?',
              answer: 'The test takes approximately 30 minutes to complete.'
            },
            {
              question: 'How many questions are there?',
              answer: `There are ${stats.totalQuestions} multiple-choice questions covering grammar, vocabulary, and comprehension.`
            },
            {
              question: 'Is the test free?',
              answer: 'Yes! The placement test is completely free.'
            },
            {
              question: 'Do I need to register or create an account?',
              answer: 'No registration is required — you can start the test immediately.'
            },
            {
              question: 'How will I get my results?',
              answer: "After completing the test, you'll receive an approximate evaluation of your English level and insights into areas to improve."
            },
            {
              question: 'Can I take the test more than once?',
              answer: 'Yes! You can retake the test whenever you like to track your progress.'
            }
          ].map((faq, index) => {
            const [open, setOpen] = useState(false)
            return (
              <div
                key={index}
                className="bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md"
              >
                {/* Question Bar */}
                <button
                  onClick={() => setOpen(!open)}
                  className="w-full flex items-center justify-between p-5 text-left transition-colors duration-200 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <HelpCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-base font-semibold text-foreground pr-4">
                      {faq.question}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <ChevronDown className="w-5 h-5 text-primary flex-shrink-0" />
                  </motion.div>
                </button>

                {/* Answer */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="px-5 pb-5 pt-2">
                        <p className="text-muted-foreground leading-relaxed pl-9">
                          {faq.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


const CallToAction = ({ stats }) => {
  return (
    <section className="py-16 bg-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-left">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
             Ready to boost your English skills?
          </h2>
          <p className="text-lg text-foreground leading-relaxed mb-8 max-w-3xl">
            Enroll in our online courses today and enjoy
            interactive lessons, practical exercises, and continuous support from experienced
            teachers. Build your confidence in speaking, reading, and writing English while
            learning at your own pace, anytime and anywhere.
          </p>
          <Link href="/courses">
            <Button size="lg" variant={'secondary'} className="text-lg px-8 py-6">
              Explore Courses
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}






