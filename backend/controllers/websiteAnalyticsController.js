// ============================================================================
// WEBSITE ANALYTICS CONTROLLER
// ============================================================================
// Fetch website analytics data from Google Analytics Data API

const { analyticsDataClient, propertyId } = require('../config/googleAnalytics');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (value) => ISO_DATE.test(value || '') && !Number.isNaN(Date.parse(value));

/**
 * GA date range for a request: an explicit ?from=YYYY-MM-DD&to=YYYY-MM-DD (the dashboard's custom
 * range) wins; otherwise `startDate` (from ?days=) through today. Invalid from/to fall back silently.
 */
function rangeFrom(query, startDate) {
  const { from, to } = query;
  if (isIsoDate(from) && isIsoDate(to) && from <= to) return { startDate: from, endDate: to };
  return { startDate, endDate: 'today' };
}
exports.rangeFrom = rangeFrom;

/**
 * Get overall website statistics
 * - Total page views (all time)
 * - Unique visitors
 * - Active users today
 * - Average session duration
 */
exports.getWebsiteStats = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({
        success: false,
        message: 'Google Analytics not configured'
      });
    }

    // Check if real-time mode is requested
    const isRealtime = req.query.days === 'realtime';
    const isAllTime = req.query.days === 'all';

    if (isRealtime) {
      // Use Realtime API for live data
      const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' }
        ]
      });

      const row = realtimeResponse.rows?.[0];
      const activeUsers = parseInt(row?.metricValues?.[0]?.value || '0');
      const realtimeViews = parseInt(row?.metricValues?.[1]?.value || '0');

      // For real-time, also get last 30 minutes trend
      const [last30MinResponse] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: [{ name: 'minutesAgo' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'minutesAgo' }, desc: false }]
      });

      console.log('Real-time Stats:', {
        activeUsers,
        realtimeViews,
        last30MinData: last30MinResponse.rows?.length || 0
      });

      return res.status(200).json({
        success: true,
        data: {
          totalViews: realtimeViews,
          uniqueVisitors: activeUsers,
          avgSessionDuration: 'Live',
          todayActive: activeUsers,
          weeklyGrowth: 0,
          isRealtime: true
        }
      });
    }

    // Get date range from query params (default to 30 days)
    const daysAgo = parseInt(req.query.days) || 30;
    // For "all time", use a far back date (GA4 max is ~14 months by default, can be up to 50 months)
    const startDate = isAllTime ? '2020-01-01' : `${daysAgo}daysAgo`;

    // Fetch multiple metrics in parallel
    const [totalViewsResponse, last30DaysResponse, todayResponse] = await Promise.all([
      // Total views for the selected period
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [rangeFrom(req.query, startDate)],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' }
        ]
      }),

      // Last 30 days for growth calculation
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          { startDate: '30daysAgo', endDate: 'yesterday' },
          { startDate: '60daysAgo', endDate: '31daysAgo' }
        ],
        metrics: [{ name: 'totalUsers' }]
      }),

      // Today's active users
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: 'today', endDate: 'today' }],
        metrics: [{ name: 'activeUsers' }]
      })
    ]);

    // Parse total stats
    const totalRow = totalViewsResponse[0].rows?.[0];
    const totalViews = parseInt(totalRow?.metricValues?.[0]?.value || '0');
    const uniqueVisitors = parseInt(totalRow?.metricValues?.[1]?.value || '0');
    const avgSessionDuration = parseFloat(totalRow?.metricValues?.[2]?.value || '0');

    // Parse growth data
    const growthRow = last30DaysResponse[0].rows?.[0];
    const currentPeriodUsers = parseInt(growthRow?.metricValues?.[0]?.value || '0');
    const previousPeriodUsers = parseInt(growthRow?.metricValues?.[1]?.value || '1');
    const weeklyGrowth = Math.round(((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100);

    // Parse today's data
    const todayRow = todayResponse[0].rows?.[0];
    const todayActive = parseInt(todayRow?.metricValues?.[0]?.value || '0');

    // Format session duration
    const minutes = Math.floor(avgSessionDuration / 60);
    const seconds = Math.floor(avgSessionDuration % 60);
    const avgSessionFormatted = `${minutes}m ${seconds}s`;

    res.status(200).json({
      success: true,
      data: {
        totalViews,
        uniqueVisitors,
        avgSessionDuration: avgSessionFormatted,
        todayActive,
        weeklyGrowth
      }
    });

  } catch (error) {
    console.error('❌ Error fetching website stats from GA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get daily statistics for chart visualization
 * Returns views and users per day for the specified number of days
 */
exports.getDailyStats = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({
        success: false,
        message: 'Google Analytics not configured'
      });
    }

    const isAllTime = req.query.days === 'all';
    // For all time, send 365 days so frontend can aggregate into 12 months
    const days = isAllTime ? 365 : (parseInt(req.query.days) || 7);
    const startDate = isAllTime ? '2020-01-01' : `${days}daysAgo`;

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [rangeFrom(req.query, startDate)],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' }
      ],
      orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }]
    });

    // Map rows by date string for quick lookup
    const rowsMap = new Map();
    (response.rows || []).forEach(row => {
      const dateStr = row.dimensionValues?.[0]?.value || '';
      const views = parseInt(row.metricValues?.[0]?.value || '0');
      const users = parseInt(row.metricValues?.[1]?.value || '0');
      if (dateStr) rowsMap.set(dateStr, { date: dateStr, views, users });
    });

    // Build a continuous daily array for the requested `days` length (oldest -> newest)
    const dailyData = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`;
      const found = rowsMap.get(dateStr);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      dailyData.push({
        date: dateStr,
        day: dayName,
        views: found ? found.views : 0,
        users: found ? found.users : 0
      });
    }

    res.status(200).json({
      success: true,
      data: dailyData
    });

  } catch (error) {
    console.error('❌ Error fetching daily stats from GA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get top pages by views
 */
exports.getTopPages = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({
        success: false,
        message: 'Google Analytics not configured'
      });
    }

    const limit = parseInt(req.query.limit) || 5;
    const isRealtime = req.query.days === 'realtime';
    const isAllTime = req.query.days === 'all';

    let response;

    if (isRealtime) {
      // Use Realtime API - try different dimensions to find page paths
      // First try: pagePath, pageLocation, or unifiedScreenName
      let pathResponse, locationResponse;
      
      try {
        // Try pagePath dimension
        [pathResponse] = await analyticsDataClient.runRealtimeReport({
          property: `properties/${propertyId}`,
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit
        });
        response = pathResponse;
        console.log('✅ Using pagePath dimension for real-time');
      } catch (error) {
        console.log('⚠️ pagePath dimension not available, trying pageLocation...');
        try {
          // Try pageLocation dimension as fallback
          [locationResponse] = await analyticsDataClient.runRealtimeReport({
            property: `properties/${propertyId}`,
            dimensions: [{ name: 'pageLocation' }],
            metrics: [{ name: 'screenPageViews' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit
          });
          response = locationResponse;
          console.log('✅ Using pageLocation dimension for real-time');
        } catch (error2) {
          // Fallback to unifiedScreenName (page title)
          console.log('⚠️ pageLocation not available, falling back to unifiedScreenName');
          [response] = await analyticsDataClient.runRealtimeReport({
            property: `properties/${propertyId}`,
            dimensions: [{ name: 'unifiedScreenName' }],
            metrics: [{ name: 'screenPageViews' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit
          });
        }
      }
    } else {
      const daysAgo = parseInt(req.query.days) || 30;
      const startDate = isAllTime ? '2020-01-01' : `${daysAgo}daysAgo`;

      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [rangeFrom(req.query, startDate)],
        dimensions: [{ name: 'pagePathPlusQueryString' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit
      });
    }

    const totalViews = response.rows?.reduce((sum, row) => {
      return sum + parseInt(row.metricValues?.[0]?.value || '0');
    }, 0) || 1;

    const topPages = response.rows?.map(row => {
      const views = parseInt(row.metricValues?.[0]?.value || '0');
      let pagePath = row.dimensionValues?.[0]?.value || '/';
      
      // If it's a full URL (pageLocation), extract just the path
      if (isRealtime && pagePath.startsWith('http')) {
        try {
          const url = new URL(pagePath);
          pagePath = url.pathname + url.search;
        } catch (e) {
          // Keep original if URL parsing fails
        }
      }
      
      return {
        page: pagePath,
        views,
        percentage: Math.round((views / totalViews) * 100)
      };
    }) || [];

    // Debug logging for real-time
    if (isRealtime) {
      console.log('🔍 Real-time Top Pages Raw Data:');
      response.rows?.forEach((row, idx) => {
        console.log(`  ${idx + 1}. Value: "${row.dimensionValues?.[0]?.value}", Views: ${row.metricValues?.[0]?.value}`);
      });
    }

      console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
      console.log('Top Pages:', topPages);
    res.status(200).json({
      success: true,
      data: topPages
    });

  } catch (error) {
    console.error('❌ Error fetching top pages from GA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top pages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get device breakdown
 */
exports.getDeviceStats = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({
        success: false,
        message: 'Google Analytics not configured'
      });
    }

    const isRealtime = req.query.days === 'realtime';
    const isAllTime = req.query.days === 'all';
    let response;

    if (isRealtime) {
      // Use Realtime API
      [response] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }]
      });
    } else {
      const daysAgo = parseInt(req.query.days) || 30;
      const startDate = isAllTime ? '2020-01-01' : `${daysAgo}daysAgo`;

      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [rangeFrom(req.query, startDate)],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }]
      });
    }

    const totalUsers = response.rows?.reduce((sum, row) => {
      return sum + parseInt(row.metricValues?.[0]?.value || '0');
    }, 0) || 1;

    const deviceStats = response.rows?.map(row => {
      const count = parseInt(row.metricValues?.[0]?.value || '0');
      const device = row.dimensionValues?.[0]?.value || 'Unknown';
      return {
        device: device.charAt(0).toUpperCase() + device.slice(1),
        count,
        percentage: Math.round((count / totalUsers) * 100)
      };
    }) || [];

    res.status(200).json({
      success: true,
      data: deviceStats
    });

  } catch (error) {
    console.error('❌ Error fetching device stats from GA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get top countries
 */
exports.getCountryStats = async (req, res) => {
  try {
    if (!propertyId) {
      return res.status(500).json({
        success: false,
        message: 'Google Analytics not configured'
      });
    }

    const limit = parseInt(req.query.limit) || 5;
    const isRealtime = req.query.days === 'realtime';
    const isAllTime = req.query.days === 'all';
    let response;

    if (isRealtime) {
      // Use Realtime API
      [response] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit
      });
    } else {
      const daysAgo = parseInt(req.query.days) || 30;
      const startDate = isAllTime ? '2020-01-01' : `${daysAgo}daysAgo`;

      [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [rangeFrom(req.query, startDate)],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit
      });
    }

    // Country flag mapping
    const countryFlags = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧',
      'Canada': '🇨🇦',
      'Australia': '🇦🇺',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'India': '🇮🇳',
      'Japan': '🇯🇵',
      'Brazil': '🇧🇷',
      'Mexico': '🇲🇽'
    };

    const countries = response.rows?.map(row => {
      const name = row.dimensionValues?.[0]?.value || 'Unknown';
      return {
        name,
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        flag: countryFlags[name] || '🌍'
      };
    }) || [];

    res.status(200).json({
      success: true,
      data: countries
    });

  } catch (error) {
    console.error('❌ Error fetching country stats from GA:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch country statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
