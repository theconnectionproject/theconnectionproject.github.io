# The Connection Project: website

Static website for The Connection Project and the *Between Us* journal.
Plain HTML, CSS and JavaScript with no build step, so it can be hosted on any static host
(Netlify, Vercel, GitHub Pages, Cloudflare Pages) by uploading this folder as it is.

## Structure

```
index.html            01 Home (hero, about, why reflection matters, notice/understand/choose, journal intro, closing)
between-us.html       02 Between Us (intro, contents, online reader, downloads)
explore.html          03 Explore Connection (four interactive sections + invitation to the journal)
css/main.css          Design system: colour + type tokens, nav, buttons, tabs, footer, shared motion
css/home.css          Homepage sections
css/between-us.css    Between Us page and journal reader
css/explore.css       Explore Connection page
js/main.js            Mobile nav, scroll reveals, line drawing, parallax, connection threads (data-thread)
js/reader.js          Online journal reader (renders the real PDF with PDF.js)
js/explore.js         Explore page diagrams (pattern line, layers, circles, needs)
js/vendor/            PDF.js 3.11.174 (official pdfjs-dist build, Apache-2.0 licence included)
assets/graphics/      Supplied brand graphics (PNG shapes, crossing-lines SVG)
assets/journal/       The two supplied PDFs, plus pages/ (cover + opening pages rendered from the PDF)
```

## Editing

- **Colours and type** are variables at the top of `css/main.css` (`--plum`, `--orchid`, `--lilac`,
  `--coral`, `--cream`, `--font-display`, `--fs-hero` …). Change them there and the whole site follows.
- **Fonts**: Anton (headlines) and DM Sans (body), the same faces used in the journal, loaded from Google Fonts.
- **Header and footer** are repeated in each HTML file. If you change navigation, update all three pages.
- **Logo**: the primary logo in brand colours, set in DM Sans, is inlined in each page: plum in the header, cream in the plum footer. Standalone copies are in `assets/brand/` (`logo-primary-left.svg`, `logo-primary-left-cream.svg`). If the logo changes, update the `logo__svg` and `footer__logo` blocks in all three pages.
- **Reduced motion**: all animation switches off when the visitor's system asks for reduced motion.

## Running locally

Open the folder with a local server rather than double-clicking the file (links use `./` for home):

    python3 -m http.server 8000

then visit http://localhost:8000.

## Journal files

- `assets/journal/between-us-journal.pdf`: 20 single pages (A4 portrait). Used for mobile reading and download.
- `assets/journal/between-us-spreads.pdf`: 10 spreads (A4 landscape). Offered as a second download.
- If either PDF is updated, replace the file with the same name. Re-render `pages/page-01.webp`
  (the cover) if the cover changes.

## Research-informed section

"Why reflection matters" cites London, Sessa & Shelley (2023), Lovis-Schmidt et al. (2024) and
Murdoch et al. (2023); each citation links straight to the article in a new tab. The "Explore the
research" panel lists those three full references plus Hoult et al. (2025) as a supplementary source on
reflective writing, with a note that the studies give context for the project and do not test Between Us.

## Journal reader

- The reader renders `assets/journal/between-us-journal.pdf` directly with PDF.js, so replacing that
  PDF updates the reader automatically. No page images need regenerating.
- Wide screens show two-page spreads like the printed journal (cover on the right, back cover on the
  left). Narrow screens and phones show one page at a time at full width.
- Controls: previous/next buttons, a page track (one node per spread), arrow keys / Home / End,
  swipe on touch screens, and clicking the left or right page. "Expand" fills the screen (Esc closes).
- The contents list opens any activity in the reader. You can also link to a page directly,
  e.g. `between-us.html#page-10`.
- Page names shown under the page number are listed at the top of `js/reader.js` (`PAGE_TITLES`).
- If the PDF can't be displayed, the reader shows a link to open the PDF instead.

## Hosting

Upload the whole folder to any static host. Nothing else is needed: no build step, server code or database.
The PDFs must stay in `assets/journal/` with the same file names. The download buttons use the
`download` attribute, which works when the site and PDFs are served from the same domain (as here).

## Explore Connection

Each section turns one journal exercise into a small diagram and links to that activity in the reader
(`between-us.html#page-N`). The statements, layer prompts, needs and circle labels come from the journal.
The short explanations and the example phrasings in "Communicating needs" are editable in `explore.html`
(each need's text sits in its button's `data-meaning` and `data-say` attributes).
Nothing visitors choose on this page is stored or sent anywhere.
