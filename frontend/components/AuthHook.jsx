'use client'

import BASE_URL from "@/app/config/url";
import { useEffect } from "react";

// app/hooks/useAuth.js
export function useAuth() {
  useEffect(() => {
    // ✅ 1️⃣ On first mount: refresh immediately
    const refreshNow = async () => {
      try {
        // Include refresh token via header if available, with cookies as fallback
        let refreshToken = null
        refreshToken = localStorage.getItem('refreshToken')

        const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {})
          },
          body: JSON.stringify({refreshToken}),
          credentials: 'include',
        });
        try {
          const data = await res.json()
          if (data?.success) {
            if (data?.accessToken) {
              try { localStorage.setItem('accessToken', data.accessToken) } catch {}
            }
            if (data?.refreshToken) {
              try { localStorage.setItem('refreshToken', data.refreshToken) } catch {}
            }
          }
        } catch {}
        
      } catch (error) {
        console.error('Error refreshing token on mount:', error);
      }
    };

    refreshNow();

    // ✅ 2️⃣ Then refresh every 30 mins
    const interval = setInterval(async () => {
      try {
        let refreshToken = null
        try { refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null } catch {}

         const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {})
          },
          credentials: 'include',
        });
        try {
          const data = await res.json()
          if (data?.success) {
            if (data?.accessToken) {
              try { localStorage.setItem('accessToken', data.accessToken) } catch {}
            }
            if (data?.refreshToken) {
              try { localStorage.setItem('refreshToken', data.refreshToken) } catch {}
            }
          }
        } catch {}
      } catch (error) {
        console.error('Error refreshing token (interval):', error);
      }
    }, 50 * 60 * 1000); // every 30 mins

    return () => clearInterval(interval);
  }, []);
}


// AuthProvider component to wrap the app and keep the token refresh active
export default function RefreshTokenProvider({ children }) {
  useAuth();
  return <>{children}</>;
}
