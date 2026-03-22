import { createRequire } from 'node:module'
import Module from 'node:module'

const require = createRequire(import.meta.url)

const childProcess = require('node:child_process')
const originalSpawn = childProcess.spawn

childProcess.spawn = function patchedSpawn(command: string, args: string[], options: any = {}) {
  console.log('spawn intercepted:', command, args)
  const ext = {
    shell: process.platform === 'win32'
  }
  options = { ...options, ...ext }
  return originalSpawn.call(this, command, args, options)
}

const originalLoad = (Module as any)._load
;(Module as any)._load = function(request: string, parent: any, isMain: boolean) {
  const result = originalLoad.apply(this, arguments as any)
  if (request === 'child_process' || request === 'node:child_process') {
    result.spawn = childProcess.spawn
  }
  return result
}
