<#
  Deploy Basket to production from the CLI, with this project's own Vercel token.

  Usually you don't need this: pushing to master deploys automatically through
  Vercel's Git integration. Use it when you want to deploy directly.

  Usage, in this project's terminal:
    $env:VERCEL_TOKEN = Read-Host "Vercel token" -AsSecureString | ConvertFrom-SecureString -AsPlainText   # PowerShell 7
    # or, in Windows PowerShell 5.1:
    $env:VERCEL_TOKEN = Read-Host "Vercel token"
    .\scripts\deploy-vercel.ps1            # refuses uncommitted changes
    .\scripts\deploy-vercel.ps1 -Force     # deploy the working folder as it is

  The token lives only in this terminal session. Never commit it, and never put
  it in .vercel/project.json or any file in this repository.
#>
param([switch]$Force)

$ErrorActionPreference = "Stop"

# This project's Vercel target. The project ID is what Vercel uses; the name is for people.
$project = "basket-app"
$projectId = "prj_f0BZjhX3LRM7ulhYrtx1Jjx5zzSI"
$scope = "maestrobrendons-projects"

if (-not $env:VERCEL_TOKEN) {
    throw "Load this project's Vercel token into this terminal first: `$env:VERCEL_TOKEN = Read-Host 'Vercel token'"
}

# Run from the project root, whatever folder the script was called from.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. The folder must be linked to Basket's Vercel project, not another account's.
$link = Join-Path $root ".vercel/project.json"
if (-not (Test-Path $link)) {
    throw "Not linked. Run: vercel link --yes --scope $scope --project $project --token `$env:VERCEL_TOKEN"
}
$linked = Get-Content $link -Raw | ConvertFrom-Json
if ($linked.projectId -ne $projectId) {
    throw "This folder is linked to $($linked.projectId) ($($linked.projectName)), not $project ($projectId). Refusing to deploy."
}

# 2. A CLI deploy uploads the working folder as it is, not what's on GitHub.
$changes = git status --porcelain --untracked-files=no
if ($changes -and -not $Force) {
    Write-Host $changes
    throw "There are uncommitted changes. Commit them first, or run with -Force to deploy the folder as it is."
}

# 3. Database migrations aren't part of a deploy: production must already have them.
$pending = npm run --silent db:status:prod 2>&1 | Out-String
if ($pending -match "have not yet been applied") {
    Write-Host $pending
    throw "Production database has migrations waiting. Run 'npm run db:deploy:prod' first (they're written to be safe for the live site), then deploy."
}

$branch = git rev-parse --abbrev-ref HEAD
$commit = git rev-parse --short HEAD
Write-Host "Deploying $project ($commit on $branch) to production as $scope..."

vercel deploy --prod --yes `
    --scope $scope `
    --project $project `
    --token $env:VERCEL_TOKEN

if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed. Check the token belongs to $scope and has access to $project."
}

Write-Host "Done. Check https://getbasket.vercel.app"
