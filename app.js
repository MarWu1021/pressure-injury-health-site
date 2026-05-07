const defaultSoapie = {
    S: "病人主訴胸口悶、喘不過氣。",
    O: "呼吸費力，呼吸 28 次/分，SpO2 88%，肺部聽診有喘鳴音。",
    A: "呼吸道清除功能失效，與支氣管痙攣及氣喘發作有關。",
    P: "改善血氧濃度，維持呼吸道通暢，持續觀察呼吸狀態。",
    I: "採半坐臥位，依醫囑給予氧氣 3L/min，通知醫師並執行噴霧治療。",
    E: "噴霧治療後追蹤呼吸音、呼吸次數與 SpO2 變化。"
};

const foodRiskTerms = {
    diabetes: {
        red: ["含糖", "珍珠奶茶", "手搖", "蛋糕", "甜點", "糖果", "果汁", "可樂"],
        yellow: ["白飯", "麵", "粥", "麵包", "地瓜", "玉米", "香蕉", "芒果"]
    },
    kidney: {
        red: ["香蕉", "楊桃", "高湯", "火鍋湯", "加工肉", "香腸", "培根", "內臟", "堅果"],
        yellow: ["豆腐", "豆漿", "乳製品", "菠菜", "菇", "海帶", "醬油", "滷肉"]
    }
};

const gameSymbols = ["藥", "藥", "水", "水", "飯", "飯", "心", "心", "氧", "氧", "步", "步", "睡", "睡", "護", "護"];

let openCards = [];
let lockBoard = false;

const HISTORY_KEYS = {
    soapie: "careHistory.soapie",
    pressure: "careHistory.pressure",
    diet: "careHistory.diet"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDateTime(isoString) {
    return new Date(isoString).toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function readHistory(type) {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEYS[type]) || "[]");
    } catch {
        return [];
    }
}

function saveHistory(type, item) {
    const items = readHistory(type);
    items.unshift({ ...item, savedAt: new Date().toISOString() });
    localStorage.setItem(HISTORY_KEYS[type], JSON.stringify(items.slice(0, 8)));
    renderHistory(type);
}

function clearHistory(type) {
    localStorage.removeItem(HISTORY_KEYS[type]);
    renderHistory(type);
}

function renderHistory(type) {
    const target = document.getElementById(`${type}History`);
    if (!target) return;

    const items = readHistory(type);
    if (!items.length) {
        target.innerHTML = '<p class="empty-history">尚無紀錄。</p>';
        return;
    }

    target.innerHTML = items.map((item) => {
        if (type === "soapie") {
            return `<article class="history-item">
                <time>${formatDateTime(item.savedAt)}</time>
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.summary)}</p>
            </article>`;
        }

        if (type === "pressure") {
            return `<article class="history-item">
                <time>${formatDateTime(item.savedAt)}</time>
                <strong>${escapeHtml(item.scoreText)}</strong>
                <p>${escapeHtml(item.summary)}</p>
            </article>`;
        }

        return `<article class="history-item">
            <time>${formatDateTime(item.savedAt)}</time>
            <strong>${escapeHtml(item.level)}</strong>
            <p>${escapeHtml(item.summary)}</p>
        </article>`;
    }).join("");
}

function renderAllHistory() {
    Object.keys(HISTORY_KEYS).forEach(renderHistory);
}

function getBradenValues() {
    const form = document.getElementById("bradenForm");
    if (!form) return [];
    return [...form.querySelectorAll("select")].map((select) => Number(select.value || 0));
}

function classifyBraden(score) {
    if (!score) return { label: "尚未完成", className: "", advice: "請先填寫六項 Braden 評估分數。" };
    if (score <= 9) return {
        label: "極高風險",
        className: "risk-high",
        advice: "需立即加強翻身、減壓床墊、皮膚檢查與傷口照護評估。",
        turning: "每 1-2 小時翻身，必要時啟動高風險照護流程。",
        skin: "每班檢查尾骶骨、足跟、髖部等受壓部位，留意破皮、滲液與異味。",
        support: "使用減壓床墊、足跟保護與移位輔具，降低摩擦與剪力。"
    };
    if (score <= 12) return {
        label: "高風險",
        className: "risk-high",
        advice: "建議每 2 小時翻身、使用減壓輔具，並每日追蹤皮膚狀況。",
        turning: "至少每 2 小時翻身，坐椅時每小時協助減壓。",
        skin: "每日完整皮膚評估，潮濕時立即清潔並更換床單或尿布。",
        support: "安排減壓床墊，注意搬移時避免拖拉造成剪力。"
    };
    if (score <= 14) return {
        label: "中度風險",
        className: "risk-mid",
        advice: "需安排規律翻身、保持皮膚乾爽，留意營養攝取與摩擦剪力。",
        turning: "建立固定翻身時程，鼓勵可耐受的床上活動。",
        skin: "檢查泛紅是否退色，避免皮膚長時間潮濕。",
        support: "保持床單平整，必要時使用枕頭或軟墊分散壓力。"
    };
    if (score <= 18) return {
        label: "輕度風險",
        className: "risk-mid",
        advice: "建議持續觀察受壓部位，鼓勵活動與補充足夠營養。",
        turning: "提醒定時變換姿勢，增加下床或坐起活動。",
        skin: "每日觀察皮膚顏色、溫度與乾濕狀態。",
        support: "可依狀況使用坐墊或足跟墊，減少局部壓力。"
    };
    return {
        label: "低風險",
        className: "risk-low",
        advice: "目前風險較低，仍需維持皮膚清潔、活動與定期再評估。",
        turning: "維持日常活動與自主翻身。",
        skin: "定期再評估皮膚狀態，住院期間仍需追蹤。",
        support: "維持良好營養與水分攝取，避免長時間壓迫。"
    };
}

function updateBradenScore() {
    const values = getBradenValues();
    const completed = values.every(Boolean);
    const score = completed ? values.reduce((sum, value) => sum + value, 0) : 0;
    const risk = classifyBraden(score);
    const scoreEl = document.getElementById("bradenScore");
    const statusEl = document.getElementById("bradenStatus");
    const heroEl = document.getElementById("heroPressureRisk");

    scoreEl.textContent = completed ? String(score) : "--";
    statusEl.textContent = risk.label;
    statusEl.className = risk.className;
    if (heroEl) heroEl.textContent = completed ? `${score} 分｜${risk.label}` : "尚未完成";

    return { completed, score, risk };
}

function makePressureReport() {
    const { completed, score, risk } = updateBradenScore();
    const report = document.getElementById("pressureReport");
    const hasDiabetes = document.getElementById("hasDiabetes").checked;
    const hasFever = document.getElementById("hasFever").checked;
    const note = document.getElementById("pressureNote").value.trim();
    const extraFlags = [
        hasDiabetes ? "有糖尿病史，需留意傷口癒合與感染風險" : "",
        hasFever ? "近期有發燒，需評估感染或發炎可能" : "",
        note ? `補充描述：${note}` : ""
    ].filter(Boolean);

    report.classList.remove("hidden");
    report.innerHTML = `
        <h3>AI 分析報告草稿</h3>
        <div class="report-grid">
            <div>
                <strong>Braden 總分</strong>
                <span>${completed ? `${score} 分，${risk.label}` : "尚未完成，請補齊六項分數"}</span>
            </div>
            <div>
                <strong>翻身與減壓</strong>
                <span>${risk.turning || risk.advice}</span>
            </div>
            <div>
                <strong>皮膚觀察</strong>
                <span>${risk.skin || "請補齊評估後產生建議。"}</span>
            </div>
            <div>
                <strong>輔具與照護</strong>
                <span>${risk.support || "請依臨床狀況安排減壓與移位輔具。"}</span>
            </div>
            <div>
                <strong>主要建議</strong>
                <span>${risk.advice}</span>
            </div>
            <div>
                <strong>臨床提醒</strong>
                <span>${extraFlags.length ? extraFlags.join("；") : "未填寫額外臨床風險因子。"}</span>
            </div>
        </div>
        <p class="note">此報告為教學展示用途，壓瘡分期、感染判斷與治療方式仍需由醫護人員評估。</p>
    `;

    saveHistory("pressure", {
        scoreText: completed ? `${score} 分｜${risk.label}` : "尚未完成",
        summary: [risk.advice, ...extraFlags].filter(Boolean).join("；")
    });
}

function handlePressurePhoto(event) {
    const file = event.target.files?.[0];
    const preview = document.getElementById("pressurePreview");
    if (!file || !preview) return;

    const reader = new FileReader();
    reader.onload = () => {
        preview.src = reader.result;
        preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

function generateSoapie(note) {
    const text = note.trim();
    if (!text) return defaultSoapie;

    const spo2 = text.match(/(?:血氧|SpO2)\D*(\d{2,3})/i)?.[1];
    const breath = text.match(/(?:呼吸|每分鐘)\D*(\d{2})/i)?.[1];
    const oxygen = text.match(/(\d)\s*(?:公升|L)/i)?.[1];
    const hasWheezing = /喘鳴|哮鳴|wheezing/i.test(text);
    const hasDoctor = /醫師|醫生|通知/.test(text);
    const hasNebulizer = /噴霧|nebulizer/i.test(text);

    return {
        S: /喘|胸口|疼|痛|不舒服/.test(text) ? "病人主訴胸口悶、喘不過氣或身體不適。" : "病人主觀感受需再補充確認。",
        O: [
            breath ? `呼吸 ${breath} 次/分` : "呼吸狀態需持續評估",
            spo2 ? `SpO2 ${spo2}%` : "血氧資料未填寫",
            hasWheezing ? "肺部聽診有喘鳴音" : "肺部聽診資料需補充"
        ].join("，") + "。",
        A: spo2 && Number(spo2) < 95 ? "低血氧風險，需注意呼吸道清除功能與換氣狀態。" : "需依生命徵象與臨床評估判斷照護問題。",
        P: "維持呼吸道通暢，追蹤生命徵象，必要時依院內流程通報。",
        I: [
            "採舒適或半坐臥位",
            oxygen ? `依醫囑給予氧氣 ${oxygen}L/min` : "依醫囑給予處置",
            hasDoctor ? "已通知醫師" : "必要時通知醫師",
            hasNebulizer ? "依醫囑執行噴霧治療" : "持續觀察症狀變化"
        ].join("；") + "。",
        E: "處置後追蹤呼吸音、呼吸次數、SpO2 與主訴改善情形。"
    };
}

function renderSoapie(data, shouldSave = false) {
    const output = document.getElementById("soapieOutput");
    const labels = {
        S: "S 主觀資料",
        O: "O 客觀資料",
        A: "A 評估",
        P: "P 計畫",
        I: "I 執行",
        E: "E 評值"
    };

    output.innerHTML = Object.entries(labels)
        .map(([key, label]) => `<div class="soapie-item"><strong>${label}</strong><span>${data[key]}</span></div>`)
        .join("");

    const lowOxygen = /SpO2\s*(8\d|9[0-4])/.test(data.O);
    document.getElementById("alertBadge").textContent = lowOxygen ? "紅燈警戒" : "持續追蹤";

    if (shouldSave) {
        saveHistory("soapie", {
            title: lowOxygen ? "呼吸照護紀錄｜紅燈警戒" : "護理紀錄草稿",
            summary: `${data.S} ${data.O}`
        });
    }
}

function analyzeDiet(condition, meal) {
    const sources = condition === "both"
        ? [foodRiskTerms.diabetes, foodRiskTerms.kidney]
        : [foodRiskTerms[condition]];
    const redHits = sources.flatMap((source) => source.red.filter((term) => meal.includes(term)));
    const yellowHits = sources.flatMap((source) => source.yellow.filter((term) => meal.includes(term)));

    if (redHits.length) {
        return {
            level: "紅燈：高風險",
            title: "建議先暫停或大幅減量",
            text: `偵測到 ${dedupe(redHits).join("、")}。可能有高糖、高鉀、高磷或高鈉風險，請依醫囑或營養師建議調整。`,
            color: "red"
        };
    }

    if (yellowHits.length) {
        return {
            level: "黃燈：適量",
            title: "需要控制份量",
            text: `偵測到 ${dedupe(yellowHits).join("、")}。可記錄份量並搭配蔬菜、蛋白質，避免一次攝取過多。`,
            color: "yellow"
        };
    }

    return {
        level: "綠燈：較安全",
        title: "可依計畫適量攝取",
        text: "未偵測到常見高風險食物，但仍需依個人疾病、抽血數值與醫囑調整。",
        color: "green"
    };
}

function dedupe(items) {
    return [...new Set(items)];
}

function renderRisk(result, shouldSave = false, context = {}) {
    document.getElementById("riskLevel").textContent = result.level;
    document.getElementById("riskTitle").textContent = result.title;
    document.getElementById("riskText").textContent = result.text;
    const heroRisk = document.getElementById("heroRisk");
    if (heroRisk) heroRisk.textContent = result.level;
    const light = document.getElementById("riskLight");
    light.className = `risk-light ${result.color}`;

    if (shouldSave) {
        saveHistory("diet", {
            level: result.level,
            summary: `${context.conditionLabel || "飲食分析"}｜${context.meal || ""}｜${result.title}`
        });
    }
}

function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

function buildGame() {
    const board = document.getElementById("gameBoard");
    const status = document.getElementById("gameStatus");
    board.innerHTML = "";
    openCards = [];
    lockBoard = false;
    status.textContent = "找出相同的健康圖示。";

    shuffle(gameSymbols).forEach((symbol, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "memory-card";
        card.textContent = "?";
        card.dataset.symbol = symbol;
        card.dataset.index = String(index);
        card.addEventListener("click", () => flipCard(card));
        board.appendChild(card);
    });
}

function flipCard(card) {
    if (lockBoard || card.classList.contains("flipped") || card.classList.contains("matched")) return;

    card.classList.add("flipped");
    card.textContent = card.dataset.symbol;
    openCards.push(card);

    if (openCards.length !== 2) return;
    lockBoard = true;

    const [first, second] = openCards;
    if (first.dataset.symbol === second.dataset.symbol) {
        first.classList.add("matched");
        second.classList.add("matched");
        openCards = [];
        lockBoard = false;
        checkGameDone();
        return;
    }

    setTimeout(() => {
        first.classList.remove("flipped");
        second.classList.remove("flipped");
        first.textContent = "?";
        second.textContent = "?";
        openCards = [];
        lockBoard = false;
    }, 700);
}

function checkGameDone() {
    const allCards = [...document.querySelectorAll(".memory-card")];
    if (allCards.every((card) => card.classList.contains("matched"))) {
        document.getElementById("gameStatus").textContent = "完成了！今天的記憶力訓練很順利。";
    }
}

function init() {
    renderSoapie(defaultSoapie);
    renderRisk(analyzeDiet("diabetes", document.getElementById("meal").value));
    updateBradenScore();
    buildGame();
    renderAllHistory();

    document.getElementById("soapieForm").addEventListener("submit", (event) => {
        event.preventDefault();
        renderSoapie(generateSoapie(document.getElementById("nurseNote").value), true);
    });

    document.getElementById("clearSoapie").addEventListener("click", () => {
        document.getElementById("nurseNote").value = "";
        renderSoapie(defaultSoapie);
    });

    document.getElementById("dietForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const condition = document.getElementById("condition").value;
        const conditionLabel = document.getElementById("condition").selectedOptions[0].textContent;
        const meal = document.getElementById("meal").value;
        renderRisk(analyzeDiet(condition, meal), true, { conditionLabel, meal });
    });

    document.getElementById("bradenForm").addEventListener("change", updateBradenScore);
    document.getElementById("pressurePhoto").addEventListener("change", handlePressurePhoto);
    document.getElementById("makePressureReport").addEventListener("click", makePressureReport);
    document.querySelectorAll(".clear-history").forEach((button) => {
        button.addEventListener("click", () => clearHistory(button.dataset.history));
    });

    document.getElementById("resetGame").addEventListener("click", buildGame);
}

window.addEventListener("DOMContentLoaded", init);
