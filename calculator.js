(function () {
    'use strict';

    // ===== Default Assumptions =====
    const DEFAULTS = {
        a_1yrSP: 35, a_3yrSP: 55, a_1yrRI: 40, a_3yrRI: 60,
        a_gsp30: 22, a_gri30: 25, a_gsp1yr: 30, a_gri1yr: 35, a_moneyback: 85,
        a_ppa1: 5, a_ppa2: 7, a_ppa3: 10, a_ppa4: 13, a_ppaPremium: 2
    };

    const STABILITY = {
        steady:   { steadyPct: 0.70, variablePct: 0.20, uncoverable: 0.10 },
        growing:  { steadyPct: 0.50, variablePct: 0.30, uncoverable: 0.20 },
        variable: { steadyPct: 0.30, variablePct: 0.35, uncoverable: 0.35 }
    };

    const $ = (id) => document.getElementById(id);
    const monthlyInput = $('monthlySpend');
    const monthlySlider = $('monthlySpendSlider');
    const coverageSlider = $('currentCoverage');
    const coverageDisplay = $('coverageDisplay');
    const stressSlider = $('stressSlider');
    const stressValue = $('stressValue');
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    let savingsChart = null;
    let stressChart = null;
    let stability = 'steady';

    // ===== Helpers =====
    function fmtFull(n) {
        var abs = Math.abs(Math.round(n));
        var str = abs.toLocaleString('en-US');
        var prefix = n < 0 ? '\u2212\u0024' : '\u0024';
        return prefix + str;
    }
    function pct(n) { return (n * 100).toFixed(1) + '%'; }
    function parseSpend(str) { return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0; }
    function getA(id) {
        const el = $(id);
        return el ? parseFloat(el.value) / 100 : DEFAULTS[id] / 100;
    }

    // ===== Core Calculation =====
    function calculate() {
        const monthly = parseSpend(monthlyInput.value);
        const annual = monthly * 12;
        const currentCoverage = parseInt(coverageSlider.value, 10) / 100;
        const profile = STABILITY[stability];
        const uncoveredAnnual = annual * (1 - currentCoverage);

        const steadySpend = uncoveredAnnual * profile.steadyPct;
        const variableSpend = uncoveredAnnual * profile.variablePct;
        const uncoverableSpend = uncoveredAnnual * profile.uncoverable;

        const r1yrSP = getA('a_1yrSP');
        const rGsp30 = getA('a_gsp30');
        const rGri30 = getA('a_gri30');
        const rGsp1yr = getA('a_gsp1yr');

        // Strategy A: Stay Flexible — all insured 30-day terms
        const committable = steadySpend + variableSpend;
        const gspPortion = committable * 0.6;
        const griPortion = committable * 0.4;
        const flexGSPSavings = gspPortion * rGsp30;
        const flexGRISavings = griPortion * rGri30;
        const flexTotalSavings = flexGSPSavings + flexGRISavings;
        const flexAnnualCost = annual - flexTotalSavings;
        const flexNetRate = annual > 0 ? flexTotalSavings / annual : 0;

        // Strategy B: Blended — native SP for steady + Archera GSP for variable
        const blendNativeSavings = steadySpend * r1yrSP;
        const blendArcheraSavings = variableSpend * rGsp1yr;
        const blendTotalSavings = blendNativeSavings + blendArcheraSavings;
        const blendAnnualCost = annual - blendTotalSavings;
        const blendNetRate = annual > 0 ? blendTotalSavings / annual : 0;

        // Strategy C: PPA / EDP
        const ppaTier = getPPATier(annual);
        const ppaPremium = getA('a_ppaPremium');
        const ppaGrossSavings = annual * ppaTier.rate;
        const ppaPremiumCost = annual * ppaPremium;
        const ppaNetSavings = ppaGrossSavings - ppaPremiumCost;
        const ppaNetRate = annual > 0 ? ppaNetSavings / annual : 0;
        const ppaShortfallProtection = annual * 0.20;

        const ppaNote = $('ppaNote');
        const ppaCard = $('ppaCard');
        if (annual < 500000) {
            ppaCard.style.opacity = '0.5';
            ppaNote.hidden = false;
        } else {
            ppaCard.style.opacity = '1';
            ppaNote.hidden = true;
        }

        $('flexSavings').textContent = fmtFull(flexTotalSavings);
        $('flexRate').textContent = pct(flexNetRate);
        $('flexCost').textContent = fmtFull(flexAnnualCost);
        $('flexGSP').textContent = fmtFull(flexGSPSavings) + '/yr saved';
        $('flexGRI').textContent = fmtFull(flexGRISavings) + '/yr saved';

        $('blendSavings').textContent = fmtFull(blendTotalSavings);
        $('blendRate').textContent = pct(blendNetRate);
        $('blendCost').textContent = fmtFull(blendAnnualCost);
        $('blendNative').textContent = fmtFull(blendNativeSavings) + '/yr saved';
        $('blendArchera').textContent = fmtFull(blendArcheraSavings) + '/yr saved';
        $('blendOD').textContent = fmtFull(uncoverableSpend) + '/yr';

        $('ppaSavings').textContent = fmtFull(Math.max(0, ppaNetSavings));
        $('ppaRate').textContent = pct(Math.max(0, ppaNetRate));
        $('ppaTier').textContent = ppaTier.label;
        $('ppaDiscount').textContent = fmtFull(ppaGrossSavings) + '/yr saved';
        $('ppaPremiumCost').textContent = '−' + fmtFull(ppaPremiumCost) + '/yr';
        $('ppaProtection').textContent = 'Up to ' + fmtFull(ppaShortfallProtection);

        updateSavingsChart(flexTotalSavings, blendTotalSavings, Math.max(0, ppaNetSavings), annual);
        updateStressTest();
    }

    function getPPATier(annual) {
        const r1 = getA('a_ppa1'), r2 = getA('a_ppa2'), r3 = getA('a_ppa3'), r4 = getA('a_ppa4');
        if (annual >= 10000000) return { rate: r4, label: '$10M+ (' + (r4 * 100).toFixed(0) + '%)' };
        if (annual >= 5000000)  return { rate: r3, label: '$5M–$10M (' + (r3 * 100).toFixed(0) + '%)' };
        if (annual >= 1000000)  return { rate: r2, label: '$1M–$5M (' + (r2 * 100).toFixed(0) + '%)' };
        if (annual >= 500000)   return { rate: r1, label: '$500K–$1M (' + (r1 * 100).toFixed(0) + '%)' };
        return { rate: 0, label: 'Below threshold' };
    }

    // ===== Savings Chart =====
    function updateSavingsChart(flex, blend, ppa, annual) {
        const ctx = $('savingsChart');
        const data = {
            labels: ['Stay Flexible\n(GSP + GRI)', 'Safety Net\n(Native + Archera)', 'PPA + Insurance'],
            datasets: [{
                label: 'Annual Savings',
                data: [flex, blend, ppa],
                backgroundColor: ['#00d4aa', '#00c9ff', '#a78bfa'],
                borderColor: ['#00d4aa', '#00c9ff', '#a78bfa'],
                borderWidth: 1,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        };
        const options = {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            return fmtFull(c.raw) + ' saved (' + pct(annual > 0 ? c.raw / annual : 0) + ' of spend)';
                        }
                    },
                    backgroundColor: '#111738', titleColor: '#f0f2f8', bodyColor: '#8b92b0',
                    borderColor: '#1a2150', borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#5a6180', callback: function (v) { return fmtFull(v); } },
                    grid: { color: 'rgba(26, 33, 80, 0.5)' }
                },
                x: { ticks: { color: '#8b92b0', font: { size: 11 } }, grid: { display: false } }
            }
        };
        if (savingsChart) {
            savingsChart.data = data; savingsChart.options = options; savingsChart.update();
        } else {
            savingsChart = new Chart(ctx, { type: 'bar', data, options });
        }
    }

    // ===== Stress Test =====
    function updateStressTest() {
        const monthly = parseSpend(monthlyInput.value);
        const annual = monthly * 12;
        const usageChange = parseInt(stressSlider.value, 10) / 100;
        const currentCoverage = parseInt(coverageSlider.value, 10) / 100;
        const profile = STABILITY[stability];
        const uncoveredAnnual = annual * (1 - currentCoverage);

        const steadySpend = uncoveredAnnual * profile.steadyPct;
        const variableSpend = uncoveredAnnual * profile.variablePct;
        const committable = steadySpend + variableSpend;

        const r1yrSP = getA('a_1yrSP');
        const rGsp30 = getA('a_gsp30');
        const rGri30 = getA('a_gri30');
        const rGsp1yr = getA('a_gsp1yr');
        const rMoneyback = getA('a_moneyback');
        const blendedFlexRate = (rGsp30 * 0.6) + (rGri30 * 0.4);

        // Strategy A: Flexible — moneyback on underutilization
        const flexBaseSavings = committable * blendedFlexRate;
        let flexStress;
        if (usageChange >= 0) {
            flexStress = flexBaseSavings;
        } else {
            const lostSavings = committable * Math.abs(usageChange) * blendedFlexRate;
            flexStress = flexBaseSavings - lostSavings + (lostSavings * rMoneyback);
        }

        // Strategy B: Blended — native has no protection, Archera portion has moneyback
        const nativeSavings = steadySpend * r1yrSP;
        const archeraSavings = variableSpend * rGsp1yr;
        let blendStress;
        if (usageChange >= 0) {
            blendStress = nativeSavings + archeraSavings;
        } else {
            const nativeLoss = steadySpend * Math.abs(usageChange) * r1yrSP;
            const archeraLoss = variableSpend * Math.abs(usageChange) * rGsp1yr;
            blendStress = nativeSavings + archeraSavings - nativeLoss - archeraLoss + (archeraLoss * rMoneyback);
        }

        // Strategy C: PPA with insurance
        const ppaTier = getPPATier(annual);
        const ppaPremium = getA('a_ppaPremium');
        const ppaGross = annual * ppaTier.rate;
        const ppaPremCost = annual * ppaPremium;
        let ppaStress;
        if (usageChange >= 0) {
            ppaStress = ppaGross - ppaPremCost;
        } else {
            const shortfallCost = annual * Math.abs(usageChange) * ppaTier.rate;
            ppaStress = ppaGross - ppaPremCost - shortfallCost + (shortfallCost * rMoneyback);
        }

        // Native-only baseline (no insurance)
        const nativeOnlyBase = committable * r1yrSP;
        let nativeOnlyStress;
        if (usageChange >= 0) {
            nativeOnlyStress = nativeOnlyBase;
        } else {
            nativeOnlyStress = nativeOnlyBase - (committable * Math.abs(usageChange) * r1yrSP);
        }

        const maxSavings = Math.max(Math.abs(flexStress), Math.abs(blendStress), Math.abs(ppaStress), Math.abs(nativeOnlyStress), 1);
        updateStressCard('stressFlex', 'stressFlexBar', flexStress, maxSavings);
        updateStressCard('stressBlend', 'stressBlendBar', blendStress, maxSavings);
        updateStressCard('stressPPA', 'stressPPABar', ppaStress, maxSavings);
        updateStressCard('stressNative', 'stressNativeBar', nativeOnlyStress, maxSavings);

        if (usageChange === 0) stressValue.textContent = '0% (no change)';
        else if (usageChange > 0) stressValue.textContent = '+' + (usageChange * 100).toFixed(0) + '% growth';
        else stressValue.textContent = (usageChange * 100).toFixed(0) + '% decline';

        updateStressChart(flexStress, blendStress, ppaStress, nativeOnlyStress);
    }

    function updateStressCard(valueId, barId, savings, maxSavings) {
        const el = $(valueId);
        const bar = $(barId);
        el.textContent = fmtFull(savings);
        el.className = 'stress-outcome ' + (savings > 0 ? 'positive' : savings < 0 ? 'negative' : 'neutral');
        bar.style.width = Math.min(100, (Math.abs(savings) / maxSavings) * 100) + '%';
        bar.style.backgroundColor = savings > 0 ? '#00d4aa' : savings < 0 ? '#ff5c6a' : '#ffb347';
    }

    function updateStressChart(flex, blend, ppa, native) {
        const ctx = $('stressChart');
        const data = {
            labels: ['Stay Flexible', 'Safety Net', 'PPA + Insurance', 'Native Only (no insurance)'],
            datasets: [{
                label: 'Net Savings Under Stress',
                data: [flex, blend, ppa, native],
                backgroundColor: [
                    flex >= 0 ? '#00d4aa' : '#ff5c6a', blend >= 0 ? '#00c9ff' : '#ff5c6a',
                    ppa >= 0 ? '#a78bfa' : '#ff5c6a', native >= 0 ? '#5a6180' : '#ff5c6a'
                ],
                borderRadius: 6, barPercentage: 0.6
            }]
        };
        const options = {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (c) => fmtFull(c.raw) },
                    backgroundColor: '#111738', titleColor: '#f0f2f8', bodyColor: '#8b92b0',
                    borderColor: '#1a2150', borderWidth: 1
                }
            },
            scales: {
                x: { ticks: { color: '#5a6180', callback: (v) => fmtFull(v) }, grid: { color: 'rgba(26, 33, 80, 0.5)' } },
                y: { ticks: { color: '#8b92b0', font: { size: 11 } }, grid: { display: false } }
            }
        };
        if (stressChart) {
            stressChart.data = data; stressChart.options = options; stressChart.update();
        } else {
            stressChart = new Chart(ctx, { type: 'bar', data, options });
        }
    }

    // ===== Event Handlers =====
    monthlyInput.addEventListener('input', function () {
        var val = parseSpend(this.value);
        monthlySlider.value = Math.min(val, 5000000);
        this.value = val.toLocaleString('en-US');
        calculate();
    });
    monthlySlider.addEventListener('input', function () {
        var val = parseInt(this.value, 10);
        monthlyInput.value = val.toLocaleString('en-US');
        calculate();
    });
    coverageSlider.addEventListener('input', function () {
        coverageDisplay.textContent = this.value + '%';
        calculate();
    });
    toggleBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            toggleBtns.forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-checked', 'false'); });
            btn.classList.add('active');
            btn.setAttribute('aria-checked', 'true');
            stability = btn.dataset.value;
            calculate();
        });
    });
    stressSlider.addEventListener('input', function () { updateStressTest(); });

    document.querySelectorAll('.breakdown-toggle').forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var content = toggle.nextElementSibling;
            var expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            content.hidden = expanded;
            toggle.querySelector('.chevron').style.transform = expanded ? '' : 'rotate(90deg)';
        });
        toggle.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); }
        });
    });

    $('toggleAssumptions').addEventListener('click', function () {
        var panel = $('assumptionsPanel');
        var expanded = !panel.hidden;
        panel.hidden = expanded;
        this.setAttribute('aria-expanded', String(!expanded));
    });

    document.querySelectorAll('.assumption-group input').forEach(function (input) {
        input.addEventListener('change', calculate);
    });

    $('resetAssumptions').addEventListener('click', function () {
        Object.keys(DEFAULTS).forEach(function (key) {
            var el = $(key);
            if (el) el.value = DEFAULTS[key];
        });
        calculate();
    });

    $('shareBtn').addEventListener('click', function () {
        var state = {
            s: parseSpend(monthlyInput.value),
            st: stability,
            c: coverageSlider.value,
            str: stressSlider.value
        };
        Object.keys(DEFAULTS).forEach(function (key) {
            var el = $(key);
            if (el && parseFloat(el.value) !== DEFAULTS[key]) state[key] = el.value;
        });
        var hash = btoa(JSON.stringify(state));
        var url = window.location.origin + window.location.pathname + '#' + hash;
        navigator.clipboard.writeText(url).then(function () {
            var toast = $('toast');
            toast.hidden = false;
            setTimeout(function () { toast.hidden = true; }, 2500);
        });
    });

    function loadFromHash() {
        if (!window.location.hash) return;
        try {
            var state = JSON.parse(atob(window.location.hash.slice(1)));
            if (state.s) {
                monthlyInput.value = state.s.toLocaleString('en-US');
                monthlySlider.value = Math.min(state.s, 5000000);
            }
            if (state.st) {
                stability = state.st;
                toggleBtns.forEach(function (b) {
                    b.classList.toggle('active', b.dataset.value === state.st);
                    b.setAttribute('aria-checked', String(b.dataset.value === state.st));
                });
            }
            if (state.c) { coverageSlider.value = state.c; coverageDisplay.textContent = state.c + '%'; }
            if (state.str) stressSlider.value = state.str;
            Object.keys(DEFAULTS).forEach(function (key) {
                if (state[key] !== undefined) { var el = $(key); if (el) el.value = state[key]; }
            });
        } catch (e) { /* invalid hash */ }
    }

    // ===== Init =====
    loadFromHash();
    calculate();

    // ===== Sticky Bar =====
    var stickyBar = $('stickyBar');
    var stickySpend = $('stickySpendSlider');
    var stickySpendVal = $('stickySpendValue');
    var stickyCoverage = $('stickyCoverageSlider');
    var stickyCoverageVal = $('stickyCoverageValue');
    var stickyStabilityEl = $('stickyStability');
    var step1El = $('step1');

    function fmtShort(n) {
        if (n >= 1000000) return '\u0024' + (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return '\u0024' + (n / 1000).toFixed(0) + 'K';
        return '\u0024' + n;
    }

    function syncStickyFromMain() {
        var val = parseSpend(monthlyInput.value);
        stickySpend.value = Math.min(val, 5000000);
        stickySpendVal.textContent = fmtShort(val);
        stickyCoverage.value = coverageSlider.value;
        stickyCoverageVal.textContent = coverageSlider.value + '%';
        var labels = { steady: 'Steady', growing: 'Growing', variable: 'Variable' };
        stickyStabilityEl.textContent = labels[stability] || 'Steady';
    }

    stickySpend.addEventListener('input', function () {
        var val = parseInt(this.value, 10);
        monthlyInput.value = val.toLocaleString('en-US');
        monthlySlider.value = val;
        stickySpendVal.textContent = fmtShort(val);
        calculate();
    });
    stickyCoverage.addEventListener('input', function () {
        coverageSlider.value = this.value;
        coverageDisplay.textContent = this.value + '%';
        stickyCoverageVal.textContent = this.value + '%';
        calculate();
    });

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    stickyBar.classList.remove('visible');
                } else {
                    syncStickyFromMain();
                    stickyBar.classList.add('visible');
                }
            });
        }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });
        observer.observe(step1El);
    }

    var origCalc = calculate;
    calculate = function () {
        origCalc();
        syncStickyFromMain();
    };
    calculate();
})();
