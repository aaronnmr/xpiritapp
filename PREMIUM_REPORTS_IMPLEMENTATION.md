# Sistema de Generación Automatizada de Reportes Visuales Premium

## Descripción General

Sistema serverless para generar reportes visuales automatizados para usuarios premium. El sistema:

1. **Recopila datos** semanales de múltiples fuentes (actividades, sesiones de gym, logros)
2. **Inyecta datos** en una plantilla HTML/CSS optimizada (Aesthetic Lab Canvas)
3. **Genera PNG** optimizado para redes sociales
4. **Almacena** reportes en base de datos para acceso posterior
5. **Permite compartir** reportes públicamente

## Arquitectura

### Base de Datos

```sql
-- Tabla de reportes premium
premium_report_cards:
- id (uuid): Identificador único
- user_id (uuid): Usuario propietario
- week_start_date (date): Inicio de la semana
- week_end_date (date): Fin de la semana
- title (text): Título del reporte
- image_url (text): URL de la imagen PNG generada
- metrics (jsonb): Datos procesados (carreras, fuerza, logros)
- visibility (enum): private | shared
- shared_at (timestamptz): Fecha de compartición
- created_at (timestamptz): Fecha de creación
```

### Flujo

```
Usuario Premium → Presiona "Generate Report"
        ↓
XpiritDataService.generatePremiumReport()
        ↓
Invoca Edge Function: generate-premium-report
        ↓
Fetch Weekly Metrics (activities, gym_workouts, achievements)
        ↓
Genera HTML con datos inyectados
        ↓
[FALTA] Convierte HTML → PNG usando headless browser
        ↓
Sube PNG a Storage y guarda URL
        ↓
Almacena reporte en BD
        ↓
Retorna al cliente
```

## Componentes Implementados

### 1. Migración de Base de Datos
**Archivo**: `supabase/migrations/202606120001_premium_report_cards.sql`

- Crea tabla `premium_report_cards`
- Índices para queries eficientes
- Campo `last_report_generated_at` en profiles

### 2. Función Serverless
**Archivo**: `supabase/functions/generate-premium-report/index.ts`

#### Responsabilidades:
- Valida que usuario sea premium
- Obtiene datos de la semana desde:
  - `activities` (carreras, distancia, duración)
  - `gym_workouts` + `gym_sets` (volumen de fuerza)
  - `user_achievements` (logros desbloqueados)
- Genera HTML con plantilla CSS aesthetic
- **[TODO]** Convierte HTML a PNG
- Almacena en `premium_report_cards`

#### Endpoint
```
POST https://<supabase-url>/functions/v1/generate-premium-report

Body:
{
  "userId": "uuid",
  "weekStartDate": "2026-06-09",
  "weekEndDate": "2026-06-15"
}

Response:
{
  "success": true,
  "reportId": "uuid",
  "metrics": { ... },
  "htmlUrl": "data:text/html;base64,..."
}
```

### 3. Servicio de Cliente
**Archivo**: `src/services/xpirit-data-service.ts`

Métodos agregados:
```typescript
generatePremiumReport(weekStartDate, weekEndDate) 
  // Invoca función serverless, registra evento

getPremiumReports(limit?, offset?)
  // Obtiene reportes del usuario con paginación

updateReportVisibility(reportId, visibility)
  // Cambia de private a shared (para compartir en redes)
```

### 4. Componente UI
**Archivo**: `src/components/premium-reports-panel.tsx`

Interfaz para:
- Botón para generar reporte de esta semana
- Lista de reportes generados con preview de métricas
- Botones para compartir (cambiar visibility)
- Indicador de estado de generación
- Manejo de errores

## Plantilla HTML/CSS

Aesthetic Lab Canvas con:
- **Gradient oscuro** (black → dark blue) 
- **Cards semitransparentes** con backdrop blur
- **Métricas principales**: distancia de carrera, sesiones, volumen de fuerza, total de workouts
- **Streak badge**: muestra racha actual (🔥)
- **Achievements**: logros desbloqueados en la semana
- **Footer**: branding Xpirit + badge Premium
- **Responsive**: 1080×1920px (9:16, óptimo para Stories/TikTok)

## Próximos Pasos: Conversión HTML a PNG

### Opción 1: Puppeteer en Edge Function (Recomendada)
```typescript
import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920 });
await page.setContent(htmlContent);
const screenshot = await page.screenshot({ type: "png" });
```

**Ventajas**: Renderizado perfecto, controla viewport
**Desventajas**: Puppeteer heavy (~300MB), tiempo de ejecución

### Opción 2: Vercel OG Image Generation
```typescript
// En Edge Function o API Route
import { ImageResponse } from "@vercel/og";

export default async (req: Request) => {
  return new ImageResponse(
    <html>{/* JSX en lugar de HTML string */}</html>,
    { width: 1080, height: 1920 }
  );
};
```

**Ventajas**: Rápido, optimizado, sin dependencias pesadas
**Desventajas**: Sintaxis JSX (no HTML puro)

### Opción 3: Playwright (Más ligero que Puppeteer)
```typescript
import { chromium } from "https://deno.land/x/playwright@v1.40.0/mod.ts";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1080, height: 1920 });
await page.setContent(htmlContent);
const buffer = await page.screenshot({ type: "png" });
```

**Ventajas**: Más ligero que Puppeteer
**Desventajas**: Sigue siendo heavy para serverless

### Opción 4: Sharp + HTML to Image (Alternativa Ligera)
```typescript
import sharp from "npm:sharp@0.32.6";
import html2canvas from "npm:html2canvas@1.4.1";

// Renderiza HTML en canvas (requiere canvas nativo)
const canvas = await html2canvas(element);
const buffer = await sharp(canvas.toBuffer()).png().toBuffer();
```

**Ventajas**: Más ligero
**Desventajas**: Canvas nativo complicado en serverless

## Implementación Recomendada

1. **Usar Puppeteer** si presupuesto/tiempo de ejecución no es limitación
2. **Usar Playwright** si quieres algo más ligero
3. **Subir PNG a Supabase Storage**:
```typescript
const fileName = `reports/${userId}/${weekStartDate}.png`;
const { data, error } = await supabase
  .storage
  .from("report-images")
  .upload(fileName, pngBuffer, {
    contentType: "image/png",
    upsert: true
  });

const publicUrl = supabase
  .storage
  .from("report-images")
  .getPublicUrl(fileName).data.publicUrl;
```

4. **Guardar URL en base de datos**

## Seguridad

- ✅ Validar que `tier == 'premium'` en función serverless
- ✅ Solo usuarios propios pueden acceder/compartir sus reportes
- ✅ RLS (Row Level Security) en tabla `premium_report_cards`
- ✅ Logs de generación en `app_events`

## Monitoreo

Eventos registrados:
- `premium_report_generation_started`
- `premium_report_generation_completed`
- `premium_report_generation_failed`
- `report_visibility_changed`

## Costo Estimado

- **Edge Function**: ~$0.20/million requests (primeros 1M gratis)
- **Storage**: $0.02/GB stored
- **Bandwidth**: $0.15/GB egress

## Mejoras Futuras

1. **Múltiples plantillas** de diseño (user-selectable)
2. **Datos comparativos** semana anterior
3. **Gráficos animados** (p.ej., progresión de distancia)
4. **Integración con redes sociales** (auto-share a Instagram)
5. **Watermark personalizado** con nombre de usuario
6. **Filtros y efectos** aplicables pre-compartición
