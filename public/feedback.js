/*!
 * NAFU Design, uwagi na podglądzie strony.
 * Dodaj do wersji podglądowej projektu:
 *   <script src="https://nafu-design.com/feedback.js" defer></script>
 * Skrypt nic nie robi, dopóki strona nie jest otwarta w panelu klienta NAFU (w ramce).
 */
(function () {
  if (window.parent === window) return
  var ALLOWED = ['https://nafu-design.com', 'https://nafubrief.netlify.app', 'http://localhost:5173', 'http://localhost:5174']
  var parentOrigin = null
  var mode = false
  var pins = []
  var layer, overlay, hover

  function send(msg) {
    if (parentOrigin) window.parent.postMessage(msg, parentOrigin)
  }
  function path() {
    return location.pathname + location.search
  }

  // ---- selektor elementu ----
  function selectorFor(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body'
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id)
    var parts = []
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 8) {
      var tag = el.tagName.toLowerCase()
      var idx = 1
      var sib = el
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) idx++
      parts.unshift(tag + ':nth-of-type(' + idx + ')')
      if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
        parts[0] = '#' + CSS.escape(el.id)
        break
      }
      el = el.parentElement
    }
    return (parts[0] && parts[0][0] === '#' ? '' : 'body > ') + parts.join(' > ')
  }

  // ---- warstwy ----
  function ensureLayers() {
    if (layer) return
    var css = document.createElement('style')
    css.textContent =
      '.nafu-pin{position:absolute;z-index:2147483646;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50% 50% 50% 4px;' +
      'background:#02afca;color:#042028;font:700 13px/30px system-ui,sans-serif;text-align:center;box-shadow:0 4px 14px rgba(7,33,41,.45);' +
      'border:2px solid #fff;cursor:pointer;transform:rotate(-45deg)}' +
      '.nafu-pin span{display:inline-block;transform:rotate(45deg)}' +
      '.nafu-pin.done{background:#9fb3b9}' +
      '.nafu-pin.flash{animation:nafuflash 1.2s ease 2}' +
      '@keyframes nafuflash{50%{box-shadow:0 0 0 12px rgba(2,175,202,.35)}}' +
      '.nafu-overlay{position:fixed;inset:0;z-index:2147483645;cursor:crosshair;background:rgba(2,175,202,.04)}' +
      '.nafu-hover{position:absolute;z-index:2147483644;pointer-events:none;outline:2px dashed #02afca;outline-offset:2px;border-radius:4px;transition:all .08s}'
    document.head.appendChild(css)
    layer = document.createElement('div')
    layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:2147483646'
    document.body.appendChild(layer)
    hover = document.createElement('div')
    hover.className = 'nafu-hover'
    hover.style.display = 'none'
    document.body.appendChild(hover)
  }

  function elementAt(x, y) {
    overlay.style.pointerEvents = 'none'
    var el = document.elementFromPoint(x, y)
    overlay.style.pointerEvents = 'auto'
    return el
  }

  function setMode(on) {
    ensureLayers()
    mode = on
    if (on && !overlay) {
      overlay = document.createElement('div')
      overlay.className = 'nafu-overlay'
      overlay.addEventListener('mousemove', function (e) {
        var el = elementAt(e.clientX, e.clientY)
        if (!el) return
        var r = el.getBoundingClientRect()
        hover.style.display = 'block'
        hover.style.left = r.left + window.scrollX + 'px'
        hover.style.top = r.top + window.scrollY + 'px'
        hover.style.width = r.width + 'px'
        hover.style.height = r.height + 'px'
      })
      overlay.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        var el = elementAt(e.clientX, e.clientY) || document.body
        var r = el.getBoundingClientRect()
        send({
          type: 'nafu:pick',
          data: {
            path: path(),
            selector: selectorFor(el),
            x_pct: r.width ? (e.clientX - r.left) / r.width : 0,
            y_pct: r.height ? (e.clientY - r.top) / r.height : 0,
            page_x: e.clientX + window.scrollX,
            page_y: e.clientY + window.scrollY,
            viewport: window.innerWidth + 'x' + window.innerHeight,
          },
        })
        setMode(false)
      })
      document.body.appendChild(overlay)
    }
    if (!on && overlay) {
      overlay.remove()
      overlay = null
      hover.style.display = 'none'
    }
  }

  function position(p) {
    var el = null
    try {
      el = p.selector ? document.querySelector(p.selector) : null
    } catch (e) {
      el = null
    }
    if (el) {
      var r = el.getBoundingClientRect()
      return { x: r.left + window.scrollX + r.width * (p.x_pct || 0), y: r.top + window.scrollY + r.height * (p.y_pct || 0) }
    }
    return { x: p.page_x || 0, y: p.page_y || 0 }
  }

  function render() {
    ensureLayers()
    layer.innerHTML = ''
    pins.forEach(function (p) {
      var pos = position(p)
      var d = document.createElement('div')
      d.className = 'nafu-pin' + (p.resolved ? ' done' : '')
      d.dataset.n = p.n
      d.style.left = pos.x + 'px'
      d.style.top = pos.y + 'px'
      d.innerHTML = '<span>' + p.n + '</span>'
      d.title = 'Uwaga ' + p.n
      d.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        send({ type: 'nafu:pinclick', n: p.n })
      })
      layer.appendChild(d)
    })
  }

  window.addEventListener('message', function (e) {
    if (ALLOWED.indexOf(e.origin) === -1) return
    var m = e.data || {}
    if (m.type === 'nafu:hello') {
      parentOrigin = e.origin
      send({ type: 'nafu:ready', path: path() })
    } else if (e.origin !== parentOrigin) {
      return
    } else if (m.type === 'nafu:mode') {
      setMode(!!m.on)
    } else if (m.type === 'nafu:pins') {
      pins = m.pins || []
      render()
    } else if (m.type === 'nafu:scrollto') {
      var p = pins.filter(function (x) { return x.n === m.n })[0]
      if (!p) return
      var pos = position(p)
      window.scrollTo({ top: Math.max(0, pos.y - window.innerHeight / 3), behavior: 'smooth' })
      var el = layer && layer.querySelector('[data-n="' + m.n + '"]')
      if (el) {
        el.classList.remove('flash')
        void el.offsetWidth
        el.classList.add('flash')
      }
    }
  })

  // zmiana podstrony (także w aplikacjach typu Next.js)
  var last = path()
  function checkNav() {
    if (path() !== last) {
      last = path()
      pins = []
      if (layer) layer.innerHTML = ''
      send({ type: 'nafu:nav', path: last })
    }
  }
  ;['pushState', 'replaceState'].forEach(function (k) {
    var orig = history[k]
    history[k] = function () {
      var r = orig.apply(this, arguments)
      setTimeout(checkNav, 50)
      return r
    }
  })
  window.addEventListener('popstate', checkNav)
  window.addEventListener('resize', function () {
    if (pins.length) render()
  })
  // obrazki i czcionki doładowują się później - odśwież położenie pinezek
  window.addEventListener('load', function () {
    if (pins.length) render()
  })
})()
