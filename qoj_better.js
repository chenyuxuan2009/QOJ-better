// ==UserScript==
// @name         QOJ Better
// @namespace    http://tampermonkey.net/
// @version      1.13
// @description  Make QOJ great again!
// @match        https://qoj.ac/*
// @match        https://jiang.ly/*
// @match        https://huang.lt/*
// @match        https://contest.ucup.ac/*
// @match        https://oj.qiuly.org/*
// @match        https://relia.uk/*
// @match        https://love.larunatre.cy/*
// @match        https://hate.larunatre.cy/*
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// @author       cyx
// ==/UserScript==

// 全局状态
window.onlyUCUPTeams = false;
window.cachedProblemIndices = null;

const RATING_CONFIG = { BASE: 4100, K: 950 };

const DOMAIN_OPTIONS = [
    { host: 'qoj.ac', contestOnly: false },
    { host: 'jiang.ly', contestOnly: false },
    { host: 'huang.lt', contestOnly: false },
    { host: 'oj.qiuly.org', contestOnly: false },
    { host: 'relia.uk', contestOnly: false },
    { host: 'love.larunatre.cy', contestOnly: false },
    { host: 'hate.larunatre.cy', contestOnly: false },
    { host: 'contest.ucup.ac', contestOnly: true },
];

function isContestContext(pathname) {
    return (
        pathname.includes('/contest/') ||
        pathname.includes('/contests') ||
        pathname.includes('/user') ||
        pathname.includes('/results')
    );
}

function getDefaultGeneralVisibility() {
    const visibility = {};
    DOMAIN_OPTIONS.forEach(option => {
        visibility[option.host] = !option.contestOnly;
    });
    return visibility;
}

function getDefaultContestVisibility() {
    const visibility = {};
    DOMAIN_OPTIONS.forEach(option => {
        visibility[option.host] = option.contestOnly;
    });
    return visibility;
}

// 获取题号
function getProblemId() {
    const matchContest = location.pathname.match(/\/contest\/(\d+)\/problem\/(\d+)/);
    if (matchContest) return matchContest[2];
    const matchProblem = location.pathname.match(/\/problem\/(\d+)/);
    if (matchProblem) return matchProblem[1];
    return null;
}

// 获取用户名
function getUsername() {
    const userLink = document.querySelector('a.dropdown-item[href*="/user/profile/"]');
    if (userLink) {
        const match = userLink.href.match(/\/user\/profile\/([^/?#]+)/);
        if (match) return match[1];
    }
    return null;
}

function switchDomain() {
    if (document.getElementById('domain-switcher')) return;
    const currentHost = location.host;
    const pathname = location.pathname + location.search + location.hash;
    const isContest = isContestContext(pathname);
    const candidateDomains = DOMAIN_OPTIONS.map(option => option.host);
    const generalVisibility = settings.domainVisibility && settings.domainVisibility.general
        ? settings.domainVisibility.general
        : getDefaultGeneralVisibility();
    const contestVisibility = settings.domainVisibility && settings.domainVisibility.contestOnly
        ? settings.domainVisibility.contestOnly
        : getDefaultContestVisibility();
    const domains = candidateDomains.filter(domain => {
        if (generalVisibility[domain]) return true;
        if (isContest && contestVisibility[domain]) return true;
        return false;
    });
    if (domains.length === 0) return;

    // 构造域名切换内容
    const span = document.createElement('span');
    span.id = 'domain-switcher';
    span.style.fontSize = '0.9em';
    span.style.color = '#666';
    span.textContent = 'switch to: ';

    domains.forEach((domain, i) => {
        const link = document.createElement('a');
        link.textContent = domain;
        link.style.marginLeft = '4px';
        link.style.color = domain === currentHost ? '#999' : '#007bff';
        link.style.cursor = domain === currentHost ? 'default' : 'pointer';
        link.style.textDecoration = 'none';
        link.onmouseover = () => (link.style.textDecoration = 'underline');
        link.onmouseout = () => (link.style.textDecoration = 'none');
        if (domain !== currentHost) {
            link.onclick = () => (window.location.href = `https://${domain}${pathname}`);
        }
        span.appendChild(link);
        if (i < domains.length - 1) span.append(' ');
    });

    // 优先尝试插入到顶部的 float-right nav（登录区域）
    const navPills = document.querySelector('.nav.nav-pills.float-right');
    if (navPills && !navPills.querySelector('#domain-switcher')) {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.appendChild(span);
        navPills.insertBefore(li, navPills.firstChild);
        return;
    }

    // 如果有登录的用户（navbar 中的 dropdown-toggle）
    const navbarUser = document.querySelector('.navbar .nav-link.dropdown-toggle');
    if (navbarUser) {
        const parentUl = navbarUser.closest('ul');
        if (parentUl && !parentUl.querySelector('#domain-switcher')) {
            const li = document.createElement('li');
            li.style.listStyle = 'none';
            li.appendChild(span);

            const userLi = navbarUser.closest('li');
            if (userLi && userLi.parentElement) {
                userLi.parentElement.insertBefore(li, userLi);
            }
        }
        return;
    }

    document.body.insertBefore(span, document.body.firstChild);
}

// ========== 设置功能 ==========

const DEFAULT_SETTINGS = {
    showRatings: true,
    showPerformance: true,
    onlyUcupTeams: false,
    showDomainSwitcher: true,
    domainVisibility: null,
    addBackButton: true,
    addViewSubmissions: true,
    addViewInContest: true,
    addAcTag: true,
    addVoteViewer: true,
    addFbJump: true,
};

let settings = {};

function loadSettings() {
    try {
        let storedSettingsStr = null;
        if (typeof GM_getValue !== 'undefined') {
            storedSettingsStr = GM_getValue('qojBetterSettings');
        }
        if (!storedSettingsStr) {
            storedSettingsStr = localStorage.getItem('qojBetterSettings');
        }
        const storedSettings = storedSettingsStr ? JSON.parse(storedSettingsStr) : {};
        settings = { ...DEFAULT_SETTINGS, ...storedSettings };
        if (settings.domainVisibility) {
            settings.domainVisibility = {
                general: {
                    ...getDefaultGeneralVisibility(),
                    ...(settings.domainVisibility.general || {}),
                },
                contestOnly: {
                    ...getDefaultContestVisibility(),
                    ...(settings.domainVisibility.contestOnly || {}),
                },
            };
        }
    } catch {
        settings = { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    const data = JSON.stringify(settings);
    if (typeof GM_setValue !== 'undefined') {
        GM_setValue('qojBetterSettings', data);
    }
    localStorage.setItem('qojBetterSettings', data);
}

function createSettingsModal() {
    if (document.getElementById('qoj-settings-modal')) return;

    const modalHtml = `
        <div id="qoj-settings-modal" style="display:none; position:fixed; z-index:1050; top:0; left:0; width:100%; height:100%; overflow:auto; background-color:rgba(0,0,0,0.4);">
            <div style="background-color:#fefefe; margin:10% auto; padding:20px; border:1px solid #888; border-radius: 5px; width:80%; max-width:600px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:20px;">
                    <h4 style="margin:0;">QOJ Better Settings</h4>
                    <span id="qoj-settings-close" style="color:#aaa; font-size:28px; font-weight:bold; cursor:pointer;">&times;</span>
                </div>
                <div>
                    <p><strong>General</strong></p>
                    <label><input type="checkbox" id="setting-showDomainSwitcher"> Show mirror switcher</label><br>
                    <div id="qoj-domain-settings" style="margin: 10px 0 0 20px;">
                        <div style="font-size: 0.85em; color: #888; margin: 6px 0 4px;">General</div>
                        <div id="qoj-domain-list-general"></div>
                        <div style="font-size: 0.85em; color: #888; margin: 8px 0 4px;">Contest only</div>
                        <div id="qoj-domain-list-contest"></div>
                    </div>
                    <hr>
                    <p><strong>Problems</strong></p>
                    <label><input type="checkbox" id="setting-addViewSubmissions"> Add view-my-submissions link</label><br>
                    <label><input type="checkbox" id="setting-addViewInContest"> Show view-in-contest link on problem pages</label><br>
                    <label><input type="checkbox" id="setting-addAcTag"> Add Accepted badge for full score</label><br>
                    <hr>
                    <p><strong>Contests</strong></p>
                    <label><input type="checkbox" id="setting-addBackButton"> Add back link on contest problem pages</label><br>
                    <hr>
                    <p><strong>Standings</strong></p>
                    <label><input type="checkbox" id="setting-addFbJump"> Enable Click on problem header to jump to First Blood</label><br>
                    <label><input type="checkbox" id="setting-showRatings"> Show problem difficulty</label><br>
                    <label style="margin-left: 20px;"><input type="checkbox" id="setting-onlyUcupTeams" data-depends-on="setting-showRatings"> Difficulty only counts UCUP teams</label><br>
                    <label><input type="checkbox" id="setting-showPerformance"> Show performance (GP30)</label><br>
                    <hr>
                    <p><strong>Profile</strong></p>
                    <label><input type="checkbox" id="setting-addVoteViewer"> Add authored problems vote viewer</label><br>
                </div>
                <div style="text-align:right; margin-top:20px;">
                    <button id="qoj-settings-cancel" style="padding: 8px 15px; background-color: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 8px;">Cancel</button>
                    <button id="qoj-settings-save" style="padding: 8px 15px; background-color: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">Save</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const renderDomainCheckboxes = () => {
        const generalContainer = document.getElementById('qoj-domain-list-general');
        const contestContainer = document.getElementById('qoj-domain-list-contest');
        if (!generalContainer || !contestContainer) return;
        generalContainer.innerHTML = '';
        contestContainer.innerHTML = '';
        DOMAIN_OPTIONS.forEach(option => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.domain = option.host;
            checkbox.id = `setting-domain-general-${option.host.replace(/\./g, '-')}`;
            label.appendChild(checkbox);
            label.append(` ${option.host}`);
            generalContainer.appendChild(label);
            generalContainer.appendChild(document.createElement('br'));
            const contestLabel = document.createElement('label');
            const contestCheckbox = document.createElement('input');
            contestCheckbox.type = 'checkbox';
            contestCheckbox.dataset.domain = option.host;
            contestCheckbox.id = `setting-domain-contest-${option.host.replace(/\./g, '-')}`;
            contestLabel.appendChild(contestCheckbox);
            contestLabel.append(` ${option.host}`);
            contestContainer.appendChild(contestLabel);
            contestContainer.appendChild(document.createElement('br'));
        });
    };

    // --- Bind events ---
    const updateDependencies = () => {
        document.querySelectorAll('#qoj-settings-modal input[data-depends-on]').forEach(child => {
            const parent = document.getElementById(child.getAttribute('data-depends-on'));
            if (parent) child.disabled = !parent.checked;
        });
        const switcherToggle = document.getElementById('setting-showDomainSwitcher');
        const domainInputs = document.querySelectorAll('#qoj-domain-settings input[type="checkbox"]');
        if (switcherToggle) {
            domainInputs.forEach(cb => {
                cb.disabled = !switcherToggle.checked;
            });
        }
    };

    document.getElementById('qoj-settings-close').onclick = () => {
        document.getElementById('qoj-settings-modal').style.display = 'none';
    };

    document.getElementById('qoj-settings-cancel').onclick = () => {
        document.getElementById('qoj-settings-modal').style.display = 'none';
    };

    document.querySelectorAll('#qoj-settings-modal input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', updateDependencies);
    });

    document.getElementById('qoj-settings-save').onclick = () => {
        settings.showRatings = document.getElementById('setting-showRatings').checked;
        settings.showPerformance = document.getElementById('setting-showPerformance').checked;
        settings.onlyUcupTeams = document.getElementById('setting-onlyUcupTeams').checked;
        settings.showDomainSwitcher = document.getElementById('setting-showDomainSwitcher').checked;
        const domainVisibility = {
            general: {},
            contestOnly: {},
        };
        document.querySelectorAll('#qoj-domain-list-general input[type="checkbox"]').forEach(cb => {
            domainVisibility.general[cb.dataset.domain] = cb.checked;
        });
        document.querySelectorAll('#qoj-domain-list-contest input[type="checkbox"]').forEach(cb => {
            domainVisibility.contestOnly[cb.dataset.domain] = cb.checked;
        });
        settings.domainVisibility = domainVisibility;
        settings.addBackButton = document.getElementById('setting-addBackButton').checked;
        settings.addViewSubmissions = document.getElementById('setting-addViewSubmissions').checked;
        settings.addViewInContest = document.getElementById('setting-addViewInContest').checked;
        settings.addAcTag = document.getElementById('setting-addAcTag').checked;
        settings.addVoteViewer = document.getElementById('setting-addVoteViewer').checked;
        settings.addFbJump = document.getElementById('setting-addFbJump').checked;

        saveSettings();
        document.getElementById('qoj-settings-modal').style.display = 'none';
        alert('Settings saved. Some changes may require a refresh.');
        // Force re-render
        window.qojBetterInitialized = false;
        lastUrl = '';
        scheduleMainAndCalc();
    };

    // Sync checkbox states when opening
    const modal = document.getElementById('qoj-settings-modal');
    const observer = new MutationObserver(() => {
        if (modal.style.display === 'block') {
            document.getElementById('setting-showRatings').checked = settings.showRatings;
            document.getElementById('setting-showPerformance').checked = settings.showPerformance;
            document.getElementById('setting-onlyUcupTeams').checked = settings.onlyUcupTeams;
            document.getElementById('setting-showDomainSwitcher').checked = settings.showDomainSwitcher;
            const defaultGeneral = getDefaultGeneralVisibility();
            const defaultContest = getDefaultContestVisibility();
            document.querySelectorAll('#qoj-domain-list-general input[type="checkbox"]').forEach(cb => {
                const domain = cb.dataset.domain;
                if (settings.domainVisibility && settings.domainVisibility.general) {
                    cb.checked = settings.domainVisibility.general[domain] !== false;
                } else {
                    cb.checked = defaultGeneral[domain] !== false;
                }
            });
            document.querySelectorAll('#qoj-domain-list-contest input[type="checkbox"]').forEach(cb => {
                const domain = cb.dataset.domain;
                if (settings.domainVisibility && settings.domainVisibility.contestOnly) {
                    cb.checked = settings.domainVisibility.contestOnly[domain] !== false;
                } else {
                    cb.checked = defaultContest[domain] !== false;
                }
            });
            document.getElementById('setting-addBackButton').checked = settings.addBackButton;
            document.getElementById('setting-addViewSubmissions').checked = settings.addViewSubmissions;
            document.getElementById('setting-addViewInContest').checked = settings.addViewInContest;
            document.getElementById('setting-addAcTag').checked = settings.addAcTag;
            document.getElementById('setting-addVoteViewer').checked = settings.addVoteViewer;
            document.getElementById('setting-addFbJump').checked = settings.addFbJump;

            updateDependencies();
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });

    renderDomainCheckboxes();
}

function addSettingsButton() {
    if (document.getElementById('qoj-settings-btn')) return;

    const li = document.createElement('li');
    li.className = 'nav-item';

    const button = document.createElement('a');
    button.id = 'qoj-settings-btn';
    button.href = 'javascript:void(0);';
    button.innerHTML = '<span class="glyphicon glyphicon-cog"></span> QOJ Better Settings';
    button.className = 'nav-link';
    button.onclick = () => {
        document.getElementById('qoj-settings-modal').style.display = 'block';
    };

    li.appendChild(button);

    const navList = document.querySelector('.navbar .nav.navbar-nav.mr-auto.navbar-transparent');
    if (navList) {
        const lastItem = navList.querySelector('li.nav-item:last-of-type');
        if (lastItem && lastItem.nextSibling) {
            navList.insertBefore(li, lastItem.nextSibling);
        } else {
            navList.appendChild(li);
        }
    } else {
        const navbarUser = document.querySelector('.nav-link.dropdown-toggle');
        if (!navbarUser) return;
        const parentUl = navbarUser.closest('ul.navbar-nav, ul.nav');
        if (!parentUl) return;
        parentUl.insertBefore(li, navbarUser.closest('li'));
    }

    createSettingsModal();
}

// ========== UCUP 评分功能 ==========

function getMultiplier(x) {
    if (x <= 20) return 1.0;
    if (x <= 40) return 1.01;
    if (x <= 60) return 1.03;
    if (x <= 70) return 1.05;
    if (x <= 80) return 1.08;
    if (x <= 90) return 1.12;
    if (x <= 95) return 1.20;
    if (x === 96) return 1.30;
    if (x === 97) return 1.50;
    if (x === 98) return 1.80;
    if (x === 99) return 2.50;
    if (x >= 100) return 3.50;
    return 1.0;
}

function getStyle(r) {
    if (r >= 3000) return '#AA0000';
    if (r >= 2600) return '#FF3333';
    if (r >= 2400) return '#FF7777';
    if (r >= 2100) return '#FFBB55';
    if (r >= 1900) return '#FF88FF';
    if (r >= 1600) return '#AAAAFF';
    if (r >= 1400) return '#03A89E';
    return '#77FF77';
}

function isProblemHeader(text) {
    if (!text) return false;
    text = text.trim();
    return /^[A-Z][0-9]?($|[\s\n\(\)])/.test(text);
}

function getProblemIndices() {
    // 如果已缓存，返回缓存的值
    if (window.cachedProblemIndices !== null) {
        return window.cachedProblemIndices;
    }

    const table = document.querySelector('table');
    if (!table) return [];

    let headerRow = table.querySelector('thead tr') || table.rows[0];
    if (!headerRow) return [];

    const cells = Array.from(headerRow.cells);
    const problemIndices = [];

    cells.forEach((cell, idx) => {
        const text = cell.innerText || cell.textContent;
        if (isProblemHeader(text)) {
            problemIndices.push(idx);
        }
    });

    // 缓存起来
    if (problemIndices.length > 0) {
        window.cachedProblemIndices = problemIndices;
    }

    return problemIndices;
}

function calculateRatings() {
    const table = document.querySelector('table');
    if (!table) return;

    let headerRow = table.querySelector('thead tr') || table.rows[0];
    if (!headerRow) return;

    if (typeof standings === 'undefined' || !Array.isArray(standings)) return;
    if (typeof score === 'undefined' || typeof score !== 'object') return;

    const problemIndices = getProblemIndices();
    if (problemIndices.length === 0) return;

    const isUCUPOnly = settings.onlyUcupTeams;
    let totalParticipants = 0;
    const acCounts = new Int32Array(problemIndices.length);

    // 纯 JS 读取计算：抛弃了让浏览器的 event loop 切开碎步的机制，在 V8 里跑完千次判断小于 1 毫秒
    for (let i = 0; i < standings.length; i++) {
        const row = standings[i];
        if (!row || row.length < 3) continue;
        const userInfo = row[2];
        if (!userInfo) continue;
        const userId = userInfo[0];

        if (isUCUPOnly && !userId.startsWith('ucup-team')) {
            continue;
        }
        totalParticipants++;

        const userScores = score[userId];
        if (userScores) {
            for (let j = 0; j < problemIndices.length; j++) {
                if (userScores[j] && userScores[j][0] > 0) {
                    acCounts[j]++;
                }
            }
        }
    }

    // 集中所有 DOM 修改在一帧里。绝不能分成多次插入。
    requestAnimationFrame(() => {
        for (let j = 0; j < problemIndices.length; j++) {
            const columnIdx = problemIndices[j];
            const acCount = acCounts[j];
            let rating = 4000;

            if (totalParticipants > 0 && acCount > 0) {
                const acPercentage = (acCount / totalParticipants) * 100;
                const multiplier = getMultiplier(acPercentage);
                const estimatedTotal = acCount * multiplier;

                if (estimatedTotal > 1) {
                    rating = Math.round(RATING_CONFIG.BASE - RATING_CONFIG.K * Math.log10(estimatedTotal));
                    rating = Math.max(800, Math.min(4000, rating));
                }
            }

            const th = headerRow.cells[columnIdx];
            let badge = th.querySelector('.qoj-precise-rating');

            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'qoj-precise-rating';
                badge.style.cssText = 'display:block; font-size:12px; font-weight:bold; margin-bottom:4px; line-height:1; font-family:monospace;';
                th.insertBefore(badge, th.firstChild);
            }

            badge.innerText = rating;
            badge.style.color = getStyle(rating);

            if (acCount === 0 || totalParticipants === 0) {
                badge.title = `AC 数: 0\n评分: 4000（默认，暂无人通过）\n参赛队: ${totalParticipants}`;
            } else {
                const acPercentage = (acCount / totalParticipants) * 100;
                const estimatedTotal = acCount * getMultiplier(acPercentage);
                badge.title = `AC 数: ${acCount}\nAC 率: ${acPercentage.toFixed(1)}%\n补偿系数: ${getMultiplier(acPercentage).toFixed(2)}\n预测全场: ${estimatedTotal.toFixed(1)}\n参赛队: ${totalParticipants}`;
            }
        }
    });
}

const GP30_SCORES = [100, 75, 60, 50, 45, 40, 36, 32, 29, 26, 24, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function getGP30(rank) {
    if (rank >= 1 && rank <= 30) return GP30_SCORES[rank - 1];
    return 0;
}

function getPerfColor(perf) {
    if (perf >= 270) return '#AA0000';
    if (perf >= 240) return '#FF3333';
    if (perf >= 210) return '#FF7777';
    if (perf >= 175) return '#FFBB55';
    if (perf >= 145) return '#FF88FF';
    if (perf >= 110) return '#AAAAFF';
    if (perf >= 70) return '#03A89E';
    return '#77FF77';
}

function calculatePerformance() {
    if (!contest_type || contest_type !== 'ICPC') return;
    const table = document.querySelector('table');
    if (!table) return;

    let headerRow = table.querySelector('thead tr') || table.rows[0];
    if (!headerRow) return;

    if (typeof standings === 'undefined' || !Array.isArray(standings)) return;
    if (typeof score === 'undefined' || typeof score !== 'object') return;

    const problemIndices = getProblemIndices();
    if (problemIndices.length === 0) return;

    let teamsWithSolvesCount = 0;
    const validUserIds = [];
    const perfMap = new Map();

    // 去掉了 await 阻塞与 JS 的时钟计算。处理一万人数组用纯粹的 for 只需不到 5ms，根本不需要挂起线程！
    for (let i = 0; i < standings.length; i++) {
        const row = standings[i];
        if (!row || row.length < 3) continue;
        const userInfo = row[2];
        if (!userInfo) continue;
        const userId = userInfo[0];

        if (!userId.startsWith('ucup-team')) continue;

        let solved = false;
        const userScores = score[userId];
        if (userScores) {
            for (let j = 0; j < problemIndices.length; j++) {
                if (userScores[j] && userScores[j][0] > 0) {
                    solved = true;
                    break;
                }
            }
        }

        if (solved && row[2][2] != 1 && row[2][2] != 2) { // 跳过 vp 队伍和未正式参赛队伍
            teamsWithSolvesCount++;
            validUserIds.push(userId);
        }
    }

    for (let i = 0; i < validUserIds.length; i++) {
        const userId = validUserIds[i];
        const rank = i + 1;
        const gp30 = getGP30(rank);
        const perf = teamsWithSolvesCount > 0 ? 200 * (teamsWithSolvesCount - rank + 1) / teamsWithSolvesCount + gp30 : gp30;
        perfMap.set(userId, { perf, rank, gp30 });
    }

    // --- 视图渲染阶段完全合并：避免多次触发浏览器的 Layout 和 Paint 导致严重卡顿 ---
    requestAnimationFrame(() => {
        if (!headerRow.querySelector('.qoj-perf-header')) {
            const perfTh = document.createElement('th');
            perfTh.className = 'qoj-perf-header';
            perfTh.textContent = 'Perf';
            perfTh.style.cssText = 'font-size:12px; white-space:nowrap; text-align:center;';
            perfTh.title = `Performance = 200 × (n_teams − rank + 1) / n_teams + GP30\nn_teams: 至少过一题的队伍数`;
            headerRow.appendChild(perfTh);
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const tbodyRows = tbody.children;

        const currentPageId = getPageId();
        const baseIdx = 100 * (currentPageId - 1);

        for (let rowIdx = 0; rowIdx < tbodyRows.length; rowIdx++) {
            const tr = tbodyRows[rowIdx];
            const standingIdx = baseIdx + rowIdx;

            if (standingIdx >= standings.length) continue;

            const row = standings[standingIdx];
            if (!row || row.length < 3) continue;
            const userInfo = row[2];
            if (!userInfo) continue;
            const userId = userInfo[0];

            let td = tr.lastElementChild;
            if (!td || !td.classList.contains('qoj-perf-cell')) {
                td = document.createElement('td');
                td.className = 'qoj-perf-cell';
                td.style.cssText = 'text-align:center; font-weight:bold; font-family:monospace;';
                tr.appendChild(td);
            }

            const perfData = perfMap.get(userId);
            if (perfData) {
                const p = perfData.perf;
                td.textContent = p % 1 === 0 ? p.toFixed(0) : p.toFixed(1);
                td.style.color = getPerfColor(p);
                td.title = `Rank: ${perfData.rank}\nGP30: ${perfData.gp30}\nn_teams: ${teamsWithSolvesCount}\nPerf: ${p.toFixed(2)}`;
            } else {
                td.textContent = '—';
                td.style.color = '#999';
                td.title = '未过题，不计入 Performance';
            }
        }
    });
}

function addToggleButton() {
    if (document.getElementById('toggle-ucup-teams')) return;

    const navbarUser = document.querySelector('.nav-link.dropdown-toggle');
    if (!navbarUser) return;

    const parentUl = navbarUser.closest('ul.navbar-nav, ul.nav');
    if (!parentUl) return;

    const li = document.createElement('li');
    li.style.listStyle = 'none';
    li.style.marginLeft = '10px';

    const button = document.createElement('button');
    button.id = 'toggle-ucup-teams';
    button.type = 'button';
    button.textContent = 'Only UCUP Teams';
    button.style.cssText = 'padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.9em;';

    button.onmouseover = () => (button.style.backgroundColor = '#218838');
    button.onmouseout = () => (button.style.backgroundColor = '#28a745');

    button.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.onlyUCUPTeams = !window.onlyUCUPTeams;
        button.textContent = window.onlyUCUPTeams ? 'Show All Teams' : 'Only UCUP Teams';

        // 重新计算时同样需要防抖和非阻塞调用
        setTimeout(() => {
            calculateRatings();
            calculatePerformance();
        }, 0);
        return false;
    };

    li.appendChild(button);
    parentUl.insertBefore(li, navbarUser.parentElement);
}

function isStandingsPage() {
    return /\/contest\/\d+\/(standings|standings\/external)/.test(location.pathname);
}

function getPageId() {
    const pagination = document.querySelector('ul.pagination');
    if (!pagination) return 1;
    const active = pagination.querySelector('li.page-item.active a.page-link');
    if (!active) return 1;
    const match = active.textContent.trim().match(/^(\d+)$/);
    return match[1] || '1';
}

function initFbJump() {
    if (window.__fbJumpInit) {
        if (window.checkFbHash) window.checkFbHash();
        return;
    }
    window.__fbJumpInit = true;

    const s = document.createElement('style');
    s.innerHTML = `
        th:has(a[href*="/problem/"]):hover { cursor: crosshair !important; background-color: rgba(0,0,0,0.08) !important; }
        .fb-highlight { background-color: rgba(255, 99, 71, 0.4) !important; transition: background-color 0.3s; }
    `;
    document.head.appendChild(s);

    const findFirstBloodRow = (doc, columnIndex) => {
        const rows = doc.querySelectorAll('table tbody tr');
        for (let row of rows) {
            if (row.querySelector('th') || row.className.match(/summary|sortfree/i) || row.closest('tfoot')) continue;
            if (columnIndex >= row.children.length) continue;
            const cell = row.children[columnIndex];
            if (cell.classList.contains('table-success')) {
                return row;
            }
        }
        return null;
    };

    const highlightRow = (row) => {
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('fb-highlight');
        setTimeout(() => row.classList.remove('fb-highlight'), 1500);
    };

    window.checkFbHash = () => {
        const hashMatch = location.hash.match(/^#fb-(\d+)$/);
        if (hashMatch) {
            setTimeout(() => {
                const targetRow = findFirstBloodRow(document, parseInt(hashMatch[1]));
                if (targetRow) highlightRow(targetRow);
                history.replaceState(null, null, location.pathname + location.search);
            }, 600);
        }
    };

    window.checkFbHash();

    document.addEventListener('click', async (event) => {
        const tableHeader = event.target.closest('th');
        if (!tableHeader) return;
        if (!tableHeader.querySelector('a[href*="/problem/"]')) return;

        // 允许直接点击 A 标签跳转到题目，只有点到 TH 空白处才触发一血搜寻
        if (event.target.closest('a')) return;

        const tableRow = tableHeader.parentElement;
        const columnIndex = Array.prototype.indexOf.call(tableRow.children, tableHeader);
        if (columnIndex < 0) return;

        event.preventDefault();
        event.stopPropagation();

        // --- 纯前端翻页查找逻辑 (兼容 QOJ 的 Vue/AJAX 无刷新翻页) ---
        const standingsData = (() => {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow.standings) return { standingsArray: unsafeWindow.standings, scoresObject: unsafeWindow.score };
            if (typeof window.standings !== 'undefined') return { standingsArray: window.standings, scoresObject: window.score };
            if (typeof standings !== 'undefined') return { standingsArray: standings, scoresObject: typeof score !== 'undefined' ? score : null };
            return null;
        })();

        let targetPageText = null;

        // 如果存在全局变量 standings 和 score，直接计算出首杀人所在页数 (按每页 100 队计算)
        if (standingsData && standingsData.standingsArray && standingsData.scoresObject) {
            let firstBloodRowIndex = -1;
            let minMinTime = Infinity;
            const problemCacheIndex = getProblemIndices().indexOf(columnIndex);

            if (problemCacheIndex !== -1) {
                for (let i = 0; i < standingsData.standingsArray.length; i++) {
                    const rowData = standingsData.standingsArray[i];
                    if (!rowData || rowData.length < 3) continue;
                    const userId = rowData[2][0];
                    const userScores = standingsData.scoresObject[userId];
                    if (userScores && userScores[problemCacheIndex]) {
                        const problemScoreObj = userScores[problemCacheIndex];
                        if (problemScoreObj && problemScoreObj[0] > 0) { // AC
                            const submissionTime = Number(problemScoreObj[1]);
                            if (!isNaN(submissionTime) && submissionTime < minMinTime) {
                                minMinTime = submissionTime;
                                firstBloodRowIndex = i;
                            } else if (isNaN(submissionTime) && firstBloodRowIndex === -1) {
                                firstBloodRowIndex = i; // 无时间数据时保底取最高名次者
                            }
                        }
                    }
                }
            }
            if (firstBloodRowIndex !== -1) {
                targetPageText = String(Math.floor(firstBloodRowIndex / 100) + 1);
            }
        }

        const currentTargetRow = findFirstBloodRow(document, columnIndex);

        if (currentTargetRow) {
            highlightRow(currentTargetRow);
            return;
        }

        const pageLinks = Array.from(document.querySelectorAll('.pagination .page-item a.page-link'))
            .filter(link => /^\d+$/.test(link.textContent.trim()));

        if (pageLinks.length === 0) return;

        const activePageElement = document.querySelector('.pagination .page-item.active a.page-link');
        const originalPageText = activePageElement ? activePageElement.textContent.trim() : null;

        document.body.style.cursor = tableHeader.style.cursor = 'wait';

        // 方法 1: 如果计算出了明确的目标页码，且它正好在底部的数字按钮清单里，直接点他
        if (targetPageText) {
            const exactLink = pageLinks.find(link => link.textContent.trim() === targetPageText);
            if (exactLink) {
                exactLink.click();
                setTimeout(() => {
                    const targetRow = findFirstBloodRow(document, columnIndex);
                    if (targetRow) {
                        highlightRow(targetRow);
                    }
                    document.body.style.cursor = tableHeader.style.cursor = '';
                }, 200); // 留给 Vue 重新渲染的时间
                return;
            }
        }

        // 方法 2: 如果由于省略号之类的没法直接找到，或是上面计算失败，则逐个点击可见的数字按钮进行地毯式搜寻
        const searchAcrossPages = (linkIndex) => {
            if (linkIndex >= pageLinks.length) {
                // 没找到，恢复原样
                const restoreLink = Array.from(document.querySelectorAll('.pagination .page-item a.page-link'))
                    .find(link => link.textContent.trim() === originalPageText);
                if (restoreLink) restoreLink.click();
                document.body.style.cursor = tableHeader.style.cursor = '';
                return;
            }

            const currentLink = pageLinks[linkIndex];
            if (currentLink.textContent.trim() === originalPageText) {
                searchAcrossPages(linkIndex + 1);
                return;
            }

            currentLink.click();
            setTimeout(() => {
                const targetRow = findFirstBloodRow(document, columnIndex);
                if (targetRow) {
                    highlightRow(targetRow);
                    document.body.style.cursor = tableHeader.style.cursor = '';
                    return;
                }
                searchAcrossPages(linkIndex + 1);
            }, 100);
        };

        searchAcrossPages(0);
    }, true);
}

// ========== 其他功能 ==========

function backProblem() {
    if (document.querySelector('.nav-link.back-problem')) return;
    const nav = document.querySelector("ul.nav.nav-tabs");
    if (!nav) return;

    const match = location.pathname.match(/^\/contest\/(\d+)\/problem\/(\d+)/);
    if (!match) return;
    const pid = match[2];

    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `<a class="nav-link back-problem" href="/problem/${pid}" role="tab">Back to the problem</a>`;

    const backToContest = Array.from(nav.querySelectorAll("a")).find(a => a.textContent.includes("Back to the contest"));
    if (backToContest) backToContest.parentElement.before(li);
    else nav.appendChild(li);
}

function viewSubmissions() {
    if (document.querySelector('.nav-link.view-submissions')) return;
    const nav = document.querySelector('ul.nav.nav-tabs[role="tablist"]');
    if (!nav) return;

    const matchContest = location.pathname.match(/\/contest\/(\d+)\/problem\/(\d+)/);
    const matchProblem = location.pathname.match(/\/problem\/(\d+)/);
    const pid = matchContest ? matchContest[2] : matchProblem ? matchProblem[1] : null;
    if (!pid) return;

    const userLink = document.querySelector('a.dropdown-item[href*="/user/profile/"]');
    const username = userLink ? userLink.href.match(/profile\/([^/?#]+)/)?.[1] : null;
    if (!username) return;

    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<a class="nav-link view-submissions" href="/submissions?problem_id=${pid}&submitter=${username}" role="tab">View submissions</a>`;
    nav.appendChild(li);
}

function viewInContestLinks() {
    const alertBox = document.querySelector('.alert.alert-primary');
    if (!alertBox) return;

    const listItems = alertBox.querySelectorAll('ul.uoj-list li a[href*="/contest/"]');
    if (!listItems.length) return;

    const pidMatch = window.location.pathname.match(/\/problem\/(\d+)/);
    if (!pidMatch) return;
    const pid = pidMatch[1];

    listItems.forEach(a => {
        if (a.parentElement.querySelector('a[data-added="true"]')) return;
        const match = a.href.match(/\/contest\/(\d+)(\?v=\d+)?/);
        if (!match) return;
        const cid = match[1];
        const ver = match[2] || '';
        const viewLink = document.createElement('a');
        viewLink.textContent = '[view in contest]';
        viewLink.href = `/contest/${cid}/problem/${pid}${ver}`;
        viewLink.style.marginLeft = '4px';
        viewLink.dataset.added = 'true';
        a.insertAdjacentElement('afterend', viewLink);
    });
}

function addAcTag() {
    if (window.__qoj_fullscore_lock) return;
    window.__qoj_fullscore_lock = true;
    if (window.__qoj_no_ac) return;
    const pid = getProblemId();
    const username = getUsername();
    if (!pid || !username) return;
    try {
        const pid = getProblemId();
        const username = getUsername();
        if (!pid || !username) return;

        const infoRow = document.querySelector('.row.d-flex.justify-content-center');
        if (!infoRow) return;
        if (infoRow.querySelector('.badge-fullscore')) return;

        const totalEl = [...infoRow.querySelectorAll('.badge.badge-secondary')]
            .find(e => e.textContent.includes('Total points'));
        if (!totalEl) return;

        const total = parseFloat(totalEl.textContent.replace(/[^\d.]/g, ''));
        if (isNaN(total)) return;

        fetch(`/submissions?problem_id=${pid}&submitter=${username}&min_score=${total}&max_score=${total}`)
            .then(res => res.text())
            .then(html => {
                const match = html.match(/<td><a href="(\/submission\/\d+)">/);
                if (!match) {
                    window.__qoj_no_ac = true;
                    return;
                }
                const sub = match[1];
                const badge = document.createElement('a');
                badge.className = 'badge badge-success mr-1 badge-fullscore';
                badge.textContent = 'Accepted ✓';
                badge.href = `${sub}`;
                badge.target = '_blank';
                infoRow.appendChild(badge);
                const submitLink = document.querySelector('a.nav-link[href="#tab-submit-answer"]');
                if (!submitLink) return;

                if (submitLink.classList.contains('submit-green')) return;

                submitLink.classList.add('submit-green');

                const style = document.createElement('style');
                style.textContent = `
                        a.nav-link.submit-green {
                            color: #00cc00 !important;
                        }
                        a.nav-link.submit-green:hover {
                            color: #00cc00 !important;
                        }
                    `;
                document.head.appendChild(style);
            })
            .catch(err => console.error('检测满分失败:', err))
            .finally(() => {
                setTimeout(() => { window.__qoj_fullscore_lock = false; }, 100);
            });
    } catch (e) {
        console.error(e);
        window.__qoj_fullscore_lock = false;
    }
}

async function fetchVotes(problemHref) {
    try {
        const res = await fetch(problemHref);
        const html = await res.text();
        // 在 QOJ/UOJ 的问题页面中含有 <div class="uoj-click-zan-block ... data-cnt="2"> 这种结构来存储总赞数
        const match = html.match(/class="uoj-click-zan-block[^>]*data-cnt="([^"]+)"/);
        if (match) {
            return parseInt(match[1], 10);
        }

        // 兼容一下有些平台如果结构是内部 span 的情况
        const fallbackMatch = html.match(/id="click-zan-block-problem-\d+"[^>]*>.*?<span class="uoj-click-zan-print">(\d+)<\/span>/s) || html.match(/uoj-click-zan-print">(\d+)<\/span>/);
        return fallbackMatch ? parseInt(fallbackMatch[1], 10) : 0;
    } catch {
        return 0;
    }
}

async function displayAuthoredProblemsVotes() {
    if (!/\/user\/profile\/[^\/]+/.test(location.href)) return;

    // 寻找包含题目链接的表格，通常就是 Authored problems
    const tables = document.querySelectorAll('table');
    let targetTable = null;
    for (const table of tables) {
        const firstLink = table.querySelector('tbody tr td a');
        if (firstLink && /\/problem\/\d+/.test(firstLink.href)) {
            targetTable = table;
            break;
        }
    }

    if (!targetTable) return;

    // 找到表格对应的标题
    let targetHeader = targetTable.parentElement;
    if (targetHeader.classList.contains('table-responsive')) {
        targetHeader = targetHeader.previousElementSibling;
    } else {
        targetHeader = targetTable.previousElementSibling;
    }

    if (!targetHeader || targetHeader.dataset.votesAdded) return;
    targetHeader.dataset.votesAdded = "true";

    const btn = document.createElement('a');
    btn.textContent = '[view votes]';
    btn.href = 'javascript:void(0);';
    btn.style.cssText = 'margin-left: 10px; font-size: 0.8em; color: #337ab7; cursor: pointer; text-decoration: none;';
    targetHeader.appendChild(btn);

    btn.onclick = async () => {
        btn.style.display = 'none'; // 点击后隐藏按钮

        const table = targetTable;
        const thead = table.querySelector('thead tr');
        if (!thead) return;

        const ths = Array.from(thead.children);
        let nameColIdx = ths.findIndex(th => th.textContent && th.textContent.includes('Problem Name'));
        if (nameColIdx === -1) {
            nameColIdx = ths.findIndex(th => th.textContent && (th.textContent.includes('Problem') || th.textContent.includes('题目')));
            if (nameColIdx === -1) nameColIdx = 1;
        }

        const voteTh = document.createElement('th');
        voteTh.textContent = 'Votes';
        voteTh.style.cssText = 'width: 5em; text-align: center;';
        thead.insertBefore(voteTh, ths[nameColIdx].nextElementSibling);

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        let totalVotes = 0;
        const headerSpan = document.createElement('span');
        headerSpan.style.color = '#777';
        headerSpan.style.marginLeft = '10px';
        headerSpan.style.fontSize = '0.8em';
        headerSpan.textContent = `(Total Votes: 0)`;
        targetHeader.appendChild(headerSpan);

        const rows = Array.from(tbody.children);
        const tasks = [];

        for (const row of rows) {
            if (row.children.length <= nameColIdx) continue;
            const nameTd = row.children[nameColIdx];

            const voteTd = document.createElement('td');
            voteTd.style.textAlign = 'center';
            row.insertBefore(voteTd, nameTd.nextElementSibling);

            const link = nameTd.querySelector('a');
            if (link && link.href) {
                voteTd.innerHTML = '<span style="color: grey; font-size: 0.9em;">...</span>';
                tasks.push(async () => {
                    const votes = await fetchVotes(link.href);
                    voteTd.textContent = votes;
                    totalVotes += votes;
                    headerSpan.textContent = `(Total Votes: ${totalVotes})`;
                });
            } else {
                voteTd.textContent = '-';
            }
        }

        // 限制并发请求以防请求泛滥被 ban (一次 5 个并发)
        const CONCURRENCY = 5;
        for (let i = 0; i < tasks.length; i += CONCURRENCY) {
            const chunk = tasks.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(t => t()));
        }
    };
}

function checkStandingsUpdate() {
    if (!isStandingsPage()) return false;
    const table = document.querySelector('table');
    if (!table) return false;
    const headerRow = table.querySelector('thead tr') || table.rows[0];
    const tbodyTr = table.querySelector('tbody tr');
    const lacksPerfHeader = headerRow && !headerRow.querySelector('.qoj-perf-header');
    const lacksPerfCell = tbodyTr && !tbodyTr.querySelector('.qoj-perf-cell');
    return lacksPerfHeader || lacksPerfCell;
}

function checkProfileUpdate() {
    if (!/\/user\/profile\/[^\/]+/.test(location.href)) return false;
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
        const firstLink = table.querySelector('tbody tr td a');
        if (firstLink && /\/problem\/\d+/.test(firstLink.href)) {
            let targetHeader = table.parentElement;
            if (targetHeader.classList.contains('table-responsive')) {
                targetHeader = targetHeader.previousElementSibling;
            } else {
                targetHeader = table.previousElementSibling;
            }
            return targetHeader && !targetHeader.dataset.votesAdded;
        }
    }
    return false;
}

function checkBasicMount() {
    return document.querySelector('.alert.alert-primary') ||
        document.querySelector('ul.nav.nav-tabs') ||
        document.querySelector('.nav-link.dropdown-toggle') ||
        document.querySelector('.nav.nav-pills.float-right') ||
        document.querySelector('.list-group-item-heading');
}

(function () {
    'use strict';
    // --- 初次执行 ---
    let mainTimer = null;
    let lastUrl = location.href;

    function scheduleMainAndCalc() {
        if (mainTimer) clearTimeout(mainTimer);
        mainTimer = setTimeout(() => {
            loadSettings(); // 每次执行前加载最新设置
            window.onlyUCUPTeams = settings.onlyUcupTeams;

            if (settings.showDomainSwitcher) switchDomain();
            if (settings.addBackButton) backProblem();
            if (settings.addViewSubmissions) viewSubmissions();
            if (settings.addViewInContest) viewInContestLinks();
            if (settings.addAcTag) addAcTag();
            if (settings.addVoteViewer) displayAuthoredProblemsVotes();

            if (isStandingsPage()) {
                addSettingsButton(); // 在榜单页也显示设置按钮
                if (settings.showRatings) calculateRatings();
                if (settings.showPerformance) calculatePerformance();
                if (settings.addFbJump) initFbJump();
            } else {
                addSettingsButton();
            }
        }, 100); // UI 触发响应时间缩短到 100ms
    }

    scheduleMainAndCalc();

    // --- 使用 MutationObserver 监听 DOM 动态变化，完美兼容 PJAX(单页跳转) ---
    const observer = new MutationObserver(() => {
        // 如果网页地址变化（通过 PJAX 跳转多页），必须重新注入渲染
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            scheduleMainAndCalc();
            return;
        }

        if (checkStandingsUpdate() || checkProfileUpdate()) {
            scheduleMainAndCalc();
            return;
        }

        // 普通页面的初次依赖挂载判断
        if (checkBasicMount() && !window.qojBetterInitialized) {
            window.qojBetterInitialized = true;
            scheduleMainAndCalc();
        }
    });

    // 启动观察器：不随意断开，长驻监听。
    observer.observe(document.body, { childList: true, subtree: true });
})();