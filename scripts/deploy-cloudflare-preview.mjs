import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const PREVIEW_NAME = 'omnilink-login-design'
const EXPECTED_SUPABASE_REF = 'fpypixbxsfpzrihwgmfk'

function readEnvFile(filePath) {
  try {
    const source = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
    const values = {}

    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!match) continue

      let value = match[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      } else {
        value = value.replace(/\s+#.*$/, '')
      }
      values[match[1]] = value
    }

    return values
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    throw error
  }
}

function run(command, args, env, cwd, stdio = 'inherit') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with status ${code ?? 'unknown'}`))
    })
  })
}

function createBuildCopy(sourceRoot) {
  const stagingRoot = mkdtempSync(path.join(tmpdir(), 'omnilink-cloudflare-preview-'))
  const excluded = new Set([
    '.agents',
    '.cache',
    '.cloudflare',
    '.codex',
    '.git',
    '.next',
    '.npmrc',
    '.vercel',
    '.wrangler',
    'coverage',
    'node_modules',
  ])

  cpSync(sourceRoot, stagingRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(sourceRoot, source)
      if (!relative) return true
      const parts = relative.split(path.sep)
      const [firstSegment] = parts
      const basename = path.basename(source)
      if (excluded.has(firstSegment)) return false
      if (parts[0] === 'supabase' && parts[1] === '.temp') return false
      if (basename.startsWith('.env.') && basename !== '.env.example') return false
      if (basename === '.env.local' || basename === '.dev.vars') return false
      return true
    },
  })

  createNodeModulesOverlay(path.join(sourceRoot, 'node_modules'), path.join(stagingRoot, 'node_modules'))
  const gitPath = path.join(sourceRoot, '.git')
  const gitType = lstatSync(gitPath).isDirectory() ? 'dir' : 'file'
  symlinkSync(gitPath, path.join(stagingRoot, '.git'), gitType)
  return stagingRoot
}

function linkPath(source, destination) {
  mkdirSync(path.dirname(destination), { recursive: true })
  symlinkSync(source, destination, statSync(source).isDirectory() ? 'dir' : 'file')
}

function createNodeModulesOverlay(sourceModules, overlayModules) {
  mkdirSync(overlayModules, { recursive: true })
  for (const entry of readdirSync(sourceModules)) {
    if (entry.startsWith('.')) {
      if (entry === '.bin') linkPath(path.join(sourceModules, entry), path.join(overlayModules, entry))
      continue
    }

    const sourceEntry = path.join(sourceModules, entry)
    const overlayEntry = path.join(overlayModules, entry)
    if (entry.startsWith('@')) {
      mkdirSync(overlayEntry, { recursive: true })
      for (const scopedPackage of readdirSync(sourceEntry)) {
        linkPath(path.join(sourceEntry, scopedPackage), path.join(overlayEntry, scopedPackage))
      }
    } else {
      linkPath(sourceEntry, overlayEntry)
    }
  }
}

const sourceRoot = process.cwd()
const envFile = path.resolve(sourceRoot, process.env.OMNILINK_PREVIEW_ENV_FILE ?? '.env.local')
const fileEnv = readEnvFile(envFile)
const supabaseUrl = process.env.OMNILINK_PREVIEW_SUPABASE_URL?.trim() || fileEnv.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.OMNILINK_PREVIEW_SUPABASE_ANON_KEY?.trim() || fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  throw new Error('Provide the staging Supabase URL and publishable key in .env.local or OMNILINK_PREVIEW_* variables.')
}

const parsedUrl = new URL(supabaseUrl)
if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== `${EXPECTED_SUPABASE_REF}.supabase.co`) {
  throw new Error('Cloudflare Preview deployment is restricted to the verified omnilink-dev Supabase project.')
}

const deployEnv = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  OMNILINK_PREVIEW_SUPABASE_URL: supabaseUrl,
  OMNILINK_PREVIEW_SUPABASE_ANON_KEY: anonKey,
}

for (const key of [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'DASHSCOPE_API_KEY',
  'VERCEL_OIDC_TOKEN',
  'VERCEL_TOKEN',
]) {
  delete deployEnv[key]
}

const stagingRoot = createBuildCopy(sourceRoot)
try {
  await run('npx', [
    'vinext-cloudflare',
    'previews',
    'deploy',
    '--preview-name',
    PREVIEW_NAME,
  ], deployEnv, stagingRoot)
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}
