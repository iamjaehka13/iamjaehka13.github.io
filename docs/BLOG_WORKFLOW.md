# Git Blog Authoring And Publishing Workflow

This document is the working contract for writing and publishing posts in this
repository. It is intended for Codex sessions and for manual maintenance.

## 1. Start From The Actual Source

The user normally provides a raw study memo or a saved GPT conversation outside
this repository.

Example handoff:

```text
Source memo: /home/iamjaehka13/uvfa_her.txt
Topic: UVFA and Hindsight Experience Replay
Target: a new RL Study post
```

Do not move, rename, or rewrite the source memo unless explicitly requested.
Read it as study evidence, not as publication-ready prose.

Before editing:

```shell
git status --short --branch
wc -l -w -c /absolute/path/to/source.txt
```

Read the whole memo or map all user questions and section headings before
deciding what to keep. Inspect at least two adjacent posts in the same series so
the new post follows the existing terminology and depth.

Useful RL Study references include:

```text
_posts/rl/study/2026-07-18-diayn-diversity-is-all-you-need.md
_posts/rl/study/2026-07-19-dads-dynamics-aware-skill-discovery.md
_posts/rl/study/2026-07-20-cic-contrastive-intrinsic-control.md
_posts/rl/study/2026-07-22-lsd-lipschitz-constrained-skill-discovery.md
_posts/rl/study/2026-07-22-metra-metric-aware-abstraction.md
_posts/rl/study/2026-07-23-uvfa-her-goal-conditioned-reinforcement-learning.md
```

## 2. Validate Claims Before Writing

Use primary sources:

- Official paper or proceedings page
- Official project page
- Official implementation repository
- Official framework documentation

For each important claim, determine whether it is:

1. Stated or demonstrated by the paper
2. An implementation-level interpretation
3. A limitation inferred from the objective or experiment
4. A proposed extension or personal judgment

Keep these categories distinct in the article. A result image is evidence for
the exact setting shown, not proof of universal superiority.

For paper figures:

- Preserve the original meaning and labels.
- Crop only to improve readability.
- Add a caption with the paper, figure number, and direct source link.
- Do not present a paper figure as a locally reproduced result.

## 3. Convert Conversation Into An Article

Raw conversations often repeat the same concept at several depths. Merge those
answers instead of preserving the chat order.

A strong default structure is:

```text
Connection to the previous post
One-sentence thesis
Visual overview
Paper information
Problem and motivation
Core objective and derivation
Implementation or data flow
Experiments and what they support
Limitations and claim boundaries
Comparison with earlier methods
Questions that were confusing
Implementation checklist
Conclusion and primary references
```

Writing rules:

- Define each symbol before using it.
- Explain what every equation changes in the algorithm.
- Use tables for comparisons with consistent dimensions.
- Put diagrams next to the paragraph they explain.
- Remove timestamps, assistant status text, deployment reports, and repeated
  question-answer blocks.
- Keep Korean prose direct and technical. English technical terms are allowed
  where they match the existing series.
- Do not force robotics examples into a paper when a simpler generic example is
  more accurate.
- Distinguish discovered behavior, commanded goal, reward, state, transition,
  representation, and policy condition.

## 4. Front Matter And Paths

Post filename:

```text
_posts/<category>/<series>/YYYY-MM-DD-descriptive-slug.md
```

RL Study example:

```yaml
---
title: "Paper or topic: literal article title"
date: 2026-07-23 00:58:00 +0900
categories: [RL, Study]
tags: [paper-name, reinforcement-learning]
description: "A concrete one-sentence summary without unsupported claims."
math: true
image:
  path: /assets/img/posts/rl/<post-slug>/00-preview.png
  alt: A literal description of the preview
---
```

Requirements:

- The timestamp must not be in the future in Asia/Seoul.
- Quote YAML values containing punctuation that can be parsed as YAML syntax.
- Keep post URLs compatible with `/posts/:title/`.
- Use internal links such as `/posts/metra-metric-aware-abstraction/`.
- Use descriptive alt text for every meaningful image.

## 5. Visual Design

Concept-heavy posts should not be walls of text. Use visuals where they clarify
an operation, comparison, trajectory, representation, or data flow.

Preferred asset types:

| Need | Preferred format |
|---|---|
| Equation or algorithm flow | Custom SVG |
| Paper evidence | Cropped PNG with source caption |
| Motion or behavior | GIF or MP4 |
| Social preview | 1200 x 630 PNG |

Visual requirements:

- The first useful visual should appear near the beginning.
- Use more than one semantic color when several concepts are compared.
- Keep cards and framed boxes at 8 px radius or less.
- Avoid decorative gradients, blobs, and unrelated stock imagery.
- Check that text fits at desktop and mobile widths.
- Do not embed source URLs or attribution bands inside GIFs when the caption
  already provides attribution.
- Do not use a figure to imply a stronger result than its caption supports.

## 6. Asset Storage And Cloudflare R2

Small assets stay in the repository:

```text
assets/img/posts/<topic>/<post-slug>/
```

Assets larger than 5 MiB should be uploaded to the configured R2 bucket:

```shell
scripts/upload_r2_asset.sh assets/img/posts/<topic>/<post-slug>/<file>
```

The script:

- Uploads to `iamjaehka13-blog-media`
- Preserves the `assets/...` object key
- Applies the detected MIME type
- Sets `Cache-Control: public, max-age=86400`
- Verifies the remote `Content-Length`
- Prints the public custom-domain URL

Use the printed URL in Markdown or HTML:

```text
https://media.iamjaehka13.blog/assets/img/posts/...
```

After upload:

1. Verify a normal `HEAD` request.
2. For MP4, verify a byte-range request returns `206`.
3. Verify the media renders in a browser.
4. Remove the large local copy from the Pages source if the post references R2.
5. Confirm no individual Git object exceeds GitHub's 100 MB hard limit.

Never commit `.wrangler/`, OAuth credentials, API tokens, or downloaded full
source videos.

## 7. Local Verification

The default Ruby currently points to Ruby 4, while the installed Jekyll bundle
is under Ruby 3.3. Use:

```shell
PATH=/home/linuxbrew/.linuxbrew/Cellar/ruby@3.3/3.3.11/bin:$PATH \
  bundle exec jekyll build
```

Run the relevant checks:

```shell
git diff --check
xmllint --noout assets/img/posts/<topic>/<post-slug>/*.svg
find assets/img/posts/<topic>/<post-slug> -type f -size +100M -print
```

Inspect the generated page:

```text
_site/posts/<post-slug>/index.html
```

Verify:

- The generated page exists.
- The title and description are correct.
- Every local asset reference resolves.
- Internal links point to existing post routes.
- MathJax markup is present when `math: true`.
- No obsolete `r2.dev` URL remains.
- The title does not leave one character on an isolated line.
- Tables, equations, images, and code blocks do not overflow mobile width.

For browser validation, inspect at least:

```text
Desktop: 1440 x 900
Mobile:   390 x 844
```

When a local server is needed, stop it after validation.

## 8. Commit And Publish

Review scope before committing:

```shell
git status --short --branch
git diff --check
git diff --stat
```

Stage only the intended post and assets. Use a specific commit message:

```shell
git add <post> <assets>
git diff --cached --check
git commit -m "Add <topic> study post"
git push origin main
```

Monitor Pages:

```shell
gh run list --limit 5
gh run watch <run-id> --exit-status
```

Publishing is complete only after:

1. The Pages build job succeeds.
2. The Pages deploy job succeeds.
3. The live post returns `200`.
4. Every new live asset returns `200`.
5. GIF or MP4 content type and range behavior are correct.
6. The live desktop and mobile page render correctly.
7. `git status` is clean and `main` matches `origin/main`.

## 9. Cloudflare Boundaries

Current public endpoints:

```text
Blog:  https://iamjaehka13.blog
Media: https://media.iamjaehka13.blog
```

The blog is served through Cloudflare with GitHub Pages as the origin. Large
media is served from Cloudflare R2 through the `media` custom domain.

DNS, TLS, ECH, R2 upload, GitHub Actions, and deployment diagnostics belong in
the work report, not in a paper or study article. Only include infrastructure
details when infrastructure is the article topic.

If a browser reports an ECH or certificate error after a DNS change, compare:

```shell
dig A iamjaehka13.blog
dig HTTPS iamjaehka13.blog
dig @lauryn.ns.cloudflare.com A iamjaehka13.blog
openssl s_client -connect iamjaehka13.blog:443 \
  -servername iamjaehka13.blog </dev/null
```

Do not change DNS, proxy status, certificates, or DNSSEC as part of an unrelated
post task.

## 10. Handoff Template

Use this prompt when assigning a new post to another Codex session:

```text
Repository:
  /home/iamjaehka13/iamjaehka13.github.io

Read first:
  AGENTS.md
  docs/BLOG_WORKFLOW.md

Source memo:
  /absolute/path/to/source.txt

Topic:
  <paper or study topic>

Create or revise the reader-facing post using the established series style.
Verify claims with primary sources, add useful visuals, build locally, commit,
push, wait for GitHub Pages, and verify the live page and assets.

Do not include chat logs, deployment diagnostics, or assistant work reports in
the article body.
```
