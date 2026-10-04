"""Pull niots.substack.com RSS into src/content/substack.posts.ts."""

import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

FEED = "https://niots.substack.com/feed"
OUT = "src/content/substack.posts.ts"
NS = {
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}
ALLOWED = {"p", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "em", "b", "i", "br", "a", "figcaption"}
SKIP_TAGS = {"script", "style", "svg", "button", "form", "iframe", "noscript", "input"}
TEXT_TAGS = {"p", "h2", "h3", "h4", "li", "blockquote", "a", "figcaption"}


def text_of(node):
    if node is None or node.text is None:
        return ""
    return html.unescape(node.text).strip()


class ArticleHtml(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0
        self.stack = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        info = {key.lower(): value or "" for key, value in attrs}
        blob = f"{info.get('class', '')} {info.get('data-component-name', '')}".lower()
        if self.skip or tag in SKIP_TAGS or "subscri" in blob:
            if tag not in {"input", "img", "br", "source"}:
                self.skip += 1
            return
        if tag == "img":
            src = info.get("src", "")
            if src.startswith("https://"):
                alt = html.escape(info.get("alt", ""), quote=True)
                self.out.append(f'<img src="{html.escape(src, quote=True)}" alt="{alt}" />')
            return
        if tag not in ALLOWED:
            return
        if tag == "a":
            if "image" in info.get("class", ""):
                return
            href = info.get("href", "")
            if href.startswith("https://") or href.startswith("http://"):
                self.out.append(f'<a href="{html.escape(href, quote=True)}">')
                self.stack.append(tag)
            return
        if tag == "br":
            self.out.append("<br />")
            return
        self.out.append(f"<{tag}>")
        self.stack.append(tag)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if self.skip:
            self.skip -= 1
            return
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self.skip or not any(tag in TEXT_TAGS for tag in self.stack):
            return
        text = html.escape(re.sub(r"\s+", " ", data))
        if text.strip():
            self.out.append(text)


def article_html(raw):
    parser = ArticleHtml()
    parser.feed(html.unescape(raw or ""))
    body = "".join(parser.out)
    body = re.sub(r"<(strong|em|b|i)>\s*</\1>", "", body)
    body = re.sub(r"(?:<p>\s*</p>)+", "", body)
    return body.strip()


def slug_from(link, seen):
    path = urllib.parse.urlparse(link).path.rstrip("/").split("/")[-1]
    base = re.sub(r"[^a-z0-9-]+", "-", path.lower()).strip("-") or "letter"
    slug = base
    number = 2
    while slug in seen:
        slug = f"{base}-{number}"
        number += 1
    seen.add(slug)
    return slug


def excerpt(raw):
    plain = re.sub(r"<[^>]+>", " ", html.unescape(raw or ""))
    plain = re.sub(r"\s+", " ", plain).strip()
    if len(plain) <= 220:
        return plain
    cut = plain[:220].rsplit(" ", 1)[0]
    return cut.rstrip(".,;:") + "…"


def main():
    request = urllib.request.Request(FEED, headers={"User-Agent": "ediinzasag-rss"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read()
    root = ET.fromstring(payload)
    posts = []
    seen = set()
    for item in root.findall("./channel/item"):
        title = text_of(item.find("title"))
        link = text_of(item.find("link"))
        if not title or not link:
            continue
        published = text_of(item.find("pubDate"))
        try:
            date = datetime.strptime(published, "%a, %d %b %Y %H:%M:%S %Z").date().isoformat()
        except ValueError:
            date = published[:10]
        enclosure = item.find("enclosure")
        image = enclosure.get("url") if enclosure is not None else ""
        encoded = item.find("content:encoded", NS)
        posts.append(
            {
                "slug": slug_from(link, seen),
                "title": title,
                "link": link,
                "date": date,
                "author": text_of(item.find("dc:creator", NS)),
                "excerpt": excerpt(text_of(item.find("description"))),
                "image": image or "",
                "html": article_html(encoded.text if encoded is not None else ""),
            }
        )
    posts.sort(key=lambda post: post["date"], reverse=True)
    body = json.dumps(posts, ensure_ascii=False, indent=2)
    source = (
        "/* Generated by scripts/pull_substack.py from https://niots.substack.com/feed. */\n"
        "export interface SubstackPost {\n"
        "  slug: string\n"
        "  title: string\n"
        "  link: string\n"
        "  date: string\n"
        "  author: string\n"
        "  excerpt: string\n"
        "  image: string\n"
        "  html: string\n"
        "}\n\n"
        f"export const substackPosts: SubstackPost[] = {body}\n"
    )
    with open(OUT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(source)
    print(f"{len(posts)} posts")


if __name__ == "__main__":
    main()
