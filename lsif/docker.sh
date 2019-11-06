#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE[0]}")/.."
set -ex

BUILD_ARGS=(
    "DATE"
    "COMMIT_SHA"
    "VERSION"
)

join() {
    local delimiter="$1"

    set +u

    local out=""
    for arg in "${BUILD_ARGS[@]}"; do
        # look up the value of "arg" in the environment, and
        # append it if "arg" is defined
        if [[ "${!arg}" ]]; then
            out+="$delimiter${arg}=${!arg}"
        fi
    done

    set -u

    echo $out
}

if [[ "${CLOUD_BUILD_ENABLE:-"false"}" == "true" ]]; then

    substitutions="_IMAGE=$IMAGE$(join ",_")"

    gcloud builds submit --config=lsif/cloudbuild.yaml \
        --substitutions=$substitutions \
        --no-source
else

    build_arg_str="$(join " --build-arg ")"

    docker build -f lsif/Dockerfile -t "$IMAGE" lsif \
        $build_arg_str \
        --progress=plain

fi
