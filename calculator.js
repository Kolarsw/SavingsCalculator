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
        const annual = parseSpend(monthlyInput.value);
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
        $('flexGSP').textContent = fmtFull(flexGSPSavings) + ' saved';
        $('flexGRI').textContent = fmtFull(flexGRISavings) + ' saved';
        $('flexOnDemand').textContent = fmtFull(annual);
        $('flexProjected').textContent = fmtFull(flexAnnualCost);
        $('flexTotalSaved').textContent = fmtFull(flexTotalSavings);

        $('blendSavings').textContent = fmtFull(blendTotalSavings);
        $('blendRate').textContent = pct(blendNetRate);
        $('blendCost').textContent = fmtFull(blendAnnualCost);
        $('blendNative').textContent = fmtFull(blendNativeSavings) + ' saved';
        $('blendArchera').textContent = fmtFull(blendArcheraSavings) + ' saved';
        $('blendOD').textContent = fmtFull(uncoverableSpend);
        $('blendOnDemand').textContent = fmtFull(annual);
        $('blendProjected').textContent = fmtFull(blendAnnualCost);
        $('blendTotalSaved').textContent = fmtFull(blendTotalSavings);

        $('ppaSavings').textContent = fmtFull(Math.max(0, ppaNetSavings));
        $('ppaRate').textContent = pct(Math.max(0, ppaNetRate));
        $('ppaTier').textContent = ppaTier.label;
        $('ppaDiscount').textContent = fmtFull(ppaGrossSavings) + ' saved';
        $('ppaPremiumCost').textContent = fmtFull(ppaPremiumCost);
        $('ppaProtection').textContent = 'Up to ' + fmtFull(ppaShortfallProtection);
        $('ppaOnDemand').textContent = fmtFull(annual);
        $('ppaProjected').textContent = fmtFull(annual - Math.max(0, ppaNetSavings));
        $('ppaTotalSaved').textContent = fmtFull(Math.max(0, ppaNetSavings));

        // "What if usage drops 20%?" comparison — shows Archera's insurance value
        var dropPct = 0.20;
        var rMoneyback = getA('a_moneyback');

        // Card 1: Flex — native loses savings, Archera gets moneyback
        var nativeDropLoss = committable * dropPct * r1yrSP;
        var flexDropLoss = committable * dropPct * ((rGsp30 * 0.6) + (rGri30 * 0.4));
        var flexDropRecovery = flexDropLoss * rMoneyback;
        $('flexAwsDrop').textContent = fmtFull(nativeDropLoss) + ' at risk';
        $('flexArcheraDrop').textContent = fmtFull(flexDropRecovery) + ' risk mitigated';
        $('flexDifference').textContent = fmtFull(flexDropRecovery + nativeDropLoss) + ' in protected value';

        // Card 2: Blend — native portion loses, Archera portion gets moneyback
        var blendNativeDropLoss = steadySpend * dropPct * r1yrSP;
        var blendArcheraDropLoss = variableSpend * dropPct * rGsp1yr;
        var blendArcheraRecovery = blendArcheraDropLoss * rMoneyback;
        var blendTotalLossNativeOnly = (steadySpend + variableSpend) * dropPct * r1yrSP;
        $('blendAwsDrop').textContent = fmtFull(blendTotalLossNativeOnly) + ' at risk';
        $('blendArcheraDrop').textContent = fmtFull(blendArcheraRecovery) + ' risk mitigated';
        $('blendDifference').textContent = fmtFull(blendArcheraRecovery + blendTotalLossNativeOnly - blendNativeDropLoss) + ' in protected value';

        // Card 3: PPA — shortfall penalty vs insurance coverage
        var ppaShortfall = annual * dropPct;
        var ppaShortfallPenalty = ppaShortfall * ppaTier.rate;
        var ppaInsuranceCoverage = ppaShortfallPenalty * rMoneyback;
        $('ppaAwsDrop').textContent = fmtFull(ppaShortfallPenalty) + ' at risk';
        $('ppaArcheraDrop').textContent = fmtFull(ppaInsuranceCoverage) + ' risk mitigated';
        $('ppaDifference').textContent = fmtFull(ppaInsuranceCoverage) + ' in protected value';

        // Dynamic recommendation — weight by stability and spend level
        var flexScore = flexTotalSavings;
        var blendScore = blendTotalSavings;
        var ppaScore = annual >= 500000 ? Math.max(0, ppaNetSavings) : 0;

        if (stability === 'variable') { flexScore *= 1.4; blendScore *= 0.9; }
        if (stability === 'growing') { flexScore *= 1.15; }
        if (stability === 'steady' && annual >= 1000000) { ppaScore *= 1.3; }
        if (annual >= 5000000) { ppaScore *= 1.2; }

        var strategies = [
            { key: 'flexible', score: flexScore },
            { key: 'blended', score: blendScore },
            { key: 'ppa', score: ppaScore }
        ];
        strategies.sort(function (a, b) { return b.score - a.score; });
        var bestKey = strategies[0].key;

        document.querySelectorAll('.strategy-card').forEach(function (card) {
            var badge = card.querySelector('.featured-badge');
            if (card.dataset.strategy === bestKey) {
                card.classList.add('featured');
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'featured-badge';
                    badge.textContent = 'Recommended';
                    card.appendChild(badge);
                }
            } else {
                card.classList.remove('featured');
                if (badge) badge.remove();
            }
        });

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
            labels: ['Archera 30-Day\n(GSP + GRI)', 'Native + Archera\n(SP + GSP)', 'PPA Insurance'],
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
        const annual = parseSpend(monthlyInput.value);
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
            labels: ['Archera 30-Day', 'Native + Archera', 'PPA Insurance', 'Native Only (no insurance)'],
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
        monthlySlider.value = Math.min(val, 50000000);
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


    function loadFromHash() {
        if (!window.location.hash) return;
        try {
            var state = JSON.parse(atob(window.location.hash.slice(1)));
            if (state.s) {
                monthlyInput.value = state.s.toLocaleString('en-US');
                monthlySlider.value = Math.min(state.s, 50000000);
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
        stickySpend.value = Math.min(val, 50000000);
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

    window.addEventListener('scroll', function () {
        var rect = step1El.getBoundingClientRect();
        if (rect.bottom < 0) {
            if (!stickyBar.classList.contains('visible')) {
                syncStickyFromMain();
                stickyBar.classList.add('visible');
            }
        } else {
            stickyBar.classList.remove('visible');
        }
    });

    var origCalc = calculate;
    calculate = function () {
        origCalc();
        syncStickyFromMain();
    };
    calculate();
})();
