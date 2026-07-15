document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const links = navLinks ? navLinks.querySelectorAll('a') : [];

  // Cache styles for SVG capture once styles are loaded
  let cachedStyles = "";
  function initStyles() {
    cachedStyles = "";
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (const rule of rules) {
            cachedStyles += rule.cssText;
          }
        }
      } catch (e) {
        // Log a warning and skip the cross-origin stylesheet (e.g. Google Fonts)
        console.warn("Skipping stylesheet rules due to CORS access restrictions: ", e);
      }
    }
  }

  // Initialize styles cache
  initStyles();
  window.addEventListener('load', initStyles);

  let isTransitioning = false;

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });

    // Wire up navigation link clicks to trigger the Thanos Snap effect
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');

        // Close mobile menu if open
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.classList.remove('menu-open');

        // Check if the link is an internal section reference
        if (targetId && targetId.startsWith('#') && targetId.length > 1) {
          e.preventDefault();

          if (isTransitioning) return;
          isTransitioning = true;

          // Find current active section in the viewport
          const currentSection = getActiveSection();
          if (currentSection) {
            thanosSnapTransition(currentSection, targetId, () => {
              isTransitioning = false;
            });
          } else {
            // Fallback scroll if no active section found
            scrollToSection(targetId);
            isTransitioning = false;
          }
        }
      });
    });

    // Close menu when clicking anywhere outside the menu
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('active') && !navLinks.contains(e.target) && e.target !== navToggle) {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.classList.remove('menu-open');
      }
    });
  }

  // Determine which section is currently active (taking up the most space in viewport)
  function getActiveSection() {
    const sections = document.querySelectorAll("section");
    let activeSection = null;
    let maxVisible = 0;

    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      if (visibleHeight > maxVisible) {
        maxVisible = visibleHeight;
        activeSection = section;
      }
    });

    return activeSection;
  }

  // Thanos Snap Transition Orchestrator
  function thanosSnapTransition(currentSection, targetId, onComplete) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scrollY = window.scrollY;

    // Clone body and remove scripts + nav links to make sure we have valid XHTML
    const bodyClone = document.body.cloneNode(true);
    bodyClone.querySelectorAll("script").forEach(s => s.remove());
    bodyClone.querySelectorAll("nav").forEach(n => n.remove());

    // Serialize to valid XML
    let serializedHtml = "";
    try {
      const serializer = new XMLSerializer();
      serializedHtml = serializer.serializeToString(bodyClone);
    } catch (err) {
      console.error("XHTML Serialization failed:", err);
      // Fallback
      scrollToSection(targetId);
      onComplete();
      return;
    }

    // Create SVG foreignObject with styles and hidden navbar to avoid duplicate rendering
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <style>
    ${cachedStyles}
    nav { display: none !important; }
    .bg-blobs { display: none !important; }
    body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
  </style>
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="margin-top: -${scrollY}px; width: 100%; height: 100%; position: relative;">
      ${serializedHtml}
    </div>
  </foreignObject>
</svg>
`;

    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      runSnapAnimation(img, targetId, onComplete);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      console.warn("Thanos Snap capture failed, falling back to instant navigation.", err);
      scrollToSection(targetId);
      onComplete();
    };

    img.src = url;
  }

  // Instant scroll in background
  function scrollToSection(targetId) {
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      const htmlEl = document.documentElement;
      const originalScrollBehavior = htmlEl.style.scrollBehavior;
      htmlEl.style.scrollBehavior = "auto";
      targetElement.scrollIntoView();
      htmlEl.style.scrollBehavior = originalScrollBehavior;
    }
  }

  // Core Animation Engine (drawImage-based to avoid tainted canvas security issues)
  function runSnapAnimation(img, targetId, onComplete) {
    // 1. Create fixed full-screen canvas overlay
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.zIndex = "99"; // Sit just below navbar (z-index 100)
    canvas.style.pointerEvents = "none";
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 2. Slice snapshot into particle positions (without reading pixels to bypass SecurityError)
    const blockSize = 16;
    const particles = [];
    const maxDiagDist = width + height;

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Diagonal distance coordinate from bottom-left corner
        const diagDist = x - y + height;
        // Fuzzy delay for natural organic wave progression
        const fuzzyDelay = diagDist + (Math.random() - 0.5) * 80;

        // Ember check (12% chance to become glowing ember particles)
        const isEmber = Math.random() < 0.12;

        particles.push({
          sx: x,
          sy: y,
          x: x,
          y: y,
          delay: fuzzyDelay,
          isEmber: isEmber,
          // Up-Right wind motion (≈35° angle)
          vx: (Math.random() - 0.15) * 1.6 + 0.4,
          vy: -(Math.random() * 2.2 + 0.8),
          size: blockSize,
          alpha: 1,
          active: false,
          dead: false
        });
      }
    }

    // 3. Trigger background scroll instantly
    scrollToSection(targetId);

    // 4. Run disintegrator loop
    const duration = 1200; // Animation duration in ms
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const threshold = progress * maxDiagDist;

      ctx.clearRect(0, 0, width, height);

      // Render undisintegrated portion of the old viewport
      ctx.save();
      ctx.drawImage(img, 0, 0, width, height);

      // Erase the bottom-left area that has disintegrated
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.moveTo(-100, height + 100);

      if (threshold <= height) {
        ctx.lineTo(-100, height - threshold);
      } else {
        ctx.lineTo(threshold - height, -100);
      }

      if (threshold <= width) {
        ctx.lineTo(threshold, height + 100);
      } else {
        ctx.lineTo(width + 100, height - (threshold - width));
        ctx.lineTo(width + 100, height + 100);
      }

      ctx.closePath();
      ctx.fillStyle = "black";
      ctx.fill();
      ctx.restore();

      // Render and update active particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.dead) continue;

        if (!p.active && threshold >= p.delay) {
          p.active = true;
        }

        if (p.active) {
          // Physics
          p.x += p.vx;
          p.y += p.vy;

          // Wind drift acceleration
          p.vx += 0.035;
          p.vy -= 0.055;

          // Turbulence/Noise offset
          p.x += Math.sin(p.y * 0.08) * 0.25;

          // Fade & Shrink
          p.size -= 0.09;
          p.alpha -= 0.015;

          if (p.size <= 0.2 || p.alpha <= 0) {
            p.dead = true;
            continue;
          }

          if (p.isEmber) {
            // Embers glow orange/yellow
            ctx.fillStyle = `rgba(255, ${Math.floor(100 + Math.random() * 110)}, 20, ${p.alpha})`;
            ctx.fillRect(p.x, p.y, p.size * 0.5, p.size * 0.5);
          } else {
            // Draw slice of image onto canvas
            ctx.globalAlpha = p.alpha;
            ctx.drawImage(img, p.sx, p.sy, blockSize, blockSize, p.x, p.y, p.size, p.size);
          }
        }
      }
      // Reset globalAlpha to default
      ctx.globalAlpha = 1.0;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Complete animation and remove canvas overlay
        canvas.remove();
        onComplete();
      }
    }

    requestAnimationFrame(animate);
  }
});

window.addEventListener("load", () => {
  fetch("https://frosty-term-384e.rohankrishna150.workers.dev/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      page: window.location.pathname,
      referrer: document.referrer,
      screen: `${screen.width}x${screen.height}`,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    })
  });
});



const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", function(){

    if(window.scrollY > 300){

        backToTop.style.opacity = "1";
        backToTop.style.visibility = "visible";

    }else{

        backToTop.style.opacity = "0";
        backToTop.style.visibility = "hidden";

    }

});

