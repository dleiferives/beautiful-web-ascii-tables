# ascii-table

A zero-configuration jQuery plugin that replaces HTML `<table>` elements with
proportional, selectable ASCII art — live, responsive, and copy-paste ready.

The hidden source table drives layout.  The browser solves column widths and
the plugin mirrors those proportions in characters, scaling the font to fill
the available space.

---

## Contents

1. [Quick start](#quick-start)
2. [How it works](#how-it-works)
3. [Auto-init](#auto-init)
4. [Manual init](#manual-init)
5. [Styles](#styles)
   - [classic](#classic-default)
   - [double](#double)
   - [dots](#dots)
   - [brackets](#brackets)
   - [rounded](#rounded)
   - [mysql](#mysql)
   - [github](#github)
   - [rst](#rst)
   - [grid](#grid)
   - [outline](#outline)
   - [minimal](#minimal)
   - [header-bar](#header-bar)
6. [Header control](#header-control)
7. [Global defaults](#global-defaults)
8. [Custom styles](#custom-styles)
9. [Style spec reference](#style-spec-reference)
10. [Layout algorithm](#layout-algorithm)
11. [CSS classes](#css-classes)
12. [Tips & tricks](#tips--tricks)

---

## Quick start

```html
<!-- 1. Load dependencies -->
<link rel="stylesheet" href="ascii-table.css">
<script src="jquery.min.js"></script>
<script src="ascii-table.js"></script>

<!-- 2. Add data-ascii to any table -->
<table data-ascii>
  <thead>
    <tr><th>Name</th><th>Role</th><th>Score</th></tr>
  </thead>
  <tbody>
    <tr><td>Alice</td><td>Engineer</td><td>98</td></tr>
    <tr><td>Bob</td><td>Designer</td><td>87</td></tr>
  </tbody>
</table>
```

Output:

```
+-------+----------+-------+
| Name  | Role     | Score |
+-------+----------+-------+
| Alice | Engineer | 98    |
| Bob   | Designer | 87    |
+-------+----------+-------+
```

That's it.  No JavaScript needed beyond the script tag.

---

## How it works

1. The HTML table is kept in the DOM but made invisible (`visibility: hidden`).
2. The browser lays out the table normally — solving column widths, text
   wrapping, flex/grid constraints, everything.
3. A `<pre>` overlay is absolutely positioned on top, sized to match.
4. The plugin reads the table's pixel geometry and converts it to character
   widths, then renders the ASCII art at whatever font size fills the space.
5. A `ResizeObserver` re-renders whenever the container changes size.

Because the source table is just hidden (not removed), the ASCII text is always
selectable and copy-pasteable as plain text.

---

## Auto-init

Any `<table>` with a `data-ascii` attribute is automatically initialised when
the DOM is ready — no extra JavaScript required.

```html
<!-- empty value = classic style -->
<table data-ascii>…</table>

<!-- named style -->
<table data-ascii="double">…</table>

<!-- with header disabled -->
<table data-ascii="github" data-ascii-header="false">…</table>
```

---

## Manual init

Call `.asciiTable()` on any jQuery selection.  Useful when:

- You create tables dynamically after page load.
- You need to register a custom style first.
- You want to skip auto-init for specific tables.

```html
<!-- Omit data-ascii so auto-init skips it -->
<table id="my-table">…</table>

<script>
  // Set the style via attr before calling .asciiTable()
  $('#my-table').attr('data-ascii', 'double').asciiTable();
</script>
```

`.asciiTable()` is idempotent — calling it twice on the same element is safe.

---

## Styles

Pick a style with `data-ascii="name"`.

### classic (default)

```html
<table data-ascii>…</table>
<!-- or -->
<table data-ascii="classic">…</table>
```

```
+-------+----------+-------+
| Name  | Role     | Score |
+-------+----------+-------+
| Alice | Engineer | 98    |
| Bob   | Designer | 87    |
+-------+----------+-------+
```

Simple `+` corners, `-` horizontal rules, `|` vertical bars.  The header row
gets the same separator style as the borders.

---

### double

```html
<table data-ascii="double">…</table>
```

```
╔═══════╦══════════╦═══════╗
║ Name  ║ Role     ║ Score ║
╠═══════╬══════════╬═══════╣
║ Alice ║ Engineer ║ 98    ║
║ Bob   ║ Designer ║ 87    ║
╚═══════╩══════════╩═══════╝
```

Unicode double-line box drawing characters.  Requires a font that includes the
box-drawing block (virtually all monospace fonts do).

---

### dots

```html
<table data-ascii="dots">…</table>
```

```
..............................
: Name  : Role     : Score :
:.......:..........:.......;
: Alice : Engineer : 98    :
: Bob   : Designer : 87    :
:.......:..........:.......;
```

Solid dot top border.  Colon cell borders.  Dot-filled separator lines with
colon intersections.

---

### brackets

```html
<table data-ascii="brackets">…</table>
```

```
//=======[]============[]=========\\
|| Name  || Role       || Score  ||
|]=======[]============[]=========[|
|| Alice || Engineer   || 98     ||
|| Bob   || Designer   || 87     ||
\\=======[]============[]=========//
```

Double-slash/backslash corners, `[]` column intersections, `||` cell borders.
Multi-character borders mean the overhead is slightly wider per column than
single-character styles — the layout algorithm accounts for this automatically.

---

### rounded

```html
<table data-ascii="rounded">…</table>
```

```
.-------.----------.-------.
| Name  | Role     | Score |
:-------+----------+-------:
| Alice | Engineer | 98    |
:-------+----------+-------:
| Bob   | Designer | 87    |
'-------'----------'-------'
```

`.` top corners, `'` bottom corners, `:` left/right on separator lines.  Row
separators appear between every data row, giving a dense-grid look.

---

### mysql

```html
<table data-ascii="mysql">…</table>
```

```
+-------+----------+-------+
| Name  | Role     | Score |
+=======+==========+=======+
| Alice | Engineer | 98    |
| Bob   | Designer | 87    |
+-------+----------+-------+
```

Classic MySQL / PostgreSQL `\G` output style.  The header separator uses `=`
instead of `-` to make the header row visually distinct.

---

### github

```html
<table data-ascii="github">…</table>
```

```
| Name  | Role     | Score |
|-------|----------|-------|
| Alice | Engineer | 98    |
| Bob   | Designer | 87    |
```

GitHub Flavored Markdown table format.  No top or bottom border — the output
can be pasted directly into a `.md` file and GitHub will render it as a table.

---

### rst

```html
<table data-ascii="rst">…</table>
```

```
+=======+==========+=======+
| Name  | Role     | Score |
+=======+==========+=======+
| Alice | Engineer | 98    |
+-------+----------+-------+
| Bob   | Designer | 87    |
+-------+----------+-------+
```

reStructuredText grid-table format.  `=` fill for top border and header
separator; `-` fill with `+` corners for every row separator and the bottom
border.  Paste directly into a `.rst` file.

---

### grid

```html
<table data-ascii="grid">…</table>
```

```
 ======= ========== ======= 
  Name    Role        Score  
 ======= ========== ======= 
  Alice   Engineer    98     
  Bob     Designer    87     
 ======= ========== ======= 
```

No cell borders — columns are separated by spacing only.  `=` lines mark the
top, header separator, and bottom.  Inspired by Sphinx / Pandas display style.

---

### outline

```html
<table data-ascii="outline">…</table>
```

```
  Name  | Role     | Score  
 -------|----------|--------
  Alice | Engineer | 98     
  Bob   | Designer | 87     
```

No outer box — only inner `|` column separators and a `-` header underline.
Clean and compact for narrow or inline contexts.

---

### minimal

```html
<table data-ascii="minimal">…</table>
```

```
  Name    Role        Score  
 -------  ----------  -------
  Alice   Engineer    98     
  Bob     Designer    87     
```

No cell borders at all.  Columns are separated purely by whitespace.  A single
`-` line underlines the header.  Maximises content density — allows the largest
possible font size for a given container area.

---

### header-bar

```html
<table data-ascii="header-bar">…</table>
```

```
|| Name  || Role     || Score ||
|  Alice  |  Engineer |  98    |
|  Bob    |  Designer |  87    |
```

Header row uses double `||` borders; data rows use single `|`.  No horizontal
separator lines.  The visual weight of the double bars alone distinguishes the
header.

---

## Header control

By default the first row is treated as the header row — it gets a separator
line drawn beneath it (in styles that define one).

### Disable the header

Set `data-ascii-header="false"` to treat every row as a plain data row:

```html
<table data-ascii="classic" data-ascii-header="false">
  <tbody>
    <tr><td>Alice</td><td>Engineer</td><td>98</td></tr>
    <tr><td>Bob</td><td>Designer</td><td>87</td></tr>
  </tbody>
</table>
```

```
+-------+----------+----+
| Alice | Engineer | 98 |
| Bob   | Designer | 87 |
+-------+----------+----+
```

The top and bottom borders are still drawn (controlled by the style's `top`/`bot`
specs), but the special header separator line (`hdr` spec) is skipped, and the
`hdrCell` style (if any) is not applied to the first row.

---

## Global defaults

Override the default style and header flag for all tables on the page before
any `.asciiTable()` calls are made:

```html
<script src="jquery.min.js"></script>
<script src="ascii-table.js"></script>
<script>
  // Every table without an explicit data-ascii value will use "double"
  $.fn.asciiTable.defaults.style = 'double';

  // Treat every table's first row as a data row unless overridden
  $.fn.asciiTable.defaults.header = false;
</script>
```

Because `ascii-table.js` auto-inits on `$(function(){...})` (which fires at
DOM-ready), any `<script>` tag that appears *after* the `ascii-table.js`
`<script>` tag and runs synchronously runs *before* auto-init — so the defaults
are picked up in time.

Individual `data-ascii` and `data-ascii-header` attributes always take
precedence over the global defaults.

---

## Custom styles

Register a custom style in `$.fn.asciiTable.styles` before calling
`.asciiTable()`:

```js
$.fn.asciiTable.styles['stars'] = {
  top:  { l:'*', f:'*', s:'*', r:'*' },
  hdr:  { l:'*', f:'-', s:'+', r:'*' },
  row:  null,
  bot:  { l:'*', f:'*', s:'*', r:'*' },
  cell: { l:'|', s:'|', r:'|' },
};
```

```
********************
| Name  | Score   |
*-------+---------*
| Alice | 98      |
| Bob   | 87      |
********************
```

Then use it like any built-in style:

```html
<table data-ascii="stars">…</table>
```

For tables that need to be manually initialised (e.g. created after page load,
or when you need to register the style first):

```js
$.fn.asciiTable.styles['my-style'] = { /* … */ };
$('#dynamic-table').attr('data-ascii', 'my-style').asciiTable();
```

---

## Style spec reference

A style object has up to five line specs and one optional alternate header-cell
spec.

```js
{
  top:     lineSpec | null,   // top border
  hdr:     lineSpec | null,   // separator drawn after the header row
  row:     lineSpec | null,   // separator drawn after each data row (when layout allows)
  bot:     lineSpec | null,   // bottom border
  cell:    cellSpec,          // data row borders
  hdrCell: cellSpec,          // (optional) header row borders — falls back to cell
}
```

### Line spec

Defines one horizontal separator line:

```js
{ l: leftCap, f: fillChar, r: rightCap, s: colSep }
```

| Field | Role | Example |
|-------|------|---------|
| `l` | Left-end cap (any string length) | `'+'`, `'//'`, `'╔'` |
| `f` | Fill character repeated across each column | `'-'`, `'='`, `'.'` |
| `s` | Column intersection (any string length) | `'+'`, `'[]'`, `'╦'` |
| `r` | Right-end cap (any string length) | `'+'`, `'\\\\'`, `'╗'` |

Setting a line spec to `null` omits that line entirely.

A separator line for a 3-column table with `colWidths = [8, 6, 7]` is built as:

```
l + f.repeat(8) + s + f.repeat(6) + s + f.repeat(7) + r
```

### Cell spec

Defines the borders of a data or header row:

```js
{ l: leftBorder, s: colSep, r: rightBorder }
```

| Field | Role | Example |
|-------|------|---------|
| `l` | Left border of the row | `'|'`, `'║'`, `'||'`, `' '` |
| `s` | Column separator | `'|'`, `'║'`, `'||'`, `' '` |
| `r` | Right border of the row | `'|'`, `'║'`, `'||'`, `' '` |

A data row is built as:

```
l + (padding + cell_text + padding) + s + (padding + cell_text + padding) + … + r
```

Multi-character `l`, `s`, `r` strings are fully supported — the layout engine
measures character overhead automatically and reserves space for them.

### `hdrCell` — different borders for the header row

If your style needs the header row to look different from data rows (e.g.
`header-bar` uses `||` for the header and `|` for data), add an `hdrCell` spec:

```js
{
  top:     null,
  hdr:     null,
  row:     null,
  bot:     null,
  cell:    { l:'|',  s:'|',  r:'|'  },  // data rows
  hdrCell: { l:'||', s:'||', r:'||' },  // header row only
}
```

When `hdrCell` is absent the header row uses `cell`.

---

## Layout algorithm

The renderer maximises font size subject to the table fitting within the
container.  Here is what happens on each render:

### 1 — Column proportions

The hidden HTML table is measured at its natural size.  The pixel width of each
column is recorded and used to distribute ASCII character columns
proportionally.

### 2 — Config selection

Three display configs are tried in order, from richest to most compact:

| Config | Row separators | Cell padding |
|--------|---------------|--------------|
| A      | Every row     | 1 space      |
| B      | Header only   | 1 space      |
| C      | Header only   | 0 spaces     |

The first config whose no-wrap font size stays at or above **6 px** is chosen.
If none qualify, config C is used regardless and the font may go below 6 px.

"Row separators every row" means the style's `row` line spec is drawn between
every data row.  Styles with `row: null` are unaffected — they produce the same
line count regardless of which config is picked.

### 3 — Refinement passes (up to 3)

With the chosen font size, character widths are measured and column character
widths are assigned.  Lines are built, and if the actual line count causes the
font to overflow height:

1. **Padding strip** — if any columns still carry 1-space padding, try dropping
   it to 0 across all columns and check whether the saved width lets the font
   stay larger.  This happens before any font shrink.
2. **Font shrink** — if padding removal is not enough (or padding is already 0),
   reduce font size to fit and loop.

### 4 — Wrap-trade

After the passes, if there is spare vertical headroom and the font is
width-constrained, the algorithm tries wrapping the tightest column at its
natural midpoint.  If that allows one more line but a 5 %+ larger font, the
trade is taken.

### Responsive reflow

A `ResizeObserver` fires whenever the wrapper or source table changes size,
debounced at 30 ms.  The full render runs again — font size, column widths, and
line count all recompute from scratch.

---

## CSS classes

| Class | Element | Purpose |
|-------|---------|---------|
| `.ascii-table-wrapper` | `<div>` | Wraps the table. `position: relative`, `width: fit-content`, `overflow: hidden`. |
| `.ascii-table-source` | `<table>` | The original table, `visibility: hidden`. |
| `.ascii-table-pre` | `<pre>` | The ASCII overlay, `position: absolute`, `top/left: 0`. |

You can style the ASCII output by targeting `.ascii-table-pre`:

```css
/* Tinted background behind the ASCII table */
.ascii-table-wrapper {
  background: #1e1e1e;
}
.ascii-table-pre {
  color: #d4d4d4;
}

/* Slightly larger minimum font */
.ascii-table-pre {
  font-size: max(8px, 1vw);  /* plugin overrides this at render time */
}
```

Note: the plugin sets `font-size` and `line-height` inline on `.ascii-table-pre`
at each render.  Inline styles beat stylesheet rules for those two properties.

---

## Tips & tricks

### Flex and grid containers

The plugin preserves `flex-grow`, `flex-shrink`, `flex-basis`, `align-self`,
`justify-self`, `order`, `grid-column`, and `grid-row` from the source table —
they are transferred to the wrapper `<div>`.  Tables in flex rows just work:

```html
<div style="display:flex; gap:1rem;">
  <table data-ascii="double" style="flex:1">…</table>
  <table data-ascii="github" style="flex:2">…</table>
</div>
```

### Fixed widths

Set `style="width:…"` on the `<table>` element and it is transferred to the
wrapper:

```html
<table data-ascii style="width: 500px">…</table>
<table data-ascii style="width: 100%">…</table>
```

### Resizable containers

Put the table inside a `resize: horizontal` div and it reflows as you drag:

```html
<div style="resize:horizontal; overflow:auto; width:400px; max-width:100%">
  <table data-ascii="rst" style="width:100%">…</table>
</div>
```

### Themed tables

Wrap a table in a coloured element and the ASCII overlay inherits `color`:

```html
<div style="background:#0d1117; color:#58a6ff; padding:1rem; border-radius:6px">
  <table data-ascii="double">…</table>
</div>
```

### Paste-ready output

Because the `<pre>` element is absolutely positioned over the hidden table, a
normal Ctrl-A / Cmd-A select-all + copy gives you the raw ASCII text — no
HTML, no extra whitespace.

### Registering styles globally

Register custom styles once before `ascii-table.js` processes the page:

```html
<script src="jquery.min.js"></script>
<script src="ascii-table.js"></script>
<script>
  $.fn.asciiTable.styles['neon'] = {
    top:  { l:'╠', f:'═', s:'╬', r:'╣' },
    hdr:  { l:'╠', f:'═', s:'╬', r:'╣' },
    row:  null,
    bot:  { l:'╠', f:'═', s:'╬', r:'╣' },
    cell: { l:'║', s:'║', r:'║' },
  };
  // All tables with data-ascii="neon" pick this up automatically
</script>
```

### Tables created after page load

```js
// Build and inject the table however you like…
var $t = $('<table data-ascii="mysql"><thead>…</thead><tbody>…</tbody></table>');
$('#container').append($t);

// Then initialise it
$t.asciiTable();
```

### Overriding style per table, ignoring global default

```js
$.fn.asciiTable.defaults.style = 'double';  // page-wide default

// This one table uses minimal instead
$('#special').attr('data-ascii', 'minimal').asciiTable();
```

---

## Browser support

Requires:
- jQuery 1.7 +
- `ResizeObserver` (all modern browsers; polyfill for IE/legacy)
- Unicode monospace font for `double` style (any system monospace font works)
