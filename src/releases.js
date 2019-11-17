import semver from 'semver'
import { fetchCommits } from './commits'
import { niceDate } from './utils'

const MERGE_COMMIT_PATTERN = /^Merge (remote-tracking )?branch '.+'/
const COMMIT_MESSAGE_PATTERN = /\n+([\S\s]+)/

async function createRelease (tag, previousTag, diff, remote, options) {
  const commits = await fetchCommits(diff, remote, options)
  const merges = commits.filter(commit => commit.merge).map(commit => commit.merge)
  const fixes = commits.filter(commit => commit.fixes).map(commit => ({ fixes: commit.fixes, commit }))
  const emptyRelease = merges.length === 0 && fixes.length === 0
  const { tagPattern, tagPrefix } = options
  const { date = new Date(), message } = commits[0] || { date: new Date().toSIO }
  const breakingCount = commits.filter(c => c.breaking).length
  const filteredCommits = commits
    .filter(commit => filterCommit(commit, options, merges))
    .sort(commitSorter(options))
    .slice(0, getCommitLimit(options, emptyRelease, breakingCount))
  return {
    tag,
    title: tag || 'Unreleased',
    date,
    isoDate: date.slice(0, 10),
    niceDate: niceDate(date),
    commits: filteredCommits,
    merges,
    fixes,
    summary: getSummary(message, options),
    major: Boolean(!tagPattern && tag && previousTag && semver.diff(tag, previousTag) === 'major'),
    href: previousTag ? remote.getCompareLink(previousTag, tag ? `${tagPrefix}${tag}` : 'HEAD') : null
  }
}

export function parseReleases (tags, remote, latestVersion, options) {
  const releases = tags.map((tag, index, tags) => {
    const previousTag = tags[index + 1]
    const diff = previousTag ? `${previousTag}..${tag}` : tag
    return createRelease(tag, previousTag, diff, remote, options)
  })
  if (latestVersion || options.unreleased) {
    const tag = latestVersion || null
    const previousTag = tags[0]
    const diff = `${previousTag}..`
    return Promise.all([
      createRelease(tag, previousTag, diff, remote, options),
      ...releases
    ])
  }
  return Promise.all(releases)
}

function getCommitLimit ({ commitLimit, backfillLimit }, emptyRelease, breakingCount) {
  if (commitLimit === false) {
    return undefined // Return all commits
  }
  const limit = emptyRelease ? backfillLimit : commitLimit
  return Math.max(breakingCount, limit)
}

function filterCommit (commit, { ignoreCommitPattern }, merges) {
  if (commit.fixes || commit.merge) {
    // Filter out commits that already appear in fix or merge lists
    return false
  }
  if (commit.breaking) {
    return true
  }
  if (ignoreCommitPattern) {
    // Filter out commits that match ignoreCommitPattern
    return new RegExp(ignoreCommitPattern).test(commit.subject) === false
  }
  if (semver.valid(commit.subject)) {
    // Filter out version commits
    return false
  }
  if (MERGE_COMMIT_PATTERN.test(commit.subject)) {
    // Filter out merge commits
    return false
  }
  if (merges.findIndex(m => m.message === commit.subject) !== -1) {
    // Filter out commits with the same message as an existing merge
    return false
  }
  return true
}

function getSummary (message, { releaseSummary }) {
  if (!message || !releaseSummary) {
    return null
  }
  if (COMMIT_MESSAGE_PATTERN.test(message)) {
    return message.match(COMMIT_MESSAGE_PATTERN)[1]
  }
  return null
}

function commitSorter ({ sortCommits }) {
  return (a, b) => {
    if (!a.breaking && b.breaking) return 1
    if (a.breaking && !b.breaking) return -1
    if (sortCommits === 'date') return new Date(a.date) - new Date(b.date)
    if (sortCommits === 'date-desc') return new Date(b.date) - new Date(a.date)
    return (b.insertions + b.deletions) - (a.insertions + a.deletions)
  }
}
