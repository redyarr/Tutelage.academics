'use client'
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

const OnlineCourses = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <>
      {/* Online Courses Section */}
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
              Online Courses
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
                  Learn quicker with our unique online courses.
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-sm sm:text-base lg:text-lg text-muted-foreground leading-relaxed mb-6"
                >
                  No matter where you are or how you want to study. At Tutelage, your course is designed the way it suits you!
                </motion.p>

                {/* Bullet Points */}
                <ul className="space-y-3 mb-8">
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="flex items-start"
                  >
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Personalized learning tailored to your goals</span>
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="flex items-start"
                  >
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Flexible options: group classes or one-on-one sessions</span>
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    className="flex items-start"
                  >
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Learn anywhere, anytime – always within reach</span>
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="flex items-start"
                  >
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Simple, modern approach that's enjoyable and effective</span>
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    className="flex items-start"
                  >
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <span className="text-sm sm:text-base text-foreground font-medium">Practice exercises after each lesson to boost your skills</span>
                  </motion.li>
                </ul>

                {/* Enroll Now Button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.6, delay: 1.0 }}
                >
                  <Link href="/courses/enroll">
                    <Button 
                      size="lg" 
                      className="px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                    >
                      Enroll Now
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
                  src="https://online.hbs.edu/Style%20Library/api/resize.aspx?imgpath=/PublishingImages/working-adult-taking-online-course.jpg&w=1200&h=630"
                  alt="Online English courses"
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

export default OnlineCourses