const GAME_MAX_GUESSES = 10;
let targetWord = "";
let currentGuess = "";
let guesses = [];
let gameMode = "daily"; // 'daily' or 'free'
let gameStatus = "IN_PROGRESS"; // 'IN_PROGRESS', 'WIN', 'FAIL'
let resultTimer = null;

let currentEnergy = 0;
let revealedHints = [];
let impulseUsed = false;
let currentHintTheme = null;

// フリーモード連続正解ストリーク
let freeStreak = 0;
let freeMaxStreak = 0;
let freeLastStreak = 0; // 失敗直前のストリークを保存する用

// デイリーモード連続正解ストリーク
let dailyStreak = 0;
let dailyMaxStreak = 0;
let dailyLastStreak = 0;
let dailyLastWinDate = "";

let hardStreak = 0;
let hardMaxStreak = 0;
let hardLastStreak = 0;
let solvedHardMegidos = new Set();
let solvedMegidos = new Set(); // 正解済みのメギドID（または名前）を保持

// DOM Elements
const board = document.getElementById("board");
const guessInput = document.getElementById("guess-input");
const submitBtn = document.getElementById("submit-btn");
const modeBtn = document.getElementById("mode-btn");
const helpBtn = document.getElementById("help-btn");
const hintText = document.getElementById("word-length-hint");
const messageContainer = document.getElementById("message-container");
const resultModal = document.getElementById("result-modal");
const helpModal = document.getElementById("help-modal");
const resultTitle = document.getElementById("result-title");
const resultTargetWord = document.getElementById("result-target-word");
const shareBtn = document.getElementById("share-btn");
const nextBtn = document.getElementById("next-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const closeHelpBtn = document.getElementById("close-help-btn");
const giveupBtn = document.getElementById("giveup-btn");
const inputContainer = document.getElementById("input-container");
const playAgainContainer = document.getElementById("play-again-container");
const playAgainBtn = document.getElementById("play-again-btn");
const listModal = document.getElementById("list-modal");
const showListBtn = document.getElementById("show-list-btn"); // 遠び方モーダル内のボタン（残存局止変数）
const listBtn = document.getElementById("list-btn"); // 入力欄横のボタン
const closeListBtn = document.getElementById("close-list-btn");
const megidoListContainer = document.getElementById("megido-list-container");
const impulseBtn = document.getElementById("impulse-btn");
const energyCount = document.getElementById("energy-count");
const impulseHintsContainer = document.getElementById("impulse-hints");
const impulseHelpModal = document.getElementById("impulse-help-modal");

const MAX_WORD_LENGTH = 8;

// Pseudo-random number generator for Daily mode
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Get today's seeded target（14日ブロックシャッフル方式）
// ・同じ14日間のブロック内では同一メギドは絶対に出ない
// ・ブロックをまたぐ偶然の被りは約14/全メギド数（約7%）とごく低い
function getDailyTarget() {
    // 基準日（この方式の運用開始日）
    const baseDate = new Date("2026-04-24");
    baseDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - baseDate) / 86400000);
    const blockNum = Math.floor(daysDiff / 14); // 何番目の14日ブロックか
    const dayInBlock = ((daysDiff % 14) + 14) % 14; // ブロック内の何日目か（0〜13）

    // ブロック番号をシードにFisher-Yatesシャッフル
    const rand = mulberry32(blockNum * 2654435761 + 1013904223);
    const arr = [...MEGIDO_CHARACTERS];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr[dayInBlock];
}

function getRandomTarget() {
    const index = Math.floor(Math.random() * MEGIDO_CHARACTERS.length);
    return MEGIDO_CHARACTERS[index];
}

// フリーモードストリークの読み込み
function loadFreeStreak() {
    const saved = localStorage.getItem("megido-wordle-streak");
    if (saved) {
        const data = JSON.parse(saved);
        freeStreak = data.streak || 0;
        freeMaxStreak = data.maxStreak || 0;
    }
}

// フリーモードストリークの保存
function saveFreeStreak() {
    localStorage.setItem("megido-wordle-streak", JSON.stringify({
        streak: freeStreak,
        maxStreak: freeMaxStreak
    }));
}

// 正解済みメギドの保存
function saveSolvedMegidos() {
    localStorage.setItem("megido-wordle-solved", JSON.stringify([...solvedMegidos]));
}

// 正解済みメギドの読み込み
function loadSolvedMegidos() {
    const saved = localStorage.getItem("megido-wordle-solved");
    if (saved) {
        solvedMegidos = new Set(JSON.parse(saved));
    }
}

// デイリーストリークの保存
function saveDailyStreak() {
    localStorage.setItem("megido-wordle-daily-streak", JSON.stringify({
        streak: dailyStreak,
        maxStreak: dailyMaxStreak,
        lastWinDate: dailyLastWinDate
    }));
}

// デイリーストリークの読み込み

function loadHardStreak() {
    const saved = localStorage.getItem("megido-wordle-hard-streak");
    if (saved) {
        const data = JSON.parse(saved);
        hardStreak = data.streak || 0;
        hardMaxStreak = data.maxStreak || 0;
    }
}
function saveHardStreak() {
    localStorage.setItem("megido-wordle-hard-streak", JSON.stringify({streak: hardStreak, maxStreak: hardMaxStreak}));
}
function loadHardSolvedMegidos() {
    const saved = localStorage.getItem("megido-wordle-hard-solved");
    if (saved) {
        solvedHardMegidos = new Set(JSON.parse(saved));
    }
}
function saveHardSolvedMegidos() {
    localStorage.setItem("megido-wordle-hard-solved", JSON.stringify([...solvedHardMegidos]));
}
function loadDailyStreak() {
    const saved = localStorage.getItem("megido-wordle-daily-streak");
    if (saved) {
        const data = JSON.parse(saved);
        dailyStreak = data.streak || 0;
        dailyMaxStreak = data.maxStreak || 0;
        dailyLastWinDate = data.lastWinDate || "";
    }
}

const getChainEmoji = (chain) => {
    const mod = chain % 100;
    if (mod === 39) return "👍";
    if (mod === 59) return "😭";
    if (mod === 72) return "🎉👁\u200D🗨\uFE0F💍"; 
    return "";
};

function formatImpulseHint(hint) {
    const isLastOne = guesses.length >= (GAME_MAX_GUESSES - 1);
    
    if (hint.startsWith("__TRANCE__:")) {
        const name = hint.replace("__TRANCE__:", "");
        return isLastOne ? `${name}を展開する` : "トランスを展開する";
    }
    
    if (hint.startsWith("__TERRAIN__:")) {
        const name = hint.replace("__TERRAIN__:", "");
        return isLastOne ? `${name}を付与できる` : "地形を付与できる";
    }
    
    return hint;
}

function initGame() {
    loadDailyStreak(); // ここでロードして最新状態にする

    if (resultTimer) {
        clearTimeout(resultTimer);
        resultTimer = null;
    }
    // 常にモーダルを隠す（モード切替時の表示バグ修正）
    resultModal.classList.add("hidden");

    if (gameMode === "hard") {
        document.body.classList.add("hard-mode");
    } else {
        document.body.classList.remove("hard-mode");
    }

    // Load state from local storage if daily
    if (gameMode === "daily") {
        targetWord = getDailyTarget();
        loadDailyState();
        if (!currentHintTheme) {
            const possibleThemes = typeof MEGIDO_HINTS !== 'undefined' ? Object.keys(MEGIDO_HINTS).filter(key => key.replace(/[CRB]$/, '') === targetWord) : [];
            currentHintTheme = possibleThemes.length > 0 ? possibleThemes[Math.floor(Math.random() * possibleThemes.length)] : targetWord;
        }
        if (gameStatus !== "IN_PROGRESS") {
            resultTimer = setTimeout(showResult, 500);
        }
    } else if (gameMode === "hard") {
        const allNames = [...MEGIDO_CHARACTERS];
        if (typeof HARD_LIST !== 'undefined') allNames.push(...HARD_LIST.filter(m => m.isMajor).map(m => m.name));
        targetWord = allNames[Math.floor(Math.random() * allNames.length)];
        guesses = [];
        gameStatus = "IN_PROGRESS";
        currentEnergy = 0;
        revealedHints = [];
        impulseUsed = false;
        let possibleThemes = [];
        if (MEGIDO_CHARACTERS.includes(targetWord) && typeof MEGIDO_HINTS !== 'undefined') {
            possibleThemes = Object.keys(MEGIDO_HINTS).filter(key => key.replace(/[CRB]$/, '') === targetWord);
        }
        currentHintTheme = possibleThemes.length > 0 ? possibleThemes[Math.floor(Math.random() * possibleThemes.length)] : targetWord;
    } else {
        targetWord = getRandomTarget();
        guesses = [];
        gameStatus = "IN_PROGRESS";
        currentEnergy = 0;
        revealedHints = [];
        impulseUsed = false;
        const possibleThemes = typeof MEGIDO_HINTS !== 'undefined' ? Object.keys(MEGIDO_HINTS).filter(key => key.replace(/[CRB]$/, '') === targetWord) : [];
        currentHintTheme = possibleThemes.length > 0 ? possibleThemes[Math.floor(Math.random() * possibleThemes.length)] : targetWord;
    }

    currentGuess = "";
    hintText.parentElement.style.display = "none"; // ヒントそのものを非表示にする
    
    // Update Board Layout
    board.innerHTML = "";
    
    // Create Grid
    for (let i = 0; i < GAME_MAX_GUESSES; i++) {
        const row = document.createElement("div");
        row.className = "tile-row";
        row.style.gridTemplateColumns = `repeat(${MAX_WORD_LENGTH}, 1fr)`;
        
        for (let j = 0; j < MAX_WORD_LENGTH; j++) {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.id = `tile-${i}-${j}`;
            row.appendChild(tile);
        }
        board.appendChild(row);
    }

    // Restore board UI
    for (let i = 0; i < guesses.length; i++) {
        drawGuessRow(i, guesses[i]);
        colorGuessRow(i, guesses[i], targetWord);
    }

    if (impulseHintsContainer) impulseHintsContainer.innerHTML = "";
    if (revealedHints && revealedHints.length > 0) {
        revealedHints.forEach(hint => {
            const div = document.createElement("div");
            div.className = "impulse-hint-item";
            div.textContent = formatImpulseHint(hint);
            if (impulseHintsContainer) impulseHintsContainer.appendChild(div);
        });
    }
    if (typeof updateImpulseUI === 'function') updateImpulseUI();

    updateUI();
}

function getDateString(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function saveDailyState() {
    const dateStr = getDateString(new Date());
    const state = {
        guesses: guesses,
        gameStatus: gameStatus,
        currentEnergy: currentEnergy,
        revealedHints: revealedHints,
        impulseUsed: impulseUsed,
        currentHintTheme: currentHintTheme
    };
    localStorage.setItem(`megido-wordle-${dateStr}`, JSON.stringify(state));
}

function loadDailyState() {
    const dateStr = getDateString(new Date());
    const saved = localStorage.getItem(`megido-wordle-${dateStr}`);
    if (saved) {
        const state = JSON.parse(saved);
        guesses = state.guesses || [];
        gameStatus = state.gameStatus || "IN_PROGRESS";
        currentEnergy = state.currentEnergy || 0;
        revealedHints = state.revealedHints || [];
        impulseUsed = state.impulseUsed || false;
        currentHintTheme = state.currentHintTheme || null;
    } else {
        guesses = [];
        gameStatus = "IN_PROGRESS";
        currentEnergy = 0;
        revealedHints = [];
        impulseUsed = false;
        currentHintTheme = null;
    }
}

// Check if string contains only Katakana (and prolonged sound mark)
function isKatakana(str) {
    return /^[\u30A0-\u30FF]+$/.test(str);
}

function showMessage(msg, duration = 2000) {
    const el = document.createElement("div");
    el.className = "message";
    el.textContent = msg;
    messageContainer.appendChild(el);
    setTimeout(() => {
        el.classList.add("fade-out");
        setTimeout(() => el.remove(), 300);
    }, duration);
}

function updateCurrentRowUI() {
    const rowIdx = guesses.length;
    if (rowIdx >= GAME_MAX_GUESSES) return;

    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        if (!tile) continue;
        // シェイクアニメーションの残留をクリア（次の入力時に再シェイクしないように）
        tile.classList.remove("shake");
        tile.textContent = currentGuess[i] || "";
        if (currentGuess[i] && i < targetWord.length) {
            tile.setAttribute("data-state", "tbd");
        } else {
            tile.removeAttribute("data-state");
        }
    }
}

guessInput.addEventListener("input", (e) => {
    if (gameStatus !== "IN_PROGRESS") return;
    
    // Auto-convert to katakana mapping or just enforce validation later
    let val = e.target.value.replace(/[\u3041-\u3096]/g, function(match) {
        // Hiragana to Katakana auto conversion if possible (basic)
        const chr = match.charCodeAt(0) + 0x60;
        return String.fromCharCode(chr);
    });

    // 全角英数字を半角に自動変換
    val = val.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    
    // limit length
    if (val.length > MAX_WORD_LENGTH) {
        val = val.substring(0, MAX_WORD_LENGTH);
        e.target.value = val;
    }
    currentGuess = val;
    updateCurrentRowUI();
});

guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        handleSubmit();
    }
});

submitBtn.addEventListener("click", () => {
    handleSubmit();
});

function drawGuessRow(rowIdx, guessWord) {
    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        if (tile) tile.textContent = guessWord[i] || "";
    }
}

function colorGuessRow(rowIdx, guessWord, target) {
    let targetArr = target.split("");
    let guessArr = guessWord.split("");
    let tileStatuses = new Array(MAX_WORD_LENGTH).fill("absent");

    // Pass 1: find correct letters
    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        if (i < target.length && guessArr[i] === targetArr[i]) {
            tileStatuses[i] = "correct";
            targetArr[i] = null;
            guessArr[i] = null;
        }
    }

    // Pass 2: find present letters
    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        if (guessArr[i] !== null && guessArr[i] !== undefined && targetArr.includes(guessArr[i])) {
            tileStatuses[i] = "present";
            targetArr[targetArr.indexOf(guessArr[i])] = null;
        }
    }

    // Apply colors with animation delay
    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        if (!tile) continue;
        setTimeout(() => {
            if (guessWord[i]) {
                tile.classList.add("flip");
                tile.classList.add(tileStatuses[i]);
            }
            // Remove tbd state
            tile.removeAttribute("data-state");
        }, i * 230); // 230ms delay per tile (1.3x faster than 300ms)
    }
    
    return new Promise(resolve => setTimeout(resolve, MAX_WORD_LENGTH * 230 + 300));
}

async function handleSubmit() {
    if (gameStatus !== "IN_PROGRESS") return;
    
    // 送信前にひらがな→カタカナへ強制正規化（IME変換途中でも対応）
    currentGuess = currentGuess.replace(/[\u3041-\u3096]/g, function(match) {
        return String.fromCharCode(match.charCodeAt(0) + 0x60);
    });
    guessInput.value = currentGuess;
    updateCurrentRowUI();

    if (currentGuess.length === 0) {
        shakeCurrentRow();
        return;
    }

    if (!isKatakana(currentGuess)) {
        showMessage("カタカナもしくはひらがなで入力してください");
        shakeCurrentRow();
        return;
    }

    if (!MEGIDO_CHARACTERS.includes(currentGuess)) {
        if (gameMode === "hard") {
            const isHardModeTarget = typeof HARD_LIST !== 'undefined' && HARD_LIST.some(m => m.name === currentGuess);
            if (!isHardModeTarget) {
                showMessage("カタカナもしくはひらがなで入力してください");
                shakeCurrentRow();
                setTimeout(() => { currentGuess = ""; guessInput.value = ""; updateCurrentRowUI(); }, 450);
                return;
            }
        } else {
            if (typeof MOB_CHARACTERS !== 'undefined' && MOB_CHARACTERS.includes(currentGuess)) {
                showMessage("軍団員のメギドではありません");
            } else {
                showMessage("カタカナもしくはひらがなで入力してください");
            }
            shakeCurrentRow();
            setTimeout(() => { currentGuess = ""; guessInput.value = ""; updateCurrentRowUI(); }, 450);
            return;
        }
    }

    if (guesses.includes(currentGuess)) {
        showMessage("再召喚はできません");
        shakeCurrentRow();
        setTimeout(() => {
            currentGuess = "";
            guessInput.value = "";
            updateCurrentRowUI();
        }, 450);
        return;
    }

    const rowIdx = guesses.length;
    const guessToEval = currentGuess;
    
    let gainedEnergy = 8 - guessToEval.length;
    if (gainedEnergy > 0) {
        currentEnergy += gainedEnergy;
        if (typeof updateImpulseUI === 'function') updateImpulseUI();
    }
    
    guesses.push(guessToEval);
    
    // アニメーションは非同期で実行し、待機しない
    colorGuessRow(rowIdx, guessToEval, targetWord);

    if (guessToEval === targetWord) {
        gameStatus = "WIN";
        // フリーモードのストリークを更新
        if (gameMode === "free") {
            freeStreak++;
            if (freeStreak > freeMaxStreak) freeMaxStreak = freeStreak;
            saveFreeStreak();
        } else if (gameMode === "hard") {
            hardStreak++;
            if (hardStreak > hardMaxStreak) hardMaxStreak = hardStreak;
            saveHardStreak();
        } else if (gameMode === "daily") {
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const todayStr = getDateString(todayDate);
            
            let daysDiff = -1;
            if (dailyLastWinDate) {
                const parts = dailyLastWinDate.split('-');
                if (parts.length === 3) {
                    const lastWinObj = new Date(parts[0], parts[1] - 1, parts[2]);
                    const diffTime = todayDate - lastWinObj;
                    daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                }
            }
            
            if (daysDiff === 0) {
                // 同じ日のクリア（リロード等）は増減させない
            } else if (daysDiff >= 1 && daysDiff <= 7) {
                // 1日〜7日の間隔ならチェイン継続
                dailyStreak++;
            } else {
                // 初回プレイ、または8日以上空いた場合
                dailyStreak = 1;
            }
            if (dailyStreak > dailyMaxStreak) dailyMaxStreak = dailyStreak;
            dailyLastWinDate = todayStr;
            saveDailyStreak();
        }
        
        // 正解済みリストに追加
        const megidoInfo = MEGIDO_LIST.find(m => m.name.replace(/[RBC]$/, "") === targetWord);
        if (megidoInfo) {
            solvedMegidos.add(megidoInfo.id);
            saveSolvedMegidos();
        } else if (typeof HARD_LIST !== 'undefined') {
            const hardInfo = HARD_LIST.find(m => m.name === targetWord);
            if (hardInfo) {
                solvedHardMegidos.add(hardInfo.id);
                saveHardSolvedMegidos();
            }
        }

        bounceCurrentRow(rowIdx);
        if (resultTimer) clearTimeout(resultTimer);
        resultTimer = setTimeout(showResult, 1150);
    } else if (guesses.length >= GAME_MAX_GUESSES) {
        gameStatus = "FAIL";
        // ストリークをリセット
        if (gameMode === "free") {
            freeLastStreak = freeStreak;
            freeStreak = 0;
            saveFreeStreak();
        } else if (gameMode === "hard") {
            hardLastStreak = hardStreak;
            hardStreak = 0;
            saveHardStreak();
        } else if (gameMode === "daily") {
            dailyLastStreak = dailyStreak;
            dailyStreak = 0;
            saveDailyStreak();
        }
        updateUI(); // 正解表示をボード下にセット
        if (resultTimer) clearTimeout(resultTimer);
        resultTimer = setTimeout(showResult, 1150);
    }

    if (gameMode === "daily") {
        saveDailyState();
    }

    // ゲーム継続時は入力欄を即座にクリアする
    if (gameStatus === "IN_PROGRESS") {
        currentGuess = "";
        guessInput.value = "";
        // スマホでキーボードを閉じてアニメーションを見せるため、フォーカスを外す
        guessInput.blur();
    } else {
        // ゲーム終了時は入力不可にする
        guessInput.disabled = true;
        submitBtn.disabled = true;
    }
}

function shakeCurrentRow() {
    const rowIdx = guesses.length;
    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        if (tile && currentGuess[i]) {
            tile.classList.remove("shake");
            void tile.offsetWidth; // trigger reflow
            tile.classList.add("shake");
        }
    }
}

function bounceCurrentRow(rowIdx) {
    for (let i = 0; i < MAX_WORD_LENGTH; i++) {
        const tile = document.getElementById(`tile-${rowIdx}-${i}`);
        if (tile && currentGuess[i]) {
            setTimeout(() => {
                tile.classList.add("bounce");
            }, i * 75); // 1.3x faster than 100
        }
    }
}

function updateUI() {
    const answerDisplay = document.getElementById("answer-display");
    
    const helpHardMode = document.getElementById("help-hard-mode");
    if (helpHardMode) {
        if (gameMode === "hard") {
            helpHardMode.classList.remove("d-none");
        } else {
            helpHardMode.classList.add("d-none");
        }
    }

    if (gameStatus !== "IN_PROGRESS") {
        inputContainer.classList.add("d-none");
        playAgainContainer.classList.remove("d-none");
        // ボタン文言をモードに応じて変更
        if (playAgainBtn) {
            playAgainBtn.textContent = (gameMode === "hard")
                ? "もう一回あそぶ（ハードモード）"
                : "もう一回あそぶ（フリーモード）";
        }
        if (impulseBtn) impulseBtn.classList.add("d-none");
        
        // 失敗・降参時はbottom-controls内に正解を表示
        if (gameStatus === "FAIL") {
            const megidoInfo = MEGIDO_LIST.find(m => m.name.replace(/[RBC]$/, "") === targetWord);
            const idText = megidoInfo ? megidoInfo.id : "";
            answerDisplay.innerHTML = `正解：<span style="font-size:13px; color:#a1a1aa;">${idText}</span>　${targetWord}`;
            answerDisplay.style.display = "block";
            document.getElementById("bottom-controls").style.flexDirection = "column";
            document.getElementById("bottom-controls").style.alignItems = "center";
        } else {
            answerDisplay.style.display = "none";
            document.getElementById("bottom-controls").style.flexDirection = "";
        }
    } else {
        inputContainer.classList.remove("d-none");
        playAgainContainer.classList.add("d-none");
        if (impulseBtn) impulseBtn.classList.remove("d-none");
        answerDisplay.style.display = "none";
        guessInput.disabled = false;
        submitBtn.disabled = false;
        guessInput.value = "";
    }
    
    if (gameMode === "daily") {
        modeBtn.textContent = "モード切替";
        const currentDisplayStreak = (gameStatus === "FAIL") ? dailyLastStreak : dailyStreak;
        document.getElementById("mode-subtitle").textContent = `📅 デイリーモード｜${currentDisplayStreak}チェイン`;
        nextBtn.textContent = "フリーモードで遊ぶ";
        nextBtn.classList.remove("d-none");
    } else {
        modeBtn.textContent = "モード切替";
        if (gameMode === "hard") {
            const currentDisplayStreak = (gameStatus === "FAIL") ? hardLastStreak : hardStreak;
            document.getElementById("mode-subtitle").textContent = `🌕 ハードモード｜${currentDisplayStreak}チェイン（最大 ${hardMaxStreak}）`;
        } else {
            const currentDisplayStreak = (gameStatus === "FAIL") ? freeLastStreak : freeStreak;
            document.getElementById("mode-subtitle").textContent = `🎮 フリーモード｜${currentDisplayStreak}チェイン（最大 ${freeMaxStreak}）`;
        }
        nextBtn.textContent = "もう一度遊ぶ";
        nextBtn.classList.remove("d-none");
    }

    const isHardUnlocked = (freeMaxStreak >= 10 || dailyMaxStreak >= 10);
    if (gameMode === "free" && isHardUnlocked) {
        modeBtn.classList.add("hard-next-btn");
    } else {
        modeBtn.classList.remove("hard-next-btn");
    }
}

function showResult() {
    updateUI(); // 確実にUI状態を最新にする
    inputContainer.classList.add("d-none");
    playAgainContainer.classList.remove("d-none");
    
    // アニメーションと競合しないよう、requestAnimationFrameを挟む
    requestAnimationFrame(() => {
        resultModal.classList.remove("hidden");
        // モーダルのスクロール位置を最上部にリセット
        const modalContent = resultModal.querySelector(".modal-content");
        if (modalContent) modalContent.scrollTop = 0;
    });
    
    resultTitle.textContent = gameStatus === "WIN" ? "勝算がある！" : "残念...";
    
    // MEGIDO_LISTからIDを取得して番号付きで表示
    const megidoInfo = MEGIDO_LIST.find(m => {
        const baseName = m.name.replace(/[RBC]$/, "");
        return baseName === targetWord;
    });
    if (megidoInfo) {
        resultTargetWord.innerHTML = `<span style="font-size:13px; color:#a1a1aa; letter-spacing:1px;">${megidoInfo.id}</span><br>${targetWord}`;
    } else {
        resultTargetWord.textContent = targetWord;
    }
    
    // コピペ用のテキストエリアに結果を設定
    const shareText = generateShareText();
    const textarea = document.getElementById("result-textarea");
    if (textarea) {
        textarea.value = shareText;
    }

    // 結果情報の要素を取得
    const streakInfo = document.getElementById("streak-info");
    
    // シェアボタンとコピー機能を表示（両モード共通）
    shareBtn.classList.remove("d-none");
    const copyContainer = document.getElementById("result-copy-container");
    if (copyContainer) copyContainer.classList.remove("d-none");

    // ストリーク情報を設定して表示
    if (streakInfo) {
        const isWin = gameStatus === "WIN";
        const streak = gameMode === "daily" ? dailyStreak : gameMode === "hard" ? hardStreak : freeStreak;
        const maxStreak = gameMode === "daily" ? dailyMaxStreak : gameMode === "hard" ? hardMaxStreak : freeMaxStreak;
        const lastStreak = gameMode === "daily" ? dailyLastStreak : gameMode === "hard" ? hardLastStreak : freeLastStreak;

        if (isWin) {
            let maxStreakHtml = "";
            if (gameMode === "free") {
                maxStreakHtml = `
                    <div class="streak-stat-item">
                        <span class="streak-stat-value">${maxStreak}</span>
                        <span>最大チェイン</span>
                    </div>`;
            }
            const trophy = getChainEmoji(streak) || "🏆";
            streakInfo.innerHTML = `
                <div class="chain-label" style="font-size: 1.2rem; margin-bottom: 10px;">${trophy} ${streak >= 2 ? "チェイン継続中！" : "チェインスタート！"}</div>
                <div class="streak-stats" ${gameMode === "daily" ? 'style="justify-content: center;"' : ''}>
                    <div class="streak-stat-item">
                        <span class="streak-stat-value">${streak}</span>
                        <span>チェイン数</span>
                    </div>
                    ${maxStreakHtml}
                </div>`;
        } else {
            // 敗北：チェイン終了
            let maxStreakHtml = "";
            if (gameMode === "free") {
                maxStreakHtml = `
                    <div class="streak-stat-item">
                        <span class="streak-stat-value">${maxStreak}</span>
                        <span>最大チェイン</span>
                    </div>`;
            }
            streakInfo.innerHTML = `
                <div class="chain-label" style="font-size: 1.2rem; margin-bottom: 10px;">💥 チェイン終了</div>
                <div class="streak-stats" ${gameMode === "daily" ? 'style="justify-content: center;"' : ''}>
                    <div class="streak-stat-item">
                        <span class="streak-stat-value">${lastStreak}</span>
                        <span>到達チェイン</span>
                    </div>
                    ${maxStreakHtml}
                </div>`;
        }
        streakInfo.classList.remove("d-none");
    }
    
    // サブタイトルを更新
    if (gameMode === "daily") {
        const currentDisplayStreak = (gameStatus === "FAIL") ? dailyLastStreak : dailyStreak;
        document.getElementById("mode-subtitle").textContent = `📅 デイリーモード｜${currentDisplayStreak}チェイン`;
    } else if (gameMode === "hard") {
        const currentDisplayStreak = (gameStatus === "FAIL") ? hardLastStreak : hardStreak;
        document.getElementById("mode-subtitle").textContent = `👿 ハードモード｜${currentDisplayStreak}チェイン（最大 ${hardMaxStreak}）`;
    } else {
        const currentDisplayStreak = (gameStatus === "FAIL") ? freeLastStreak : freeStreak;
        document.getElementById("mode-subtitle").textContent = `🎮 フリーモード｜${currentDisplayStreak}チェイン（最大 ${freeMaxStreak}）`;
    }
}

// UI Event Listeners
modeBtn.addEventListener("click", () => {
    const isHardUnlocked = (freeMaxStreak >= 10 || dailyMaxStreak >= 10);
    if (gameMode === "daily") {
        gameMode = "free";
    } else if (gameMode === "free") {
        gameMode = isHardUnlocked ? "hard" : "daily";
    } else {
        gameMode = "daily";
    }
    initGame();
});

giveupBtn.addEventListener("click", () => {
    if (gameStatus !== "IN_PROGRESS") return;
    if (confirm("降参してよいですか？\n勝算がない？")) {
        gameStatus = "FAIL";
        if (gameMode === "free") {
            freeLastStreak = freeStreak;
            freeStreak = 0;
            saveFreeStreak();
        } else if (gameMode === "hard") {
            hardLastStreak = hardStreak;
            hardStreak = 0;
            saveHardStreak();
        } else if (gameMode === "daily") {
            dailyLastStreak = dailyStreak;
            dailyStreak = 0;
            saveDailyStreak();
        }
        if (gameMode === "daily") {
            saveDailyState();
        }
        updateUI();
        showResult();
    }
});

playAgainBtn.addEventListener("click", () => {
    if (gameMode === "daily") {
        gameMode = "free";
    }
    initGame();
});

helpBtn.addEventListener("click", () => {
    helpModal.classList.remove("hidden");
});

closeHelpBtn.addEventListener("click", () => {
    helpModal.classList.add("hidden");
});

// 入力欄横の一覧ボタンのイベントリスナー
function openListModal() {
    // カウント用の集計
    let mainSolvedCount = 0;
    let extraSolvedCount = 0;
    let mainTotalCount = 0;
    const mainCategories = ["祖", "真", "継", "宵"];

    // MEGIDO_LISTを走査して、画面に表示される星の数を直接集計
    MEGIDO_LIST.forEach(m => {
        const cat = m.id.charAt(0);
        const isMain = mainCategories.includes(cat);
        const isSolved = solvedMegidos.has(m.id);

        if (isMain) {
            mainTotalCount++;
            if (isSolved) mainSolvedCount++;
        } else {
            if (isSolved) extraSolvedCount++;
        }
    });

    // リストを生成
    let currentCategory = "";
    let html = "";
    
    // カウント表示HTML（リストの最上部に挿入）
    if (mainSolvedCount > 0 || extraSolvedCount > 0) {
        let countText = "";
        if (mainSolvedCount >= mainTotalCount && mainTotalCount > 0) {
            countText = "⭐: Complete!";
        } else {
            countText = "⭐: " + mainSolvedCount;
        }

        if (extraSolvedCount > 0) {
            countText += ` <span style="font-size: 0.9em; margin-left: 10px; color: var(--primary-color); opacity: 0.8;">(他: ${extraSolvedCount})</span>`;
        }
        
        html += `<div class="megido-count">${countText}</div>`;
    }

    MEGIDO_LIST.forEach(m => {
        const cat = m.id.charAt(0);
        if (cat !== currentCategory) {
            currentCategory = cat;
            html += `<h3 style="margin-top: 15px; border-bottom: 1px solid var(--primary-color); color: var(--primary-color); padding-bottom: 5px;">【${cat}】</h3>`;
        }
        
        // 正解済みメギドは星アイコンを表示（常に同幅の列を確保してずれを防ぐ）
        const isSolved = solvedMegidos.has(m.id);
        const solvedMark = `<span style="width: 20px; display: inline-block; text-align: center; color: #fcd34d; flex-shrink: 0;">${isSolved ? "⭐" : ""}</span>`;

        // 既に入力したメギドは太字の紫で表示
        const baseName = m.name.replace(/[RBC]$/, "");
        const isGuessed = guesses.includes(baseName);
        const nameStyle = isGuessed ? "font-weight: bold; color: #a855f7;" : "";
        html += `<div class="megido-list-item">
                    ${solvedMark}
                    <span class="megido-id">${m.id}</span> 
                    <span class="megido-name" style="${nameStyle}">${m.name}</span>
                 </div>`;
    });
    
    // ハードモード用図鑑（gameModeに関わらず正解済みがいれば追加表示するか、ハード限定にするか。計画通りハード限定で表示）
    if (gameMode === "hard" && typeof HARD_LIST !== 'undefined') {
        html += `<h3 style="margin-top: 15px; border-bottom: 1px solid #bc13fe; color: #bc13fe; padding-bottom: 5px;">【モブメギド・ハルマ】</h3>`;
        HARD_LIST.forEach(m => {
            const isSolved = solvedHardMegidos.has(m.id);
            if (isSolved) {
                const isGuessed = guesses.includes(m.name);
                const nameStyle = isGuessed ? "font-weight: bold; color: #a855f7;" : "";
                html += `<div class="megido-list-item">
                            <span style="width: 20px; display: inline-block; text-align: center; color: #bc13fe; flex-shrink: 0;">⭐</span>
                            <span class="megido-id"></span> 
                            <span class="megido-name" style="${nameStyle}">${m.name}</span>
                         </div>`;
            }
        });
    }

    megidoListContainer.innerHTML = html;
    listModal.classList.remove("hidden");
}

if (listBtn) {
    listBtn.addEventListener("click", () => {
        openListModal();
    });
}

closeListBtn.addEventListener("click", () => {
    listModal.classList.add("hidden");
});

// モーダル外（背景）をタップ・クリックしたら閉じる（メギド72のUI仕様に準拠）
[helpModal, listModal, resultModal, impulseHelpModal].forEach(modal => {
    if (modal) {
        modal.addEventListener("click", (e) => {
            // クリックした要素がモーダル自身（背景）の場合のみ閉じる
            if (e.target === modal) {
                modal.classList.add("hidden");
            }
        });
    }
});

closeModalBtn.addEventListener("click", () => {
    resultModal.classList.add("hidden");
});

nextBtn.addEventListener("click", () => {
    resultModal.classList.add("hidden");
    if (gameMode === "daily") {
        gameMode = "free";
    }
    initGame();
});

// Share logic
function generateShareText() {
    const title = `メギドWordle (${gameMode === "daily" ? "デイリーモード" : gameMode === "hard" ? "ハードモード" : "フリーモード"})`;
    const attempt = gameStatus === "WIN" ? guesses.length : "X";
    const impulseIcon = impulseUsed ? "⚛️" : "";
    const header = `${title} ${attempt}/${GAME_MAX_GUESSES}${impulseIcon}\n`;

    // 「正解：名前　(チェイン)」行を追加
    let extraLine = "";

    if (gameMode === "free") {
        let chainText = "";
        if (gameStatus === "WIN") {
            chainText = freeStreak > 0 ? `${freeStreak}チェイン！${getChainEmoji(freeStreak)}` : "";
        } else {
            chainText = freeLastStreak > 0 ? `${freeLastStreak}チェイン${getChainEmoji(freeLastStreak)}` : "";
        }
        extraLine = chainText ? `正解：${targetWord}　${chainText}\n` : `正解：${targetWord}\n`;
    } else if (gameMode === "hard") {
        let chainText = "";
        if (gameStatus === "WIN") {
            chainText = hardStreak > 0 ? `${hardStreak}チェイン！${getChainEmoji(hardStreak)}` : "";
        } else {
            chainText = hardLastStreak > 0 ? `${hardLastStreak}チェイン${getChainEmoji(hardLastStreak)}` : "";
        }
        extraLine = chainText ? `正解：${targetWord}　${chainText}\n` : `正解：${targetWord}\n`;
    } else if (gameMode === "daily") {
        let chainText = "";
        if (gameStatus === "WIN") {
            chainText = dailyStreak > 0 ? `${dailyStreak}チェイン！${getChainEmoji(dailyStreak)}` : "";
        } else {
            chainText = dailyLastStreak > 0 ? `${dailyLastStreak}チェイン${getChainEmoji(dailyLastStreak)}` : "";
        }
        // デイリーモードはネタバレ防止のため正解名は出さず、チェインのみ出力
        extraLine = chainText ? `${chainText}\n` : "";
    }
    
    let lines = new Array(GAME_MAX_GUESSES).fill("");
    
    guesses.forEach((guess, index) => {
        let targetArr = targetWord.split("");
        let guessArr = guess.split("");
        let rowStatuses = new Array(MAX_WORD_LENGTH).fill("⬛");

        for (let i = 0; i < MAX_WORD_LENGTH; i++) {
            if (i < targetWord.length && guessArr[i] === targetArr[i]) {
                rowStatuses[i] = "🟩";
                targetArr[i] = null;
                guessArr[i] = null;
            }
        }
        for (let i = 0; i < MAX_WORD_LENGTH; i++) {
            if (guessArr[i] !== null && guessArr[i] !== undefined && targetArr.includes(guessArr[i])) {
                rowStatuses[i] = "🟨";
                targetArr[targetArr.indexOf(guessArr[i])] = null;
            } else if (guessArr[i]) {
                if (rowStatuses[i] !== "🟩") {
                    rowStatuses[i] = "⬜";
                }
            }
        }
        lines[index] = rowStatuses.join("");
    });

    // WIN時は正解行（最後の行）を8文字固定の🟩で上書き（文字数推測を防ぐ）
    if (gameStatus === "WIN" && guesses.length > 0) {
        lines[guesses.length - 1] = "🟩🟩🟩🟩🟩🟩🟩🟩";
    }

    let grid = "";
    for (let i = 0; i < guesses.length; i++) {
        grid += lines[i] + "\n";
    }

    const url = "https://megidowordle.vercel.app/";
    return `${header}${extraLine}\n${grid}\n#メギドWordle\n${url}`;
}

shareBtn.addEventListener("click", () => {
    const shareText = generateShareText();
    
    // ユーザー操作に同期して即時呼び出す（ポップアップブロック・スマホアプリ未起動対策）
    // x.comはスマホでXアプリへの遷移が促される
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(tweetUrl, "_blank");
    
    // クリップボードへのコピーは非同期で行う（失敗しても投稿には影響しない）
    navigator.clipboard.writeText(shareText).then(() => {
        showMessage("Xを開きました！クリップボードにもコピー済みです");
    }).catch(() => {
        showMessage("Xを開きました！");
    });
});

const copyTextBtn = document.getElementById("copy-text-btn");
if (copyTextBtn) {
    copyTextBtn.addEventListener("click", () => {
        const textarea = document.getElementById("result-textarea");
        navigator.clipboard.writeText(textarea.value).then(() => {
            const originalText = copyTextBtn.textContent;
            copyTextBtn.textContent = "コピーしました！";
            setTimeout(() => {
                copyTextBtn.textContent = originalText;
            }, 2000);
        });
    });
}

// Impulse Logic

function getTargetHints() {
    let hints = [];
    if (MEGIDO_CHARACTERS.includes(targetWord)) {
        if (typeof MEGIDO_HINTS !== 'undefined' && currentHintTheme && MEGIDO_HINTS[currentHintTheme]) {
            hints = MEGIDO_HINTS[currentHintTheme];
        }
    } else if (typeof HARD_LIST !== 'undefined') {
        const hardChar = HARD_LIST.find(m => m.name === targetWord);
        if (hardChar && hardChar.hints && hardChar.hints.length > 0) {
            hints = hardChar.hints;
        } else {
            hints = ["軍団員のメギドではありません"]; // モブ用のヒント代替テキスト
        }
    }
    return hints;
}

function updateImpulseUI() {
    if (!impulseBtn || !energyCount) return;
    const targetHints = getTargetHints();
    
    if (targetHints.length === 0) {
        impulseBtn.disabled = true;
        impulseBtn.className = "btn-disabled";
        energyCount.textContent = "0";
        return;
    }

    if (impulseUsed) {
        impulseBtn.disabled = false; // クリックしてメッセージを出せるように
        impulseBtn.className = "btn-exhausted";
        energyCount.textContent = "消耗";
        return;
    }

    if (currentEnergy > 35) {
        currentEnergy = 35; // 上限を35に固定
    }

    if (currentEnergy === 35) {
        energyCount.textContent = "最大";
    } else {
        energyCount.textContent = currentEnergy;
    }

    if (currentEnergy >= 35) {
        impulseBtn.disabled = false;
        impulseBtn.className = "btn-ready-3";
    } else if (currentEnergy >= 30) {
        impulseBtn.disabled = false;
        impulseBtn.className = "btn-ready-2";
    } else if (currentEnergy >= 25) {
        impulseBtn.disabled = false;
        impulseBtn.className = "btn-ready-1";
    } else {
        impulseBtn.disabled = false; // ヘルプを表示させるためクリック可能にする
        impulseBtn.className = "btn-disabled";
    }
}

if (impulseBtn) {
    impulseBtn.addEventListener("click", () => {
        if (impulseUsed) {
            showMessage("リリースは1回しか使用できません");
            impulseBtn.blur();
            return;
        }

        if (currentEnergy < 25) {
            const impulseHelpModal = document.getElementById("impulse-help-modal");
            if (impulseHelpModal) impulseHelpModal.classList.remove("hidden");
            impulseBtn.blur();
            return;
        }
        
        let hintsToReveal = 1;
        if (currentEnergy >= 35) {
            hintsToReveal = 3;
        } else if (currentEnergy >= 30) {
            hintsToReveal = 2;
        }

        impulseUsed = true;
        currentEnergy = 0;
        
        const targetHints = getTargetHints();
        const availableHints = targetHints.filter(h => !revealedHints.includes(h));
        
        if (availableHints.length > 0) {
            for (let i = availableHints.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableHints[i], availableHints[j]] = [availableHints[j], availableHints[i]];
            }

            const pickedHints = availableHints.slice(0, Math.min(hintsToReveal, availableHints.length));
            revealedHints.push(...pickedHints);

            pickedHints.forEach(hint => {
                const div = document.createElement("div");
                div.className = "impulse-hint-item";
                div.textContent = formatImpulseHint(hint);
                if (impulseHintsContainer) impulseHintsContainer.appendChild(div);
            });
        }

        updateImpulseUI();
        if (gameMode === "daily") {
            saveDailyState();
        }
        
        impulseBtn.blur();
    });
}

const closeImpulseHelpBtn = document.getElementById("close-impulse-help-btn");
if (closeImpulseHelpBtn) {
    closeImpulseHelpBtn.addEventListener("click", () => {
        if (impulseHelpModal) impulseHelpModal.classList.add("hidden");
    });
}

// Initialize
loadFreeStreak(); // ストリークをlocalStorageから復元
loadHardStreak(); // ハードモードのストリーク
loadSolvedMegidos(); // 正解済みメギドを復元
loadHardSolvedMegidos(); // ハードモード正解済み
initGame();

// === DEBUG / ADMIN TOOLS (Trigger: ?FF11) ===
// デバッグ機能は admin.js に分離されました。
