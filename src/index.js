#!/usr/bin/env node

import 'core-js/stable'
import run from './run'

export const generateChangelog = async (output, tagPattern = '') => {
  const newArgs = process.argv.concat(
    ['--output', output, '--tag-pattern', tagPattern,
      '--unreleased', true])

  console.log('process.argv', { oldArgs: process.argv, newArgs })

  if (!output) {
    throw new Error('output should be a valid path')
  }
  console.log('generateChangelog called', { output, tagPattern })
  return run(newArgs)
}

export const generateChangelogWithOptions = async ({
                                                     unreleased,
                                                     output,
                                                     issuePattern,
                                                     issueUrl,
                                                     tagPattern,
                                                   }) => {

  if (!output) {
    throw new Error('output should be a valid path')
  }
  const newArgs = process.argv.concat(
    ['--output', output])
  if (tagPattern) {
    newArgs.push('--tag-pattern')
    newArgs.push(tagPattern)
  }
  if (unreleased) {
    newArgs.push('--unreleased')
    newArgs.push(true)
  }
  if (issuePattern) {
    newArgs.push('--issue-pattern')
    newArgs.push(issuePattern)
  }
  if (issueUrl) {
    newArgs.push('--issue-url')
    newArgs.push(issueUrl)
  }

  console.log('process.argv', { oldArgs: process.argv, newArgs })

  console.log('generateChangelog called', { output, tagPattern })
  return run(newArgs)
}
