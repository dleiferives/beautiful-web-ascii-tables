(function ($) {
  'use strict';

  var LH_MAX = 1.4;
  var LH_MIN = 0.7;
  var FS_MIN = 6;

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

  function wrapText(text, width) {
    if (width <= 0 || text.length <= width) return [text];
    var lines = [], current = '';
    var words = text.split(/\s+/).filter(Boolean);
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
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

  function estimateLines(R, sepEvery, style, hasHeader) {
    var Rd = R - (hasHeader ? 1 : 0);
    var seps = (style.top ? 1 : 0) + (style.bot ? 1 : 0);
    if (hasHeader && style.hdr) seps++;
    if (sepEvery && style.row) seps += Math.max(0, Rd - 1);
    return R + seps;
  }

  function buildLines(rows, colWidths, padding, sepEvery, style, hasHeader) {
    var sp = ' '.repeat(padding);
    var lines = [];
    var topSep = makeSepLine(colWidths, style.top);
    var hdrSep = makeSepLine(colWidths, style.hdr);
    var rowSep = makeSepLine(colWidths, style.row);
    var botSep = makeSepLine(colWidths, style.bot);

    if (topSep) lines.push(topSep);

    $.each(rows, function (ri, row) {
      var isHeader = hasHeader && ri === 0;
      var isLast   = ri === rows.length - 1;
      var cs = isHeader ? (style.hdrCell || style.cell) : style.cell;

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

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function render($table, $pre, $wrapper) {
    var tRect = $table[0].getBoundingClientRect();
    var W = tRect.width, H = tRect.height;
    if (W < 1 || H < 1) return;

    var rows = $table.data('ascii-rows');
    var R = rows.length, N = 0;
    $.each(rows, function (_, row) { N = Math.max(N, row.length); });

    var styleName = ($table.attr('data-ascii') || '').trim() || $.fn.asciiTable.defaults.style;
    var style = STYLES[styleName] || STYLES[$.fn.asciiTable.defaults.style] || STYLES.classic;
    var hasHeader = $table.data('ascii-header') !== false &&
                    String($table.data('ascii-header')) !== 'false' &&
                    $.fn.asciiTable.defaults.header !== false;

    var k_w = charWidthAt($pre, 100) / 100;

    var maxLen = [], minInner = [];
    for (var c = 0; c < N; c++) {
      var mx = 0, mw = 0;
      $.each(rows, function (_, row) {
        mx = Math.max(mx, (row[c] || '').length);
        (row[c] || '').split(/\s+/).filter(Boolean).forEach(function (w) {
          mw = Math.max(mw, w.length);
        });
      });
      maxLen.push(mx);
      minInner.push(mw || 1);
    }

    var $refRow = $table.find('tr').first();
    $table.find('tr').each(function () {
      if ($(this).find('td,th').length > $refRow.find('td,th').length) $refRow = $(this);
    });
    var colPx = [];
    $refRow.find('td,th').each(function () { colPx.push(this.getBoundingClientRect().width); });
    var pxTotal = colPx.reduce(function (a, b) { return a + b; }, 0) || W;

    // Overhead = chars consumed by left/right borders and column separators (not content).
    var cs0 = style.hdrCell || style.cell;
    var overhead = cs0.l.length + (N > 1 ? (N - 1) * cs0.s.length : 0) + cs0.r.length;

    var configs = [
      { sepEvery: true,  padding: 1 },
      { sepEvery: false, padding: 1 },
      { sepEvery: false, padding: 0 },
    ];

    var chosen = null;
    for (var ci = 0; ci < configs.length; ci++) {
      var cfg = configs[ci];
      var cfgLines = estimateLines(R, cfg.sepEvery, style, hasHeader);
      var minChars = overhead;
      for (var i = 0; i < N; i++) minChars += maxLen[i] + 2 * cfg.padding;
      var fs_w = W / (minChars * k_w);
      var lh   = Math.min(LH_MAX, Math.max(LH_MIN, H / (cfgLines * fs_w)));
      var fs   = Math.min(fs_w, H / (cfgLines * lh));
      if (fs >= FS_MIN) { chosen = { cfg: cfg, fs: fs, lh: lh }; break; }
    }

    if (!chosen) {
      var fb = configs[configs.length - 1];
      var fbLines = estimateLines(R, fb.sepEvery, style, hasHeader);
      var fbChars = overhead;
      for (var j = 0; j < N; j++) fbChars += maxLen[j];
      var fs_w0 = W / (fbChars * k_w);
      var lh0   = Math.max(LH_MIN, H / (fbLines * fs_w0));
      chosen = { cfg: fb, fs: Math.max(4, Math.min(fs_w0, H / (fbLines * lh0))), lh: lh0 };
    }

    var fs       = chosen.fs;
    var lh       = chosen.lh;
    var padding  = chosen.cfg.padding;
    var sepEvery = chosen.cfg.sepEvery;

    $pre.css('line-height', lh);

    var lines, colWidths;
    for (var pass = 0; pass < 3; pass++) {
      var cw         = charWidthAt($pre, fs);
      var innerTotal = Math.max(N, Math.floor(W / cw) - overhead - 2 * N * padding);

      colWidths = [];
      var assigned = 0;
      for (var k = 0; k < N; k++) {
        var inner = (k === N - 1)
          ? Math.max(minInner[k], innerTotal - assigned)
          : Math.max(minInner[k], Math.round(colPx[k] / pxTotal * innerTotal));
        colWidths.push(inner + 2 * padding);
        if (k < N - 1) assigned += inner;
      }

      lines = buildLines(rows, colWidths, padding, sepEvery, style, hasHeader);

      var fs_h = H / (lines.length * lh);
      if (fs_h >= fs - 0.5) break;

      // Before shrinking font, try removing padding from any columns that still have it.
      if (padding > 0) {
        var innerTotal0 = Math.max(N, Math.floor(W / cw) - overhead);
        var colWidths0 = [], assigned0 = 0;
        for (var k0 = 0; k0 < N; k0++) {
          var inner0 = (k0 === N - 1)
            ? Math.max(minInner[k0], innerTotal0 - assigned0)
            : Math.max(minInner[k0], Math.round(colPx[k0] / pxTotal * innerTotal0));
          colWidths0.push(inner0);
          if (k0 < N - 1) assigned0 += inner0;
        }
        var lines0 = buildLines(rows, colWidths0, 0, sepEvery, style, hasHeader);
        var fs_h0  = H / (lines0.length * lh);
        if (fs_h0 > fs_h) {
          padding   = 0;
          colWidths = colWidths0;
          lines     = lines0;
          fs_h      = fs_h0;
        }
      }

      if (fs_h >= fs - 0.5) break;
      fs = Math.max(FS_MIN, fs_h);
    }

    // Wrap-trade: if height still has headroom the font is width-constrained.
    var fs_if_one_more_line = H / ((lines.length + 1) * lh);
    if (fs_if_one_more_line > fs * 1.05) {
      var bestCol = -1, minSlack = Infinity;
      for (var kk = 0; kk < N; kk++) {
        if (maxLen[kk] < 2) continue;
        var slack = colWidths[kk] - 2 * padding - maxLen[kk];
        if (slack < minSlack) { minSlack = slack; bestCol = kk; }
      }

      if (bestCol >= 0) {
        var longestCell = '';
        $.each(rows, function (_, row) {
          var t = row[bestCol] || '';
          if (t.length > longestCell.length) longestCell = t;
        });
        var mid     = Math.ceil(longestCell.length / 2);
        var breakAt = longestCell.lastIndexOf(' ', mid);
        if (breakAt < 1) breakAt = mid;
        var wrapInner = Math.max(minInner[bestCol], breakAt);

        if (wrapInner < colWidths[bestCol] - 2 * padding) {
          var newColWidths   = colWidths.slice();
          newColWidths[bestCol] = wrapInner + 2 * padding;

          var newTotalChars = newColWidths.reduce(function (a, b) { return a + b; }, 0) + overhead;
          var newFs = Math.min(W / (newTotalChars * k_w), fs_if_one_more_line);

          if (newFs > fs * 1.05) {
            colWidths = newColWidths;
            fs = newFs;
            charWidthAt($pre, fs);
            lines = buildLines(rows, colWidths, padding, sepEvery, style, hasHeader);
          }
        }
      }
    }

    $pre.text(lines.join('\n'));
    $wrapper.css('min-height', $pre[0].offsetHeight + 'px');
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
      var childProps = {};
      $.each(
        ['flex-grow','flex-shrink','flex-basis','align-self',
         'justify-self','order','grid-column','grid-row'],
        function (_, p) { childProps[p] = $table.css(p); }
      );

      $table.wrap('<div class="ascii-table-wrapper">');
      var $wrapper = $table.parent();
      if (inlineW) $wrapper.css('width', inlineW);
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
