import { describe, it } from 'mocha'
import { expect } from 'chai'
import remotes from './data/remotes'
import commits from './data/commits'
import commitsSingleRelease from './data/commits-single-release'
import releases from './data/releases'
import { parseReleases, sortReleases } from '../src/releases'

const options = {
  unreleased: false,
  commitLimit: 3,
  backfillLimit: 3,
  tagPrefix: '',
  sortCommits: 'relevance'
}


describe('sortReleases', () => {
  it('compares semver tags', () => {
    expect(sortReleases({ tag: '1.0.0' }, { tag: '0.1.0' })).to.equal(-1)
    expect(sortReleases({ tag: '0.1.0' }, { tag: '1.0.0' })).to.equal(1)
    expect(sortReleases({ tag: '0.1.0' }, { tag: '0.1.0' })).to.equal(0)
  })

  it('supports null tags', () => {
    expect(sortReleases({ tag: '0.1.0' }, { tag: null })).to.equal(1)
    expect(sortReleases({ tag: null }, { tag: '0.1.0' })).to.equal(-1)
    expect(sortReleases({ tag: null }, { tag: null })).to.equal(-0)
  })

  it('supports non-semver tags', () => {
    expect(sortReleases({ tag: 'abc' }, { tag: 'def' })).to.equal(1)
    expect(sortReleases({ tag: 'def' }, { tag: 'abc' })).to.equal(-1)
    expect(sortReleases({ tag: 'abc' }, { tag: 'abc' })).to.equal(0)
  })

  it('supports non-semver numeric tags', () => {
    expect(sortReleases({ tag: '22.1' }, { tag: '22.0' })).to.equal(-1)
    expect(sortReleases({ tag: '22.0' }, { tag: '22.1' })).to.equal(1)
    expect(sortReleases({ tag: '123.0' }, { tag: '22.1' })).to.equal(-1)
    expect(sortReleases({ tag: '0.1' }, { tag: '0.01' })).to.equal(-1)
    expect(sortReleases({ tag: '0.14' }, { tag: '0.2' })).to.equal(-1)
    expect(sortReleases({ tag: '0.2' }, { tag: '0.14' })).to.equal(1)
  })

  it('supports partial semver tags', () => {
    expect(sortReleases({ tag: 'v0.50.7' }, { tag: 'v0.51' })).to.equal(1)
    expect(sortReleases({ tag: 'v0.51' }, { tag: 'v0.50.7' })).to.equal(-1)
    expect(sortReleases({ tag: 'v0.6' }, { tag: 'v0.50.7' })).to.equal(1)
    expect(sortReleases({ tag: 'v0.50.7' }, { tag: 'v0.6' })).to.equal(-1)
    expect(sortReleases({ tag: 'v2' }, { tag: 'v11' })).to.equal(1)
    expect(sortReleases({ tag: 'v11' }, { tag: 'v2' })).to.equal(-1)
  })
})
