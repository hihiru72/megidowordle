const GAME_MAX_GUESSES = 10;
let targetWord = "";
let currentGuess = "";
let guesses = [];
let gameMode = "daily"; // 'daily' or 'free'
let gameStatus = "IN_PROGRESS"; // 'IN_PROGRESS', 'WIN', 'FAIL'
let resultTimer = null;

// フリーモード連続正解ストリーク
let freeStreak = 0;
let freeMaxStreak = 0;
let freeLastStreak = 0; // 失敗直前のストリークを保存する用
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

function initGame() {
    if (resultTimer) {
        clearTimeout(resultTimer);
        resultTimer = null;
    }
    // 常にモーダルを隠す（モード切替時の表示バグ修正）
    resultModal.classList.add("hidden");

    // Load state from local storage if daily
    if (gameMode === "daily") {
        targetWord = getDailyTarget();
        loadDailyState();
    } else {
        targetWord = getRandomTarget();
        guesses = [];
        gameStatus = "IN_PROGRESS";
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

    updateUI();
}

function saveDailyState() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const state = {
        guesses: guesses,
        gameStatus: gameStatus
    };
    localStorage.setItem(`megido-wordle-${dateStr}`, JSON.stringify(state));
}

function loadDailyState() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const saved = localStorage.getItem(`megido-wordle-${dateStr}`);
    if (saved) {
        const state = JSON.parse(saved);
        guesses = state.guesses || [];
        gameStatus = state.gameStatus || "IN_PROGRESS";
    } else {
        guesses = [];
        gameStatus = "IN_PROGRESS";
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
        showMessage("カタカナで入力してください");
        shakeCurrentRow();
        return;
    }

    if (!MEGIDO_CHARACTERS.includes(currentGuess)) {
        showMessage("召喚されているメギドの名前を入力してください");
        shakeCurrentRow();
        setTimeout(() => {
            currentGuess = "";
            guessInput.value = "";
            updateCurrentRowUI();
        }, 450);
        return;
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
        }
        
        // 正解済みリストに追加
        const megidoInfo = MEGIDO_LIST.find(m => m.name.replace(/[RBC]$/, "") === targetWord);
        if (megidoInfo) {
            solvedMegidos.add(megidoInfo.id);
            saveSolvedMegidos();
        }

        bounceCurrentRow(rowIdx);
        resultTimer = setTimeout(showResult, 1150);
    } else if (guesses.length >= GAME_MAX_GUESSES) {
        gameStatus = "FAIL";
        // フリーモードのストリークをリセット
        if (gameMode === "free") {
            freeLastStreak = freeStreak; // リセット前に今回のチェイン数を保存
            freeStreak = 0;
            saveFreeStreak();
        }
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
    if (gameStatus !== "IN_PROGRESS") {
        inputContainer.classList.add("d-none");
        playAgainContainer.classList.remove("d-none");
        // If already finished when page loads
        if (guesses.length > 0 && resultModal.classList.contains("hidden")) {
            resultTimer = setTimeout(showResult, 500);
        }
    } else {
        inputContainer.classList.remove("d-none");
        playAgainContainer.classList.add("d-none");
        guessInput.disabled = false;
        submitBtn.disabled = false;
        guessInput.value = "";
    }
    
    if (gameMode === "daily") {
        modeBtn.textContent = "モード切替";
        document.getElementById("mode-subtitle").textContent = "📅 デイリーモード";
        nextBtn.textContent = "フリーモードで遊ぶ";
        nextBtn.classList.remove("d-none");
    } else {
        modeBtn.textContent = "モード切替";
        document.getElementById("mode-subtitle").textContent = `🎮 フリーモード｜チェイン ${freeStreak} ♪最大 ${freeMaxStreak}`;
        nextBtn.textContent = "もう一度遊ぶ";
        nextBtn.classList.remove("d-none");
    }
}

function showResult() {
    inputContainer.classList.add("d-none");
    playAgainContainer.classList.remove("d-none");
    resultModal.classList.remove("hidden");
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
    
    // デイリーモード
    if (gameMode === "daily") {
        shareBtn.classList.remove("d-none");
        const copyContainer = document.getElementById("result-copy-container");
        if (copyContainer) copyContainer.classList.remove("d-none");
        if (streakInfo) streakInfo.classList.add("d-none");
    } else {
        // フリーモード：シェアボタンとコピー機能を表示
        shareBtn.classList.remove("d-none");
        const copyContainer = document.getElementById("result-copy-container");
        if (copyContainer) copyContainer.classList.remove("d-none");
        
        // ストリーク情報を設定して表示
        if (streakInfo) {
            if (gameStatus === "WIN" && freeStreak >= 2) {
                // 2回以上連続正解：チェイン表示
                streakInfo.innerHTML = `
                    <div class="chain-number">${freeStreak - 1}</div>
                    <div class="chain-label">チェイン！</div>
                    <div class="streak-stats">
                        <div class="streak-stat-item">
                            <span class="streak-stat-value">${freeStreak}</span>
                            <span>現在チェイン数</span>
                        </div>
                        <div class="streak-stat-item">
                            <span class="streak-stat-value">${freeMaxStreak}</span>
                            <span>最大チェイン</span>
                        </div>
                    </div>`;
            } else if (gameStatus === "WIN") {
                // 初勝利：チェインスタート
                streakInfo.innerHTML = `
                    <div class="chain-label">🏆 チェインスタート！</div>
                    <div class="streak-stats">
                        <div class="streak-stat-item">
                            <span class="streak-stat-value">${freeMaxStreak}</span>
                            <span>最大チェイン</span>
                        </div>
                    </div>`;
            } else {
                // 敗北：チェイン終了
                streakInfo.innerHTML = `
                    <div class="chain-label">💥 チェイン終了</div>
                    <div class="streak-stats">
                        <div class="streak-stat-item">
                            <span class="streak-stat-value">${freeMaxStreak}</span>
                            <span>最大チェイン</span>
                        </div>
                    </div>`;
            }
            streakInfo.classList.remove("d-none");
        }
        
        // フリーモードのサブタイトルを更新
        document.getElementById("mode-subtitle").textContent = `🎮 フリーモード｜チェイン ${freeStreak} ♪最大 ${freeMaxStreak}`;
    }
}

// UI Event Listeners
modeBtn.addEventListener("click", () => {
    gameMode = gameMode === "daily" ? "free" : "daily";
    initGame();
});

giveupBtn.addEventListener("click", () => {
    if (gameStatus !== "IN_PROGRESS") return;
    if (confirm("降参してよいですか？\n勝算がない？")) {
        gameStatus = "FAIL";
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
    // リストを常に再生成して既入力名を色付ける
    let currentCategory = "";
    let html = "";
    MEGIDO_LIST.forEach(m => {
        const cat = m.id.charAt(0);
        if (cat !== currentCategory) {
            currentCategory = cat;
            html += `<h3 style="margin-top: 15px; border-bottom: 1px solid var(--primary-color); color: var(--primary-color); padding-bottom: 5px;">【${cat}】</h3>`;
        }
        
        // 正解済みメギドは星アイコンを表示
        const isSolved = solvedMegidos.has(m.id);
        const solvedMark = isSolved ? '<span style="color: #fcd34d; margin-right: 4px;">⭐</span>' : "";

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
[helpModal, listModal, resultModal].forEach(modal => {
    modal.addEventListener("click", (e) => {
        // クリックした要素がモーダル自身（背景）の場合のみ閉じる
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
    });
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
    const title = `メギドWordle (${gameMode === "daily" ? "デイリーモード" : "フリーモード"})`;
    const attempt = gameStatus === "WIN" ? guesses.length : "X";
    const header = `${title} ${attempt}/${GAME_MAX_GUESSES}\n`;

    // フリーモードの場合は「正解：名前　(チェイン)」行を追加
    let extraLine = "";
    if (gameMode === "free") {
        let chainText;
        if (gameStatus === "WIN" && freeStreak >= 2) {
            chainText = `${freeStreak - 1}チェイン！（最大${freeMaxStreak}チェイン）`;
        } else if (gameStatus === "WIN") {
            chainText = "チェインスタート！";
        } else {
            // 失敗時：保存した今回のチェイン数と最大を表示
            chainText = `チェイン終了（チェイン数：${freeLastStreak}　最大チェイン：${freeMaxStreak}）`;
        }
        extraLine = `正解：${targetWord}　${chainText}\n`;
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

    let grid = "";
    // 推測した回数分だけ、縦に1行ずつ出力する（2列表示をやめる）
    for (let i = 0; i < guesses.length; i++) {
        grid += lines[i] + "\n";
    }

    const url = "https://megidowordle.vercel.app/";
    return `${header}${extraLine}\n${grid}\n#メギド72 #メギドWordle\n${url}`;
}

shareBtn.addEventListener("click", () => {
    const shareText = generateShareText();
    
    navigator.clipboard.writeText(shareText).then(() => {
        showMessage("結果をクリップボードにコピーしました！Twitterを開きます。");
        setTimeout(() => {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank");
        }, 800);
    }).catch(() => {
        showMessage("コピーに失敗しました。手動でシェアしてください。");
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, "_blank");
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

// Initialize
loadFreeStreak(); // ストリークをlocalStorageから復元
loadSolvedMegidos(); // 正解済みメギドを復元
initGame();
