'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, GraduationCap, FileText, Target, Info, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BASE_URL from '@/app/config/url'
import { BASE_URL_PROD } from '@/app/config/url'
import { toast } from 'sonner'

const SearchPage = () => {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const topRef = useRef(null)
  const searchParams = useSearchParams()

  // Available filters based on backend (levels is not available)
  const availableFilters = [
    { value: 'tests', label: 'Tests' },
    { value: 'courses', label: 'Courses' },
    { value: 'blogs', label: 'Blogs' },
    { value: 'skills', label: 'Skills' },
    { value: 'esl resources', label: 'ESL Resources' }
  ]

  // Handle URL parameters and auto-search
  useEffect(() => {
    const urlQuery = searchParams.get('query')
    const urlFilter = searchParams.get('filter')
    if (urlQuery && urlQuery.trim()) {
      setQuery(urlQuery.trim())
      if (urlFilter) {
        setFilter(urlFilter)
      }
      // Trigger search automatically
      setTimeout(() => {
        performSearch(urlQuery.trim(), urlFilter || '', 1)
      }, 100)
    }
  }, [searchParams])

  const performSearch = async (searchQuery, searchFilter = '', searchPage = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        page: searchPage.toString(),
        limit: '10'
      })

      if (searchFilter && searchFilter !== 'all') {
        params.append('filter', searchFilter)
      }

      const response = await fetch(`${BASE_URL}/api/search?${params}`)
      const data = await response.json()
        console.log('resuys:', data);

      if (response.ok) {
        setResults(data.results || [])
        setTotalPages(data.meta?.totalPages || 1)
        setTotalResults(data.meta?.totalResults || 0)
        setHasSearched(true)
        setPage(searchPage)
      } else {
        toast.error(data.message || 'Search failed')
        setResults([])
        setTotalPages(1)
        setTotalResults(0)
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Failed to perform search')
      setResults([])
      setTotalPages(1)
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query')
      return
    }

    await performSearch(query, filter, 1)
  }

  const handlePageChange = (newPage) => {
    setPage(newPage)
    // Trigger search with new page
    performSearch(query, filter, newPage)
    // Scroll to top after a brief delay to ensure content has loaded
    setTimeout(() => {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const resetSearch = () => {
    setQuery('')
    setFilter('')
    setResults([])
    setPage(1)
    setTotalPages(1)
    setTotalResults(0)
    setHasSearched(false)
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div ref={topRef} className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-lg shadow-sm p-6 sm:p-8">
              <div className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                  Search
                </h1>
              </div>

              {/* Search Form */}
              <div className="space-y-4 mb-8">
                {/* Mobile: Input and Category stuck together, Button separate */}
                <div className="flex gap-2 sm:hidden">
                  <div className="flex gap-0 flex-1">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Search for anything..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="w-full rounded-r-none border-r-0"
                      />
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger className="w-32 rounded-l-none border-l-0">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {availableFilters.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-4"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>

                {/* Desktop: Original layout */}
                <div className="hidden sm:flex sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Search for anything..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full"
                    />
                  </div>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {availableFilters.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="whitespace-nowrap"
                  >
                    {loading ? 'Searching...' : 'Search'}
                    <Search className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                {hasSearched && (
                  <div className="text-sm text-muted-foreground">
                    Found {totalResults} result{totalResults !== 1 ? 's' : ''} {filter && filter !== 'all' && `in ${availableFilters.find(f => f.value === filter)?.label || filter}`}
                  </div>
                )}
              </div>

              {/* Search Results */}
              {!hasSearched ? (
                <div className="text-center py-12">
                  <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg">Ready to search</p>
                  <p className="text-muted-foreground text-sm mt-2">Enter your search terms above to find courses, blogs, skills, tests, and ESL resources</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {results.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground text-lg">No results found</p>
                      <p className="text-muted-foreground text-sm mt-2">Try adjusting your search terms or filters</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {results?.map((result, index) => (
                          <div key={`${result.id}-${index}`} className="pb-8 border-b border-border last:border-b-0 cursor-pointer">
                              <Link href={result?.link || '/'} className="block hover:opacity-80 transition-opacity">
                                <h3 className="text-xl font-semibold text-foreground underline underline-offset-2">
                                  {result?.title}
                                </h3>
                               
                                  <p className="text-muted-foreground mt-6 text-base leading-relaxed">
                                    {result?.description}
                                  </p>
                              
                              </Link>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-6 border-t border-border">
                          <Button
                            variant="outline"
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page <= 1 || loading}
                            className="flex items-center gap-2"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>

                          <span className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                          </span>

                          <Button
                            variant="outline"
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page >= totalPages || loading}
                            className="flex items-center gap-2"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Right Side */}
          <div className="space-y-6">
            {/* Tutelage AI CTA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Try Tutelage AI
                </CardTitle>
                <CardDescription>
                  Experience our advanced AI-powered learning platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Enhance your learning with intelligent assistance, smart recommendations, and real-time guidance.
                </p>
                <Link href={BASE_URL_PROD} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full">
                    Launch AI Platform
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* English Level Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Find Your English Level
                </CardTitle>
                <CardDescription>
                  Our free 30-minutes English placement test helps you identify your current level of English proficiency. It assesses grammar, vocabulary, and comprehension to provide an accurate overview of your strengths and areas for development.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/tutelage-tests/free-practice-test">
                  <Button variant="outline" className="w-full mb-3">
                    Take Free Test
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Other Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Practice Tests
                </CardTitle>
                <CardDescription>
                  Improve your skills with our comprehensive test collection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/tutelage-tests/language-placement">
                  <Button variant="ghost" className="w-full text-sm justify-start">
                    Language Placement Test
                  </Button>
                </Link>
                <Link href="/tutelage-tests/mock-exam">
                  <Button variant="ghost" className="w-full text-sm justify-start">
                    Mock Exams
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Course Enrollment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Enroll in Courses
                </CardTitle>
                <CardDescription>
                  Start your English learning journey today
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose from our wide range of English courses designed for all levels and purposes.
                </p>
                <Link href="/courses">
                  <Button variant="outline" className="w-full">
                    Browse Courses
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchPage