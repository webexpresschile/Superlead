# WebExpress 2.0 — Plataforma de Presencia Digital Inteligente para Pymes

> **Autor:** Armando / Dimo
> **Versión:** 2.0 — Reimaginar el modelo de negocio
> **Propósito:** Archivo de especificación para implementación con Claude

---

## Resumen Ejecutivo

WebExpress nació como un servicio de sitios web económicos hechos con IA. La evolución es un **ecosistema completo de presencia digital** para Pymes latinoamericanas: sitio web + panel de edición + chatbot WhatsApp con IA + herramientas de crecimiento. Todo automatizado, todo desde un panel.

---

## Filosofía del Producto

- **Cero fricción:** El cliente no necesita saber de tecnología
- **Todo en uno:** Sitio, chatbot, leads, contenido — un solo lugar
- **IA nativa:** No es un add-on, es el motor principal
- **Económico pero poderoso:** Precios de Pyme, funcionalidad de enterprise

---

## Componentes del Sistema

### 1. 🏗️ Generador de Sitios Web (Core)

**Qué es:**
Sitio web moderno generado 100% con IA, desplegado automáticamente.

**Características:**
- Templates inteligentes por industria (restaurante, clínica, abogado, constructor, tienda)
- Contenido generado por IA (texto, imágenes, SEO)
- Diseño responsive, mobile-first
- Lighthouse score > 90
- Dominio personalizado + SSL incluido
- Hosting gestionado (Vercel / GitHub Pages / Railway)

**Diferenciador:**
No es una landing page genérica — el sistema entiende el rubro del negocio y genera contenido relevante, fotos de stock apropiadas, y estructura de navegación específica para la industria.

**Tecnología:**
- Frontend: Astro / Next.js (según complejidad)
- IA: DeepSeek + OpenRouter para generación de contenido
- Deploy: Automático a GitHub Pages o Vercel
- Repo por cliente (para que puedan clonarlo si quieren)

---

### 2. 🎛️ Panel de Edición (CMS para Clientes)

**Qué es:**
Un panel tipo "Webflow lite" donde el cliente puede modificar su sitio sin saber código.

**Características:**
- Editor visual de contenido (texto, imágenes, horarios, precios)
- Galería de imágenes (subir/arrastrar)
- Secciones editables (hero, servicios, equipo, contacto, testimonios)
- Cambiar colores y logo desde el panel
- Vista previa en tiempo real
- Publicar cambios con un clic → deploy automático

**Lo que NO es:**
No es un constructor drag-and-drop completo (muy complejo). Es un panel de edición de contenido sobre una plantilla fija. El cliente edita textos, imágenes y datos, no la estructura.

**Tecnología:**
- Panel: Next.js + Tailwind
- CMS: Headless (contenido en JSON → commit a GitHub)
- Deploy: Trigger automático via GitHub Actions

**Flujo:**
1. Cliente edita contenido en el panel
2. Panel genera archivos Markdown/JSON actualizados
3. Push a `data/` branch del repo
4. GitHub Actions rebuild + deploy
5. Sitio actualizado en < 30 segundos

---

### 3. 🤖 Chatbot WhatsApp con IA

**Qué es:**
Un chatbot conectado a WhatsApp Business API que responde preguntas de clientes potenciales usando IA.

**Características:**
- Entrenado con la info del sitio web del negocio
- Responde preguntas sobre horarios, precios, servicios, ubicación
- Agenda citas / reservas automáticamente
- Captura leads y los envía al panel
- Responde 24/7
- Escala conversaciones humanas cuando no sabe responder

**Casos de uso:**
- Restaurante: "¿Tienen menú vegetariano? ¿Cuál es el horario?"
- Clínica: "¿A qué hora atiende el doctor Pérez?"
- Taller: "¿Cuánto cuesta un cambio de aceite?"
- Inmobiliaria: "¿Qué departamentos tienen disponibles?"

**Tecnología:**
- WhatsApp: WATI / Twilio / Evolution API / Business API
- IA: DeepSeek + contexto del negocio
- N8N para orquestación
- Supabase para almacenar historial de chats

---

### 4. 🎯 Captura de Leads (Superlead Integration)

**Qué es:**
Generar clientes potenciales desde Google Maps para el rubro del cliente.

**Cómo funciona:**
- El cliente (ej: dentista) quiere más pacientes
- WebExpress busca competidores en Google Maps
- Extrae nombres, teléfonos, emails, redes sociales
- Exporta CSV con leads listos para contactar

**Valor:**
No solo le das un sitio web — le das clientes potenciales para que llame.

**Tecnología:**
- Integración directa con **Superlead** (tu SaaS)
- API de Google Places (New)
- Búsqueda por rubro + ubicación + punto de referencia
- Filtros por categoría + competencia

---

### 5. 📊 Panel de Analytics & Dashboard del Cliente

**Qué es:**
Un dashboard donde el cliente ve el rendimiento de su sitio y chatbot.

**Métricas:**
- Visitas al sitio (pageviews, sesiones)
- Consultas del chatbot (cuántas, qué preguntan, cuántos leads)
- Leads capturados (formulario + chatbot)
- Posición SEO estimada para keywords clave
- Resumen semanal por email

**Diferenciador:**
La mayoría de las Pymes no revisan analytics porque no entienden. El panel debe ser **ultra simple** — tipo "Esta semana tuviste 150 visitas y 3 personas preguntaron por tus precios. Aquí están sus teléfonos."

---

### 6. ✍️ Generación Automática de Contenido

**Qué es:**
El sistema genera contenido periódico para el sitio y redes sociales.

**Tipos de contenido:**
- **Blog posts:** Artículos automáticos sobre la industria del cliente
- **Testimonios:** Formatear reseñas de Google como contenido del sitio
- **Redes sociales:** Posts para Instagram/Facebook (texto + imagen) basados en el blog
- **Ofertas:** Banner en el sitio para promociones que el cliente define
- **FAQ:** Preguntas frecuentes extraídas del chatbot (lo que más preguntan)

**Flujo:**
1. Sistema detecta qué contenido falta o está desactualizado
2. Genera borrador con IA usando el contexto del negocio
3. Lo sube al panel como "sugerido" (el cliente revisa y publica)
4. Si el cliente no hace nada en 7 días, se publica automáticamente

---

### 7. 📱 Integración con Redes Sociales

**Qué es:**
Sincronización básica entre el sitio web y las redes del cliente.

**Características:**
- Feed de Instagram embebido en el sitio (actualizado automáticamente)
- Botón "Publicar en Instagram" desde el contenido generado
- Links a WhatsApp, Instagram, Facebook en header/footer
- Reviews de Google mostradas en el sitio

---

### 8. 💳 Facturación y Planes (Lemon Squeezy)

**Modelo de suscripción mensual:**

| Plan | Sitio | Panel | Chatbot | Leads | Precio |
|------|-------|-------|---------|-------|--------|
| **Básico** | ✅ Landing Page | ❌ | ❌ | ❌ | $9.99/mes |
| **Negocio** | ✅ Sitio completo (5 págs) | ✅ | ✅ Básico (100 chats) | ❌ | $19.99/mes |
| **Pro** | ✅ Sitio completo | ✅ | ✅ Ilimitado | ✅ (Superlead) | $39.99/mes |
| **Enterprise** | ✅ + multi-idioma | ✅ + custom domain | ✅ + CRM | ✅ + Agencia | $79.99/mes |

**Setup fee único:**
- Básico: $49 (configuración + contenido generado)
- Negocio: $99 (lo mismo + personalización)
- Pro: $199 (todo + chatbot entrenado + leads iniciales)
- Enterprise: $399 (white-label para agencias)

---

## Arquitectura Técnica

```
┌──────────────────────────────────────────────────┐
│                 CLIENTE (Frontend)                │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │ Sitio    │  │ Panel    │  │ Dashboard      │ │
│  │ Web      │  │ Editor   │  │ Analytics      │ │
│  │ (Astro)  │  │ (Next)   │  │ (Next)         │ │
│  └────┬─────┘  └────┬─────┘  └───────┬────────┘ │
└───────┼──────────────┼────────────────┼───────────┘
        │              │                │
┌───────┼──────────────┼────────────────┼───────────┐
│       ▼              ▼                ▼           │
│  ┌────────────────────────────────────────────┐  │
│  │            API Layer (Next.js)             │  │
│  │  /api/sites · /api/content · /api/chat    │  │
│  └──────────────────┬─────────────────────────┘  │
│                     │                            │
│  ┌──────────────────┼─────────────────────────┐  │
│  │     ▼            ▼           ▼             │  │
│  │  Supabase    GitHub      DeepSeek          │  │
│  │  (DB + Auth) (Repo)      (IA Engine)       │  │
│  │                     │                      │  │
│  │  ┌──────────────────┼──────────────────┐   │  │
│  │  │  N8N (Orquestración Automatización)  │   │  │
│  │  │  └ Webhooks · Workflows · Triggers   │   │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │           Canales de Salida                │  │
│  │  WhatsApp Web · Instagram · Email          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Flujo de Onboarding del Cliente

```
1. Cliente completa formulario (rubro, ubicación, nombre, datos)
   └─ IA analiza el rubro y genera recomendaciones

2. Sistema genera sitio web automáticamente (5-10 minutos)
   └─ Contenido, imágenes, SEO, estructura

3. Se despliega en URL temporal (webexpress.cl/tu-negocio)
   └─ Cliente recibe link para previsualizar

4. Cliente paga setup fee → se activa el panel
   └─ Puede editar textos, subir fotos, personalizar

5. Cliente activa chatbot + funcionalidades extra
   └─ Se entrena con el contenido del sitio

6. Dashboard se activa en mes 2 (primeros analytics)
   └─ Reporte semanal automático por email
```

---

## Modelo de Ingresos

| Fuente | Margen | Nota |
|--------|--------|------|
| Setup fees | 80-90% | Una vez por cliente |
| Suscripciones mensuales | 70-85% | Recurrencia |
| Superlead (leads adicionales) | 90% | Venta cruzada |
| Chatbot extra (más de X chats) | 80% | Upgrade |
| Consultoría / personalización | Variable | Servicio premium |

**Estimado mensual con 20 clientes en plan Negocio:**
- 20 × $19.99 = $399.80/mes recurrente
- + setup fees esporádicos
- + upgrades a Pro

**Estimado mensual con 50 clientes:**
- Mix de planes → ~$1,500-$2,500/mes recurrente
- Escalable a 200+ clientes sin aumentar personal

---

## Sugerencias de Expansión

### A Corto Plazo (MVP — 2 semanas)
- [ ] Generador de sitios con IA funcionando
- [ ] Panel de edición básico (textos + imágenes)
- [ ] Un template por industria (comenzar con 3 rubros)
- [ ] Deploy automático
- [ ] Chatbot WhatsApp básico (responde desde contexto fijo)

### A Mediano Plazo (1-2 meses)
- [ ] Integración Superlead (leads para clientes)
- [ ] Dashboard de analytics
- [ ] Más templates (10+ industrias)
- [ ] Chatbot con memoria (historial de conversaciones)
- [ ] Generación de contenido automática

### A Largo Plazo (3-6 meses)
- [ ] White-label para agencias de marketing
- [ ] Multi-idioma automático
- [ ] E-commerce básico (catálogo + checkout Lemon Squeezy)
- [ ] App mobile para que clientes vean su dashboard
- [ ] API pública para que desarrolladores externos integren

---

## Estrategia de Precios en Chile

**Dólares vs Pesos:**
- Los precios pueden estar en USD (como referencia) pero se cobran en CLP
- Usar Lemon Squeezy que convierte automáticamente

**Benchmark de mercado:**
- Wix / Squarespace: $16-$39 USD/mes sin IA, sin chatbot
- Tiendanemo: desde $15 USD/mes solo tienda
- Desarrollador freelance: $300-$800 USD una vez, sin mantención

**Posicionamiento:**
> "Todo lo que necesitas para vender online: sitio web + WhatsApp IA + clientes potenciales. Por menos de lo que cobra un desarrollador por una landing page."

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Clientes no saben usar el panel | Onboarding guiado + video tutoriales |
| Chatbot da respuestas incorrectas | Supervisión humana + límites de confianza |
| Abuso de API (costos de IA) | Rate limiting + límites por plan |
| Competencia copia el modelo | Enfoque en experiencia + atención al cliente |
| Escalabilidad técnica | Stack serverless (Vercel + Supabase + Railway) |

---

## Stack Tecnológico Recomendado

| Componente | Tecnología | Costo |
|-----------|-----------|-------|
| Frontend (sitios cliente) | Astro + Tailwind | $0 |
| Panel de edición | Next.js + Tailwind | $0 |
| Base de datos | Supabase (Free tier) | $0 |
| Autenticación | Clerk | $0 (dev) |
| IA Chat | DeepSeek + OpenRouter | ~$0.50/mes por cliente |
| WhatsApp | Evolution API (self-host) | ~$5/mes |
| Deploy | Vercel + GitHub Pages | $0 |
| Pagos | Lemon Squeezy | 5% + $0.50 |
| Dominios | .cl (Nic Chile) | ~$10/año |
| N8N | Railway + Postgres | ~$5/mes |

**Costo por cliente (plan Negocio):** ~$1-3 USD/mes
**Margen:** 85-95%

---

## Conclusión

WebExpress 2.0 no es solo "hacer páginas web baratas" — es **darle a la Pyme latinoamericana una máquina de clientes**. Sitio web que se ve profesional + chatbot que atiende 24/7 + leads que puede llamar. Todo desde un panel simple, todo con IA, todo por menos de $20 USD al mes.

El valor no está en el sitio web (eso es commodity) — está en el **ecosistema** que convierte visitantes en clientes.
