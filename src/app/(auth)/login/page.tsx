'use client'

import { useActionState } from 'react'
import { login } from '@/actions/auth.actions'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null)

  return (
    <div className="p-8 bg-white shadow-xl rounded-xl w-full max-w-md border border-gray-100">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">ERP Login</h1>
        <p className="text-sm text-gray-500 mt-2">Sign in to access your portal</p>
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            name="email"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
            placeholder="name@school.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            name="password"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-slate-900 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-70"
        >
          {isPending ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}