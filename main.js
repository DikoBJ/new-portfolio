(() => {
    const section = document.querySelector('.horizontal-scroll-section');
    const dots = document.querySelectorAll('.pagination-dot');
    const description = document.querySelector('.slide-description');
    const readMoreBtn = document.querySelector('.read-more-btn');
    const backBtn = document.querySelector('.back-btn');
    const slides = document.querySelectorAll('.slide');
    const totalSlides = slides.length;

    let current = 0;
    let locked = false;
    let expanded = false;
    let wheelTimeout = null;
    let accumulated = 0;
    const LOCK_DURATION = 750;
    const DELTA_THRESHOLD = 30;

    const descriptions = [
        `Console software was developed and designed for the lighting controllers monitoring system.`,
        `Hotel Texel Den Burg is live and taking bookings.<br>Proud to have designed and built this one from scratch.`,
        `Encolor — a standalone site for a luxury lighting product,<br>designed for the customers who notice the details.`
    ];

    const bgColors = [
        { rgb: [14, 65, 97] },
        { rgb: [26, 61, 46] },
        { rgb: [107, 74, 110] }
    ];

    const readMoreColors = ['#0e4161', '#1a3d2e', '#6b4a6e'];

    function applyBg(index) {
        const c = bgColors[index];
        document.body.style.background = `rgb(${c.rgb.join(',')})`;
        document.documentElement.style.setProperty('--read-more-color', readMoreColors[index]);
    }

    const TELEPORT_FADE_MS = 220;

    function updateSlideStates() {
        const n = totalSlides;
        slides.forEach((slide, i) => {
            let logical = ((i - current) % n + n) % n;
            if (logical > n / 2) logical -= n;

            const prevLogical = slide.dataset.logical !== undefined
                ? Number(slide.dataset.logical)
                : logical;
            slide.dataset.logical = logical;

            const devices = slide.querySelector('.slide-devices');
            const needsTeleport = Math.abs(logical - prevLogical) > 1;

            const setClasses = () => {
                slide.classList.remove('is-active', 'is-prev', 'is-next', 'is-far');
                if (logical === 0) slide.classList.add('is-active');
                else if (logical === -1) slide.classList.add('is-prev');
                else if (logical === 1) slide.classList.add('is-next');
                else slide.classList.add('is-far');
            };

            if (needsTeleport) {
                // Bump a token so any still-pending teleport for this slide aborts.
                const token = (slide._teleportToken || 0) + 1;
                slide._teleportToken = token;

                // Phase 1 — fade the peek out at its current position.
                if (devices) {
                    devices.style.transition = `opacity ${TELEPORT_FADE_MS}ms ease`;
                    devices.style.opacity = '0';
                }

                // Phase 2 — snap slide + device to new side, then fade back in.
                setTimeout(() => {
                    if (slide._teleportToken !== token) return;

                    slide.style.transition = 'none';
                    if (devices) devices.style.transition = 'none';

                    slide.style.transform = `translateX(${logical * 100}vw)`;
                    setClasses();

                    // Force reflow so transform/class updates commit with no transition.
                    void slide.offsetWidth;
                    if (devices) void devices.offsetWidth;

                    slide.style.transition = '';
                    if (devices) {
                        devices.style.transition = '';
                        devices.style.opacity = '';
                    }
                }, TELEPORT_FADE_MS);
            } else {
                slide.style.transform = `translateX(${logical * 100}vw)`;
                setClasses();
            }
        });
    }

    function goTo(index) {
        if (expanded) return;
        const next = ((index % totalSlides) + totalSlides) % totalSlides;
        if (next === current) return;
        current = next;

        applyBg(current);
        updateSlideStates();

        dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
        description.innerHTML = descriptions[current];
    }

    function updateBackBtnContrast() {
        if (!expanded) {
            backBtn.classList.remove('on-dark');
            return;
        }
        const detail = slides[current].querySelector('.detail-sections');
        if (!detail) return;

        const btnRect = backBtn.getBoundingClientRect();
        const btnMidY = btnRect.top + btnRect.height / 2;
        const detailRect = detail.getBoundingClientRect();

        // Still over the colored slide background (detail-sections hasn't reached the button)
        if (detailRect.top > btnRect.bottom) {
            backBtn.classList.add('on-dark');
            return;
        }

        // Check which detail-block is currently crossing the back button
        const blocks = slides[current].querySelectorAll('.detail-block');
        let blockAtBtn = null;
        for (const block of blocks) {
            const r = block.getBoundingClientRect();
            if (r.top <= btnMidY && r.bottom >= btnMidY) {
                blockAtBtn = block;
                break;
            }
        }

        // Dark blocks (design-system on Console, retrospective on Texel/Encolor) need a white icon
        const isDarkBlock = blockAtBtn && (
            blockAtBtn.classList.contains('block-design-system') ||
            blockAtBtn.classList.contains('block-retrospective')
        );
        if (isDarkBlock) {
            backBtn.classList.add('on-dark');
        } else {
            backBtn.classList.remove('on-dark');
        }
    }

    function expand() {
        if (expanded) return;
        expanded = true;

        slides[current].classList.add('active-detail');
        section.classList.add('expanded');
        backBtn.classList.add('on-dark');

        requestAnimationFrame(() => {
            section.scrollTo({ top: 0, behavior: 'instant' });
            const detail = slides[current].querySelector('.detail-sections');
            if (detail) {
                setTimeout(() => {
                    detail.scrollIntoView({ behavior: 'smooth' });
                }, 80);
            }
        });
    }

    function collapse() {
        if (!expanded) return;

        section.scrollTo({ top: 0, behavior: 'smooth' });

        setTimeout(() => {
            expanded = false;
            section.classList.remove('expanded');
            const activeSlide = slides[current];
            activeSlide.classList.remove('active-detail');
            backBtn.classList.remove('on-dark');
            updateSlideStates();

            // Re-entry animation: section drives the corner icons + footer,
            // active slide drives its own header + device.
            activeSlide.classList.add('is-returning');
            section.classList.add('is-returning');

            // Collapse is usually triggered by an upward fling; its trailing
            // momentum would otherwise hit the slide wheel handler and flip
            // to another slide. Lock the wheel so we stay on this one.
            wheelLocked = true;
            wheelLockedAt = performance.now();
            accumulated = 0;
            scheduleWheelUnlock();

            setTimeout(() => {
                activeSlide.classList.remove('is-returning');
                section.classList.remove('is-returning');
            }, 900);
        }, 500);
    }

    applyBg(0);
    updateSlideStates();

    readMoreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        expand();
    });

    backBtn.addEventListener('click', () => {
        collapse();
    });

    section.addEventListener('scroll', () => {
        updateBackBtnContrast();
    }, { passive: true });

    window.addEventListener('resize', updateBackBtnContrast);

    // Scroll-up-to-collapse: when already at the top of the detail view and the
    // user keeps pulling upward (wheel or swipe), trigger the same collapse as
    // the back button. Requires accumulated intent so a stray flick doesn't fire.
    const COLLAPSE_PULL_THRESHOLD = 90;
    let collapsePullAccum = 0;
    let collapsePullTimeout = null;

    const resetCollapsePull = () => {
        collapsePullAccum = 0;
        clearTimeout(collapsePullTimeout);
    };

    window.addEventListener('wheel', (e) => {
        if (!expanded) return;
        if (section.scrollTop > 2 || e.deltaY >= 0) {
            resetCollapsePull();
            return;
        }
        collapsePullAccum += -e.deltaY;
        clearTimeout(collapsePullTimeout);
        collapsePullTimeout = setTimeout(resetCollapsePull, 220);
        if (collapsePullAccum >= COLLAPSE_PULL_THRESHOLD) {
            resetCollapsePull();
            collapse();
        }
    }, { passive: true });

    let collapseTouchStartY = 0;
    let collapseTouchStartScrollTop = 0;
    window.addEventListener('touchstart', (e) => {
        if (!expanded) return;
        collapseTouchStartY = e.touches[0].clientY;
        collapseTouchStartScrollTop = section.scrollTop;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (!expanded) return;
        if (collapseTouchStartScrollTop > 2) return;
        if (section.scrollTop > 2) return;
        const diffY = e.changedTouches[0].clientY - collapseTouchStartY;
        if (diffY > 80) collapse();
    }, { passive: true });

    // After a slide change, suppress the wheel until either the wheel has
    // been quiet for WHEEL_IDLE_GAP (fling has died) or we've been locked
    // for WHEEL_MAX_LOCK (fallback so a continuous wheel scroll can't get
    // stuck). LOCK_MIN keeps a small floor so the transition can finish.
    const WHEEL_IDLE_GAP = 90;
    const WHEEL_LOCK_MIN = 450;
    const WHEEL_MAX_LOCK = 1000;

    let wheelLocked = false;
    let wheelLockedAt = 0;
    let wheelIdleTimer = null;

    const endWheelLock = () => {
        wheelLocked = false;
        accumulated = 0;
    };

    const scheduleWheelUnlock = () => {
        const now = performance.now();
        const sinceLock = now - wheelLockedAt;
        const minRemain = Math.max(0, WHEEL_LOCK_MIN - sinceLock);
        const maxRemain = Math.max(0, WHEEL_MAX_LOCK - sinceLock);
        const delay = Math.min(Math.max(WHEEL_IDLE_GAP, minRemain), maxRemain);
        clearTimeout(wheelIdleTimer);
        wheelIdleTimer = setTimeout(endWheelLock, delay);
    };

    window.addEventListener('wheel', (e) => {
        if (expanded) return;
        e.preventDefault();

        if (wheelLocked || locked) {
            scheduleWheelUnlock();
            return;
        }

        accumulated += e.deltaY;

        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => { accumulated = 0; }, 200);

        if (Math.abs(accumulated) < DELTA_THRESHOLD) return;

        locked = true;
        wheelLocked = true;
        wheelLockedAt = performance.now();
        accumulated = 0;

        if (e.deltaY > 0) goTo(current + 1);
        else goTo(current - 1);

        setTimeout(() => { locked = false; }, LOCK_DURATION);
        scheduleWheelUnlock();
    }, { passive: false });

    dots.forEach((dot) => {
        dot.addEventListener('click', () => {
            if (locked || expanded) return;
            locked = true;
            goTo(Number(dot.dataset.index));
            setTimeout(() => { locked = false; }, LOCK_DURATION);
        });
    });

    window.addEventListener('keydown', (e) => {
        if (expanded) {
            if (e.key === 'Escape') collapse();
            return;
        }
        const isPrev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
        const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';
        if (!isPrev && !isNext) return;
        e.preventDefault();
        if (locked) return;
        locked = true;
        goTo(current + (isNext ? 1 : -1));
        setTimeout(() => { locked = false; }, LOCK_DURATION);
    });

    let touchStartX = 0;
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (locked || expanded) return;
        const diffX = touchStartX - e.changedTouches[0].clientX;
        const diffY = touchStartY - e.changedTouches[0].clientY;
        // Require a mostly-horizontal swipe; ignore vertical gestures so scroll-intent
        // or pinch-like motions don't flip slides.
        if (Math.abs(diffX) < 50) return;
        if (Math.abs(diffX) < Math.abs(diffY) * 1.2) return;
        locked = true;
        if (diffX > 0) goTo(current + 1);
        else goTo(current - 1);
        setTimeout(() => { locked = false; }, LOCK_DURATION);
    }, { passive: true });

    document.querySelectorAll('.ipad-stack').forEach((stack) => {
        const frames = Array.from(stack.querySelectorAll('.ipad-mockup'));
        if (!frames.length) return;

        const block = stack.closest('.detail-block');
        const arrows = block ? block.querySelectorAll('.nav-arrow') : [];
        if (arrows.length < 2) return;

        const [prevBtn, nextBtn] = arrows;
        const N = frames.length;
        let index = 0;

        const POS_CLASSES = ['pos-front', 'pos-mid', 'pos-back', 'pos-behind'];

        const render = () => {
            frames.forEach((frame, i) => {
                frame.classList.remove(...POS_CLASSES);
                const offset = ((i - index) % N + N) % N;
                if (offset === 0) frame.classList.add('pos-front');
                else if (offset === 1) frame.classList.add('pos-mid');
                else if (offset === 2) frame.classList.add('pos-back');
                else frame.classList.add('pos-behind');
            });
        };

        render();

        nextBtn.addEventListener('click', () => {
            index = (index + 1) % N;
            render();
        });

        prevBtn.addEventListener('click', () => {
            index = (index - 1 + N) % N;
            render();
        });
    });
})();
