


const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

export async function POST(req) {
  try {
    const body = await req.json()
    const { email, password } = body || {}

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Missing email or password' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    // Forward to backend
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    // If backend failed, forward status and message
    if (!data) {
      return new Response(JSON.stringify({ success: false, message: 'No response from backend' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }

    // If login successful, set HttpOnly cookies for tokens
    const headers = { 'Content-Type': 'application/json' }
    if (data.success && (data.accessToken || data.refreshToken)) {
      const cookies = []
      // accessToken cookie
      if (data.accessToken) {
        cookies.push(`token=${data.accessToken}; Path=/; HttpOnly; SameSite=Strict; Secure`)
      }
      if (data.refreshToken) {
        cookies.push(`refreshToken=${data.refreshToken}; Path=/; HttpOnly; SameSite=Strict; Secure`)
      }
      if (cookies.length) headers['Set-Cookie'] = cookies.join(', ')
    }

    // Only return the simplified payload to the client
    const payload = {
      success: !!data.success,
      message: data.message || (data.success ? 'Login successful' : 'Login failed'),
      user: data.user || null,
    }

    return new Response(JSON.stringify(payload), { status: 200, headers })
  } catch (err) {
    console.error('API /signin error:', err)
    return new Response(JSON.stringify({ success: false, message: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function GET() {
  return new Response(JSON.stringify({ success: false, message: 'Use POST' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
}
