---
layout: page
title: Archives
permalink: /archives/
---

<ul class="tags-box">

{% if site.posts != empty %}

  {% for post in site.posts %}
    <time datetime="{{ post.date | date:"%Y-%m-%d" }}">
      {{ post.date | date:"%Y-%m-%d" }}
    </time>
    &raquo; <a href="{{ site.baseurl }}{{ post.url }}">{{ post.title | capitalize }}</a><br />
  {% endfor %}

{% else %}

  <span>No posts</span>

{% endif %}

</ul>
