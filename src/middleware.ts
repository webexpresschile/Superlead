import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const protectedRoutes = createRouteMatcher([
  '/dashboard(.*)',
  '/api/search(.*)',
  '/api/leads(.*)',
  '/api/credits(.*)',
  '/api/user(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (protectedRoutes(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and public ads endpoint
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
