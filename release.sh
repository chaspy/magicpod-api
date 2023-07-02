#!/bin/bash

# タグ一覧を取得して、最新のタグを取得
git fetch --tags --prune-tags --prune
latest_tag=$(git tag -l --sort=-v:refname | head -n 1)

# タグがない場合、v1.0.0 として初期化
if [ -z "$latest_tag" ]; then
  latest_tag="v1.0.0"
fi

# 最新のタグからパッチバージョンを 1 つ上げる
new_tag=$(echo "$latest_tag" | awk -F. '{ printf("%s.%s.%s", $1, $2, $3+1) }')


# compile
npm install
npm run all

git config --global user.email "chaspy@users.noreply.github.com"
git config --global user.name "Takeshi Kondo"

# commit
git add .
git commit -m 'compile'

# 新しいタグをローカルに作成
git tag "${new_tag}"

# 新しいタグをリモートリポジトリにプッシュ
git push origin "${new_tag}"

# 最新のタグと現在のブランチ間の全てのマージコミットを取得
merge_commits=$(git log --merges --pretty=format:"%s" ${latest_tag}..HEAD)
echo "${merge_commits}"

# マージコミットからプルリクエストの番号を取得し、それらのプルリクエストのタイトルとリンクを取得
pr_titles_links=""
while read -r line ; do
    if [[ $line =~ Merge\ pull\ request\ #([0-9]*) ]] ; then
        pr_number=${BASH_REMATCH[1]}
        pr_info=$(curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/chaspy/magicpod-datadog-action/pulls/${pr_number})
        pr_title=$(echo $pr_info | jq -r .title)
        pr_link=$(echo $pr_info | jq -r .html_url)
        pr_titles_links="${pr_titles_links}\n${pr_title}: ${pr_link}"
    fi
done <<< "$merge_commits"

# GitHub の API を使ってリリースを作成
# GITHUB_TOKEN は環境変数として設定するか、直接スクリプトに記述してください
repo_url="https://api.github.com/repos/chaspy/magicpod-datadog-action/releases"
response=$(curl -s -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  -d "{\"tag_name\":\"$new_tag\",\"name\":\"Release $new_tag\",\"body\":\"${pr_titles_links}\"}" \
  $repo_url)

# リリースの作成に成功したか確認
if echo "$response" | grep -q '"id":'; then
  echo "Release $new_tag was created successfully."
else
  echo "Failed to create release. Please check your GITHUB_TOKEN and repository settings."
fi

