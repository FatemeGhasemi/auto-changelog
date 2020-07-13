#!/usr/bin/env node

import 'core-js/stable'
import run from './run'

export const generateChangelog = async (output, tagPattern = '') => {
  const newArgs =  process.argv.concat(['--output', output, '--tag-pattern', tagPattern])

  console.log('process.argv', {oldArgs :process.argv, newArgs})

  if (!output) {
    throw new Error('output should be a valid path')
  }
  console.log('generateChangelog called', { output, tagPattern })
  return run(newArgs)
}