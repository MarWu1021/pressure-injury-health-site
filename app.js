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

const gameSymbols = ["🍎", "🍎", "🍌", "🍌", "🍇", "🍇", "🍊", "🍊", "🍓", "🍓", "🥝", "🥝", "🍍", "🍍", "🍉", "🍉"];

const healthVideos = [
    "3SpS4oDsN-g",
    "9XhiP7KLVdg",
    "61kPjUQAoNU",
    "ciYupDYhHQQ",
    "0wFT1h6JO8U",
    "TY_tX-KbweQ",
    "e5c5EEQNMFM",
    "Fajdx5eEGRs",
    "mTZR38eGf5w",
    "U5aQUN5c4U8",
    "nSm8bARXomw",
    "IyX5kU9ad54",
    "tGJ4WtKffeA",
    "UzfJ4EYn7qo",
    "lzB_0doHzhk"
];

let openCards = [];
let lockBoard = false;
let pressurePhotoAnalysis = null;

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

function pickRandomVideo(previousId = "") {
    if (healthVideos.length === 1) return healthVideos[0];
    let nextId = previousId;
    while (nextId === previousId) {
        nextId = healthVideos[Math.floor(Math.random() * healthVideos.length)];
    }
    return nextId;
}

function setRandomVideo() {
    const iframe = document.getElementById("healthVideo");
    const caption = document.getElementById("videoCaption");
    if (!iframe) return;

    const currentId = iframe.dataset.videoId || "";
    const nextId = pickRandomVideo(currentId);
    iframe.dataset.videoId = nextId;
    iframe.src = `https://www.youtube.com/embed/${nextId}`;

    if (caption) {
        const currentIndex = healthVideos.indexOf(nextId) + 1;
        caption.textContent = `目前隨機選到第 ${currentIndex} 部影片。重新整理頁面或按按鈕會再換一部。`;
    }
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
    const clinical = buildPressureClinicalAdvice({ hasDiabetes, hasFever, note, completed, score, risk });

    report.classList.remove("hidden");

    if (!pressurePhotoAnalysis || pressurePhotoAnalysis.status !== "valid") {
        const message = pressurePhotoAnalysis?.summary || "請先上傳清楚的皮膚或疑似傷口照片，系統才會產生照片相關分析。";
        report.innerHTML = `
            <h3>照片檢核未通過</h3>
            <div class="report-grid">
                <div>
                    <strong>照片狀態</strong>
                    <span>${escapeHtml(message)}</span>
                </div>
                <div>
                    <strong>處理方式</strong>
                    <span>請重新上傳受壓部位、皮膚泛紅、破皮或疑似傷口照片，避免花草、食物、風景等非皮膚照片。</span>
                </div>
                <div>
                    <strong>Braden 分數</strong>
                    <span>${completed ? `${score} 分，${risk.label}` : "尚未完成，請補齊六項分數"}</span>
                </div>
                <div>
                    <strong>臨床風險</strong>
                    <span>${escapeHtml(clinical.summary)}</span>
                </div>
            </div>
            <p class="note">目前照片不像皮膚或傷口，因此不會儲存為壓瘡分析紀錄。</p>
        `;
        return;
    }

    report.innerHTML = `
        <h3>AI 分析報告草稿</h3>
        <div class="report-grid">
            <div>
                <strong>照片初步檢核</strong>
                <span>${escapeHtml(pressurePhotoAnalysis.summary)}</span>
            </div>
            <div>
                <strong>Braden 總分</strong>
                <span>${completed ? `${score} 分，${risk.label}` : "尚未完成，請補齊六項分數"}</span>
            </div>
            <div>
                <strong>翻身與減壓</strong>
                <span>${escapeHtml(clinical.turning)}</span>
            </div>
            <div>
                <strong>皮膚觀察</strong>
                <span>${escapeHtml(clinical.skin)}</span>
            </div>
            <div>
                <strong>輔具與照護</strong>
                <span>${escapeHtml(clinical.support)}</span>
            </div>
            <div>
                <strong>主要建議</strong>
                <span>${escapeHtml(clinical.mainAdvice)}</span>
            </div>
            <div>
                <strong>臨床風險加權</strong>
                <span>${escapeHtml(clinical.summary)}</span>
            </div>
            <div>
                <strong>追蹤頻率</strong>
                <span>${escapeHtml(clinical.followUp)}</span>
            </div>
        </div>
        <p class="note">此報告為教學展示用途，壓瘡分期、感染判斷與治療方式仍需由醫護人員評估。</p>
    `;

    saveHistory("pressure", {
        scoreText: completed ? `${score} 分｜${risk.label}` : "尚未完成",
        summary: [pressurePhotoAnalysis.summary, clinical.summary, clinical.mainAdvice].filter(Boolean).join("；")
    });
}

function buildPressureClinicalAdvice({ hasDiabetes, hasFever, note, completed, score, risk }) {
    let level = 0;
    const flags = [];

    if (hasDiabetes) {
        level += 1;
        flags.push("糖尿病史：傷口癒合較慢，感染風險較高");
    }

    if (hasFever) {
        level += 2;
        flags.push("近期發燒：需優先評估感染或發炎可能");
    }

    if (note) {
        flags.push(`補充描述：${note}`);
    }

    const baseTurning = risk.turning || risk.advice;
    const baseSkin = risk.skin || "請補齊評估後產生建議。";
    const baseSupport = risk.support || "請依臨床狀況安排減壓與移位輔具。";
    const baseAdvice = risk.advice;
    const scoreText = completed ? `${score} 分，${risk.label}` : "Braden 尚未完成";

    if (!level) {
        return {
            summary: "未勾選糖尿病或發燒，依 Braden 分數與照片初步檢核給予一般照護建議。",
            turning: baseTurning,
            skin: baseSkin,
            support: baseSupport,
            mainAdvice: baseAdvice,
            followUp: completed ? `${scoreText}，依目前風險等級定期追蹤。` : "請先補齊 Braden 六項分數。"
        };
    }

    if (level >= 3) {
        return {
            summary: `高警示：${flags.join("；")}。`,
            turning: `${baseTurning}；因同時有糖尿病與發燒，建議提高一級照護警戒。`,
            skin: `${baseSkin}；每班確認紅腫熱痛、滲液、異味與傷口擴大情形。`,
            support: `${baseSupport}；必要時提早使用減壓床墊、足跟保護與移位輔具。`,
            mainAdvice: `${baseAdvice}；需優先排除感染並追蹤血糖控制，避免傷口惡化。`,
            followUp: "建議每班追蹤皮膚與體溫，若有滲液、異味、疼痛加劇或發燒持續，應通報醫護人員。"
        };
    }

    if (hasFever) {
        return {
            summary: `感染警示：${flags.join("；")}。`,
            turning: `${baseTurning}；發燒時需縮短觀察間隔。`,
            skin: `${baseSkin}；特別注意傷口周圍是否有紅腫熱痛、滲液或異味。`,
            support: baseSupport,
            mainAdvice: `${baseAdvice}；近期發燒時需評估感染或發炎可能。`,
            followUp: "建議每班追蹤體溫與皮膚變化，必要時通報醫護人員。"
        };
    }

    return {
        summary: `癒合風險：${flags.join("；")}。`,
        turning: baseTurning,
        skin: `${baseSkin}；糖尿病史者需更注意傷口癒合速度與感染徵象。`,
        support: `${baseSupport}；避免局部壓迫與剪力造成傷口延遲癒合。`,
        mainAdvice: `${baseAdvice}；建議同步追蹤血糖控制與營養攝取。`,
        followUp: "建議每日追蹤傷口大小、顏色、滲液與周圍皮膚狀況。"
    };
}

function handlePressurePhoto(event) {
    const file = event.target.files?.[0];
    const preview = document.getElementById("pressurePreview");
    const status = document.getElementById("pressurePhotoStatus");
    pressurePhotoAnalysis = null;
    if (!file || !preview) return;

    if (status) {
        status.className = "photo-status";
        status.textContent = "正在檢查照片內容...";
    }

    const reader = new FileReader();
    reader.onload = async () => {
        preview.src = reader.result;
        preview.classList.remove("hidden");
        pressurePhotoAnalysis = await analyzePressureImage(reader.result);
        renderPressurePhotoStatus();
    };
    reader.readAsDataURL(file);
}

function renderPressurePhotoStatus() {
    const status = document.getElementById("pressurePhotoStatus");
    if (!status || !pressurePhotoAnalysis) return;

    status.className = `photo-status ${pressurePhotoAnalysis.status}`;
    status.textContent = pressurePhotoAnalysis.summary;
}

function analyzePressureImage(dataUrl) {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 180;
            const scale = Math.min(1, maxSize / img.width, maxSize / img.height);
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) {
                resolve({
                    status: "invalid",
                    summary: "瀏覽器無法讀取照片，請重新上傳清楚的皮膚或傷口照片。"
                });
                return;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let total = 0;
            let skin = 0;
            let woundRed = 0;
            let darkTissue = 0;
            let greenBackground = 0;
            let blueBackground = 0;
            let highSaturationWarm = 0;

            for (let index = 0; index < pixels.length; index += 16) {
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const a = pixels[index + 3];
                if (a < 180) continue;

                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const saturation = max ? (max - min) / max : 0;
                total += 1;

                const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

                if (
                    r > 80 &&
                    g > 35 &&
                    b > 20 &&
                    r > g &&
                    g >= b &&
                    saturation >= 0.08 &&
                    saturation <= 0.46 &&
                    cb >= 77 &&
                    cb <= 127 &&
                    cr >= 133 &&
                    cr <= 173
                ) {
                    skin += 1;
                }

                if (r > 115 && r > g * 1.22 && r > b * 1.22 && saturation > 0.24) {
                    woundRed += 1;
                }

                if (r < 105 && g < 95 && b < 95 && saturation > 0.16) {
                    darkTissue += 1;
                }

                if (g > 90 && g > r * 1.08 && g > b * 1.08 && saturation > 0.18) {
                    greenBackground += 1;
                }

                if (b > 95 && b > r * 1.08 && b > g * 1.04 && saturation > 0.18) {
                    blueBackground += 1;
                }

                if (r > 135 && g > 45 && b < 135 && r > g * 1.12 && saturation > 0.42) {
                    highSaturationWarm += 1;
                }
            }

            const ratio = (value) => value / Math.max(total, 1);
            const skinRatio = ratio(skin);
            const redRatio = ratio(woundRed);
            const darkRatio = ratio(darkTissue);
            const greenRatio = ratio(greenBackground);
            const blueRatio = ratio(blueBackground);
            const warmRatio = ratio(highSaturationWarm);
            const skinOrWoundSignal = skinRatio + redRatio * 0.55 + darkRatio * 0.45;
            const plantOrSceneSignal = greenRatio + blueRatio;

            if (total < 80) {
                resolve({
                    status: "invalid",
                    summary: "照片解析度或內容太少，請重新上傳清楚的皮膚或疑似傷口照片。"
                });
                return;
            }

            if (greenRatio > 0.06 && warmRatio > 0.08) {
                resolve({
                    status: "invalid",
                    summary: "照片中同時偵測到大量綠色背景與高飽和橘紅色，較像花草或環境照片，請改上傳受壓部位皮膚或傷口照片。"
                });
                return;
            }

            if (greenRatio > 0.12 || plantOrSceneSignal > 0.2) {
                resolve({
                    status: "invalid",
                    summary: "照片背景色占比過高，系統無法確認為皮膚或傷口照片，請重新拍攝受壓部位。"
                });
                return;
            }

            if (skinRatio < 0.12 && redRatio < 0.1 && darkRatio < 0.12) {
                resolve({
                    status: "invalid",
                    summary: "照片中缺少足夠的皮膚或紅色傷口特徵，請重新上傳清楚的皮膚狀況照片。"
                });
                return;
            }

            if (skinRatio < 0.18 && warmRatio > 0.18) {
                resolve({
                    status: "invalid",
                    summary: "照片主要是高飽和橘紅色區塊，但缺少周圍皮膚特徵，系統判定不像壓瘡照片。"
                });
                return;
            }

            if (skinOrWoundSignal < 0.16) {
                resolve({
                    status: "invalid",
                    summary: "照片中的皮膚或傷口訊號不足，請重新拍攝清楚的受壓部位。"
                });
                return;
            }

            const cue = redRatio > 0.08
                ? "偵測到疑似泛紅或傷口色塊"
                : darkRatio > 0.08
                    ? "偵測到疑似深色組織或陰影區域"
                    : "偵測到疑似皮膚區域";

            resolve({
                status: "valid",
                summary: `${cue}，可產生初步照護建議；此影像檢核僅供專題展示，不等同醫療診斷。`
            });
        };

        img.onerror = () => resolve({
            status: "invalid",
            summary: "無法讀取照片，請重新上傳 JPG 或 PNG 格式的皮膚或傷口照片。"
        });

        img.src = dataUrl;
    });
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
    status.textContent = "找出相同的水果圖示。";

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

function normalizePageId(id) {
    if (!id || id === "home") return "homePage";
    return id;
}

function showPage(id, shouldUpdateHash = true) {
    const pageId = normalizePageId(id);
    const pages = [...document.querySelectorAll(".page-section")];
    const target = document.getElementById(pageId);
    if (!target) return;

    pages.forEach((page) => {
        page.classList.toggle("active-page", page === target);
    });

    document.querySelectorAll(".nav-links a, .brand").forEach((link) => {
        const linkId = normalizePageId(link.getAttribute("href")?.replace("#", ""));
        link.classList.toggle("active-nav", linkId === pageId);
    });

    if (shouldUpdateHash) {
        window.history.replaceState(null, "", `#${pageId}`);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function initPaging() {
    const pageIds = new Set([...document.querySelectorAll(".page-section")].map((section) => section.id));

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        const targetId = normalizePageId(link.getAttribute("href").replace("#", ""));
        if (!pageIds.has(targetId)) return;

        link.addEventListener("click", (event) => {
            event.preventDefault();
            showPage(targetId);
        });
    });

    const initialId = normalizePageId(window.location.hash.replace("#", ""));
    showPage(pageIds.has(initialId) ? initialId : "homePage", false);
}

function init() {
    initPaging();
    renderSoapie(defaultSoapie);
    renderRisk(analyzeDiet("diabetes", document.getElementById("meal").value));
    updateBradenScore();
    buildGame();
    renderAllHistory();
    setRandomVideo();

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
    document.getElementById("randomVideoBtn").addEventListener("click", setRandomVideo);
}

window.addEventListener("DOMContentLoaded", init);
