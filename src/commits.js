import semver from 'semver'
import { cmd, isLink, encodeHTML, replaceText, getGitVersion } from './utils'

const COMMIT_SEPARATOR = '__AUTO_CHANGELOG_COMMIT_SEPARATOR__'
const MESSAGE_SEPARATOR = '__AUTO_CHANGELOG_MESSAGE_SEPARATOR__'
const MATCH_COMMIT = /(.*)\n(?:\s\((.*)\))?\n(.*)\n(.*)\n(.*)\n([\S\s]+)/
const MATCH_STATS = /(\d+) files? changed(?:, (\d+) insertions?...)?(?:, (\d+) deletions?...)?/
const BODY_FORMAT = '%B'
const FALLBACK_BODY_FORMAT = '%s%n%n%b'

// https://help.github.com/articles/closing-issues-via-commit-messages
const DEFAULT_FIX_PATTERN = /(?:close[sd]?|fixe?[sd]?|implement?[sd]?|resolve[sd]?)\s(?:#(\d+)|(https?:\/\/.+?\/(?:issues|pull|pull-requests|merge_requests)\/(\d+)))/gi

const MERGE_PATTERNS = [
  /Merge pull request #(\d+) from .+\n\n(.+)/, // Regular GitHub merge
  /^(.+) \(#(\d+)\)(?:$|\n\n)/, // Github squash merge
  /Merged in .+ \(pull request #(\d+)\)\n\n(.+)/, // BitBucket merge
  /Merge branch .+ into .+\n\n(.+)[\S\s]+See merge request [^!]*!(\d+)/ // GitLab merge
]

export async function fetchCommits (remote, options, branch = null, onProgress) {
  const command = branch ? `git log ${branch}` : 'git log'
  const format = await getLogFormat()
  const log = await cmd(`${command} --shortstat --pretty=format:${format} ${options.appendGitLog}`, onProgress)
  const commits = parseCommits(log, remote, options)
  console.log('commits ', { 0: commits[0], 1: commits[1], 2: commits[2], 3: commits[3] })
  return commits
}

async function getLogFormat () {
  const gitVersion = await getGitVersion()
  const bodyFormat = gitVersion && semver.gte(gitVersion, '1.7.2') ? BODY_FORMAT : FALLBACK_BODY_FORMAT
  return `${COMMIT_SEPARATOR}%H%n%d%n%ai%n%an%n%ae%n${bodyFormat}${MESSAGE_SEPARATOR}`
}

function parseCommits (string, remote, options = {}) {
  const commits = string
    .split(COMMIT_SEPARATOR)
    .slice(1)
    .map(commit => parseCommit(commit, remote, options))

  if (options.startingCommit) {
    const index = commits.findIndex(c => c.hash.indexOf(options.startingCommit) === 0)
    if (index === -1) {
      throw new Error(`Starting commit ${options.startingCommit} was not found`)
    }
    return commits.slice(0, index + 1)
  }

  return commits
}

function parseCommit (commit, remote, options = {}) {
  const [, hash, refs, date, author, email, tail] = commit.match(MATCH_COMMIT)
  const [body, stats] = tail.split(MESSAGE_SEPARATOR)
  const message = encodeHTML(body)
  const parsed = {
    hash,
    shorthash: hash.slice(0, 7),
    author,
    email,
    date: new Date(date).toISOString(),
    tag: getTag(refs, options),
    subject: replaceText(getSubject(message), options),
    message: message.trim(),
    messageWithoutSubject: message.trim().replace(getSubject(message), '') || undefined,
    fixes: getFixes(message, author, remote, options),
    href: remote.getCommitLink(hash),
    breaking: !!options.breakingPattern && new RegExp(options.breakingPattern).test(message),
    ...getStats(stats.trim())
  }
  return {
    ...parsed,
    merge: getMerge(parsed, message, remote, options)
  }
}

function getTag (refs, options) {
  if (!refs) return null
  for (const ref of refs.split(', ')) {
    const prefix = `tag: ${options.tagPrefix}`
    if (ref.indexOf(prefix) === 0) {
      const tag = ref.replace(prefix, '')
      // if (options.tagPattern) {
      //   if (new RegExp(options.tagPattern).test(tag)) {
      //     return tag
      //   }
      //   return null
      // }
      // if (semver.valid(tag)) {
      return tag
      // }
    }
  }
  return null
}

function getSubject (message) {
  if (!message) {
    return '_No commit message_'
  }
  return message.match(/[^\n]+/)[0]
}

function getStats (stats) {
  if (!stats) return {}
  const [, files, insertions, deletions] = stats.match(MATCH_STATS)
  return {
    files: parseInt(files || 0),
    insertions: parseInt(insertions || 0),
    deletions: parseInt(deletions || 0)
  }
}

function getFixes (message, author, remote, options = {}) {
  const pattern = getFixPattern(options)
  const fixes = []
  let match = pattern.exec(message)
  if (!match) return null
  while (match) {
    const id = getFixID(match)
    const href = isLink(match[2]) ? match[2] : remote.getIssueLink(id)
    fixes.push({ id, href, author })
    match = pattern.exec(message)
  }
  return fixes
}

function getFixID (match) {
  // Get the last non-falsey value in the match array
  for (let i = match.length; i >= 0; i--) {
    if (match[i]) {
      return match[i]
    }
  }
}

function getFixPattern (options) {
  if (options.issuePattern) {
    return new RegExp(options.issuePattern, 'g')
  }
  return DEFAULT_FIX_PATTERN
}

function getMergePatterns (options) {
  if (options.mergePattern) {
    return MERGE_PATTERNS.concat(new RegExp(options.mergePattern, 'g'))
  }
  return MERGE_PATTERNS
}

function getMerge (commit, message, remote, options = {}) {
  const patterns = getMergePatterns(options)
  for (const pattern of patterns) {
    const match = pattern.exec(message)
    if (match) {
      const id = /^\d+$/.test(match[1]) ? match[1] : match[2]
      const message = /^\d+$/.test(match[1]) ? match[2] : match[1]
      return {
        id,
        message: replaceText(message, options),
        href: remote.getMergeLink(id),
        author: commit.author,
        commit
      }
    }
  }
  return null
}
