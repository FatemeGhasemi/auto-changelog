import semver from 'semver'
import { niceDate } from './utils'

// const MERGE_COMMIT_PATTERN = /^Merge (remote-tracking )?branch '.+'/
const COMMIT_MESSAGE_PATTERN = /\n+([\S\s]+)/

function commitReducer ({ map, version }, commit) {
  const currentVersion = commit.tag || version
  const commits = map[currentVersion] || []
  return {
    map: {
      ...map,
      [currentVersion]: [...commits, commit]
    },
    version: currentVersion
  }
}

function getCommitsByCategory (commits) {
  const featureCommits = []
  const bugFixCommits = []
  const improvementCommits = []
  const otherCommits = []
  const allCommits = []
  for (const commit of commits) {
    if (commit.subject &&
      commit.subject.toLowerCase().includes('[feature]')) {
      commit.feature = true
      featureCommits.push(commit)
    } else if (commit.subject &&
      commit.subject.toLowerCase().includes('[bug]')) {
      commit.bugFix = true
      bugFixCommits.push(commit)
    } else if (commit.subject &&
      commit.subject.toLowerCase().includes('[enhancement]')) {
      commit.enhancement = true
      improvementCommits.push(commit)
    } else if (commit.subject &&
      commit.subject.toLowerCase().includes('[deprecate]')) {
      commit.deprecate = true
      improvementCommits.push(commit)
    } else if (commit.subject &&
      commit.subject.toLowerCase().includes('[remove]')) {
      commit.remove = true
      improvementCommits.push(commit)
    } else {
      otherCommits.push(commit)
    }

    commit.subject = commit.subject
      .replace('[Feature]', '')
      .replace('[feature]', '')
      .replace('[Enhancement]', '')
      .replace('[enhancement]', '')
      .replace('[Bug]', '')
      .replace('[bug]', '')
      .replace('[Deprecate]', '')
      .replace('[deprecate]', '')
      .replace('[Remove]', '')
      .replace('[remove]', '')
    if (commit.remove || commit.bugFix || commit.deprecate || commit.enhancement || commit.feature) {
      allCommits.push(commit)
    }
  }
  // if (allCommits.length > 0) {
  //   console.log("allCommits ", { 0: allCommits[0], 1: allCommits[1], 2: allCommits[2], 3: allCommits[3] })
  //   console.log("commits ", { 0: commits[0], 1: commits[1], 2: commits[2], 3: commits[3] })
  // }
  return {
    featureCommits: featureCommits,
    bugFixCommits: bugFixCommits,
    improvementCommits: improvementCommits,
    otherCommits: otherCommits,
    allCommits: allCommits
  }
}

export function parseReleases (commits, remote, latestVersion, options) {
  const { map } = commits.reduce(commitReducer, { map: {}, version: latestVersion })
  return Object.keys(map).map((key, index, versions) => {
    const commits = map[key]
    const previousVersion = versions[index + 1] || null
    const versionCommit = commits.find(commit => commit.tag) || {}
    const merges = commits.filter(commit => commit.merge).map(commit => commit.merge)
    const fixes = commits.filter(commit => commit.fixes).map(commit => ({ fixes: commit.fixes, commit }))
    const tag = versionCommit.tag || latestVersion
    const date = versionCommit.date || new Date().toISOString()
    const { tagPattern, tagPrefix } = options
    const { featureCommits, bugFixCommits, improvementCommits, otherCommits, allCommits } = getCommitsByCategory(commits)
    return {
      tag,
      title: tag || 'Unreleased',
      date,
      isoDate: date.slice(0, 10),
      niceDate: niceDate(date),
      featureCommits,
      bugFixCommits,
      improvementCommits,
      otherCommits,
      allCommits,
      merges,
      fixes,
      summary: getSummary(versionCommit.message, options),
      major: Boolean(!tagPattern && tag && previousVersion && semver.diff(tag, previousVersion) === 'major'),
      href: previousVersion ? remote.getCompareLink(`${tagPrefix}${previousVersion}`, tag ? `${tagPrefix}${tag}` : 'HEAD') : null
    }
  }).filter(release => {
    return options.unreleased ? true : release.tag
  })
}

export function sortReleases (a, b) {
  const tags = {
    a: inferSemver(a.tag),
    b: inferSemver(b.tag)
  }
  if (tags.a && tags.b) {
    if (semver.valid(tags.a) && semver.valid(tags.b)) {
      return semver.rcompare(tags.a, tags.b)
    }
    if (tags.a === tags.b) {
      return 0
    }
    return tags.a < tags.b ? 1 : -1
  }
  if (tags.a) return 1
  if (tags.b) return -1
  return 0
}

function inferSemver (tag) {
  if (/^v?\d+$/.test(tag)) {
    // v1 becomes v1.0.0
    return `${tag}.0.0`
  }
  if (/^v?\d+\.\d+$/.test(tag)) {
    // v1.0 becomes v1.0.0
    return `${tag}.0`
  }
  return tag
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
