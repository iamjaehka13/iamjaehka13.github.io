---
layout: page
title: Archives
icon: fas fa-archive
order: 3
---

{% assign archive_posts = site.posts | where_exp: "post", "post.archive != false and post.basic_post != true" %}
{% assign grouped_posts = archive_posts | group_by_exp: "post", "post.date | date: '%Y'" %}

<div id="archives">
  {% for year in grouped_posts %}
    <h2 class="mt-4">{{ year.name }}</h2>
    <ul class="list-unstyled">
      {% for post in year.items %}
        <li class="mb-2">
          <span class="text-muted">{{ post.date | date: "%m-%d" }}</span>
          <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
        </li>
      {% endfor %}
    </ul>
  {% endfor %}
</div>
