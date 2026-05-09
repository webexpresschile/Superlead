import Link from 'next/link'
import { Search, Download, Sparkles, BarChart3, Building2, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignInButton, SignUpButton } from '@clerk/nextjs'

const features = [
  {
    icon: Search,
    title: 'Busca por rubro + ubicación',
    desc: 'Encuentra cualquier tipo de negocio en cualquier ciudad. Restaurantes, clínicas, talleres, tiendas — lo que necesites.',
  },
  {
    icon: Sparkles,
    title: 'Enriquecimiento con IA',
    desc: 'DeepSeek analiza cada lead y agrega categoría precisa, descripción y nivel de competencia automáticamente.',
  },
  {
    icon: Download,
    title: 'Exporta a CSV o JSON',
    desc: 'Descarga tus leads en el formato que prefieras. O intégralos con GHL, Google Sheets o tu CRM favorito.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard inteligente',
    desc: 'Historial de búsquedas, leads guardados, créditos restantes y estadísticas en tiempo real.',
  },
]

const plans = [
  {
    name: 'Free',
    price: '$0',
    leads: '50',
    desc: 'Para probar',
    features: ['50 leads/mes', 'CSV y JSON', 'Enriquecimiento IA'],
    cta: 'Empezar gratis',
    featured: false,
  },
  {
    name: 'Starter',
    price: '$9.99',
    leads: '200',
    desc: 'Para emprendedores',
    features: ['200 leads/mes', 'CSV y JSON', 'Enriquecimiento IA', 'Export a GHL'],
    cta: 'Elegir Starter',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$19.99',
    leads: '1,000',
    desc: 'Para agencias',
    features: ['1,000 leads/mes', 'CSV y JSON', 'Enriquecimiento IA', 'Export a GHL', 'Soporte prioritario'],
    cta: 'Elegir Pro',
    featured: true,
  },
  {
    name: 'Agency',
    price: '$39.99',
    leads: '5,000',
    desc: 'Para equipos grandes',
    features: ['5,000 leads/mes', 'CSV y JSON', 'Enriquecimiento IA', 'Export a GHL', 'API access', 'Soporte 24/7'],
    cta: 'Elegir Agency',
    featured: false,
  },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg">Superlead</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#pricing" className="hover:text-gray-900">Precios</a>
            <Link href="/dashboard" className="hover:text-gray-900">Dashboard</Link>
          </nav>
          <div className="flex items-center gap-3">
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Registrarse</Button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Building2 className="w-4 h-4" />
            Lead Generation con IA
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 mb-6">
            Encuentra clientes en<br />
            <span className="text-blue-600">Google Maps.</span> Automatizado.
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            Busca negocios por rubro y ubicación, enriquece los datos con IA,
            y exporta leads listos para vender. Sin complicaciones.
          </p>
          <div className="flex items-center justify-center gap-4">
            <SignUpButton mode="modal">
              <Button size="lg" className="text-base px-8">
                Empezar gratis
                <Target className="ml-2 w-4 h-4" />
              </Button>
            </SignUpButton>
            <Button variant="outline" size="lg" className="text-base px-8">
              Ver demo
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-4">50 leads gratis. Sin tarjeta.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Todo lo que necesitas para generar leads
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Precios simples
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-md mx-auto">
            Paga solo por los leads que necesitas. Sin cargos ocultos.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${
                  plan.featured
                    ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-gray-500">/mes</span>
                </div>
                <p className="text-sm mb-4">
                  <span className="font-semibold">{plan.leads}</span> leads por mes
                </p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-gray-600 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      {f}
                    </li>
                  ))}
                </ul>
                <SignUpButton mode="modal">
                  <Button className="w-full" variant={plan.featured ? 'default' : 'outline'}>
                    {plan.cta}
                  </Button>
                </SignUpButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-400">
          <span>© 2026 Superlead. Hecho en Chile 🇨🇱</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-gray-600">Términos</a>
            <a href="#" className="hover:text-gray-600">Privacidad</a>
            <a href="#" className="hover:text-gray-600">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
