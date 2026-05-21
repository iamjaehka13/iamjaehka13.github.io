# jaehka13.github.io

GitHub Pages blog based on the Jekyll Chirpy theme.

This repository was started from [`tosemfdk/tosemfdk.github.io`](https://github.com/tosemfdk/tosemfdk.github.io), which is MIT licensed, then cleaned up for `iamjaehka13.github.io`.

## Write a Post

Create a Markdown file in `_posts/` with this filename format:

```text
YYYY-MM-DD-post-title.md
```

Example front matter:

```yaml
---
title: "Post title"
date: 2026-05-21 14:30:00 +0900
categories: [Robotics]
tags: [go2, sim2real]
---
```

Post images can go in `assets/img/posts/`.

## Local Preview

Install Ruby, then run:

```shell
bundle install
bundle exec jekyll serve -l
```

Open `http://127.0.0.1:4000`.

## Publish

1. Create a GitHub repository named `iamjaehka13.github.io`.
2. Push this repository to `main`.
3. In GitHub, set Pages source to **GitHub Actions**.
4. The site will be published at `https://iamjaehka13.github.io`.

## Credits

- Theme: [jekyll-theme-chirpy](https://github.com/cotes2020/jekyll-theme-chirpy)
- Base reference: [tosemfdk/tosemfdk.github.io](https://github.com/tosemfdk/tosemfdk.github.io)
