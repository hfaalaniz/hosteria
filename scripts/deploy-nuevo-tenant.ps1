#!/usr/bin/env pwsh
# deploy-nuevo-tenant.ps1
# Uso: .\deploy-nuevo-tenant.ps1 -Slug camasutra

param(
  [string]$Slug = "",
  # Token NUNCA hardcodeado: pasalo con -Token o seteá CLOUDFLARE_API_TOKEN
  [string]$Token = $env:CLOUDFLARE_API_TOKEN,
  [string]$AccountId = "d4b139590ecac195d1d5c5310541c47c",
  [string]$WorkerUrl = "https://hosteria-api.soportetecnicoaf1.workers.dev",
  [string]$AdminDistPath = "$PSScriptRoot\..\frontend\dist",
  [string]$WebDistPath = "$PSScriptRoot\..\web\dist"
)

if (-not $Token) {
  Write-Host "✗ Falta el API token. Pasalo con -Token o seteá la variable de entorno CLOUDFLARE_API_TOKEN."
  exit 1
}

$env:CLOUDFLARE_API_TOKEN = $Token
$headers = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }

function Ensure-PagesProject {
  param([string]$projectName, [hashtable]$envVars)

  $baseUri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects"

  # Verificar si existe
  try {
    $existing = Invoke-RestMethod -Uri "$baseUri/$projectName" -Headers $headers -ErrorAction Stop
    Write-Host "  ✓ Proyecto '$projectName' ya existe"
  } catch {
    Write-Host "  Creando proyecto '$projectName'..."
    $body = @{ name = $projectName; production_branch = "main" } | ConvertTo-Json
    $proj = Invoke-RestMethod -Uri $baseUri -Method Post -Headers $headers -Body $body
    Write-Host "  ✓ Proyecto creado"
  }

  # Configurar variables de entorno
  $envBody = @{
    deployment_configs = @{
      production = @{
        env_vars = $envVars
      }
    }
  } | ConvertTo-Json -Depth 10
  Invoke-RestMethod -Uri "$baseUri/$projectName" -Method Patch -Headers $headers -Body $envBody | Out-Null
  Write-Host "  ✓ Variables de entorno configuradas"
}

function Deploy-Dist {
  param([string]$projectName, [string]$distPath)

  if (-not (Test-Path $distPath)) {
    Write-Host "  ✗ No se encontró dist/ en: $distPath"
    Write-Host "    Ejecutá 'npm run build' en el directorio correspondiente"
    return $false
  }

  Write-Host "  Deployando dist/ a '$projectName'..."
  $result = npx wrangler pages deploy $distPath --project-name=$projectName --branch=main 2>&1
  if ($LASTEXITCODE -eq 0 -or ($result -join '') -match 'Deployment complete') {
    $url = ($result | Select-String 'https://.*\.pages\.dev').Matches.Value | Select-Object -Last 1
    Write-Host "  ✓ Deploy exitoso: $url"
    Write-Host "  ✓ Producción: https://$projectName.pages.dev"
    return $true
  } else {
    Write-Host "  ✗ Error en deploy:"
    Write-Host ($result | Select-Object -Last 5)
    return $false
  }
}

# ─── Main ───────────────────────────────────────────────────────────────

if (-not $Slug) {
  Write-Host "Uso: .\deploy-nuevo-tenant.ps1 -Slug <slug>"
  Write-Host "Ejemplo: .\deploy-nuevo-tenant.ps1 -Slug camasutra"
  exit 1
}

$slugClean = $Slug -replace '[^a-z0-9-]', '-'
$adminProject = $slugClean.Substring(0, [Math]::Min(28, $slugClean.Length))
$webProject   = ('web-' + $slugClean).Substring(0, [Math]::Min(28, ('web-' + $slugClean).Length))

Write-Host "`n=== Deploy para tenant: $Slug ===`n"

# ── Admin panel ──────────────────────────────────────────────────────────
Write-Host "[ Admin: $adminProject ]"
Ensure-PagesProject -projectName $adminProject -envVars @{
  VITE_API_URL = @{ value = $WorkerUrl }
}
Deploy-Dist -projectName $adminProject -distPath $AdminDistPath

# ── Web pública ──────────────────────────────────────────────────────────
Write-Host "`n[ Web publica: $webProject ]"
Ensure-PagesProject -projectName $webProject -envVars @{
  VITE_API_URL    = @{ value = $WorkerUrl }
  VITE_TENANT_SLUG = @{ value = $Slug }
}
Deploy-Dist -projectName $webProject -distPath $WebDistPath

Write-Host "`n=== Listo ==="
Write-Host "Admin:      https://$adminProject.pages.dev"
Write-Host "Web publica: https://$webProject.pages.dev"
