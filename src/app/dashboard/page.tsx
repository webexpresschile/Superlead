'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, LogOut, Target, Loader2 } from 'lucide-react'

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null)
  const [leads, setLeads] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState({ used: 0, limit: 50 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadLeads(session.access_token)
        loadCredits(session.access_token)
      }
    })
  }, [])

  async function loadLeads(token: string) {
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ format: 'json' }),
    })
    const data = await res.json()
    if (data.leads) setLeads(data.leads)
  }

  async function loadCredits(token: string) {
    const { data } = await supabase.from('users').select('credits_used, credits_limit').single()
    if (data) setCredits({ used: data.credits_used ?? 0, limit: data.credits_limit ?? 50 })
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query || !location || !session) return
    setLoading(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ query, location }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setLeads(prev => [...data.leads, ...prev])
      setCredits(prev => ({ ...prev, used: prev.used + data.total }))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    if (!session) return
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <Target className="w-10 h-10 text-blue-600 mx-auto mb-2" />
            <CardTitle>Inicia sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
              Continuar con Google
            </Button>
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
            <Badge variant="secondary" className="text-xs">
              {credits.used}/{credits.limit} leads
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
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
              <CardTitle className="text-sm text-gray-500">Créditos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{credits.limit - credits.used} <span className="text-lg text-gray-400">restantes</span></p>
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
