[![GitHub Super-Linter](https://github.com/bitdeps/rolling-tag/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/bitdeps/rolling-tag/actions/workflows/ci.yml/badge.svg)

# Github Action Rolling Tag: Provides Immutable Revisions for container images

Imagine the scenario where we aim to publish a container image named
`app-0.2.2`. Typically, the process involves:

1. Publishing the container image to a container registry.
1. Creating the corresponding GitHub release.

However, container images often receive updates, such as security patches,
without a change in version. To accommodate such updates, the version tag can
roll while the revision tag remains immutable. For instance, `app-0.2.2` can
roll, while each new release retains an immutable tag with a revision suffix
like `app-0.2.2-r1`, `app-0.2.2-r2`, and so forth. For more detailed information
on rolling tags, refer to the
[Bitnami documentation](https://docs.bitnami.com/tutorials/understand-rolling-tags-containers).

## Usage

```yaml
name: Publish Image

on:
  workflow_dispatch:
    inputs:
      imageVersion:
        type: string
        description: Version of the image to publish

jobs:
  build-image:
    runs-on: ubuntu-latest
    steps:
      - name: Rolling tag
        uses: bitdeps/rolling-tag@v1
        id: roll
        with:
          version: ${{ github.event.inputs.imageVersion }}
          latest-pin: v1.27.x

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: |
            name/app
          tags: |
            type=raw,value=${{ github.event.inputs.imageVersion }}
            type=raw,value=${{ steps.roll.outputs.tag }}
            type=raw,value=latest,enable=${{ steps.roll.outputs.updates-latest == 'true' }}
            type=semver,pattern=v{{major}}.{{minor}},enable=${{ steps.roll.outputs.updates-latest == 'true' }}

      # ... Steps to push an image and create a GitHub release
```

## Configuration

### Inputs

| Input           | Description                                                                  | Default |
| --------------- | ---------------------------------------------------------------------------- | ------- |
| `version`       | Version to calculate the rolling tag for. (**required**)                     |         |
| `filter`        | Regular expression to filter version releases/tags.                          |         |
| `releases-only` | Inspect only GitHub releases; when set to false, retrieves tags from GitHub. | `true`  |
| `latest-github` | Detect (by default) or obtain the latest tag from the latest GitHub release. | `false` |
| `latest-pin`    | Regular expression to pin the latest version.                                |         |

### Outputs

| Output           | Description                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `tag`            | Value of the rolling tag for the given version. For example, if the version is v0.1.1, the rolling tag can be v0.1.1 or v0.1.1-r1, etc. |
| `latest-tag`     | The current latest rolling tag (it can be the same as the latest version if not rolled yet).                                            |
| `latest-version` | Same as latest-tag, but without -r\d+ suffix.                                                                                           |
| `updates-latest` | Specifies whether the new rolling tag should update the latest tag.                                                                     |

## Examples

### Filtering Versions

The `filter` option allows you to filter out undesired releases/tags. Suppose we
have tags for two apps: `app-x.y.z` and `bar-x.y.z`. Specify the filter as
follows to select only tags for the app:

```yaml
with:
  version: app-0.1.1
  filter: ^app-\d+
```

### Latest Advisor (for Tagging Container Images)

First, you can pin the latest to a specified pattern (which can be a regular
expression too):

```yaml
with:
  version: 'v1.27.5'
  latest-pin: v1.27.x
```

The above action sorts the tags in natural order to detect the latest. If the
found tags satisfy the `<= v1.27.5` condition, then the `updates-latest` output
will be set to `true`. Conversely, when there are higher versions (e.g.,
`v1.27.7`), `updates-latest` will be `false`. Note that pinning the latest is
optional.

#### Detecting Latest or Using GitHub Latest Release Value

By default, we automatically detect the latest by performing natural sorting, as
mentioned earlier. If you'd like to disable this behavior, you can use the
configuration below:

```yaml
with:
  version: v1.2.3
  latest-github: true
```

By setting `latest-github` to `true`, the action will know to rely on the latest
release value provided by GitHub.

### Switch Versions Retrieval (from GitHub Releases or Tags)

By default, versions are fetched from releases. If you want to extend this to
all tags, use the configuration below:

```yaml
with:
  version: v1.2.3
  releases-only: false
```

## Related actions

- [Find Latest Tag](https://github.com/oprypin/find-latest-tag)
