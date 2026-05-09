(function ($) {
  'use strict';

  // Line-height bounds. LH_MIN must be >= 1 — anything below causes adjacent
  // text rows to visibly overlap, which is exactly the bug the previous
  // solver could fall into when height-constrained.
  var LH_MAX = 1.4;
  var LH_MIN = 1.0;
  var FS_MIN = 6;
  // Inner-cell padding values to consider. Larger paddings let the search
  // soak up horizontal slack when the layout is otherwise height-bound,
  // letting the font grow until W and H co-saturate.
  var PADDINGS = [0, 1, 2];

  // Each line spec: { l: leftCap, f: fillChar, s: colSep, r: rightCap }
  // Each cell spec: { l: leftBorder, s: colSep, r: rightBorder }
  // null line spec = omit that line entirely
  var STYLES = {
    classic: {
      top:  { l:'+', f:'-', s:'+', r:'+' },
      hdr:  { l:'+', f:'-', s:'+', r:'+' },
      row:  null,
      bot:  { l:'+', f:'-', s:'+', r:'+' },
      cell: { l:'|', s:'|', r:'|' },
    },
    double: {
      top:  { l:'╔', f:'═', s:'╦', r:'╗' },
      hdr:  { l:'╠', f:'═', s:'╬', r:'╣' },
      row:  null,
      bot:  { l:'╚', f:'═', s:'╩', r:'╝' },
      cell: { l:'║', s:'║', r:'║' },
    },
    dots: {
      top:  { l:'.', f:'.', s:'.', r:'.' },
      hdr:  { l:':', f:'.', s:':', r:':' },
      row:  null,
      bot:  { l:':', f:'.', s:':', r:':' },
      cell: { l:':', s:':', r:':' },
    },
    brackets: {
      top:  { l:'//', f:'=', s:'[]', r:'\\\\' },
      hdr:  { l:'|]', f:'=', s:'[]', r:'[|' },
      row:  null,
      bot:  { l:'\\\\', f:'=', s:'[]', r:'//' },
      cell: { l:'||', s:'||', r:'||' },
    },
    rounded: {
      top:  { l:'.', f:'-', s:'.', r:'.' },
      hdr:  { l:':', f:'-', s:'+', r:':' },
      row:  { l:':', f:'-', s:'+', r:':' },
      bot:  { l:"'", f:'-', s:"'", r:"'" },
      cell: { l:'|', s:'|', r:'|' },
    },
    mysql: {
      top:  { l:'+', f:'-', s:'+', r:'+' },
      hdr:  { l:'+', f:'=', s:'+', r:'+' },
      row:  null,
      bot:  { l:'+', f:'-', s:'+', r:'+' },
      cell: { l:'|', s:'|', r:'|' },
    },
    github: {
      top:  null,
      hdr:  { l:'|', f:'-', s:'|', r:'|' },
      row:  null,
      bot:  null,
      cell: { l:'|', s:'|', r:'|' },
    },
    rst: {
      top:  { l:'+', f:'=', s:'+', r:'+' },
      hdr:  { l:'+', f:'=', s:'+', r:'+' },
      row:  { l:'+', f:'-', s:'+', r:'+' },
      bot:  { l:'+', f:'-', s:'+', r:'+' },
      cell: { l:'|', s:'|', r:'|' },
    },
    grid: {
      top:  { l:' ', f:'=', s:' ', r:' ' },
      hdr:  { l:' ', f:'=', s:' ', r:' ' },
      row:  null,
      bot:  { l:' ', f:'=', s:' ', r:' ' },
      cell: { l:' ', s:' ', r:' ' },
    },
    outline: {
      top:  null,
      hdr:  { l:' ', f:'-', s:'|', r:' ' },
      row:  null,
      bot:  null,
      cell: { l:' ', s:'|', r:' ' },
    },
    minimal: {
      top:  null,
      hdr:  { l:' ', f:'-', s:' ', r:' ' },
      row:  null,
      bot:  null,
      cell: { l:' ', s:' ', r:' ' },
    },
    'header-bar': {
      top:     null,
      hdr:     null,
      row:     null,
      bot:     null,
      cell:    { l:'|',  s:'|',  r:'|'  },
      hdrCell: { l:'||', s:'||', r:'||' },
    },
  };
  STYLES['default'] = STYLES.classic;

  function charWidthAt($pre, fs) {
    $pre.css('font-size', fs + 'px');
    var $s = $('<span>').text('M').appendTo($pre);
    var w = $s[0].getBoundingClientRect().width || fs * 0.6;
    $s.remove();
    return w;
  }

  function pad(str, len) {
    if (len <= 0) return '';
    return (str + ' '.repeat(Math.max(0, len - str.length))).slice(0, len);
  }

  // Greedy word-wrap. If a single word exceeds width, hard-break it.
  function wrapText(text, width) {
    if (width <= 0) return [text];
    if (text.length <= width) return [text];
    var lines = [], current = '';
    var words = text.split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      // Hard-break overlong words.
      while (word.length > width) {
        if (current) { lines.push(current); current = ''; }
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (current === '') {
        current = word;
      } else if ((current + ' ' + word).length <= width) {
        current += ' ' + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function makeSepLine(colWidths, spec) {
    if (!spec) return null;
    return spec.l + colWidths.map(function (w) { return spec.f.repeat(w); }).join(spec.s) + spec.r;
  }

  // rowPads[i] = blank cell-lines emitted BEFORE row i's content (after the
  // preceding separator). Used to align each row's first content line with
  // the corresponding source <tr>'s pixel position.
  function buildLines(rows, colWidths, padding, sepEvery, style, hasHeader, rowPads) {
    var sp = ' '.repeat(padding);
    var lines = [];
    var topSep = makeSepLine(colWidths, style.top);
    var hdrSep = makeSepLine(colWidths, style.hdr);
    var rowSep = makeSepLine(colWidths, style.row);
    var botSep = makeSepLine(colWidths, style.bot);

    function blankRowLine(cs) {
      return cs.l + colWidths.map(function (w) {
        return sp + pad('', w - 2 * padding) + sp;
      }).join(cs.s) + cs.r;
    }

    if (topSep) lines.push(topSep);

    $.each(rows, function (ri, row) {
      var isHeader = hasHeader && ri === 0;
      var isLast   = ri === rows.length - 1;
      var cs = isHeader ? (style.hdrCell || style.cell) : style.cell;

      var pre = (rowPads && rowPads[ri]) ? rowPads[ri] : 0;
      for (var p = 0; p < pre; p++) lines.push(blankRowLine(cs));

      var wrapped = colWidths.map(function (w, col) {
        return wrapText(row[col] || '', w - 2 * padding);
      });
      var rowH = wrapped.reduce(function (m, wc) { return Math.max(m, wc.length); }, 1);

      for (var ln = 0; ln < rowH; ln++) {
        lines.push(cs.l + colWidths.map(function (w, col) {
          return sp + pad(wrapped[col][ln] || '', w - 2 * padding) + sp;
        }).join(cs.s) + cs.r);
      }

      if (isLast) {
        if (botSep) lines.push(botSep);
      } else if (isHeader) {
        if (hdrSep) lines.push(hdrSep);
      } else if (sepEvery && rowSep) {
        lines.push(rowSep);
      }
    });

    return lines;
  }

  // Static line-count for a given inner-width vector (no separator characters,
  // just rows worth of vertical space). Same algebra as buildLines but cheaper.
  function countLines(rows, innerWidths, sepEvery, style, hasHeader) {
    var lines = 0;
    if (style.top) lines++;
    if (style.bot) lines++;
    if (hasHeader && style.hdr) lines++;
    if (sepEvery && style.row) {
      var dataRows = rows.length - (hasHeader ? 1 : 0);
      lines += Math.max(0, dataRows - 1);
    }
    for (var ri = 0; ri < rows.length; ri++) {
      var rowH = 1;
      for (var c = 0; c < innerWidths.length; c++) {
        var w = wrapText(rows[ri][c] || '', innerWidths[c]);
        if (w.length > rowH) rowH = w.length;
      }
      lines += rowH;
    }
    return lines;
  }

  // Smallest inner width >= minInner that wraps `text` into <= k lines.
  function minWidthForKLines(text, k, minInner) {
    if (k <= 0) return text.length;
    if (text.length <= minInner) return minInner;
    var lo = minInner, hi = text.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (wrapText(text, mid).length <= k) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  // Per-column candidate inner widths: every "breakpoint" where wrap count
  // changes for at least one cell, capped to a small set so the joint search
  // stays tractable.
  function columnBreakpoints(rows, c, minInner, maxLen) {
    var set = {};
    set[minInner] = true;
    set[maxLen] = true;
    for (var ri = 0; ri < rows.length; ri++) {
      var text = rows[ri][c] || '';
      if (!text || text.length <= minInner) continue;
      for (var k = 1; k <= 5; k++) {
        var w = minWidthForKLines(text, k, minInner);
        if (w >= minInner && w <= maxLen) set[w] = true;
      }
    }
    var arr = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    // Keep at most 6 widths per column to bound the cartesian product.
    if (arr.length > 6) {
      var picked = [arr[0]];
      var step = (arr.length - 1) / 5;
      for (var i = 1; i < 5; i++) picked.push(arr[Math.round(i * step)]);
      picked.push(arr[arr.length - 1]);
      arr = picked.filter(function (v, idx, a) { return idx === 0 || v !== a[idx-1]; });
    }
    return arr;
  }

  // Score a candidate (padding, sepEvery, innerWidths) tuple. Returns the
  // largest font size that satisfies both width and height, with line-height
  // backed off toward LH_MIN if height-bound — never below LH_MIN.
  function scoreCandidate(rows, hasHeader, style, padding, sepEvery, inners, overhead, k_w, W, H) {
    var N = inners.length;
    var totalChars = overhead + 2 * N * padding;
    for (var i = 0; i < N; i++) totalChars += inners[i];
    var lines = countLines(rows, inners, sepEvery, style, hasHeader);

    var fs_w     = W / (totalChars * k_w);
    var fs_hMax  = H / (lines * LH_MIN);
    var fs       = Math.min(fs_w, fs_hMax);
    if (!isFinite(fs) || fs <= 0) return null;

    var fs_hPref = H / (lines * LH_MAX);
    var lh = (fs <= fs_hPref) ? LH_MAX : Math.max(LH_MIN, H / (lines * fs));

    return { fs: fs, lh: lh, lines: lines, totalChars: totalChars,
             padding: padding, sepEvery: sepEvery, inners: inners.slice() };
  }

  // Joint search over per-column wrap breakpoints. For small N (typically
  // <= 6) we enumerate the cartesian product of per-column candidates.
  function searchInners(rows, hasHeader, style, padding, sepEvery, breakpoints,
                        overhead, k_w, W, H) {
    var N = breakpoints.length;
    var sizes = breakpoints.map(function (b) { return b.length; });
    var total = sizes.reduce(function (a, b) { return a * b; }, 1);

    // Hard cap on enumeration; fall back to greedy hill-climb if too big.
    if (total > 4096) return greedyInners(rows, hasHeader, style, padding, sepEvery,
                                          breakpoints, overhead, k_w, W, H);

    var best = null;
    var idx = new Array(N).fill(0);
    var inners = new Array(N);
    while (true) {
      for (var c = 0; c < N; c++) inners[c] = breakpoints[c][idx[c]];
      var s = scoreCandidate(rows, hasHeader, style, padding, sepEvery,
                             inners, overhead, k_w, W, H);
      if (s && (!best || s.fs > best.fs)) best = s;

      var k = N - 1;
      while (k >= 0) {
        idx[k]++;
        if (idx[k] < sizes[k]) break;
        idx[k] = 0; k--;
      }
      if (k < 0) break;
    }
    return best;
  }

  function greedyInners(rows, hasHeader, style, padding, sepEvery, breakpoints,
                        overhead, k_w, W, H) {
    var N = breakpoints.length;
    // Start at widest (no wrap).
    var idx = breakpoints.map(function (b) { return b.length - 1; });
    function evalAt(i) {
      var inners = i.map(function (v, c) { return breakpoints[c][v]; });
      return scoreCandidate(rows, hasHeader, style, padding, sepEvery,
                            inners, overhead, k_w, W, H);
    }
    var best = evalAt(idx);
    for (var iter = 0; iter < 4 * N; iter++) {
      var improved = false;
      for (var c = 0; c < N; c++) {
        for (var d = -1; d <= 1; d += 2) {
          var ni = idx.slice();
          ni[c] += d;
          if (ni[c] < 0 || ni[c] >= breakpoints[c].length) continue;
          var s = evalAt(ni);
          if (s && (!best || s.fs > best.fs)) { best = s; idx = ni; improved = true; }
        }
      }
      if (!improved) break;
    }
    return best;
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function render($table, $pre, $wrapper) {
    // Measure the SOURCE TABLE — not the wrapper/box around it. The whole
    // point of this library is "the hidden table drives layout". Whatever
    // dimensions the browser picks for the source table are what the ASCII
    // mirrors. If the user wants the ASCII to fill a bigger box, they set
    // CSS on the source table (width:100%, height:100%) so the table
    // itself grows — and then we follow it.
    var tRect = $table[0].getBoundingClientRect();
    var W = tRect.width, H = tRect.height;
    if (W < 1 || H < 1) return;

    var rows = $table.data('ascii-rows');
    var R = rows.length, N = 0;
    $.each(rows, function (_, row) { N = Math.max(N, row.length); });
    if (N === 0) return;

    var styleName = ($table.attr('data-ascii') || '').trim() || $.fn.asciiTable.defaults.style;
    var style = STYLES[styleName] || STYLES[$.fn.asciiTable.defaults.style] || STYLES.classic;
    var hasHeader = $table.data('ascii-header') !== false &&
                    String($table.data('ascii-header')) !== 'false' &&
                    $.fn.asciiTable.defaults.header !== false;

    // Calibrate char width: cw scales linearly with fs in any monospace font,
    // so one measurement gives us the constant k_w = cw / fs.
    var k_w = charWidthAt($pre, 100) / 100;

    // Per-column max content length and minimum inner width (longest single
    // word — narrower than this would force a hard mid-word break).
    var maxLen = [], minInner = [];
    for (var c = 0; c < N; c++) {
      var mx = 0, mw = 0;
      $.each(rows, function (_, row) {
        var t = row[c] || '';
        if (t.length > mx) mx = t.length;
        var parts = t.split(/\s+/);
        for (var p = 0; p < parts.length; p++) if (parts[p].length > mw) mw = parts[p].length;
      });
      maxLen.push(Math.max(1, mx));
      minInner.push(Math.max(1, mw || 1));
    }

    // Per-column breakpoints — discrete inner widths worth trying.
    var breakpoints = [];
    for (var c2 = 0; c2 < N; c2++) {
      breakpoints.push(columnBreakpoints(rows, c2, minInner[c2], maxLen[c2]));
    }

    // Overhead = chars consumed by left/right borders and column separators.
    // Header cells may use a different (wider) spec.
    var csCell = style.cell;
    var csHead = style.hdrCell || style.cell;
    function overheadOf(cs) {
      return cs.l.length + (N > 1 ? (N - 1) * cs.s.length : 0) + cs.r.length;
    }
    // Use the larger of the two for sizing — we must fit the wider of the
    // header and data rows.
    var overhead = Math.max(overheadOf(csCell), overheadOf(csHead));

    var configs = [];
    for (var pi = 0; pi < PADDINGS.length; pi++) {
      configs.push({ sepEvery: true,  padding: PADDINGS[pi] });
      configs.push({ sepEvery: false, padding: PADDINGS[pi] });
    }

    // Find the (config, inner-widths) combo that maximises font size.
    var best = null;
    for (var ci = 0; ci < configs.length; ci++) {
      var cfg = configs[ci];
      var s = searchInners(rows, hasHeader, style, cfg.padding, cfg.sepEvery,
                           breakpoints, overhead, k_w, W, H);
      if (s && (!best || s.fs > best.fs)) best = s;
    }

    if (!best) return; // shouldn't happen — search always returns something

    // Cap fs at the source table's CSS font-size. The whole point of this
    // library is to mirror the source — blowing the text up to 30+ px just
    // because the box is large looks wrong. Any leftover slack after this
    // cap is soaked up (in priority order) by:
    //   1. line-height stretch (up to LH_FILL)
    //   2. extra blank lines per data row (rowPads)
    //   3. extra inner-cell width to span W horizontally
    // We only let the font GROW past the cap if the search couldn't find
    // a layout that fits at the cap — i.e., the container is genuinely
    // smaller than the natural rendering.
    var fs_target = parseFloat($table.css('font-size')) || 16;
    var fs        = Math.max(4, Math.min(best.fs, fs_target));
    var lh        = best.lh;
    var padding   = best.padding;
    var sepEvery  = best.sepEvery;
    var inners    = best.inners.slice();

    // Width-fill: when the chosen font is height-bound, the text natural
    // width is less than W and the ASCII huddles in the upper-left of the
    // wrapper. Grow inner widths (no extra rows, same font) until the row
    // physically spans W.
    var fillTotalChars = Math.floor(W / (fs * k_w));
    var curTotalChars  = overhead + 2 * N * padding;
    for (var c3 = 0; c3 < N; c3++) curTotalChars += inners[c3];
    if (fillTotalChars > curTotalChars + 1) {
      var extra = fillTotalChars - curTotalChars;
      // Distribute proportional to source-column pixel widths; fall back to
      // even distribution if that's unavailable.
      var $refRow = $table.find('tr').first();
      $table.find('tr').each(function () {
        if ($(this).find('td,th').length > $refRow.find('td,th').length) $refRow = $(this);
      });
      var colPx = [];
      $refRow.find('td,th').each(function () { colPx.push(this.getBoundingClientRect().width); });
      var pxTotal = colPx.reduce(function (a, b) { return a + b; }, 0);
      if (colPx.length !== N || pxTotal <= 0) {
        colPx = []; for (var cc = 0; cc < N; cc++) colPx.push(1); pxTotal = N;
      }
      var assigned = 0;
      for (var c4 = 0; c4 < N; c4++) {
        var add = (c4 === N - 1) ? (extra - assigned)
                                 : Math.round(colPx[c4] / pxTotal * extra);
        inners[c4] += add;
        assigned  += add;
      }
    }

    var colWidths = inners.map(function (w) { return w + 2 * padding; });

    // Per-row vertical alignment. The goal is for each ASCII row's first
    // content line to land at roughly the same Y as the corresponding
    // source <tr>. Two knobs:
    //   * line-height (lh) — one knob, sets the SPACING between every line
    //   * rowPads — per-row blank-line padding before each row's content
    //
    // Strategy: set lh so that the ASCII line height matches the source's
    // average row spacing (this is what makes per-row alignment trivial),
    // then compute rowPads by walking the line stream and padding each row
    // until it reaches its target line index. Finally, if the resulting
    // total height overflows H, scale lh down to fit.
    var LH_FILL = 2.5;

    var srcTops = [], srcSpacing = 0;
    $table.find('tr').each(function () {
      srcTops.push(this.getBoundingClientRect().top - tRect.top);
    });
    if (srcTops.length >= 2) {
      srcSpacing = (srcTops[srcTops.length - 1] - srcTops[0]) / (srcTops.length - 1);
    } else {
      srcSpacing = H / Math.max(1, rows.length);
    }
    lh = Math.max(LH_MIN, Math.min(LH_FILL, srcSpacing / fs));

    function computeRowPads(asciiLineH) {
      var pads    = new Array(rows.length).fill(0);
      var emitted = (style.top ? 1 : 0);
      // Shift target by topSep — row 0 sits below the top separator, so
      // we measure source positions relative to where row 0 *can* start.
      var anchor = emitted;
      for (var i = 0; i < rows.length; i++) {
        if (i > 0) {
          if (i === 1 && hasHeader && style.hdr)     emitted += 1;
          else if (sepEvery && style.row)            emitted += 1;
        }
        var targetLine = anchor + Math.round((srcTops[i] - srcTops[0]) / asciiLineH);
        var pre        = Math.max(0, targetLine - emitted);
        pads[i]        = pre;
        emitted       += pre;
        var rh = 1;
        for (var c = 0; c < N; c++) {
          var w = wrapText(rows[i][c] || '', inners[c]);
          if (w.length > rh) rh = w.length;
        }
        emitted += rh;
      }
      // emitted now counts everything except the bot separator.
      return { pads: pads, totalLines: emitted + (style.bot ? 1 : 0) };
    }

    var pack = computeRowPads(fs * lh);
    var rowPads = pack.pads;

    // Fit-to-H: if the (lh, pads) we picked overflows, scale lh down and
    // recompute pads. We loop a few times because the pads themselves
    // depend on lh — but it converges fast in practice.
    for (var fit = 0; fit < 4; fit++) {
      var rendered = pack.totalLines * fs * lh;
      if (rendered <= H + 0.5) break;
      var shrink = H / rendered;
      lh = Math.max(LH_MIN, lh * shrink);
      pack = computeRowPads(fs * lh);
      rowPads = pack.pads;
      if (lh <= LH_MIN + 1e-6) break;
    }

    // Recompute cw at the chosen font size (this also leaves $pre with the
    // correct font-size / line-height for the final paint).
    charWidthAt($pre, fs);
    $pre.css('line-height', lh);

    var lines = buildLines(rows, colWidths, padding, sepEvery, style, hasHeader, rowPads);
    $pre.text(lines.join('\n'));
    // Wrapper height is anchored to the source table's measured H, NOT the
    // pre's rendered height — using the latter creates a runaway feedback
    // loop (wrapper grows → table inside grows in some layouts → larger H
    // measured → bigger font → taller pre → wrapper grows again).
    $wrapper.css('min-height', H + 'px');
  }

  $.fn.asciiTable = function () {
    return this.each(function () {
      var $table = $(this);
      if ($table.data('ascii-done')) return;
      $table.data('ascii-done', true);

      var rows = [];
      $table.find('tr').each(function () {
        var row = [];
        $(this).find('td,th').each(function () {
          row.push($(this).text().trim().replace(/\s+/g, ' '));
        });
        rows.push(row);
      });
      $table.data('ascii-rows', rows);

      var inlineW = this.style.width;
      var inlineH = this.style.height;
      var childProps = {};
      $.each(
        ['flex-grow','flex-shrink','flex-basis','align-self',
         'justify-self','order','grid-column','grid-row'],
        function (_, p) { childProps[p] = $table.css(p); }
      );

      $table.wrap('<div class="ascii-table-wrapper">');
      var $wrapper = $table.parent();
      if (inlineW) $wrapper.css('width', inlineW);
      if (inlineH) $wrapper.css('height', inlineH);
      $wrapper.css(childProps);

      var $pre = $('<pre class="ascii-table-pre">').appendTo($wrapper);
      $table.addClass('ascii-table-source');

      var run = debounce(function () { render($table, $pre, $wrapper); }, 30);
      var ro = new ResizeObserver(run);
      ro.observe($wrapper[0]);
      ro.observe($table[0]);

      render($table, $pre, $wrapper);
    });
  };

  // Named styles — add custom ones here or via $.fn.asciiTable.styles['myStyle'] = {...}
  $.fn.asciiTable.styles = STYLES;

  // Global defaults — override before calling asciiTable()
  $.fn.asciiTable.defaults = { style: 'classic', header: true };

  $(function () { $('table[data-ascii]').asciiTable(); });

}(jQuery));
