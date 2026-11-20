import { Sandbox } from '@vercel/sandbox'

// Caller supplies credentials through the environment; no secrets enter the VM.
let sandbox
try {
  sandbox = await Sandbox.create({ persistent: false, networkPolicy: 'deny-all', timeout: 60_000 })
  const result = await sandbox.runCommand({ cmd: 'node', args: ['--version'] })
  const nodeVersion = (await result.stdout()).trim()
  if (result.exitCode !== 0 || !/^v\d+\.\d+\.\d+$/.test(nodeVersion)) throw new Error('SANDBOX_COMMAND_FAILED')
  process.stdout.write(JSON.stringify({ connected: true, nodeVersion, network: 'deny-all' }) + '\n')
} catch (error) {
  // Upstream messages may contain request data. Return a status, not credentials.
  process.stderr.write(JSON.stringify({ connected: Boolean(sandbox), error: 'SANDBOX_CHECK_FAILED', status: typeof error?.status === 'number' ? error.status : null }) + '\n')
  process.exitCode = 1
} finally {
  if (sandbox) {
    try { await sandbox.stop(); process.stdout.write('Sandbox stopped\n') }
    catch { process.stderr.write('SANDBOX_STOP_FAILED: resource expires after the configured 60-second timeout\n'); process.exitCode = 1 }
  }
}
