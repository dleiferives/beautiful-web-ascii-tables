(function ($) {
  'use strict';

  var LH_MAX = 1.4;
  var LH_MIN = 0.7;
  var FS_MIN = 6;

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

  function buildLines(rows, colWidths, padding, sepEvery) {
    var sp  = ' '.repeat(padding);
    var sep = '+' + colWidths.map(function (w) { return '-'.repeat(w); }).join('+') + '+';
    var lines = [sep];
    $.each(rows, function (ri, row) {
      var wrapped = colWidths.map(function (w, col) {
        return wrapText(row[col] || '', w - 2 * padding);
      });
      var rowH = wrapped.reduce(function (m, wc) { return Math.max(m, wc.length); }, 1);
      for (var ln = 0; ln < rowH; ln++) {
        lines.push('|' + colWidths.map(function (w, col) {
          return sp + pad(wrapped[col][ln] || '', w - 2 * padding) + sp;
        }).join('|') + '|');
      }
      if (sepEvery || ri === 0) lines.push(sep);
    });
    if (!sepEvery) lines.push(sep);
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

    // Read the HTML table's column pixel widths — the browser already solved
    // proportional layout (including wrapping). We mirror these proportions in ASCII.
    var $refRow = $table.find('tr').first();
    $table.find('tr').each(function () {
      if ($(this).find('td,th').length > $refRow.find('td,th').length) $refRow = $(this);
    });
    var colPx = [];
    $refRow.find('td,th').each(function () { colPx.push(this.getBoundingClientRect().width); });
    var pxTotal = colPx.reduce(function (a, b) { return a + b; }, 0) || W;

    // Pick the richest display config whose no-wrap font size meets FS_MIN.
    // cfg.lines is a lower-bound estimate used only for the initial lh/fs guess;
    // the iteration below corrects fs once actual wrapped line counts are known.
    var configs = [
      { sepEvery: true,  padding: 1, lines: 2 * R + 1 },
      { sepEvery: false, padding: 1, lines: R + 3      },
      { sepEvery: false, padding: 0, lines: R + 3      },
    ];

    var chosen = null;
    for (var ci = 0; ci < configs.length; ci++) {
      var cfg = configs[ci];
      var minChars = N + 1;
      for (var i = 0; i < N; i++) minChars += maxLen[i] + 2 * cfg.padding;
      var fs_w = W / (minChars * k_w);
      var lh   = Math.min(LH_MAX, Math.max(LH_MIN, H / (cfg.lines * fs_w)));
      var fs   = Math.min(fs_w, H / (cfg.lines * lh));
      if (fs >= FS_MIN) { chosen = { cfg: cfg, fs: fs, lh: lh }; break; }
    }

    if (!chosen) {
      var fb = configs[configs.length - 1];
      var fbChars = N + 1;
      for (var j = 0; j < N; j++) fbChars += maxLen[j];
      var fs_w0 = W / (fbChars * k_w);
      var lh0 = Math.max(LH_MIN, H / (fb.lines * fs_w0));
      chosen = { cfg: fb, fs: Math.max(4, Math.min(fs_w0, H / (fb.lines * lh0))), lh: lh0 };
    }

    var fs      = chosen.fs;
    var lh      = chosen.lh;
    var padding = chosen.cfg.padding;
    var sepEvery = chosen.cfg.sepEvery;

    $pre.css('line-height', lh);

    // Iterate: distribute chars proportionally to HTML column widths → wrap cells →
    // count real line total → shrink fs to fit H → repeat until stable.
    var lines, colWidths;
    for (var pass = 0; pass < 3; pass++) {
      var cw         = charWidthAt($pre, fs);
      var innerTotal = Math.max(N, Math.floor(W / cw) - (N + 1) - 2 * N * padding);

      colWidths = [];
      var assigned = 0;
      for (var k = 0; k < N; k++) {
        var inner = (k === N - 1)
          ? Math.max(minInner[k], innerTotal - assigned)
          : Math.max(minInner[k], Math.round(colPx[k] / pxTotal * innerTotal));
        colWidths.push(inner + 2 * padding);
        if (k < N - 1) assigned += inner;
      }

      lines = buildLines(rows, colWidths, padding, sepEvery);

      var fs_h = H / (lines.length * lh);
      if (fs_h >= fs - 0.5) break;
      fs = Math.max(FS_MIN, fs_h);
    }

    // Wrap-trade: if height still has headroom the font is width-constrained.
    // Find the column with the least content slack (text fills it most tightly),
    // wrap it at its natural midpoint to free horizontal chars, and check whether
    // the resulting larger font is worth the extra line.
    var fs_if_one_more_line = H / ((lines.length + 1) * lh);
    if (fs_if_one_more_line > fs * 1.05) {
      var bestCol = -1, minSlack = Infinity;
      for (var kk = 0; kk < N; kk++) {
        if (maxLen[kk] < 2) continue;
        var slack = colWidths[kk] - 2 * padding - maxLen[kk];
        if (slack < minSlack) { minSlack = slack; bestCol = kk; }
      }

      if (bestCol >= 0) {
        // Find the wrap width: last word-break at or before the midpoint of the
        // longest cell in this column, so the content splits to exactly 2 lines.
        var longestCell = '';
        $.each(rows, function (_, row) {
          var t = row[bestCol] || '';
          if (t.length > longestCell.length) longestCell = t;
        });
        var mid = Math.ceil(longestCell.length / 2);
        var breakAt = longestCell.lastIndexOf(' ', mid);
        if (breakAt < 1) breakAt = mid;
        var wrapInner = Math.max(minInner[bestCol], breakAt);

        if (wrapInner < colWidths[bestCol] - 2 * padding) {
          var newColWidths = colWidths.slice();
          newColWidths[bestCol] = wrapInner + 2 * padding;

          var newTotalChars = newColWidths.reduce(function (a, b) { return a + b; }, 0) + (N + 1);
          var newFs = Math.min(W / (newTotalChars * k_w), fs_if_one_more_line);

          if (newFs > fs * 1.05) {
            colWidths = newColWidths;
            fs = newFs;
            charWidthAt($pre, fs);
            lines = buildLines(rows, colWidths, padding, sepEvery);
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

  $(function () { $('table[data-ascii]').asciiTable(); });

}(jQuery));
