'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  BarChart, 
  TrendingUp, 
  Users, 
  Eye, 
  Clock,
  Globe,
  Monitor,
  Smartphone,
  ArrowLeft,
  Download,
  Calendar,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import BASE_URL from '/app/config/url'
import AnalyticsPageSkeleton from "@/components/skeletons/AnalyticsPageSkeleton"


const AnalyticsPage = () => {
  const [stats, setStats] = useState(null)
  const [dailyData, setDailyData] = useState([])
  const [topPages, setTopPages] = useState([])
  const [deviceStats, setDeviceStats] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dateRange, setDateRange] = useState('realtime') // Default to real-time
  const [showDateMenu, setShowDateMenu] = useState(false)

  const dateRangeOptions = [
    { label: 'Real-time', value: 'realtime' },
    { label: 'Last 7 Days', value: 7 },
    { label: 'Last 30 Days', value: 30 },
    { label: 'Last 90 Days', value: 90 },
    { label: 'Last 365 Days', value: 365 },
    { label: 'all time', value: 'all' }
  ]

  useEffect(() => {
    const fetchAllAnalytics = async () => {
      try {
        setLoading(true)
        const isRealtime = dateRange === 'realtime'
        const isAllTime = dateRange === 'all'
        const daysParam = isRealtime ? 'realtime' : (isAllTime ? 'all' : dateRange)
        // For 'All Time' fetch 365 days so we can aggregate into 12 monthly bars.
        const chartDays = isAllTime ? 365 : Math.min(isRealtime ? 7 : (typeof dateRange === 'number' ? dateRange : 30), 30)
        
        const [statsRes, dailyRes, pagesRes, devicesRes, countriesRes] = await Promise.all([
          fetch(`${BASE_URL}/api/website-analytics/website-stats?days=${daysParam}`),
          fetch(`${BASE_URL}/api/website-analytics/daily-stats?days=${chartDays}`),
          fetch(`${BASE_URL}/api/website-analytics/top-pages?limit=5&days=${daysParam}`),
          fetch(`${BASE_URL}/api/website-analytics/device-stats?days=${daysParam}`),
          fetch(`${BASE_URL}/api/website-analytics/country-stats?limit=5&days=${daysParam}`)
        ])

        if (!statsRes.ok) console.log('failed to fetch stats');
        

        const [statsData, dailyDataRes, pagesData, devicesData, countriesData] = await Promise.all([
          statsRes.json(),
          dailyRes.json(),
          pagesRes.json(),
          devicesRes.json(),
          countriesRes.json()
        ])

        setStats(statsData.data)
        setDailyData(dailyDataRes.data || [])
        setTopPages(pagesData.data || [])
        setDeviceStats(devicesData.data || [])
        setCountries(countriesData.data || [])
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAllAnalytics()
  }, [dateRange])

  if (loading) {
    return <AnalyticsPageSkeleton />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Unable to load analytics</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Link href="/admin-dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // Limit chart display based on date range
  // For "All Time", show monthly aggregated data (12 months max)
  // For other ranges, show daily data (max 30 days)
  const isAllTime = dateRange === 'all'
  
  let chartData = []
  // For 'all time' and '365 days', always aggregate by month (12 bars, month labels)
  const shouldShowMonthly = isAllTime || dateRange === 365
  if (shouldShowMonthly) {
    // Aggregate data by month for all time or 365 days view (produce short month labels: Jan, Feb, ...)
    const monthlyMap = new Map()
    dailyData.forEach(day => {
      const date = new Date(
        day.date.substring(0, 4),
        day.date.substring(4, 6) - 1,
        day.date.substring(6, 8)
      )
      const year = date.getFullYear()
      const monthIndex = date.getMonth() + 1
      const monthId = `${year}-${String(monthIndex).padStart(2, '0')}` // e.g. 2025-01
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short' }) // Jan, Feb, Mar

      if (!monthlyMap.has(monthId)) {
        monthlyMap.set(monthId, { id: monthId, day: monthLabel, views: 0, users: 0 })
      }
      const m = monthlyMap.get(monthId)
      m.views += day.views
      m.users += day.users
    })

    // Always show last 12 months, even if some months have zero data
    const now = new Date()
    const months = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const monthIndex = d.getMonth() + 1
      const monthId = `${year}-${String(monthIndex).padStart(2, '0')}`
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' })
      const m = monthlyMap.get(monthId) || { id: monthId, day: monthLabel, views: 0, users: 0 }
      months.push(m)
    }
    chartData = months
  } else {
    // Show daily data (pad to requested days: realtime -> 7, otherwise selected number or 30)
    const daysToShow = dateRange === 'realtime' ? 7 : (typeof dateRange === 'number' ? dateRange : 30)
    // Build map of existing dailyData by date
    const dailyMap = new Map(dailyData.map(d => [d.date, d]))
    const today = new Date()
    const padded = []
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}${mm}${dd}`
      const existing = dailyMap.get(dateStr)
      // For 30 and 90 days, show date (e.g., Nov 15); otherwise, show weekday
      let dayLabel
      if (dateRange === 30 || dateRange === 90) {
        dayLabel = d.toLocaleDateString('en-US', { day: 'numeric' , month: 'short'})
      } else {
        dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' })
      }
      padded.push({
        date: dateStr,
        day: dayLabel,
        views: existing ? existing.views : 0,
        users: existing ? existing.users : 0
      })
    }
    chartData = padded
  }
  
  const maxValue = Math.max(...chartData.map(d => Math.max(d.views, d.users)), 1)

  const exportToPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    // Title
    doc.setFontSize(20)
    doc.setTextColor(40, 40, 40)
    doc.text('Tutelage Analytics Report', pageWidth / 2, 20, { align: 'center' })
    
    // Date range
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    const selectedRange = dateRangeOptions.find(opt => opt.value === dateRange)?.label || 'Last 30 Days'
    const rangeText = dateRange === 'realtime' ? 'Real-time (Live Data)' : `Date Range: ${selectedRange}`
    doc.text(rangeText, pageWidth / 2, 28, { align: 'center' })
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 33, { align: 'center' })
    
    let yPos = 45
    
    // Key Metrics
    doc.setFontSize(14)
    doc.setTextColor(40, 40, 40)
    doc.text('Key Metrics', 14, yPos)
    yPos += 8
    
    const metricsData = [
      ['Total Views', stats?.totalViews?.toLocaleString() || '0'],
      ['Unique Visitors', stats?.uniqueVisitors?.toLocaleString() || '0'],
      ['Avg. Session Duration', stats?.avgSessionDuration || '0m 0s'],
      ['Active Users Today', stats?.todayActive?.toLocaleString() || '0'],
      ['Growth', `${stats?.weeklyGrowth >= 0 ? '+' : ''}${stats?.weeklyGrowth || 0}%`]
    ]
    
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: metricsData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 }
    })
    
    yPos = doc.lastAutoTable.finalY + 15
    
    // Top Pages
    if (topPages.length > 0) {
      doc.setFontSize(14)
      doc.text('Top Pages', 14, yPos)
      yPos += 8
      
      const pagesData = topPages.map(page => [
        page.page,
        page.views.toLocaleString(),
        `${page.percentage}%`
      ])
      
      autoTable(doc, {
        startY: yPos,
        head: [['Page', 'Views', 'Percentage']],
        body: pagesData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 }
      })
      
      yPos = doc.lastAutoTable.finalY + 15
    }
    
    // Device Stats
    if (deviceStats.length > 0 && yPos < 250) {
      doc.setFontSize(14)
      doc.text('Device Breakdown', 14, yPos)
      yPos += 8
      
      const devicesData = deviceStats.map(device => [
        device.device,
        device.count.toLocaleString(),
        `${device.percentage}%`
      ])
      
      autoTable(doc, {
        startY: yPos,
        head: [['Device', 'Users', 'Percentage']],
        body: devicesData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 }
      })
      
      yPos = doc.lastAutoTable.finalY + 15
    }
    
    // New page for countries if needed
    if (countries.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }
      
      doc.setFontSize(14)
      doc.text('Top Countries', 14, yPos)
      yPos += 8
      
      const countriesData = countries.map(country => [
        country.name,
        country.users.toLocaleString()
      ])
      
      autoTable(doc, {
        startY: yPos,
        head: [['Country', 'Users']],
        body: countriesData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 }
      })
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }
    
    // Save PDF
    const fileName = `tutelage-analytics-${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin-dashboard">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Comprehensive website traffic and visitor insights
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Date Range Picker */}
          <div className="relative">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowDateMenu(!showDateMenu)}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {dateRangeOptions.find(opt => opt.value === dateRange)?.label }
            </Button>
            
            {showDateMenu && (
              <Card className="absolute right-0 top-12 z-50 w-48 shadow-lg">
                <CardContent className="p-2">
                  {dateRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setDateRange(option.value)
                        setShowDateMenu(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                        dateRange === option.value ? 'bg-accent font-medium' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Export Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportToPDF}
            disabled={!stats}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalViews?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">
              {dateRangeOptions.find(opt => opt.value === dateRange)?.label || 'Selected period'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.uniqueVisitors?.toLocaleString() || '0'}</div>
            <p className={`text-xs flex items-center gap-1 ${
              (stats?.weeklyGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendingUp className="h-3 w-3" />
              {(stats?.weeklyGrowth || 0) >= 0 ? '+' : ''}{stats?.weeklyGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgSessionDuration || '0m 0s'}</div>
            <p className="text-xs text-muted-foreground">Time spent per visit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todayActive?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">Currently browsing</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Traffic Overview</CardTitle>
            <CardDescription>Daily page views and unique visitors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Chart */}
              <div className="flex items-end justify-between gap-3 h-64 overflow-y-auto">
                {chartData.length > 0 ? (
                  chartData.map((data, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="w-full flex gap-1 items-end" style={{ height: '85%' }}>
                        {/* Views bar */}
                        <div 
                          className="flex-1 bg-gradient-to-t from-primary to-primary/60 rounded-t-md hover:from-primary/80 transition-all"
                          style={{ height: `${(data.views / maxValue) * 100}%` }}
                          title={`${data.views} views`}
                        />
                        {/* Users bar */}
                        <div 
                          className="flex-1 bg-gradient-to-t from-green-500 to-green-400 rounded-t-md hover:from-green-600 transition-all"
                          style={{ height: `${(data.users / maxValue) * 100}%` }}
                          title={`${data.users} users`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {isAllTime ? data.day : data.day}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No data available yet</p>
                  </div>
                )}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span className="text-sm text-muted-foreground">website Views</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-sm text-muted-foreground">Active Visitors</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>Most visited pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {topPages.length > 0 ? (
                topPages.map((page, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="font-medium flex-1 break-all" title={page.page}>
                        {page.page}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {page.views.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all"
                        style={{ width: `${page.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No page data available yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device & Geography */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Devices
            </CardTitle>
            <CardDescription>Traffic by device type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deviceStats.map((device, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    {device.device === 'Mobile' ? (
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{device.device}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-secondary rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${device.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-16 text-right">
                      {device.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Top Countries
            </CardTitle>
            <CardDescription>Visitors by location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {countries.map((country, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{country.flag}</span>
                    <span className="text-sm font-medium">{country.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {country.users.toLocaleString()} users
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Notice */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BarChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Connected to Google Analytics
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {stats?.totalViews > 0 ? (
                  <>
                    This dashboard is displaying real-time data from Google Analytics. 
                    Data is fetched directly from your Google Analytics property and updates automatically.
                  </>
                ) : (
                  <>
                    Google Analytics is configured but hasn't collected data yet. 
                    It typically takes 24-48 hours to start showing visitor data after initial setup. 
                    Keep the site running and check back soon!
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AnalyticsPage
