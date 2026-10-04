# EZ Эдийн засаг

Newsroom site for [ediinzasag.mn](https://ediinzasag.mn). Mongolian economy and world markets, with the YouTube show and Substack newsletter on the same desk.

Interface elements come from [Watermelon UI](https://ui.watermelon.sh/) (navigation, announcement, blog blocks, footer) on top of shadcn/ui, Tailwind CSS, and Vite.

## Live

https://0xdmicheal.github.io/ediinzasag/

## Run

```bash
npm.cmd install
npm.cmd run dev
```

The dev server is http://localhost:5180. On Windows, `start.bat` does the same thing.

## Pages

- `/` home, with the price board and the latest briefings
- `/markets` Friday closes for MSE, world indices, and commodities
- `/mongolia` and `/world`
- `/story/:slug`
- `/ez-talk` YouTube
- `/newsletter` Substack
- `/about`

Briefings cite public releases. They are not a wire feed.
