'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Target, Loader2, ShoppingCart } from 'lucide-react'

const LEAD_OPTIONS = [10, 20, 30, 40, 50, 60]

export default function Dashboard() {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [leads, setLeads] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [maxResults, setMaxResults] = useState(20)
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState({
    used: 0,
    limit: 50,
    used_today: 0,
    daily_limit: 7,
  })

  useEffect(() => {
    if (isSignedIn) {
      loadLeads()
      loadCredits()
    }
  }, [isSignedIn])

  async function loadLeads() {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ format: 'json' }),
    })
    const data = await res.json()
    if (data.leads) setLeads(data.leads)
  }

  async function loadCredits() {
    const token = await getToken()
    if (!token) return
    const { data } = await supabase
      .from('users')
      .select('credits_used, credits_limit, credits_used_today, daily_limit')
      .eq('auth_id', user?.id)
      .single()
    if (data) {
      setCredits({
        used: data.credits_used ?? 0,
        limit: data.credits_limit ?? 50,
        used_today: data.credits_used_today ?? 0,
        daily_limit: data.daily_limit ?? 7,
      })
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query || !location) return
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, location, max_results: maxResults }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLeads(prev => [...data.leads, ...prev])
      setCredits({
        used: data.credits.used,
        limit: data.credits.limit,
        used_today: data.credits.used_today,
        daily_limit: data.credits.daily_limit,
      })
    } catch (e: any) {
      if (e.message.includes('diario')) {
        alert('📅 Límite diario alcanzado. Vuelve mañana o compra más créditos.')
      } else if (e.message.includes('mensual')) {
        alert('📊 Límite mensual alcanzado. Compra más créditos.')
      } else {
        alert(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ format: 'csv' }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <Target className="w-10 h-10 text-blue-600 mx-auto mb-2" />
            <CardTitle>Inicia sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignInButton mode="modal">
              <Button className="w-full">Continuar con Google</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="font-bold">Superlead</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="text-xs gap-2">
              <ShoppingCart className="w-3 h-3" />
              Comprar créditos
            </Button>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Rubro (ej: restaurantes, dentistas, gym)"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Ubicación (ej: Santiago, Chile)"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading || !query || !location}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </form>

            {/* Lead quantity selector */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Leads por búsqueda:</span>
              <div className="flex gap-2">
                {LEAD_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxResults(n)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                      maxResults === n
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-400 ml-auto">
                {credits.used_today}/{credits.daily_limit} usados hoy
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Leads encontrados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{leads.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Búsquedas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{new Set(leads.map(l => l.search_id)).size}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Créditos del mes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                <span className={credits.limit - credits.used <= 5 ? 'text-red-500' : ''}>
                  {credits.limit - credits.used}
                </span>
                <span className="text-lg text-gray-400">/{credits.limit}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{credits.daily_limit - credits.used_today}</p>
                <p className="text-sm text-gray-400">/{credits.daily_limit}</p>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${(credits.used_today / credits.daily_limit) * 100}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Leads</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Busca tu primer lead para empezar</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 font-medium text-gray-500">Nombre</th>
                      <th className="text-left py-3 font-medium text-gray-500">Teléfono</th>
                      <th className="text-left py-3 font-medium text-gray-500">Dirección</th>
                      <th className="text-left py-3 font-medium text-gray-500">Rating</th>
                      <th className="text-left py-3 font-medium text-gray-500">Categoría</th>
                      <th className="text-left py-3 font-medium text-gray-500">Competencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 font-medium">{lead.name}</td>
                        <td className="py-3 text-gray-500">{lead.phone || '-'}</td>
                        <td className="py-3 text-gray-500 max-w-[200px] truncate">{lead.address || '-'}</td>
                        <td className="py-3">
                          {lead.rating ? (
                            <Badge variant="secondary" className="text-xs">
                              {lead.rating} ★
                            </Badge>
                          ) : '-'}
                        </td>
                        <td className="py-3 text-gray-500">{lead.enriched_category || '-'}</td>
                        <td className="py-3">
                          <Badge variant={
                            lead.competition_level === 'Bajo' ? 'secondary' :
                            lead.competition_level === 'Alto' ? 'destructive' : 'default'
                          } className="text-xs">
                            {lead.competition_level}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
