const core = require('@actions/core')
const github = require('@actions/github')
const natural_sort = require('natsort').default

const config = {
  version: core.getInput('version', { required: true }),
  filter: core.getInput('filter'),
  releasesOnly: core.getBooleanInput('releases-only'),
  latestGithub: core.getBooleanInput('latest-github'),
  latestPin: core.getInput('latest-pin')
}

const octokit = github.getOctokit(process.env['GITHUB_TOKEN'])
const restOpts = {
  owner: github.context.repo.owner,
  repo: github.context.repo.repo,
  per_page: 100
}

// Check if the version matches the latest pin
function matchesLatest(version) {
  const reLatest = new RegExp(config.latestPin.replace(/\.x$/, ''))
  if (!config.latestPin) return true
  if (reLatest.test(version)) return true
  return false
}

// Check if the version matches either semver (v1.2.3/1.2.3) or the expression specified by filter
function matchVersion(version) {
  const reVSemver = new RegExp(/^v?\d+\.\d+(\.\d+)?(\.\d+)?.*/)
  const reFilter = new RegExp(config.filter.replace(/\.x$/, ''))
  const re = config.filter ? reFilter : reVSemver
  return config.filter ? re.test(version) : true
}

async function run() {
  try {
    const sorted = await getSortedVersions()
    const outputs = await rollTag(sorted)
    core.setOutput('tag', outputs.tag)
    core.setOutput('latest-tag', outputs.latest_tag)
    core.setOutput('latest-version', outputs.latest_version)
    core.setOutput('updates-latest', outputs.updates_latest)
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

// Retrieve the list of versions sorted in the descending order either from github releases or tags
async function getSortedVersions() {
  // get version either from releases or tags API
  function getVersion(i) {
    return config.releasesOnly ? i.tag_name : i.name
  }

  const versions = []
  const method = config.releasesOnly
    ? 'GET /repos/{owner}/{repo}/releases'
    : 'GET /repos/{owner}/{repo}/tags'

  for await (const resp of octokit.paginate.iterator(method, restOpts)) {
    for (const item of resp.data || resp) {
      const version = getVersion(item)
      if (config.releasesOnly && item.draft) continue
      if (matchVersion(version)) versions.push(version)
    }
  }

  if (versions.length > 0) {
    return versions.toSorted(natural_sort({ desc: true }))
  } else {
    return []
  }
}

// Get latest github release version
async function githubLatestRelease() {
  try {
    const resp = await octokit.rest.repos.getLatestRelease(restOpts)
    return resp.data.tag_name
  } catch (e) {
    if (e.status === 404) undefined
    throw e
  }
}

// Roll the tag and determine the latest, calculate action's outputs
async function rollTag(versions) {
  const reRollingSuffix = /-r\d+$/
  const inVersion = config.version.replace(reRollingSuffix, '')
  const latest = config.latestGithub
    ? await githubLatestRelease()
    : versions.find(i => matchesLatest(i))
  let updates_latest = false
  const outputs = {}

  // Set the rolling tag as v1.2.3 (first) or for the next v1.2.3-r{1...}
  const reCurrentVer = new RegExp(`${inVersion}-r\\d+$`)
  const rollId = versions.filter(
    v => v === inVersion || reCurrentVer.test(v)
  ).length
  outputs.tag = rollId === 0 ? inVersion : `${inVersion}-r${rollId}`

  if (latest && matchesLatest(inVersion)) {
    const sortedLatest = [outputs.tag, latest].toSorted(
      natural_sort({ desc: true })
    )
    if (sortedLatest[0] === outputs.tag) updates_latest = true
  } else if (config.latestPin) {
    core.info(
      `Version ${inVersion} doesn't satisfy latest-pin ${config.latestPin}.`
    )
  }

  outputs.latest_tag = latest || ''
  outputs.latest_version = outputs.latest_tag.replace(reRollingSuffix, '')
  outputs.updates_latest = updates_latest
  return outputs
}

module.exports = {
  run
}
