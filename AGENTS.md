# Blog Repository Instructions

These instructions apply to all work in this repository.

## Required Workflow

- Before creating, revising, or publishing a post, read
  `docs/BLOG_WORKFLOW.md`.
- Inspect the source memo and at least two relevant existing posts before
  editing. Preserve the established voice, taxonomy, and URL structure.
- Turn raw conversations into a reader-facing article. Remove chat timestamps,
  repeated explanations, and work-log narration.
- Verify technical claims against primary sources such as official papers,
  project pages, documentation, and official code repositories.
- Separate what a source demonstrates from implementation interpretation,
  personal judgment, and proposed extensions. Do not overstate results.
- Prefer the flow: motivation, core idea, equations, implementation/data flow,
  evidence, limitations, and connection to previous posts.

## Visuals And Media

- Include useful visual material for concept-heavy posts. Prefer clear custom
  SVG diagrams, properly attributed paper figures, and relevant result media.
- Put small post assets under `assets/img/posts/<topic>/<post-slug>/`.
- Send assets larger than 5 MiB to Cloudflare R2 with
  `scripts/upload_r2_asset.sh`. Use the returned
  `https://media.iamjaehka13.blog/...` URL in the post and do not keep the large
  file in the generated Pages artifact.
- Caption third-party figures with the creator or paper name and a direct source
  link. Never add credentials, OAuth tokens, or private URLs to the repository.

## Publishing

- Use a non-future timestamp in Asia/Seoul and preserve Chirpy front matter.
- Infrastructure diagnostics, deployment logs, and assistant status reports do
  not belong in the article body unless the post is specifically about them.
- Build with the repository's Ruby 3.3 environment as documented in
  `docs/BLOG_WORKFLOW.md`.
- A request to publish is complete only after local validation, an intentional
  commit, push to `main`, a successful Pages workflow, and live page and asset
  checks.
- Inspect `git status` before editing and before committing. Never discard
  unrelated user changes.
