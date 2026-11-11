import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Settings, List, Timer, Edit2, X, Plus, Minus, Layers, Trash2, Clock, AlertCircle, Printer, Camera, Sparkles, ChevronDown, Save, Check, Search, Filter, Calendar, Globe, PenTool, SlidersHorizontal, RotateCcw, HelpCircle, Key, Download, Upload, Copy, Lock, Unlock, CheckCircle2, Building2, Trophy } from 'lucide-react';

// --- アプリの定数 ---
const DEFAULT_CLUBS = [
  { id: 'default', name: 'メインクラブ' }
];

const MAX_COMPETITIONS = 8;

const LEVEL_CATEGORIES = [
  { id: 'enjoy', name: 'エンジョイマスターズ', desc: '健康維持・楽しく泳ぐ' },
  { id: 'special', name: 'スペシャルマスターズ', desc: '大会出場・記録更新' }
];

const DEFAULT_LOGIC_SETTINGS = {
  levels: [
    { id: 'enjoy-beginner', category: 'enjoy', name: '初級', basePace25: 35, desc: 'マイペース' },
    { id: 'enjoy-intermediate', category: 'enjoy', name: '中級', basePace25: 30, desc: '定期的に泳ぐ' },
    { id: 'enjoy-advanced', category: 'enjoy', name: '上級', basePace25: 25, desc: '長距離も' },
    { id: 'special-beginner', category: 'special', name: '初級', basePace25: 22, desc: '大会へ' },
    { id: 'special-intermediate', category: 'special', name: '中級', basePace25: 18, desc: '上位入賞' },
    { id: 'special-advanced', category: 'special', name: '上級', basePace25: 14, desc: '全国レベル' }
  ],
  distanceLimits: {
    enjoy: { min: 700, max: 1600 },
    special: { min: 1000, max: 2500 }
  },
  menuDistances: {
    enjoy: {
      WUp: 25,
      Kick: 25,
      Drill: 25,
      Pull: 25,
      Main: 25,
      MainEndurance: 50,
      Down: 25,
      maxRepDist: 100,
      minDownTotal: 50
    },
    special: {
      WUp: 50,
      Kick: 50,
      Drill: 50,
      Pull: 50,
      Main: 50,
      MainEndurance: 100,
      Down: 50,
      maxRepDist: 100,
      minDownTotal: 50
    }
  },
  baseRatios: {
    default: { WUp: 15, Kick: 15, Drill: 15, Pull: 15, Main: 30, Down: 10 },
    endurance: { WUp: 15, Kick: 10, Drill: 10, Pull: 15, Main: 40, Down: 10 },
    speed: { WUp: 15, Kick: 15, Drill: 15, Pull: 15, Main: 30, Down: 10 },
    technique: { WUp: 15, Kick: 15, Drill: 25, Pull: 15, Main: 20, Down: 10 },
    recovery: { WUp: 25, Kick: 15, Drill: 20, Pull: 15, Main: 15, Down: 10 }
  },
  periodAdjustments: {
    prep: { WUp: 5, Kick: 0, Drill: 5, Pull: 0, Main: -10, Down: 0 },
    quantity: { WUp: 0, Kick: 0, Drill: -5, Pull: 0, Main: 10, Down: -5 },
    qual_quan: { WUp: 0, Kick: 5, Drill: 0, Pull: -10, Main: 5, Down: 0 },
    quality: { WUp: 5, Kick: 0, Drill: 0, Pull: 0, Main: -5, Down: 0 },
    taper: { WUp: 10, Kick: 0, Drill: 0, Pull: 0, Main: -15, Down: 5 }
  }
};

const PURPOSE_NAMES = { default: 'デフォルト', endurance: '持久力向上', speed: 'スピード向上', technique: 'テクニック向上', recovery: 'フォーム向上' };
const PART_KEYS = ['WUp', 'Kick', 'Drill', 'Pull', 'Main', 'Down'];

const PURPOSES = [
  { id: 'endurance', name: '持久力向上', desc: '長距離を一定ペース' },
  { id: 'speed', name: 'スピード向上', desc: '短距離を高い強度で' },
  { id: 'technique', name: 'テクニック向上', desc: 'ドリル・フォーム重視' },
  { id: 'recovery', name: 'フォーム向上', desc: '疲労回復・フォーム確認' }
];

const PERIODS = [
  { id: 'prep', name: '準備期', desc: 'フォーム・基礎体力' },
  { id: 'quantity', name: '量的期', desc: '持久力強化' },
  { id: 'qual_quan', name: '質量的期', desc: 'スピード＋持久力' },
  { id: 'quality', name: '質的期', desc: 'スピード強化' },
  { id: 'taper', name: 'テーパー期', desc: 'レースペース' }
];

const STYLES = ['Choice', 'Fr', 'Ba', 'Br', 'Fly', 'IM', 'S1'];

const apiKey = "";

// --- 公開版: ブラウザ保存領域の安全なラッパー ---
// プライベートブラウズや一部のアプリ内ブラウザでは localStorage が使えず例外になるため、
// その場合はメモリ上に保存して画面が真っ白にならないようにする
const safeStorage = (() => {
  const mem = {};
  let ls = null;
  try {
    ls = window.localStorage;
    ls.setItem('__mm_test', '1');
    ls.removeItem('__mm_test');
  } catch {
    ls = null;
  }
  return {
    getItem: (k) => {
      try { return ls ? ls.getItem(k) : (k in mem ? mem[k] : null); } catch { return null; }
    },
    setItem: (k, v) => {
      try { if (ls) ls.setItem(k, String(v)); else mem[k] = String(v); } catch {}
    }
  };
})();

// --- Gemini API 共通呼び出し ---
// 旧モデル gemini-2.5-flash-preview-09-2025 は提供終了済み。
// 常に最新のFlashを指す公式エイリアスを既定にし、上限・未提供時は Flash-Lite に自動で切り替える。
const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
const GEMINI_FALLBACK_MODEL = 'gemini-flash-lite-latest';

class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const callGemini = async (payload, customApiKey = "", model = "", maxRetries = 2) => {
  const key = (customApiKey || '').trim() || apiKey;
  if (!key) throw new GeminiError('APIキーが設定されていません', 'NO_KEY');

  const models = [...new Set([(model || '').trim() || GEMINI_DEFAULT_MODEL, GEMINI_FALLBACK_MODEL])];
  let lastError = new GeminiError('API呼び出しに失敗しました', 'UNKNOWN');

  for (const m of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response;
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(payload)
        });
      } catch {
        lastError = new GeminiError('通信エラー', 'NETWORK');
        if (attempt < maxRetries) { await sleep(1000 * 2 ** attempt); continue; }
        break;
      }

      if (response.ok) {
        const result = await response.json();
        const text = (result.candidates?.[0]?.content?.parts || [])
          .filter(part => !part.thought)
          .map(part => part.text || '')
          .join('')
          .trim();
        if (text) return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        lastError = new GeminiError('AIの応答が空でした', 'EMPTY');
        if (attempt < maxRetries) { await sleep(1000 * 2 ** attempt); continue; }
        break;
      }

      const bodyText = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403 || /API_KEY_INVALID|API key not valid/i.test(bodyText)) {
        // キーが無効なら何度試しても同じなので即終了
        throw new GeminiError('APIキーが無効です', 'BAD_KEY');
      }
      if (response.status === 429) {
        lastError = new GeminiError('無料枠の上限に達しました', 'QUOTA');
        break; // 次のモデル(Flash-Lite)へ
      }
      if (response.status === 400 || response.status === 404) {
        lastError = new GeminiError('モデルが利用できません', 'NO_MODEL');
        break; // 次のモデルへ
      }
      // 5xx などの一時的なエラーは間隔をあけて再試行
      lastError = new GeminiError('AIサーバーが混雑しています', 'SERVER');
      if (attempt < maxRetries) await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
};

const geminiErrorToast = (error, fallbackLabel) => {
  const code = error?.code;
  if (code === 'NO_KEY') return `APIキー未設定のため${fallbackLabel}`;
  if (code === 'BAD_KEY') return `APIキーが無効なため${fallbackLabel}`;
  if (code === 'QUOTA') return `AI無料枠の上限のため${fallbackLabel}`;
  return `AI通信エラーのため${fallbackLabel}`;
};

const fetchWorkoutFromGemini = async (params, logicSettings, customApiKey = "", model = "") => {
  const baseRatio = logicSettings.baseRatios[params.purposeId] || logicSettings.baseRatios.default;
  const adj = logicSettings.periodAdjustments[params.periodId] || { WUp:0, Kick:0, Drill:0, Pull:0, Main:0, Down:0 };
  const targetLevel = logicSettings.levels.find(l => l.id === params.levelId);
  const isSpecial = params.levelId.includes('special');
  const distConfig = logicSettings.menuDistances?.[isSpecial ? 'special' : 'enjoy'] || DEFAULT_LOGIC_SETTINGS.menuDistances[isSpecial ? 'special' : 'enjoy'];
  const mainTargetDist = params.purposeId === 'endurance' ? distConfig.MainEndurance : distConfig.Main;

  const systemInstruction = `あなたはプロのマスターズ水泳コーチです。
ユーザーから提供される「レベル」「目的」「トレーニング期」「テーマ」「総距離」に基づき、最適な水泳の練習メニューを作成してください。
以下のルールに厳密に従ってJSONを出力してください。
1. 各パート(W-Up, Kick, Drill, Pull, Main, Down)の総距離(total)の合計が、必ず目標の総距離と一致すること。
2. ダウン(Down)は必ず最後に入れ、最低${distConfig.minDownTotal}m確保すること。
3. distance(1本の距離)は5の倍数にし、最大${distConfig.maxRepDist}m以下にすること。各パートの1本あたりの基準距離は W-Up:${distConfig.WUp}m、Kick:${distConfig.Kick}m、Drill:${distConfig.Drill}m、Pull:${distConfig.Pull}m、Main:${mainTargetDist}m、Down:${distConfig.Down}m を目安にすること。
4. circleSeconds(サークルタイム)は5の倍数にすること(ダウンやリカバリーの場合は0でも可)。
5. styleは 'Choice', 'Fr', 'Ba', 'Br', 'Fly', 'IM', 'S1' のいずれか。
6. 日本語でdescriptionを記述すること。
7. 参考：各パートの距離割合の目安は、W-Up:${baseRatio.WUp+adj.WUp}%、Kick:${baseRatio.Kick+adj.Kick}%、Drill:${baseRatio.Drill+adj.Drill}%、Pull:${baseRatio.Pull+adj.Pull}%、Main:${baseRatio.Main+adj.Main}% とし、Downは最低${distConfig.minDownTotal}mを確保して残り距離を埋めること。
8. 参考：対象レベルの25mあたりの基準ペースは ${targetLevel ? targetLevel.basePace25 : 30}秒 です。これをもとにサークルを適宜設定してください。`;

  const userQuery = `
条件:
- カテゴリ: ${params.levelCategoryName}
- レベル: ${params.levelName} (${params.levelDesc})
- 目的: ${params.purposeName}
- トレーニング期: ${params.periodName}
- テーマ: ${params.theme || '特になし'}
- 総距離: ${params.totalDistance}m

この条件に最適なメニューをJSONで生成してください。`;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            type: { type: "STRING" },
            partRestSeconds: { type: "INTEGER" },
            total: { type: "INTEGER" },
            sets: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  distance: { type: "INTEGER" },
                  reps: { type: "INTEGER" },
                  setsCount: { type: "INTEGER" },
                  restSeconds: { type: "INTEGER" },
                  style: { type: "STRING" },
                  circleSeconds: { type: "INTEGER" },
                  description: { type: "STRING" }
                },
                required: ["distance", "reps", "setsCount", "restSeconds", "style", "circleSeconds", "description"]
              }
            }
          },
          required: ["name", "type", "partRestSeconds", "total", "sets"]
        }
      }
    }
  };

  const text = await callGemini(payload, customApiKey, model);
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.some(part => !Array.isArray(part?.sets))) {
    throw new GeminiError('AIの応答形式が不正です', 'FORMAT');
  }
  const stamp = Date.now();
  return parsed.map((part, pIdx) => {
    const sets = part.sets.map((set, sIdx) => {
      const distance = Math.max(5, Number(set.distance) || 25);
      const circleSeconds = Math.max(0, Number(set.circleSeconds) || 0);
      return {
        ...set,
        distance,
        reps: Math.max(1, Number(set.reps) || 1),
        setsCount: Math.max(1, Number(set.setsCount) || 1),
        restSeconds: Math.max(0, Number(set.restSeconds) || 0),
        style: STYLES.includes(set.style) ? set.style : 'Choice',
        description: set.description || '',
        circleSeconds,
        id: `set-${stamp}-${pIdx}-${sIdx}`,
        circle: circleSeconds > 0 ? formatTime(circleSeconds) : null
      };
    });
    return {
      ...part,
      id: `part-${stamp}-${pIdx}`,
      type: part.type || part.name || 'Main',
      partRestSeconds: Math.max(0, Number(part.partRestSeconds) || 0),
      // 表示や時間計算と食い違わないよう、合計距離はセット内容から再計算する
      total: sets.reduce((sum, st) => sum + st.distance * st.reps * st.setsCount, 0),
      sets
    };
  });
};

const translateWithGemini = async (texts, targetLang, customApiKey = "", model = "") => {
  if (!texts || texts.length === 0) return {};

  const langName = targetLang === 'en' ? 'English' : 'Chinese (Traditional/Simplified)';
  
  const systemInstruction = `あなたはプロの水泳コーチであり、優秀な翻訳家です。提供された水泳の練習メニューに関する日本語のテキスト配列を、指定された言語（${langName}）に翻訳してください。
水泳特有の用語（例：キャッチ、プル、サークル、イーブンペース、セット、レスト、ハードなど）は、その言語での一般的な水泳用語として適切に翻訳してください。
元の配列と同じ要素数・同じ順番の文字列配列を必ずJSON形式で返してください。`;

  const payload = {
    contents: [{ parts: [{ text: JSON.stringify(texts) }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: { type: "STRING" }
      }
    }
  };

  const text = await callGemini(payload, customApiKey, model, 1);
  const translatedArray = JSON.parse(text);
  if (!Array.isArray(translatedArray) || translatedArray.length !== texts.length) {
    throw new GeminiError('翻訳結果の形式が不正です', 'FORMAT');
  }
  const translationMap = {};
  texts.forEach((original, idx) => {
    translationMap[original] = translatedArray[idx];
  });
  return translationMap;
};

// --- 翻訳データ ---
const TRANSLATIONS = {
  ja: {
    distance: '距離', purpose: '目的', totalDist: '総泳距離', period: '期',
    circle: 'ｻｰｸﾙ', rest: '休憩', setRest: 'Set Rest', theme: 'テーマ',
    nextMeet: '直近大会', daysLeftPrefix: 'あと', daysLeftSuffix: '日', todayMeet: '本日開催!', pastMeetSuffix: '日前',
    enjoy: 'エンジョイマスターズ', special: 'スペシャルマスターズ',
    purposes: { endurance: '持久力向上', speed: 'スピード向上', technique: 'テクニック向上', recovery: 'フォーム向上' },
    periods: { prep: '準備期', quantity: '量的期', qual_quan: '質量的期', quality: '質的期', taper: 'テーパー期' },
    desc: {
      'ゆったりと体をほぐす': 'ゆったりと体をほぐす',
      '板キック / 姿勢を意識': '板キック / 姿勢を意識',
      'ドリル / フォームを意識': 'ドリル / フォームを意識',
      'ブイ使用 / キャッチを意識': 'ブイ使用 / キャッチを意識',
      '心拍数を整える': '心拍数を整える',
      'イーブンペースを保つ': 'イーブンペースを保つ',
      'Hard! 質を落とさずに': 'Hard! 質を落とさずに',
      'フォームを崩さず丁寧に': 'フォームを崩さず丁寧に',
      '気持ちよく泳ぐ': '気持ちよく泳ぐ',
      '追加メニュー': '追加メニュー'
    }
  },
  en: {
    distance: 'Dist', purpose: 'Focus', totalDist: 'Total Distance', period: 'Phase',
    circle: 'Cycle', rest: 'Rest', setRest: 'Set Rest', theme: 'Theme',
    nextMeet: 'Next Meet', daysLeftPrefix: '', daysLeftSuffix: ' days left', todayMeet: 'Today!', pastMeetSuffix: ' days ago',
    enjoy: 'Enjoy Masters', special: 'Special Masters',
    purposes: { endurance: 'Endurance', speed: 'Speed', technique: 'Technique', recovery: 'Form' },
    periods: { prep: 'Prep Phase', quantity: 'Quantity Phase', qual_quan: 'Qual/Quan Phase', quality: 'Quality Phase', taper: 'Taper Phase' },
    desc: {
      'ゆったりと体をほぐす': 'Relax and loosen up',
      '板キック / 姿勢を意識': 'Kickboard / Focus on posture',
      'ドリル / フォームを意識': 'Drill / Focus on form',
      'ブイ使用 / キャッチを意識': 'Pull buoy / Focus on catch',
      '心拍数を整える': 'Regulate heart rate',
      'イーブンペースを保つ': 'Maintain even pace',
      'Hard! 質を落とさずに': 'Hard! Maintain quality',
      'フォームを崩さず丁寧に': 'Carefully, keep form',
      '気持ちよく泳ぐ': 'Swim comfortably',
      '追加メニュー': 'Additional menu'
    }
  },
  zh: {
    distance: '距離', purpose: '目的', totalDist: '總距離', period: '階段',
    circle: '循環', rest: '休息', setRest: '組間休息', theme: '主題',
    nextMeet: '近期賽事', daysLeftPrefix: '倒數', daysLeftSuffix: '天', todayMeet: '今日舉行!', pastMeetSuffix: '天前',
    enjoy: '享受游泳', special: '專業游泳',
    purposes: { endurance: '耐力提升', speed: '速度提升', technique: '技巧提升', recovery: '姿勢調整' },
    periods: { prep: '準備期', quantity: '量化期', qual_quan: '質量期', quality: '質化期', taper: '減量期' },
    desc: {
      'ゆったりと体をほぐす': '放鬆身體',
      '板キック / 姿勢を意識': '浮板打水 / 注意姿勢',
      'ドリル / フォームを意識': '分解動作 / 注意姿勢',
      'ブイ使用 / キャッチを意識': '夾浮球 / 注意抓水',
      '心拍数を整える': '調整心率',
      'イーブンペースを保つ': '保持均速',
      'Hard! 質を落とさずに': '全力！保持質量',
      'フォームを崩さず丁寧に': '保持姿勢，仔細游',
      '気持ちよく泳ぐ': '輕鬆游',
      '追加メニュー': '追加菜單'
    }
  }
};

// --- 翻訳用単語辞書 (フリーテキスト部分一致用・大幅拡張版) ---
const WORD_DICT = {
  en: {
    'キャッチ': 'Catch', 'プル': 'Pull', 'キック': 'Kick', 'スイム': 'Swim', 'ドリル': 'Drill', 'バタ足': 'Flutter kick',
    'ハード': 'Hard', 'イージー': 'Easy', 'ダッシュ': 'Dash', 'ゆっくり': 'Slowly', '速く': 'Fast', 'ペース': 'Pace',
    '大きく': 'Big', '丁寧に': 'Carefully', '呼吸': 'Breathing', 'ターン': 'Turn', 'バサロ': 'Dolphin kick',
    'ストリームライン': 'Streamline', 'アップ': 'Warm-up', 'ダウン': 'Cool-down', 'ウォーミングアップ': 'Warm-up', 'クールダウン': 'Cool-down',
    'を意識する': ' focus', 'を意識': ' focus', '意識する': ' focus', '意識': 'Focus', '保つ': ' maintain', 'キープ': 'Keep',
    'イーブンペース': 'Even pace', 'フォーム': 'Form', '姿勢': 'Posture', '心拍数': 'Heart rate', '整える': ' regulate',
    '質': 'Quality', '落とさずに': ' without dropping', '気持ちよく': 'Comfortably', '泳ぐ': ' swim',
    '追加メニュー': 'Additional menu', 'タイム': 'Time', '測定': ' trial',
    '個人メドレー': 'IM', 'クロール': 'Crawl', '背泳ぎ': 'Backstroke', '平泳ぎ': 'Breaststroke', 'バタフライ': 'Butterfly',
    'フリー': 'Freestyle', 'ブレスト': 'Breaststroke', 'バック': 'Backstroke', 'フライ': 'Butterfly',
    'インターバル': 'Interval', 'レスト': 'Rest', 'セット': 'Set', 'ビルドアップ': 'Build up', 'ディセンディング': 'Descending',
    'スムース': 'Smooth', 'チョイス': 'Choice', '全力': 'All out', '潜水': 'Underwater', 'ノーブレ': 'No breathing', 'ハイポ': 'Hypo',
    'スタート': 'Start', '飛び込み': 'Dive', '浮き上がり': 'Breakout', 'タッチ': 'Touch', '壁': 'Wall',
    '長距離': 'Long distance', '短距離': 'Sprint', '中距離': 'Middle distance',
    'フィン': 'Fins', 'パドル': 'Paddles', 'チューブ': 'Tube', 'パラシュート': 'Parachute', '板': 'Kickboard', 'ブイ': 'Pull buoy',
    'スノーケル': 'Snorkel', 'シュノーケル': 'Snorkel', 'ストローク': 'Stroke', 'テンポ': 'Tempo', 'ピッチ': 'Pitch',
    '上げる': ' raise', '下げる': ' lower', '気を付ける': ' be careful', '注意する': ' pay attention', '注意': 'Attention',
    'から': ' from ', 'まで': ' to ', '約': 'About ', '回': ' times', '秒': 'sec', '分': 'min'
  },
  zh: {
    'キャッチ': '抓水', 'プル': '划水', 'キック': '打水', 'スイム': '游泳', 'ドリル': '分解動作', 'バタ足': '自由式打水',
    'ハード': '全力', 'イージー': '輕鬆', 'ダッシュ': '衝刺', 'ゆっくり': '慢慢', '速く': '快', 'ペース': '配速',
    '大きく': '大動作', '丁寧に': '仔細', '呼吸': '換氣', 'ターン': '轉身', 'バサロ': '蝶腰',
    'ストリームライン': '流線型', 'アップ': '熱身', 'ダウン': '緩和', 'ウォーミングアップ': '熱身', 'クールダウン': '緩和',
    'を意識する': ' 注意', 'を意識': ' 注意', '意識する': ' 注意', '意識': '注意', '保つ': ' 保持', 'キープ': '保持',
    'イーブンペース': '均速', 'フォーム': '姿勢', '姿勢': '姿勢', '心拍数': '心率', '整える': ' 調整',
    '質': '質量', '落とさずに': ' 不下降', '気持ちよく': '輕鬆地', '泳ぐ': ' 游',
    '追加メニュー': '追加菜單', 'タイム': '時間', '測定': ' 測驗',
    '個人メドレー': '混合式', 'クロール': '自由式', '背泳ぎ': '仰式', '平泳ぎ': '蛙式', 'バタフライ': '蝶式',
    'フリー': '自由式', 'ブレスト': '蛙式', 'バック': '仰式', 'フライ': '蝶式',
    'インターバル': '間歇', 'レスト': '休息', 'セット': '組', 'ビルドアップ': '漸快', 'ディセンディング': '漸快',
    'スムース': '順暢', 'チョイス': '自選', '全力': '全力', '潜水': '潛水', 'ノーブレ': '不換氣', 'ハイポ': '低氧',
    'スタート': '出發', '飛び込み': '跳水', '浮き上がり': '出水', 'タッチ': '觸壁', '壁': '牆壁',
    '長距離': '長距離', '短距離': '短距離', '中距離': '中距離',
    'フィン': '蛙鞋', 'パドル': '划手板', 'チューブ': '拉力繩', 'パラシュート': '阻力傘', '板': '浮板', 'ブイ': '夾浮球',
    'スノーケル': '呼吸管', 'シュノーケル': '呼吸管', 'ストローク': '划水', 'テンポ': '節奏', 'ピッチ': '頻率',
    '上げる': ' 提高', '下げる': ' 降低', '気を付ける': ' 小心', '注意する': ' 注意', '注意': '注意',
    'から': ' 從 ', 'まで': ' 到 ', '約': '大約 ', '回': ' 次', '秒': '秒', '分': '分'
  }
};

// --- ユーティリティ関数 ---
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return 'なし';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}"`;
  return `${m}'${s.toString().padStart(2, '0')}"`;
};

const formatTimeObj = (dateObj) => {
  if (!dateObj) return '';
  return `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
};

const formatShortDateWithDay = (dateStr) => {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const day = days[dateObj.getDay()];
  return `${m}/${d}(${day})`;
};

const getDaysUntilDate = (targetDateStr, baseDateStr) => {
  if (!targetDateStr) return null;
  const parts = targetDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const baseStr = baseDateStr || getTodayDateStr();
  const baseParts = baseStr.split('-').map(Number);
  if (baseParts.length !== 3 || baseParts.some(isNaN)) return null;

  const target = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  const base = new Date(baseParts[0], baseParts[1] - 1, baseParts[2], 0, 0, 0, 0);
  if (isNaN(target.getTime()) || isNaN(base.getTime())) return null;
  return Math.round((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
};

const formatCompetitionPeriod = (comp, includeYear = false) => {
  if (!comp) return '';
  const start = comp.startDate || comp.date;
  const end = comp.endDate || start;
  if (!start) return '';
  const startFormatted = formatShortDateWithDay(start);
  const yearSuffix = includeYear ? ` (${start.slice(0, 4)})` : '';
  if (!end || start === end) {
    return `${startFormatted}${yearSuffix}`;
  }
  const endFormatted = formatShortDateWithDay(end);
  return `${startFormatted}〜${endFormatted}${yearSuffix}`;
};

const getCompetitionDaysUntil = (comp, baseDateStr) => {
  if (!comp) return null;
  const start = comp.startDate || comp.date;
  const end = comp.endDate || start;
  if (!start) return null;
  const daysToStart = getDaysUntilDate(start, baseDateStr);
  const daysToEnd = getDaysUntilDate(end, baseDateStr);
  if (daysToStart === null) return null;
  if (daysToStart > 0) return daysToStart;
  if (daysToEnd !== null && daysToEnd >= 0) return 0; // 開催期間中
  return daysToEnd !== null ? daysToEnd : daysToStart;
};

const roundTo10 = (num) => Math.max(0, Math.round(num / 10) * 10);

const calculateCircle = (distance, levelId, intensity = 1.0, logicSettings) => {
  const level = logicSettings.levels.find(l => l.id === levelId);
  if (!level) return 0;
  const base25 = level.basePace25;
  const timeInSeconds = Math.ceil(((distance / 25) * base25 * (1 + (distance/25)*0.015)) * intensity);
  return Math.ceil(timeInSeconds / 5) * 5;
};

const getSetDuration = (set, levelId, logicSettings) => {
  let baseSeconds = set.circleSeconds;
  if (baseSeconds === 0) {
    const level = logicSettings.levels.find(l => l.id === levelId) || logicSettings.levels[0];
    baseSeconds = Math.ceil((set.distance / 25) * level.basePace25 * 1.3);
  }
  return (baseSeconds * set.reps * set.setsCount) + (set.restSeconds * (set.setsCount - 1));
};

const getEstimatedDistance = (startStr, endStr, levelId, purposeId, periodId, logicSettings) => {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMinutes <= 0) diffMinutes += 24 * 60;
  
  const level = logicSettings.levels.find(l => l.id === levelId) || logicSettings.levels[0];
  
  let purposeWeight = 0.5;
  if (purposeId === 'endurance') purposeWeight = 1.0;
  if (purposeId === 'speed') purposeWeight = 0.0;
  
  let levelWeight = 0.5;
  if (level.id.includes('beginner')) levelWeight = 0.0;
  if (level.id.includes('advanced')) levelWeight = 1.0;

  const totalWeight = (purposeWeight + levelWeight) / 2;

  let base60MinDist = 0;
  const limits = logicSettings.distanceLimits || { enjoy: {min: 700, max: 1600}, special: {min: 1000, max: 2500} };
  if (level.category === 'enjoy') {
    const minD = limits.enjoy.min;
    const maxD = limits.enjoy.max;
    base60MinDist = minD + (maxD - minD) * totalWeight;
  } else {
    const minD = limits.special.min;
    const maxD = limits.special.max;
    base60MinDist = minD + (maxD - minD) * totalWeight;
  }

  let periodWeight = 1.0;
  if (periodId === 'prep') periodWeight = 0.9;
  if (periodId === 'quantity') periodWeight = 1.1; 
  if (periodId === 'qual_quan') periodWeight = 1.0;
  if (periodId === 'quality') periodWeight = 0.85;
  if (periodId === 'taper') periodWeight = 0.6; 
  
  const estimated = base60MinDist * (diffMinutes / 60) * periodWeight;
  return roundTo10(estimated);
};

const getPartColors = (name) => {
  const n = name.toLowerCase();
  if (n.includes('main')) return { border: 'border-orange-500', text: 'text-orange-700', badgeText: 'text-orange-950', badgeBg: 'bg-orange-200', badgeBorder: 'border-orange-500', headerBg: 'bg-orange-100', setBg: 'bg-orange-50/40' };
  return { border: 'border-slate-400', text: 'text-slate-700', badgeText: 'text-black', badgeBg: 'bg-slate-100', badgeBorder: 'border-slate-300', headerBg: 'bg-slate-100', setBg: 'bg-slate-50/50' };
};

const cloneDefaultLogicSettings = () => JSON.parse(JSON.stringify(DEFAULT_LOGIC_SETTINGS));

const getTodayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const createDefaultClubProfile = (overrides = {}) => ({
  logicSettings: cloneDefaultLogicSettings(),
  useAiMode: false,
  isCurrentAiGenerated: false,
  levelCategory: LEVEL_CATEGORIES[0].id,
  levelId: 'enjoy-intermediate',
  purpose: PURPOSES[0].id,
  period: PERIODS[1].id,
  purposeDetail: "",
  distance: "2000",
  startTime: "10:00",
  endTime: "11:00",
  workoutData: null,
  printDate: getTodayDateStr(),
  printFont: 'handwriting',
  printLang: 'ja',
  competitions: [],
  showCompetitionOnPrint: true,
  ...overrides
});

const loadInitialClubProfiles = (initialClubId) => {
  try {
    const savedProfiles = safeStorage.getItem('magicMenu_clubProfiles');
    if (savedProfiles) {
      const parsed = JSON.parse(savedProfiles);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {}

  let legacyLogic = cloneDefaultLogicSettings();
  try {
    const savedLogic = safeStorage.getItem('magicMenu_logicSettings');
    if (savedLogic) {
      const parsedLogic = JSON.parse(savedLogic);
      if (!parsedLogic.distanceLimits) {
        parsedLogic.distanceLimits = cloneDefaultLogicSettings().distanceLimits;
      }
      if (!parsedLogic.menuDistances) {
        parsedLogic.menuDistances = cloneDefaultLogicSettings().menuDistances;
      }
      legacyLogic = parsedLogic;
    }
  } catch {}

  let legacyWorkoutData = null;
  try {
    const savedWorkout = safeStorage.getItem('magicMenu_currentWorkoutData');
    if (savedWorkout) legacyWorkoutData = JSON.parse(savedWorkout);
  } catch {}

  const savedPeriod = safeStorage.getItem('magicMenu_period');
  const validPeriod = PERIODS.find(p => p.id === savedPeriod) ? savedPeriod : PERIODS[1].id;

  const migratedProfile = createDefaultClubProfile({
    logicSettings: legacyLogic,
    useAiMode: safeStorage.getItem('magicMenu_useAiMode') === 'true',
    isCurrentAiGenerated: safeStorage.getItem('magicMenu_isCurrentAiGenerated') === 'true',
    levelCategory: safeStorage.getItem('magicMenu_levelCategory') || LEVEL_CATEGORIES[0].id,
    levelId: safeStorage.getItem('magicMenu_levelId') || 'enjoy-intermediate',
    purpose: safeStorage.getItem('magicMenu_purpose') || PURPOSES[0].id,
    period: validPeriod,
    purposeDetail: safeStorage.getItem('magicMenu_purposeDetail') || "",
    distance: safeStorage.getItem('magicMenu_distance') || "2000",
    startTime: safeStorage.getItem('magicMenu_startTime') || "10:00",
    endTime: safeStorage.getItem('magicMenu_endTime') || "11:00",
    workoutData: legacyWorkoutData
  });

  return { [initialClubId]: migratedProfile };
};

const PRINT_FONTS = [
  { id: 'handwriting', name: '手書', className: 'font-handwriting' },
  { id: 'rounded', name: '丸ゴ', className: 'font-rounded-print' },
  { id: 'sans', name: '角ゴ', className: 'font-sans-print' },
  { id: 'serif', name: '明朝', className: 'font-serif-print' }
];

const PRINT_LANGS = [
  { id: 'ja', name: '日本語' },
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' }
];

const generateSetsForPart = (partType, targetDist, levelId, purposeId, periodId, logicSettings) => {
  if (targetDist <= 0) return [];
  
  const isSpecial = levelId.includes('special');
  const catKey = isSpecial ? 'special' : 'enjoy';
  const distConfig = logicSettings.menuDistances?.[catKey] || DEFAULT_LOGIC_SETTINGS.menuDistances[catKey];
  const partKey = partType === 'W-Up' ? 'WUp' : partType;
  const maxRepDist = Math.max(25, Number(distConfig.maxRepDist) || 100);

  let preferredDist = Number(distConfig[partKey]) || (isSpecial ? 50 : 25);
  if (isSpecial) {
      if (partType === 'Down' && targetDist < preferredDist * 2) preferredDist = Math.min(preferredDist, 25);
  } else {
      if (levelId === 'enjoy-beginner' && targetDist < 100) {
          preferredDist = Math.min(preferredDist, 10);
      }
  }

  if (purposeId === 'endurance' && partType === 'Main' && targetDist >= (Number(distConfig.MainEndurance) || 50) * 2) {
      preferredDist = Number(distConfig.MainEndurance) || (isSpecial ? 100 : 50);
  }

  if (preferredDist < 5) preferredDist = 5;
  if (preferredDist > maxRepDist) preferredDist = maxRepDist;

  preferredDist = Math.max(5, Math.floor(preferredDist / 5) * 5);

  let reps = Math.floor(targetDist / preferredDist);

  if (reps % 2 !== 0) {
      reps -= 1;
  }
  
  if (reps < 2) {
      reps = 2; 
      preferredDist = Math.floor((targetDist / 2) / 5) * 5;
      if (preferredDist < 5) {
          preferredDist = 5;
          if (targetDist < 10) reps = 1;
      }
  }

  let setsCount = 1;
  let restSeconds = 0;

  let loopCount = 0;
  while (reps >= 12 && loopCount < 5) {
      loopCount++;
      if (reps % 2 === 0 && setsCount * 2 <= 8) {
          setsCount *= 2; 
          reps /= 2;
          if (reps % 2 !== 0) {
              if (reps > 2) reps -= 1;
              else reps += 1;
          }
          if (restSeconds === 0) restSeconds = 30;
      } else {
          if (preferredDist * 2 <= maxRepDist) {
              preferredDist *= 2;
              reps = Math.floor(reps / 2);
              if (reps % 2 !== 0) {
                  if (reps > 2) reps -= 1;
                  else reps += 1;
              }
          } else {
              setsCount *= 2;
              reps = Math.floor(reps / 2);
              if (reps % 2 !== 0) {
                  if (reps > 2) reps -= 1;
                  else reps += 1;
              }
              if (restSeconds === 0) restSeconds = 30;
          }
      }
  }

  let distPerRep = preferredDist;

  let intensity = 1.0;
  let desc = '';
  let style = 'Choice';

  if (partType === 'W-Up') { intensity = 1.2; desc = 'ゆったりと体をほぐす'; }
  else if (partType === 'Kick') { intensity = 1.4; desc = '板キック / 姿勢を意識'; style = 'Choice'; }
  else if (partType === 'Drill') { intensity = 1.3; desc = 'ドリル / フォームを意識'; style = 'Choice'; }
  else if (partType === 'Pull') { intensity = 1.1; desc = 'ブイ使用 / キャッチを意識'; style = 'Fr'; }
  else if (partType === 'Down') { intensity = 1.3; desc = '心拍数を整える'; }
  else if (partType === 'Main') {
    if (purposeId === 'endurance') {
      intensity = 1.0; desc = 'イーブンペースを保つ'; style = 'Fr';
    } else if (purposeId === 'speed') {
      intensity = 0.85; desc = 'Hard! 質を落とさずに'; style = 'S1';
    } else if (purposeId === 'technique') {
      intensity = 1.15; desc = 'フォームを崩さず丁寧に'; style = 'IM';
    } else {
      intensity = 1.1; desc = '気持ちよく泳ぐ'; style = 'Choice';
    }

    let periodMultiplier = 1.0;
    if (periodId === 'prep') {
        periodMultiplier = 1.15; 
        if (restSeconds === 0 && setsCount > 1) restSeconds = 20;
        if (style === 'Choice' && Math.random() > 0.5) style = 'IM';
    } else if (periodId === 'quantity') {
        periodMultiplier = 1.05; 
        if (restSeconds === 0 && setsCount > 1) restSeconds = 15;
        if (style === 'Choice' && Math.random() > 0.5) style = 'Fr';
    } else if (periodId === 'qual_quan') {
        periodMultiplier = 0.95; 
        if (restSeconds === 0 && setsCount > 1) restSeconds = 30;
    } else if (periodId === 'quality') {
        periodMultiplier = 0.85; 
        if (restSeconds === 0 && setsCount > 1) restSeconds = 60;
        style = 'Choice';
    } else if (periodId === 'taper') {
        periodMultiplier = 0.90; 
        if (restSeconds === 0 && setsCount > 1) restSeconds = 60;
        style = 'Choice';
    }
    intensity *= periodMultiplier;
  }

  let circleSeconds = (partType === 'Down' || purposeId === 'recovery') ? 0 : calculateCircle(distPerRep, levelId, intensity, logicSettings);
  
  if (circleSeconds > 0) {
      if (circleSeconds < 20) {
          circleSeconds = 20;
      }
      if (partType === 'W-Up' && circleSeconds < 50) {
          circleSeconds = 50;
      }
  }

  return [{
    id: `set-${Date.now()}-${Math.random()}`,
    distance: distPerRep,
    reps: reps,
    setsCount: setsCount,
    restSeconds: restSeconds,
    style: style,
    circle: circleSeconds > 0 ? formatTime(circleSeconds) : null,
    circleSeconds: circleSeconds,
    description: desc
  }];
};

const generateWorkout = (levelId, purposeId, periodId, totalDistance, logicSettings) => {
  let remainingDist = totalDistance;
  const workout = [];
  let idCounter = 1;

  const isSpecial = levelId.includes('special');
  const catKey = isSpecial ? 'special' : 'enjoy';
  const distConfig = logicSettings.menuDistances?.[catKey] || DEFAULT_LOGIC_SETTINGS.menuDistances[catKey];
  const minDownTotal = Math.max(25, Number(distConfig.minDownTotal) || 50);
  const downUnitDist = Math.max(5, Math.floor((Number(distConfig.Down) || (isSpecial ? 50 : 25)) / 5) * 5);

  const baseRatio = logicSettings.baseRatios[purposeId] || logicSettings.baseRatios.default;
  const adj = logicSettings.periodAdjustments[periodId] || { WUp:0, Kick:0, Drill:0, Pull:0, Main:0, Down:0 };

  let pWup = Math.max(0, baseRatio.WUp + adj.WUp) / 100;
  let pKick = Math.max(0, baseRatio.Kick + adj.Kick) / 100;
  let pDrill = Math.max(0, baseRatio.Drill + adj.Drill) / 100;
  let pPull = Math.max(0, baseRatio.Pull + adj.Pull) / 100;
  let pMain = Math.max(0, baseRatio.Main + adj.Main) / 100;

  const addSet = (partName, distRatio) => {
    if (partName === 'Down') {
      let targetDist = remainingDist;
      if (targetDist < minDownTotal) targetDist = minDownTotal; 
      
      let sets = [];
      let currentTarget = targetDist;
      
      while (currentTarget > 0) {
          let dist = downUnitDist;
          let reps = 2;
          
          if (currentTarget >= downUnitDist * 2) {
              dist = downUnitDist;
              reps = Math.floor(currentTarget / (downUnitDist * 2)) * 2;
          } else if (currentTarget >= 50 && downUnitDist > 25) {
              dist = 25;
              reps = Math.floor(currentTarget / 50) * 2;
          } else {
              dist = Math.floor(currentTarget / 2 / 5) * 5;
              if (dist < 5) dist = 5;
              reps = 2;
              
              if (dist * reps !== currentTarget) {
                  dist = currentTarget;
                  reps = 1;
              }
          }
          
          sets.push({
              id: `set-${Date.now()}-${Math.random()}`,
              distance: dist, 
              reps: reps, 
              setsCount: 1, restSeconds: 0, style: 'Choice', circle: null, circleSeconds: 0, description: '心拍数を整える'
          });
          
          currentTarget -= (dist * reps);
      }

      const actualDist = sets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
      workout.push({
        id: `part-${idCounter++}`,
        name: partName,
        type: partName,
        partRestSeconds: 0,
        total: actualDist,
        sets: sets
      });
      remainingDist -= actualDist;

    } else {
      let maxAllowed = remainingDist - minDownTotal; 
      if (maxAllowed < 0) maxAllowed = 0;
      
      let targetDist = Math.round((totalDistance * distRatio) / 10) * 10;
      if (targetDist > maxAllowed) targetDist = maxAllowed;
      if (targetDist <= 0) return;

      const sets = generateSetsForPart(partName, targetDist, levelId, purposeId, periodId, logicSettings);
      let actualDist = sets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
      
      if (actualDist > maxAllowed) {
          let over = actualDist - maxAllowed;
          for (let s of sets) {
             while (over > 0 && s.reps > 2) {
                 s.reps -= 2;
                 over -= s.distance * 2 * s.setsCount;
             }
          }
          actualDist = sets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
      }
      
      if (actualDist > 0) {
        workout.push({
          id: `part-${idCounter++}`,
          name: partName,
          type: partName,
          partRestSeconds: 60,
          total: actualDist,
          sets: sets
        });
        remainingDist -= actualDist;
      }
    }
  };

  addSet('W-Up', pWup);
  addSet('Kick', pKick);
  addSet('Drill', pDrill);
  addSet('Pull', pPull);
  addSet('Main', pMain);
  addSet('Down', 1.0);

  return workout;
};

export default function App() {
  // --- クラブ登録・管理用ステート ---
  const [clubs, setClubs] = useState(() => {
    try {
      const saved = safeStorage.getItem('magicMenu_clubs');
      const parsed = saved ? JSON.parse(saved) : DEFAULT_CLUBS;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CLUBS;
    } catch {
      return DEFAULT_CLUBS;
    }
  });

  const [currentClubId, setCurrentClubId] = useState(() => {
    const savedId = safeStorage.getItem('magicMenu_currentClubId');
    try {
      const savedClubs = JSON.parse(safeStorage.getItem('magicMenu_clubs') || '[]');
      if (savedId && Array.isArray(savedClubs) && savedClubs.some(c => c.id === savedId)) {
        return savedId;
      }
      if (Array.isArray(savedClubs) && savedClubs.length > 0) {
        return savedClubs[0].id;
      }
    } catch {}
    return savedId || DEFAULT_CLUBS[0].id;
  });

  const [clubProfiles, setClubProfiles] = useState(() => loadInitialClubProfiles(currentClubId));

  const initialActiveProfile = useMemo(() => {
    const p = clubProfiles[currentClubId];
    return p ? { ...createDefaultClubProfile(), ...p } : createDefaultClubProfile();
  }, []);

  const [logicSettings, setLogicSettings] = useState(() => {
    const base = cloneDefaultLogicSettings();
    const saved = initialActiveProfile.logicSettings;
    if (!saved) return base;
    return {
      ...base,
      ...saved,
      distanceLimits: saved.distanceLimits || base.distanceLimits,
      menuDistances: saved.menuDistances || base.menuDistances
    };
  });
  const [activeTab, setActiveTab] = useState(() => safeStorage.getItem('magicMenu_activeTab') || 'settings');
  const [useAiMode, setUseAiMode] = useState(() => Boolean(initialActiveProfile.useAiMode));
  const [isCurrentAiGenerated, setIsCurrentAiGenerated] = useState(() => Boolean(initialActiveProfile.isCurrentAiGenerated));
  const [levelCategory, setLevelCategory] = useState(() => initialActiveProfile.levelCategory || LEVEL_CATEGORIES[0].id);
  const [levelId, setLevelId] = useState(() => initialActiveProfile.levelId || 'enjoy-intermediate'); 
  const [purpose, setPurpose] = useState(() => initialActiveProfile.purpose || PURPOSES[0].id);
  const [period, setPeriod] = useState(() => {
    const saved = initialActiveProfile.period;
    return PERIODS.find(p => p.id === saved) ? saved : PERIODS[1].id; 
  });
  const [purposeDetail, setPurposeDetail] = useState(() => initialActiveProfile.purposeDetail || ""); 
  const [distance, setDistance] = useState(() => initialActiveProfile.distance || "2000");
  const [startTime, setStartTime] = useState(() => initialActiveProfile.startTime || "10:00");
  const [endTime, setEndTime] = useState(() => initialActiveProfile.endTime || "11:00"); 
  const [workoutData, setWorkoutData] = useState(() => initialActiveProfile.workoutData || null);

  const [editingSet, setEditingSet] = useState(null);
  const [editingPart, setEditingPart] = useState(null);

  const [printDate, setPrintDate] = useState(() => initialActiveProfile.printDate || getTodayDateStr());
  const [printTime, setPrintTime] = useState("");
  const [printFont, setPrintFont] = useState(() => initialActiveProfile.printFont || 'handwriting');
  const [printLang, setPrintLang] = useState(() => initialActiveProfile.printLang || 'ja');
  const [competitions, setCompetitions] = useState(() => Array.isArray(initialActiveProfile.competitions) ? initialActiveProfile.competitions : []);
  const [showCompetitionOnPrint, setShowCompetitionOnPrint] = useState(() => initialActiveProfile.showCompetitionOnPrint !== false);
  const [aiTranslations, setAiTranslations] = useState({ en: {}, zh: {} });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showScreenshotHint, setShowScreenshotHint] = useState(false);
  const [screenshotScale, setScreenshotScale] = useState(1);
  const printCardRef = useRef(null);
  const wakeLockRef = useRef(null);
  const hintTimerRef = useRef(null);

  const [savedWorkouts, setSavedWorkouts] = useState(() => {
    try {
      const item = safeStorage.getItem('magicMenu_savedWorkouts');
      return item ? JSON.parse(item) : [];
    } catch (error) {
      return [];
    }
  });
  const [saveToast, setSaveToast] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isClubModalOpen, setIsClubModalOpen] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [editingClubId, setEditingClubId] = useState(null);
  const [editingClubName, setEditingClubName] = useState('');

  // --- 大会登録・管理用ステート ---
  const [isCompetitionModalOpen, setIsCompetitionModalOpen] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompStartDate, setNewCompStartDate] = useState(() => getTodayDateStr());
  const [newCompEndDate, setNewCompEndDate] = useState(() => getTodayDateStr());
  const [editingCompId, setEditingCompId] = useState(null);
  const [editingCompName, setEditingCompName] = useState('');
  const [editingCompStartDate, setEditingCompStartDate] = useState('');
  const [editingCompEndDate, setEditingCompEndDate] = useState('');

  const isComposingRef = useRef(false);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    // Safari等でcompositionend直後にEnterのkeydownが発火するケースにも対応
    setTimeout(() => {
      isComposingRef.current = false;
    }, 50);
  };

  const isEnterWithoutIme = (e) => {
    return (
      e.key === 'Enter' &&
      !isComposingRef.current &&
      !e.nativeEvent?.isComposing &&
      e.keyCode !== 229
    );
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClubId, setFilterClubId] = useState(() => currentClubId);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterDistance, setFilterDistance] = useState('all');

  const [isLogicSettingsOpen, setIsLogicSettingsOpen] = useState(false);
  const [activeLogicTab, setActiveLogicTab] = useState('pace');
  const [tempSettings, setTempSettings] = useState(logicSettings);

  // --- 公開版向け追加ステート（ヘルプ・APIキー・バックアップ・共有通知） ---
  const [userApiKey, setUserApiKey] = useState(() => safeStorage.getItem('magicMenu_userApiKey') || '');
  const [geminiModel, setGeminiModel] = useState(() => safeStorage.getItem('magicMenu_geminiModel') || '');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState('guide');
  const [infoToast, setInfoToast] = useState('');

  const showToast = (msg) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(''), 2800);
  };

  useEffect(() => {
    const handleFocusOut = (e) => {
      const targetTags = ['INPUT', 'SELECT', 'TEXTAREA'];
      if (targetTags.includes(e.target.tagName)) {
        const metaViewport = document.querySelector('meta[name=viewport]');
        if (metaViewport) {
          const originalContent = metaViewport.getAttribute('content');
          metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
          setTimeout(() => {
            metaViewport.setAttribute('content', originalContent || 'width=device-width, initial-scale=1.0');
          }, 300);
        }
      }
    };
    document.addEventListener('focusout', handleFocusOut);
    return () => document.removeEventListener('focusout', handleFocusOut);
  }, []);

  useEffect(() => {
    safeStorage.setItem('magicMenu_activeTab', activeTab);
  }, [activeTab]);

  // 選択中のクラブに紐づくすべての設定データをクラブ別プロファイルとして自動保存
  useEffect(() => {
    if (!currentClubId) return;
    setClubProfiles(prev => {
      const updated = {
        ...prev,
        [currentClubId]: {
          logicSettings,
          useAiMode,
          isCurrentAiGenerated,
          levelCategory,
          levelId,
          purpose,
          period,
          purposeDetail,
          distance,
          startTime,
          endTime,
          workoutData,
          printDate,
          printFont,
          printLang,
          competitions,
          showCompetitionOnPrint
        }
      };
      try {
        safeStorage.setItem('magicMenu_clubProfiles', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save club profiles:', e);
      }
      return updated;
    });
  }, [
    currentClubId,
    logicSettings,
    useAiMode,
    isCurrentAiGenerated,
    levelCategory,
    levelId,
    purpose,
    period,
    purposeDetail,
    distance,
    startTime,
    endTime,
    workoutData,
    printDate,
    printFont,
    printLang,
    competitions,
    showCompetitionOnPrint
  ]);

  useEffect(() => {
    safeStorage.setItem('magicMenu_savedWorkouts', JSON.stringify(savedWorkouts));
  }, [savedWorkouts]);

  useEffect(() => {
    safeStorage.setItem('magicMenu_userApiKey', userApiKey);
  }, [userApiKey]);

  useEffect(() => {
    safeStorage.setItem('magicMenu_geminiModel', geminiModel);
  }, [geminiModel]);

  useEffect(() => {
    safeStorage.setItem('magicMenu_clubs', JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    safeStorage.setItem('magicMenu_currentClubId', currentClubId);
  }, [currentClubId]);

  const currentClub = useMemo(() => {
    return clubs.find(c => c.id === currentClubId) || clubs[0] || DEFAULT_CLUBS[0];
  }, [clubs, currentClubId]);

  const applyProfileToState = useCallback((profile) => {
    const safeProfile = { ...createDefaultClubProfile(), ...(profile || {}) };
    const defaultLogic = cloneDefaultLogicSettings();
    const safeLogic = safeProfile.logicSettings
      ? {
          ...defaultLogic,
          ...safeProfile.logicSettings,
          distanceLimits: safeProfile.logicSettings.distanceLimits || defaultLogic.distanceLimits,
          menuDistances: safeProfile.logicSettings.menuDistances || defaultLogic.menuDistances
        }
      : defaultLogic;

    setLogicSettings(safeLogic);
    setUseAiMode(Boolean(safeProfile.useAiMode));
    setIsCurrentAiGenerated(Boolean(safeProfile.isCurrentAiGenerated));
    setLevelCategory(safeProfile.levelCategory || LEVEL_CATEGORIES[0].id);
    setLevelId(safeProfile.levelId || 'enjoy-intermediate');
    setPurpose(safeProfile.purpose || PURPOSES[0].id);
    setPeriod(PERIODS.find(p => p.id === safeProfile.period) ? safeProfile.period : PERIODS[1].id);
    setPurposeDetail(safeProfile.purposeDetail || "");
    setDistance(safeProfile.distance || "2000");
    setStartTime(safeProfile.startTime || "10:00");
    setEndTime(safeProfile.endTime || "11:00");
    setWorkoutData(safeProfile.workoutData || null);
    setPrintDate(safeProfile.printDate || getTodayDateStr());
    setPrintFont(safeProfile.printFont || 'handwriting');
    setPrintLang(safeProfile.printLang || 'ja');
    setCompetitions(Array.isArray(safeProfile.competitions) ? safeProfile.competitions : []);
    setShowCompetitionOnPrint(safeProfile.showCompetitionOnPrint !== false);
  }, []);

  const handleSelectClub = useCallback((clubId, customProfiles = null) => {
    const profilesMap = customProfiles || clubProfiles;
    const targetProfile = profilesMap[clubId] || createDefaultClubProfile();
    setCurrentClubId(clubId);
    setFilterClubId(clubId);
    applyProfileToState(targetProfile);
  }, [clubProfiles, applyProfileToState]);

  const handleAddClub = () => {
    const trimmed = newClubName.trim();
    if (!trimmed) return;
    const newClub = {
      id: `club-${Date.now()}`,
      name: trimmed
    };
    const newProfile = createDefaultClubProfile();
    const nextProfiles = { ...clubProfiles, [newClub.id]: newProfile };
    setClubs(prev => [...prev, newClub]);
    setClubProfiles(nextProfiles);
    handleSelectClub(newClub.id, nextProfiles);
    setNewClubName('');
    showToast(`「${trimmed}」を登録しました（専用設定を作成）`);
  };

  const handleSaveClubEdit = (clubId) => {
    const trimmed = editingClubName.trim();
    if (!trimmed) return;
    setClubs(prev => prev.map(c => c.id === clubId ? { ...c, name: trimmed } : c));
    setEditingClubId(null);
    setEditingClubName('');
    showToast('クラブ名を更新しました');
  };

  const handleDeleteClub = (clubId) => {
    if (clubs.length <= 1) {
      showToast('最低1つのクラブが必要です');
      return;
    }
    const targetClub = clubs.find(c => c.id === clubId);
    const remainingClubs = clubs.filter(c => c.id !== clubId);
    const fallbackClubId = remainingClubs[0].id;

    // 削除するクラブに紐づく保存メニューを先頭のクラブへ引き継ぐ
    setSavedWorkouts(prev => prev.map(w => (w.clubId || 'default') === clubId ? { ...w, clubId: fallbackClubId } : w));
    setClubs(remainingClubs);

    const remainingProfiles = { ...clubProfiles };
    delete remainingProfiles[clubId];
    setClubProfiles(remainingProfiles);
    try {
      safeStorage.setItem('magicMenu_clubProfiles', JSON.stringify(remainingProfiles));
    } catch {}

    if (currentClubId === clubId) {
      handleSelectClub(fallbackClubId, remainingProfiles);
    }
    if (filterClubId === clubId) {
      setFilterClubId(fallbackClubId);
    }
    showToast(`「${targetClub?.name || 'クラブ'}」を削除しました`);
  };

  // --- 大会登録・編集・削除ハンドラ（クラブごとに最大8大会・開催期間対応） ---
  const handleAddCompetition = () => {
    const trimmedName = newCompName.trim();
    if (!trimmedName || !newCompStartDate) return;
    if (competitions.length >= MAX_COMPETITIONS) {
      showToast(`大会登録は1クラブにつき最大${MAX_COMPETITIONS}件までです`);
      return;
    }
    const startDate = newCompStartDate;
    const endDate = (!newCompEndDate || newCompEndDate < startDate) ? startDate : newCompEndDate;
    const newComp = {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      startDate,
      endDate,
      date: startDate
    };
    setCompetitions(prev =>
      [...prev, newComp].sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
    );
    setNewCompName('');
    showToast(`大会「${trimmedName}」を登録しました`);
  };

  const handleSaveCompetitionEdit = (compId) => {
    const trimmedName = editingCompName.trim();
    if (!trimmedName || !editingCompStartDate) return;
    const startDate = editingCompStartDate;
    const endDate = (!editingCompEndDate || editingCompEndDate < startDate) ? startDate : editingCompEndDate;
    setCompetitions(prev =>
      prev
        .map(c => c.id === compId ? { ...c, name: trimmedName, startDate, endDate, date: startDate } : c)
        .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
    );
    setEditingCompId(null);
    setEditingCompName('');
    setEditingCompStartDate('');
    setEditingCompEndDate('');
    showToast('大会情報を更新しました');
  };

  const handleDeleteCompetition = (compId) => {
    setCompetitions(prev => prev.filter(c => c.id !== compId));
    if (editingCompId === compId) {
      setEditingCompId(null);
    }
    showToast('大会を削除しました');
  };

  // 印刷日付（printDate）を基準に直近の大会と残り日数を算出
  const nearestCompetition = useMemo(() => {
    if (!competitions || competitions.length === 0) return null;
    const baseDate = printDate || getTodayDateStr();
    const withDays = competitions
      .filter(c => c && c.name && (c.startDate || c.date))
      .map(c => ({
        ...c,
        daysUntil: getCompetitionDaysUntil(c, baseDate)
      }))
      .filter(c => c.daysUntil !== null);

    if (withDays.length === 0) return null;

    // 基準日以降（開催期間中含む）で最も近い大会を最優先
    const upcoming = withDays
      .filter(c => c.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (upcoming.length > 0) return upcoming[0];

    // すべて過去日の場合は最も日付が近い大会を返す
    const past = [...withDays].sort((a, b) => b.daysUntil - a.daysUntil);
    return past[0];
  }, [competitions, printDate]);

  const estimatedDistForTime = useMemo(() => {
    return getEstimatedDistance(startTime, endTime, levelId, purpose, period, logicSettings);
  }, [startTime, endTime, levelId, purpose, period, logicSettings]);

  const handleGenerateMagic = async () => {
    setIsGenerating(true);
    
    const distNum = Number(distance) || 0;
    const validDistance = Math.max(100, roundTo10(distNum));

    if (useAiMode) {
      try {
        const catObj = LEVEL_CATEGORIES.find(c => c.id === levelCategory);
        const levelObj = logicSettings.levels.find(l => l.id === levelId);
        const purpObj = PURPOSES.find(p => p.id === purpose);
        const perObj = PERIODS.find(p => p.id === period);
        
        const params = {
          levelCategoryName: catObj?.name || '',
          levelId: levelId,
          levelName: levelObj?.name || '',
          levelDesc: levelObj?.desc || '',
          purposeId: purpose,
          purposeName: purpObj?.name || '',
          periodId: period,
          periodName: perObj?.name || '',
          theme: purposeDetail,
          totalDistance: validDistance
        };
        
        const aiData = await fetchWorkoutFromGemini(params, logicSettings, userApiKey, geminiModel);
        setWorkoutData(aiData);
        const newTotal = aiData.reduce((sum, part) => sum + part.total, 0);
        setDistance(String(newTotal));
        setIsCurrentAiGenerated(true);
        setActiveTab('workout');
      } catch (error) {
        console.error("AI Generation Error:", error);
        const data = generateWorkout(levelId, purpose, period, validDistance, logicSettings);
        setWorkoutData(data);
        const newTotal = data.reduce((sum, part) => sum + part.total, 0);
        setDistance(String(newTotal));
        setIsCurrentAiGenerated(false);
        setActiveTab('workout');
        showToast(geminiErrorToast(error, '標準ロジックで生成しました'));
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 600));
      const data = generateWorkout(levelId, purpose, period, validDistance, logicSettings);
      setWorkoutData(data);
      const newTotal = data.reduce((sum, part) => sum + part.total, 0);
      setDistance(String(newTotal));
      setIsCurrentAiGenerated(false);
      setActiveTab('workout');
    }
    
    setIsGenerating(false);
  };

  // メニューをテキストとしてクリップボードにコピー（LINE・メール共有用）
  const copyWorkoutToClipboard = () => {
    if (!scheduledWorkoutData) return;
    const catName = LEVEL_CATEGORIES.find(c => c.id === levelCategory)?.name || '';
    const lvlName = logicSettings.levels.find(l => l.id === levelId)?.name || '';
    const purpName = PURPOSES.find(p => p.id === purpose)?.name || '';
    const perName = PERIODS.find(p => p.id === period)?.name || '';

    let text = `🏊‍♂️ 【${currentClub.name}】 ${catName} (${lvlName})\n`;
    text += `📅 ${formatShortDateWithDay(printDate)} ${printTime}\n`;
    if (showCompetitionOnPrint && nearestCompetition) {
      const daysText = nearestCompetition.daysUntil === 0
        ? '本日開催！'
        : nearestCompetition.daysUntil > 0
          ? `あと${nearestCompetition.daysUntil}日`
          : `${Math.abs(nearestCompetition.daysUntil)}日前`;
      text += `🏆 直近大会: ${nearestCompetition.name} (${formatCompetitionPeriod(nearestCompetition)} / ${daysText})\n`;
    }
    text += `🎯 目的: ${purpName} (${perName}) / 総距離: ${actualTotalDistance}m\n`;
    if (purposeDetail) text += `💡 テーマ: ${purposeDetail}\n`;
    text += `------------------------\n`;

    scheduledWorkoutData.parts.forEach(part => {
      text += `■ ${part.name} (${part.total}m)\n`;
      part.sets.forEach(set => {
        const setsStr = set.setsCount > 1 ? `×${set.setsCount}set` : '';
        const circleStr = set.circle ? ` (${set.circle})` : '';
        const restStr = (set.setsCount > 1 && set.restSeconds > 0) ? ` [SetRest:${formatTime(set.restSeconds)}]` : '';
        text += `  ・${set.distance}m×${set.reps}${setsStr} ${set.style}${circleStr}${restStr} ${set.description || ''}\n`;
      });
      if (part.partRestSeconds > 0) {
        text += `  [Rest: ${formatTime(part.partRestSeconds)}]\n`;
      }
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('メニューをテキストコピーしました！');
      }).catch(() => {
        showToast('コピーに失敗しました');
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('メニューをテキストコピーしました！');
    }
  };

  // データのバックアップ書き出し（JSONエクスポート）
  const exportAppData = () => {
    const backup = {
      version: 3,
      exportedAt: new Date().toISOString(),
      clubs,
      currentClubId,
      clubProfiles,
      savedWorkouts,
      logicSettings
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masters_swim_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('バックアップファイルを保存しました');
  };

  // データのバックアップ読み込み（JSONインポート）
  const importAppData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const restoredClubs = Array.isArray(parsed.clubs) && parsed.clubs.length > 0 ? parsed.clubs : clubs;
        const restoredClubId = parsed.currentClubId && restoredClubs.some(c => c.id === parsed.currentClubId)
          ? parsed.currentClubId
          : restoredClubs[0].id;

        if (Array.isArray(parsed.clubs) && parsed.clubs.length > 0) {
          setClubs(parsed.clubs);
        }
        if (Array.isArray(parsed.savedWorkouts)) {
          setSavedWorkouts(parsed.savedWorkouts);
        }
        if (parsed.clubProfiles && typeof parsed.clubProfiles === 'object') {
          setClubProfiles(parsed.clubProfiles);
          handleSelectClub(restoredClubId, parsed.clubProfiles);
        } else {
          if (parsed.currentClubId) {
            setCurrentClubId(restoredClubId);
            setFilterClubId(restoredClubId);
          }
          if (parsed.logicSettings && parsed.logicSettings.levels) {
            setLogicSettings(parsed.logicSettings);
          }
        }
        showToast('バックアップデータを復元しました！');
        setIsHelpOpen(false);
      } catch (err) {
        showToast('ファイルの形式が正しくありません');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const regenerateWithNewParams = (newLevelId, newPurpose, newPeriod, newDistance) => {
    const distNum = Number(newDistance !== undefined ? newDistance : distance) || 0;
    const validDistance = Math.max(100, roundTo10(distNum));
    const newData = generateWorkout(newLevelId, newPurpose, newPeriod, validDistance, logicSettings);
    setWorkoutData(newData);
    const newTotal = newData.reduce((sum, part) => sum + part.total, 0);
    setDistance(String(newTotal));
  };

  const handleMenuCategoryChange = (e) => {
    const newCat = e.target.value;
    setLevelCategory(newCat);
    const defaultLevel = logicSettings.levels.find(l => l.category === newCat && l.name === '中級')?.id || logicSettings.levels.find(l => l.category === newCat)?.id;
    setLevelId(defaultLevel);
    regenerateWithNewParams(defaultLevel, purpose, period, distance);
  };

  const handleMenuLevelChange = (e) => {
    const newLevel = e.target.value;
    setLevelId(newLevel);
    regenerateWithNewParams(newLevel, purpose, period, distance);
  };

  const handleMenuPurposeChange = (e) => {
    const newPurpose = e.target.value;
    setPurpose(newPurpose);
    regenerateWithNewParams(levelId, newPurpose, period, distance);
  };

  const handleMenuPeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    regenerateWithNewParams(levelId, purpose, newPeriod, distance);
  };

  const scheduledWorkoutData = useMemo(() => {
    if (!workoutData) return null;
    let currentTime = new Date();
    const [sh, sm] = startTime.split(':');
    currentTime.setHours(parseInt(sh), parseInt(sm), 0, 0);

    const startObj = new Date(currentTime);

    const dataWithSchedule = workoutData.map(part => {
      const scheduledSets = part.sets.map(set => {
        const setStart = new Date(currentTime);
        const duration = getSetDuration(set, levelId, logicSettings);
        currentTime = new Date(currentTime.getTime() + duration * 1000);
        const setEnd = new Date(currentTime);
        return { ...set, setStart, setEnd };
      });
      
      const partRestStart = new Date(currentTime);
      const restSecs = Number(part.partRestSeconds) || 0;
      if (restSecs > 0 && scheduledSets.length > 0) {
        currentTime = new Date(currentTime.getTime() + restSecs * 1000);
      }
      const partRestEnd = new Date(currentTime);

      return { ...part, sets: scheduledSets, partRestStart, partRestEnd };
    });

    let targetEndTimeObj = new Date(startObj);
    const [eh, em] = endTime.split(':');
    targetEndTimeObj.setHours(parseInt(eh), parseInt(em), 0, 0);
    if (targetEndTimeObj < startObj) {
      targetEndTimeObj.setDate(targetEndTimeObj.getDate() + 1);
    }

    return {
      parts: dataWithSchedule,
      startTime: startObj,
      endTime: new Date(currentTime),
      targetEndTime: targetEndTimeObj
    };
  }, [workoutData, startTime, endTime, levelId, logicSettings]);

  useEffect(() => {
    if (scheduledWorkoutData) {
      setPrintTime(`${formatTimeObj(scheduledWorkoutData.startTime)}-${formatTimeObj(scheduledWorkoutData.endTime)}`);
    }
  }, [scheduledWorkoutData]);

  const updatePartName = (partId, newName) => {
    setWorkoutData(prev => prev.map(p => p.id === partId ? { ...p, name: newName } : p));
  };

  const updatePartRestDirect = (partId, value) => {
    let newRest;
    if (typeof value === 'string') {
        newRest = value === '' ? '' : parseInt(value, 10);
    } else {
        newRest = value;
    }
    setWorkoutData(prev => prev.map(p => p.id === partId ? { ...p, partRestSeconds: isNaN(newRest) ? 0 : Math.max(0, newRest) } : p));
  };

  const updateSetStyleDirect = (partId, setId, value) => {
    setWorkoutData(prev => prev.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          sets: p.sets.map(s => s.id === setId ? { ...s, style: value } : s)
        };
      }
      return p;
    }));
  };

  const updateSetDescriptionDirect = (partId, setId, value) => {
    setWorkoutData(prev => prev.map(p => {
      if (p.id === partId) {
        return {
          ...p,
          sets: p.sets.map(s => s.id === setId ? { ...s, description: value } : s)
        };
      }
      return p;
    }));
  };

  const handlePartTotalChange = (partId, value) => {
    setWorkoutData(prev => prev.map(p => p.id === partId ? { ...p, total: value } : p));
  };

  const handlePartTotalCommit = (partId, value) => {
    const newTotal = roundTo10(Number(value) || 0);
    setWorkoutData(prev => {
      const newData = prev.map(p => {
        if (p.id === partId) {
          const newSets = generateSetsForPart(p.type || 'Main', newTotal, levelId, purpose, period, logicSettings);
          const actualDist = newSets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
          return { ...p, total: actualDist, sets: newSets };
        }
        return p;
      });
      const overallNewTotal = newData.reduce((sum, p) => sum + Number(p.total), 0);
      setDistance(String(overallNewTotal));
      return newData;
    });
  };

  const addNewSetToPart = (partId) => {
    setWorkoutData(prev => prev.map(part => {
      if (part.id === partId) {
        const newSet = {
          id: `set-${Date.now()}-${Math.random()}`,
          distance: 50,
          reps: 4,
          setsCount: 1,
          restSeconds: 0,
          style: 'Choice',
          circle: null,
          circleSeconds: 0,
          description: '追加メニュー'
        };
        const newSets = [...part.sets, newSet];
        const newTotal = newSets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
        return { ...part, sets: newSets, total: newTotal };
      }
      return part;
    }));
  };

  const deleteSetDirect = (partId, setId) => {
    setWorkoutData(prev => prev.map(part => {
      if (part.id === partId) {
        const newSets = part.sets.filter(s => s.id !== setId);
        const newTotal = newSets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
        return { ...part, sets: newSets, total: newTotal };
      }
      return part;
    }));
  };

  const openEditModal = (partId, set) => {
    setEditingSet({
      partId,
      setId: set.id,
      distance: set.distance,
      reps: set.reps,
      setsCount: set.setsCount || 1,
      restSeconds: set.restSeconds || 0,
      circleSeconds: set.circleSeconds || 0,
      style: set.style || 'Choice',
      description: set.description || ''
    });
  };

  const saveEdit = () => {
    if (!workoutData || !editingSet) return;
    const newData = workoutData.map(part => {
      if (part.id === editingSet.partId) {
        const newSets = part.sets.map(s => {
          if (s.id === editingSet.setId) {
            return {
              ...s,
              distance: editingSet.distance,
              reps: editingSet.reps,
              setsCount: editingSet.setsCount,
              restSeconds: editingSet.restSeconds,
              circleSeconds: editingSet.circleSeconds,
              circle: editingSet.circleSeconds > 0 ? formatTime(editingSet.circleSeconds) : null,
              style: editingSet.style,
              description: editingSet.description
            };
          }
          return s;
        });
        const newTotal = newSets.reduce((sum, s) => sum + (s.distance * s.reps * s.setsCount), 0);
        return { ...part, sets: newSets, total: newTotal };
      }
      return part;
    });
    setWorkoutData(newData);
    setEditingSet(null);
  };

  const openPartEditModal = (part) => {
    setEditingPart({
      id: part.id,
      name: part.name,
      partRestSeconds: part.partRestSeconds || 0
    });
  };

  const savePartEdit = () => {
    if (!workoutData || !editingPart) return;
    setWorkoutData(prev => prev.map(p => 
      p.id === editingPart.id 
        ? { ...p, name: editingPart.name, partRestSeconds: editingPart.partRestSeconds }
        : p
    ));
    setEditingPart(null);
  };

  const addPart = () => {
    setWorkoutData(prev => {
      const newPartId = `part-custom-${Date.now()}`;
      const newPart = {
        id: newPartId,
        name: 'New Part',
        type: 'Main', 
        partRestSeconds: 60,
        total: 0,
        sets: []
      };
      return [...prev, newPart];
    });
  };

  const deletePart = (partId) => {
    setWorkoutData(prev => {
      const newData = prev.filter(p => p.id !== partId);
      const overallNewTotal = newData.reduce((sum, p) => sum + Number(p.total), 0);
      setDistance(String(overallNewTotal));
      return newData;
    });
  };

  const adjustCircle = (amount) => {
    setEditingSet(prev => {
      let current = prev.circleSeconds;
      if (current === 0 && amount > 0) current = 30;
      else current += amount;
      return { ...prev, circleSeconds: Math.max(0, current) };
    });
  };

  const adjustRest = (amount) => {
    setEditingSet(prev => {
      let current = prev.restSeconds;
      if (current === 0 && amount > 0) current = 10;
      else current += amount;
      return { ...prev, restSeconds: Math.max(0, current) };
    });
  };

  const adjustPartRest = (amount) => {
    setEditingPart(prev => {
      let current = prev.partRestSeconds;
      if (current === 0 && amount > 0) current = 30;
      else current += amount;
      return { ...prev, partRestSeconds: Math.max(0, current) };
    });
  };

  const saveCurrentWorkout = () => {
    if (!workoutData) return;
    const newWorkout = {
      id: Date.now().toString(),
      clubId: currentClub.id,
      title: '', 
      date: new Date().toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      lessonDate: printDate,
      workoutData,
      distance,
      startTime,
      endTime,
      levelCategory,
      levelId,
      purpose,
      period,
      purposeDetail,
      isAiGenerated: isCurrentAiGenerated
    };
    setSavedWorkouts(prev => [newWorkout, ...prev]);
    setFilterClubId(currentClub.id);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const loadWorkout = (saved) => {
    const targetClubId = (saved.clubId && clubs.some(c => c.id === saved.clubId)) ? saved.clubId : currentClubId;
    if (targetClubId !== currentClubId) {
      const targetProfile = clubProfiles[targetClubId] || createDefaultClubProfile();
      applyProfileToState(targetProfile);
      setCurrentClubId(targetClubId);
      setFilterClubId(targetClubId);
    }
    setWorkoutData(saved.workoutData);
    setDistance(saved.distance);
    setStartTime(saved.startTime);
    setEndTime(saved.endTime);
    if (saved.lessonDate) {
      setPrintDate(saved.lessonDate);
    }
    setLevelCategory(saved.levelCategory);
    setLevelId(saved.levelId);
    setPurpose(saved.purpose);
    setPeriod(saved.period || PERIODS[1].id);
    setPurposeDetail(saved.purposeDetail);
    setIsCurrentAiGenerated(saved.isAiGenerated || false);
    setActiveTab('workout');
  };

  const deleteSavedWorkout = (id) => {
    setSavedWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const updateSavedWorkoutTitle = (id, newTitle) => {
    setSavedWorkouts(prev => prev.map(w => w.id === id ? { ...w, title: newTitle } : w));
  };

  const updateSavedWorkoutClub = (id, newClubId) => {
    setSavedWorkouts(prev => prev.map(w => w.id === id ? { ...w, clubId: newClubId } : w));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('all');
    setFilterPurpose('all');
    setFilterPeriod('all');
    setFilterDistance('all');
  };

  const filteredSavedWorkouts = useMemo(() => {
    return savedWorkouts.filter(workout => {
      const workoutClubId = workout.clubId || DEFAULT_CLUBS[0].id;
      const matchClub = filterClubId === 'all' || workoutClubId === filterClubId;
      const matchQuery = (workout.title || '').includes(searchQuery) || (workout.purposeDetail || '').includes(searchQuery);
      const matchCategory = filterCategory === 'all' || workout.levelCategory === filterCategory;
      const matchPurpose = filterPurpose === 'all' || workout.purpose === filterPurpose;
      const matchPeriod = filterPeriod === 'all' || workout.period === filterPeriod;
      
      const dist = Number(workout.distance) || 0;
      let matchDistance = true;
      if (filterDistance === 'under1000') matchDistance = dist < 1000;
      if (filterDistance === '1000-2000') matchDistance = dist >= 1000 && dist <= 2000;
      if (filterDistance === 'over2000') matchDistance = dist > 2000;

      return matchClub && matchQuery && matchCategory && matchPurpose && matchPeriod && matchDistance;
    });
  }, [savedWorkouts, filterClubId, searchQuery, filterCategory, filterPurpose, filterPeriod, filterDistance]);

  const actualTotalDistance = workoutData 
    ? workoutData.reduce((total, part) => total + Number(part.total), 0)
    : 0;

  const currentLevelObj = logicSettings.levels.find(l => l.id === levelId);
  const availableLevels = logicSettings.levels.filter(l => l.category === levelCategory);

  const handlePrintLangChange = async (langId) => {
    if (langId === 'ja') {
      setPrintLang(langId);
      return;
    }

    const textsToTranslate = new Set();
    if (purposeDetail) textsToTranslate.add(purposeDetail);
    if (nearestCompetition?.name) textsToTranslate.add(nearestCompetition.name);
    if (scheduledWorkoutData) {
      scheduledWorkoutData.parts.forEach(p => {
        p.sets.forEach(s => {
          if (s.description) textsToTranslate.add(s.description);
        });
      });
    }

    const textsArray = Array.from(textsToTranslate).filter(t => !aiTranslations[langId]?.[t]);

    if (textsArray.length > 0 && userApiKey.trim()) {
      setIsTranslating(true);
      try {
        const newTranslations = await translateWithGemini(textsArray, langId, userApiKey, geminiModel);
        setAiTranslations(prev => ({
          ...prev,
          [langId]: { ...(prev[langId] || {}), ...newTranslations }
        }));
      } catch (error) {
        console.error("Translation Error:", error);
        showToast(geminiErrorToast(error, '内蔵辞書で翻訳しました'));
      }
      setIsTranslating(false);
    }
    setPrintLang(langId);
  };

  const t_desc = (text) => {
    if (!text) return '';
    if (printLang === 'ja') return text;
    
    if (aiTranslations[printLang] && aiTranslations[printLang][text]) {
      return aiTranslations[printLang][text];
    }
    
    if (TRANSLATIONS[printLang]?.desc[text]) {
      return TRANSLATIONS[printLang].desc[text];
    }
    
    let translated = text;
    const dict = WORD_DICT[printLang];
    if (dict) {
      const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);
      for (const jaWord of sortedKeys) {
        translated = translated.split(jaWord).join(dict[jaWord]);
      }
    }
    return translated;
  };

  const isNeutralTab = activeTab === 'saved' || activeTab === 'print' || activeTab === 'competitions';
  const isSpecialTheme = !isNeutralTab && levelCategory === 'special';

  // 画面サイズに合わせてメニューカードを余白なしで中央に最大フィットさせる計算
  const updateScreenshotScale = useCallback(() => {
    if (!isScreenshotMode || !printCardRef.current) {
      setScreenshotScale(1);
      return;
    }
    const card = printCardRef.current;
    const cardWidth = card.offsetWidth || 380;
    const cardHeight = card.offsetHeight || 520;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 上下左右の余白を極限まで減らし（各4px）、どんな画面でも見切れず最大表示する倍率を算出
    const padding = 8;
    const scaleX = (vw - padding) / cardWidth;
    const scaleY = (vh - padding) / cardHeight;
    const optimalScale = Math.max(0.3, Math.min(scaleX, scaleY, 3.5));
    setScreenshotScale(optimalScale);
  }, [isScreenshotMode]);

  // ヒント表示の一時タイマー制御
  const triggerHintTemporarily = useCallback((duration = 2500) => {
    setShowScreenshotHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      setShowScreenshotHint(false);
    }, duration);
  }, []);

  // スリープ防止 (Wake Lock API) の制御
  useEffect(() => {
    const requestWakeLock = async () => {
      if (isScreenshotMode && isScreenLocked && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (err) {
          // ブラウザやバッテリー設定により拒否された場合は無視
        }
      } else if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        } catch (err) {}
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isScreenshotMode, isScreenLocked]);

  // スクリーンショットモードの時のエフェクト＆リサイズ監視
  useEffect(() => {
    if (isScreenshotMode) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      triggerHintTemporarily(2500);
      const rafId = requestAnimationFrame(() => updateScreenshotScale());
      window.addEventListener('resize', updateScreenshotScale);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('resize', updateScreenshotScale);
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      };
    } else {
      setShowScreenshotHint(false);
      setIsScreenLocked(false);
      setScreenshotScale(1);
    }
  }, [isScreenshotMode, updateScreenshotScale, triggerHintTemporarily]);

  const appBg = activeTab === 'print' 
    ? 'bg-slate-100' 
    : activeTab === 'saved'
      ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100 animate-gradient'
      : activeTab === 'competitions'
        ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100 animate-gradient'
        : levelCategory === 'enjoy'
          ? 'bg-gradient-to-br from-blue-100 via-cyan-50 to-indigo-100 animate-gradient'
          : 'bg-gradient-to-br from-rose-100 via-fuchsia-50 to-purple-100 animate-gradient';

  return (
    <div className={`flex flex-col h-screen font-sans text-slate-800 transition-colors duration-1000 ${appBg} overflow-hidden`}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Klee+One:wght@600&family=Noto+Sans+JP:wght@700&family=Noto+Serif+JP:wght@700&family=M+PLUS+Rounded+1c:wght@700&display=swap');

          .font-app-title {
            font-family: 'Cinzel', serif;
            letter-spacing: -0.02em;
          }

          @keyframes gradientBg {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animate-gradient {
            background-size: 200% 200%;
            animation: gradientBg 15s ease infinite;
          }

          @keyframes patternScroll {
            0% { background-position: 0 0; }
            100% { background-position: 48px 48px; }
          }
          .bg-masters-pattern-glass {
            background-color: rgba(255, 255, 255, 0.4);
            background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l20 20-20 20L0 20z' fill='%23c4262e' opacity='0.4'/%3E%3Cpath d='M0 0l40 40m0-40L0 40' stroke='%23f39c12' stroke-width='2' opacity='0.7'/%3E%3Cpath d='M20 0v40m-20-20h40' stroke='%230b1a3a' stroke-width='1.5' opacity='0.5'/%3E%3C/svg%3E");
            background-size: 24px 24px;
            animation: patternScroll 20s linear infinite;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }

          .pattern-overlay {
            position: absolute;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l20 20-20 20L0 20z' fill='%23ffffff' opacity='0.25'/%3E%3Cpath d='M0 0l40 40m0-40L0 40' stroke='%23ffffff' stroke-width='2' opacity='0.4'/%3E%3Cpath d='M20 0v40m-20-20h40' stroke='%23000000' stroke-width='1.5' opacity='0.1'/%3E%3C/svg%3E");
            background-size: 20px 20px;
            pointer-events: none;
            mix-blend-mode: overlay;
          }
          
          .pattern-overlay-dark {
            position: absolute;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l20 20-20 20L0 20z' fill='%23000000' opacity='0.04'/%3E%3Cpath d='M0 0l40 40m0-40L0 40' stroke='%23000000' stroke-width='1.5' opacity='0.06'/%3E%3Cpath d='M20 0v40m-20-20h40' stroke='%23ffffff' stroke-width='1' opacity='0.15'/%3E%3C/svg%3E");
            background-size: 20px 20px;
            pointer-events: none;
          }

          .glass-panel {
            background: rgba(255, 255, 255, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(200, 210, 225, 0.6);
            box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.6);
          }
          .glass-btn {
            background: rgba(255, 255, 255, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(200, 210, 225, 0.6);
            box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.03);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .glass-btn:hover {
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08);
          }
          .glass-btn:active {
            transform: scale(0.95);
          }
          .glass-input {
            background: rgba(255, 255, 255, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(200, 210, 225, 0.8);
            transition: all 0.2s ease;
          }
          .glass-input:focus-within {
            background: rgba(255, 255, 255, 0.95);
            border-color: rgba(150, 180, 220, 0.9);
            box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
          }
          .glass-active {
            background: rgba(255, 255, 255, 0.95);
            border-color: rgba(255, 255, 255, 1);
            box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08);
          }

          @keyframes rainbowFlash {
            0% { opacity: 0; background: rgba(255,255,255,0); backdrop-filter: blur(0px); }
            20% { opacity: 1; background: linear-gradient(135deg, rgba(255,0,0,0.2), rgba(255,165,0,0.2), rgba(255,255,0,0.2), rgba(0,128,0,0.2), rgba(0,0,255,0.2), rgba(75,0,130,0.2), rgba(238,130,238,0.2)); backdrop-filter: blur(8px); }
            80% { opacity: 1; background: linear-gradient(135deg, rgba(255,0,0,0.2), rgba(255,165,0,0.2), rgba(255,255,0,0.2), rgba(0,128,0,0.2), rgba(0,0,255,0.2), rgba(75,0,130,0.2), rgba(238,130,238,0.2)); backdrop-filter: blur(8px); }
            100% { opacity: 0; background: rgba(255,255,255,0); backdrop-filter: blur(0px); }
          }
          .animate-rainbow-flash { animation: rainbowFlash 0.6s ease-out forwards; }

          @keyframes borderGlow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          .magic-border-enjoy::before, .magic-border-special::before, .magic-border-ai::before,
          .magic-border-print-enjoy::before, .magic-border-print-special::before, .magic-border-print-ai::before,
          .magic-border-icon-enjoy::before, .magic-border-icon-special::before, .magic-border-icon-ai::before,
          .magic-border-icon-neutral::before {
            content: '';
            position: absolute;
            animation: borderGlow 5s linear infinite;
            z-index: -2;
          }

          .magic-border-enjoy, .magic-border-special, .magic-border-ai {
            position: relative; padding: 2px; border-radius: 1.5rem; overflow: hidden; z-index: 1;
          }
          .magic-border-enjoy::before, .magic-border-special::before, .magic-border-ai::before {
            top: -75%; left: -75%; width: 250%; height: 250%;
          }
          .magic-border-content {
            position: relative; z-index: -1; background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border-radius: calc(1.5rem - 2px); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.8); height: 100%;
          }

          .magic-border-print-enjoy, .magic-border-print-special, .magic-border-print-ai {
            position: relative; padding: 3px; border-radius: 0.85rem; overflow: hidden; z-index: 1;
          }
          .magic-border-print-enjoy::before, .magic-border-print-special::before, .magic-border-print-ai::before {
            top: -75%; left: -75%; width: 250%; height: 250%; animation-duration: 6s;
          }
          .magic-border-print-content {
            position: relative; z-index: -1; background: #ffffff;
            border-radius: calc(0.85rem - 3px); height: 100%;
          }

          .magic-border-icon-enjoy, .magic-border-icon-special, .magic-border-icon-ai, .magic-border-icon-neutral {
            position: relative; padding: 2px; border-radius: 0.75rem; overflow: hidden; z-index: 1;
          }
          .magic-border-icon-enjoy::before, .magic-border-icon-special::before, .magic-border-icon-ai::before, .magic-border-icon-neutral::before {
            top: -100%; left: -100%; width: 300%; height: 300%;
          }

          .magic-border-enjoy::before, .magic-border-print-enjoy::before, .magic-border-icon-enjoy::before {
            background: conic-gradient(transparent, transparent, transparent, rgba(59, 130, 246, 0.9), rgba(14, 165, 233, 0.9), rgba(56, 189, 248, 0.9), transparent);
          }

          .magic-border-special::before, .magic-border-print-special::before, .magic-border-icon-special::before {
            background: conic-gradient(transparent, transparent, transparent, rgba(225, 29, 72, 0.9), rgba(244, 63, 94, 0.9), rgba(251, 113, 133, 0.9), transparent);
          }

          .magic-border-ai::before, .magic-border-print-ai::before, .magic-border-icon-ai::before {
            background: conic-gradient(transparent, transparent, transparent, rgba(239, 68, 68, 0.9), rgba(234, 179, 8, 0.9), rgba(34, 197, 94, 0.9), rgba(59, 130, 246, 0.9), rgba(168, 85, 247, 0.9), transparent);
          }

          .magic-border-icon-neutral::before {
            background: conic-gradient(transparent, transparent, transparent, rgba(148, 163, 184, 0.8), rgba(203, 213, 225, 0.8), rgba(100, 116, 139, 0.8), transparent);
          }

          .bg-shoulder-pattern-enjoy {
            background-image: url("data:image/svg+xml,%3Csvg width='200' height='60' viewBox='0 0 200 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,0 40,0 20,30' fill='%23002A5C'/%3E%3Cpolygon points='40,0 100,0 60,30' fill='%23C8102E'/%3E%3Cpolygon points='100,0 160,0 130,30' fill='%23F19E1F'/%3E%3Cpolygon points='160,0 200,0 200,30 180,30' fill='%23002A5C'/%3E%3Cpolygon points='0,0 20,30 0,30' fill='%23F19E1F'/%3E%3Cpolygon points='40,0 20,30 60,30' fill='%23ffffff'/%3E%3Cpolygon points='100,0 60,30 130,30' fill='%23002A5C'/%3E%3Cpolygon points='160,0 130,30 180,30' fill='%23ffffff'/%3E%3Cpolygon points='0,30 30,30 15,60' fill='%23C8102E'/%3E%3Cpolygon points='30,30 90,30 50,60' fill='%23002A5C'/%3E%3Cpolygon points='90,30 150,30 110,60' fill='%23ffffff'/%3E%3Cpolygon points='150,30 200,30 180,60' fill='%23F19E1F'/%3E%3Cpolygon points='200,30 200,60 180,60' fill='%23C8102E'/%3E%3Cpolygon points='0,30 15,60 0,60' fill='%23ffffff'/%3E%3Cpolygon points='30,30 15,60 50,60' fill='%23F19E1F'/%3E%3Cpolygon points='90,30 50,60 110,60' fill='%23C8102E'/%3E%3Cpolygon points='150,30 110,60 180,60' fill='%23002A5C'/%3E%3C/svg%3E");
            background-size: 140px 42px;
            background-repeat: repeat;
          }

          .bg-shoulder-pattern-special {
            background-image: url("data:image/svg+xml,%3Csvg width='200' height='60' viewBox='0 0 200 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='0,0 40,0 20,30' fill='%23ffffff'/%3E%3Cpolygon points='40,0 100,0 60,30' fill='%23F19E1F'/%3E%3Cpolygon points='100,0 160,0 130,30' fill='%23C8102E'/%3E%3Cpolygon points='160,0 200,0 200,30 180,30' fill='%23ffffff'/%3E%3Cpolygon points='0,0 20,30 0,30' fill='%23C8102E'/%3E%3Cpolygon points='40,0 20,30 60,30' fill='%23002A5C'/%3E%3Cpolygon points='100,0 60,30 130,30' fill='%23ffffff'/%3E%3Cpolygon points='160,0 130,30 180,30' fill='%23002A5C'/%3E%3Cpolygon points='0,30 30,30 15,60' fill='%23F19E1F'/%3E%3Cpolygon points='30,30 90,30 50,60' fill='%23ffffff'/%3E%3Cpolygon points='90,30 150,30 110,60' fill='%23002A5C'/%3E%3Cpolygon points='150,30 200,30 180,60' fill='%23C8102E'/%3E%3Cpolygon points='200,30 200,60 180,60' fill='%23F19E1F'/%3E%3Cpolygon points='0,30 15,60 0,60' fill='%23002A5C'/%3E%3Cpolygon points='30,30 15,60 50,60' fill='%23C8102E'/%3E%3Cpolygon points='90,30 50,60 110,60' fill='%23F19E1F'/%3E%3Cpolygon points='150,30 110,60 180,60' fill='%23ffffff'/%3E%3C/svg%3E");
            background-size: 140px 42px;
            background-repeat: repeat;
          }

          .font-handwriting { font-family: 'Klee One', cursive; font-weight: 600; letter-spacing: 0.03em; }
          .font-sans-print { font-family: 'Noto Sans JP', sans-serif; font-weight: 700; letter-spacing: 0.01em; }
          .font-serif-print { font-family: 'Noto Serif JP', serif; font-weight: 700; letter-spacing: 0.02em; }
          .font-rounded-print { font-family: 'M PLUS Rounded 1c', sans-serif; font-weight: 700; letter-spacing: 0.02em; }

          @keyframes energyFlow {
            0% { background-position: 200% 50%; }
            100% { background-position: -200% 50%; }
          }
          .animate-energy-flow {
            background: linear-gradient(90deg, 
              transparent 0%, 
              rgba(251, 146, 60, 0.1) 25%, 
              rgba(251, 146, 60, 0.5) 45%, 
              rgba(255, 255, 255, 0.9) 50%, 
              rgba(251, 146, 60, 0.5) 55%, 
              rgba(251, 146, 60, 0.1) 75%, 
              transparent 100%
            );
            background-size: 200% 100%;
            animation: energyFlow 3s linear infinite;
          }

          @keyframes floatIcon {
            0%, 100% { transform: translateY(0) rotate(-5deg); }
            50% { transform: translateY(-4px) rotate(10deg); }
          }
          .animate-float-icon {
            animation: floatIcon 3s ease-in-out infinite;
          }

          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }

          @media print {
            body, html {
              background: #ffffff !important;
              height: auto !important;
              overflow: visible !important;
            }
            main {
              overflow: visible !important;
              height: auto !important;
              padding: 0 !important;
            }
            .print-area {
              box-shadow: none !important;
            }
          }
        `}
      </style>

      {/* --- AI Mode Aura --- */}
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-1000 z-0 ${useAiMode ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-purple-400/10 via-blue-400/5 to-transparent mix-blend-overlay"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[30vh] bg-gradient-to-t from-fuchsia-400/10 to-transparent mix-blend-overlay"></div>
      </div>

      {/* --- マジック生成フラッシュエフェクト --- */}
      {isGenerating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="glass-panel p-6 rounded-3xl flex flex-col items-center gap-3 border-white/40 shadow-2xl relative overflow-hidden">
             <div className={`absolute inset-0 animate-gradient ${useAiMode ? 'bg-gradient-to-r from-blue-400/20 via-fuchsia-400/20 to-orange-400/20' : 'bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-cyan-400/20'}`}></div>
             <div className="relative">
               <div className={`absolute inset-0 rounded-full blur-xl animate-pulse opacity-70 ${useAiMode ? 'bg-gradient-to-r from-blue-400 via-fuchsia-400 to-orange-400' : 'bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500'}`}></div>
               {useAiMode ? (
                 <Sparkles className="w-10 h-10 text-fuchsia-500 relative z-10 animate-bounce" />
               ) : (
                 <PenTool className="w-10 h-10 text-blue-500 relative z-10 animate-bounce" />
               )}
             </div>
             <div className="font-black text-sm text-slate-700 mt-2 bg-white/70 px-4 py-1.5 rounded-full shadow-sm border border-white relative z-10">
                {useAiMode ? 'AIが最適なメニューを考案中...' : 'メニューを生成中...'}
             </div>
           </div>
        </div>
      )}

      {/* --- AI翻訳ローディングエフェクト --- */}
      {isTranslating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="glass-panel p-6 rounded-3xl flex flex-col items-center gap-3 border-white/40 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 via-teal-400/20 to-cyan-400/20 animate-gradient"></div>
             <div className="relative">
               <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-full blur-xl animate-pulse opacity-70"></div>
               <Globe className="w-10 h-10 text-emerald-500 relative z-10 animate-bounce" />
             </div>
             <div className="font-black text-sm text-slate-700 mt-2 bg-white/70 px-4 py-1.5 rounded-full shadow-sm border border-white relative z-10">
                AIが翻訳中...
             </div>
           </div>
        </div>
      )}

      {/* 全画面共通ヘッダー (印刷時のみ非表示) */}
      {!isScreenshotMode && (
      <header className={`glass-panel px-3 py-2 flex items-center justify-between z-10 relative border-x-0 border-t-0 border-b rounded-none overflow-hidden transition-all duration-500 print:hidden ${isSpecialTheme ? 'border-orange-500/80 shadow-[0_4px_24px_-2px_rgba(242,160,61,0.6)]' : activeTab === 'saved' ? 'border-emerald-300/60 shadow-sm' : isNeutralTab ? 'border-slate-300/60 shadow-sm' : 'border-slate-300/60'}`}>
        <div className={`absolute inset-0 pointer-events-none z-0 mix-blend-multiply transition-all duration-500 ${isSpecialTheme ? 'bg-shoulder-pattern-special opacity-[0.85]' : isNeutralTab ? 'bg-shoulder-pattern-enjoy opacity-[0.15] grayscale' : 'bg-shoulder-pattern-enjoy opacity-[0.85]'}`}></div>
        <div className="pattern-overlay-dark opacity-30 pointer-events-none z-0"></div>
        
        <div className={`absolute inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-1000 ${isSpecialTheme ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 animate-energy-flow mix-blend-color-dodge opacity-70"></div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <div className={`shadow-sm shrink-0 ${isNeutralTab ? 'magic-border-icon-neutral' : useAiMode ? 'magic-border-icon-ai' : levelCategory === 'enjoy' ? 'magic-border-icon-enjoy' : 'magic-border-icon-special'}`}>
            <div className={`relative flex items-center justify-center w-[34px] h-[34px] rounded-[10px] overflow-hidden border shadow-inner transition-colors duration-500 ${isSpecialTheme ? 'bg-white border-orange-300/60' : 'bg-white border-slate-300/60'}`}>
              <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 rounded-[8px] overflow-hidden">
                <defs>
                  <g id="poly-bg">
                    <polygon points="-10,-10 30,-10 -10,30" fill="#F39C12" stroke="#F39C12" strokeWidth="0.5" />
                    <polygon points="30,-10 20,40 -10,30" fill="#E67E22" stroke="#E67E22" strokeWidth="0.5" />
                    <polygon points="30,-10 70,-10 20,40" fill="#E74C3C" stroke="#E74C3C" strokeWidth="0.5" />
                    <polygon points="70,-10 60,30 20,40" fill="#C0392B" stroke="#C0392B" strokeWidth="0.5" />
                    <polygon points="70,-10 110,-10 60,30" fill="#1A252F" stroke="#1A252F" strokeWidth="0.5" />
                    <polygon points="110,-10 110,40 60,30" fill="#154360" stroke="#154360" strokeWidth="0.5" />
                    
                    <polygon points="-10,30 20,40 -10,70" fill="#F1C40F" stroke="#F1C40F" strokeWidth="0.5" />
                    <polygon points="20,40 30,60 -10,70" fill="#F39C12" stroke="#F39C12" strokeWidth="0.5" />
                    <polygon points="20,40 60,30 30,60" fill="#A93226" stroke="#A93226" strokeWidth="0.5" />
                    <polygon points="60,30 80,70 30,60" fill="#1C2833" stroke="#1C2833" strokeWidth="0.5" />
                    <polygon points="60,30 110,40 80,70" fill="#34495E" stroke="#34495E" strokeWidth="0.5" />
                    <polygon points="110,40 110,80 80,70" fill="#111827" stroke="#111827" strokeWidth="0.5" />
                    
                    <polygon points="-10,70 30,60 -10,110" fill="#E74C3C" stroke="#E74C3C" strokeWidth="0.5" />
                    <polygon points="30,60 40,110 -10,110" fill="#C0392B" stroke="#C0392B" strokeWidth="0.5" />
                    <polygon points="30,60 80,70 40,110" fill="#F1C40F" stroke="#F1C40F" strokeWidth="0.5" />
                    <polygon points="80,70 80,110 40,110" fill="#D35400" stroke="#D35400" strokeWidth="0.5" />
                    <polygon points="80,70 110,80 80,110" fill="#212F3D" stroke="#212F3D" strokeWidth="0.5" />
                    <polygon points="110,80 110,110 80,110" fill="#154360" stroke="#154360" strokeWidth="0.5" />
                  </g>

                  <filter id="s-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="-2" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.6"/>
                  </filter>
                  <filter id="m-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.4"/>
                  </filter>

                  <clipPath id="m-clip">
                    <text x="38" y="80" fontFamily="Arial, sans-serif" fontSize="85" fontWeight="900" textAnchor="middle" letterSpacing="-4">M</text>
                  </clipPath>
                  <clipPath id="s-clip">
                    <text x="74" y="80" fontFamily="Arial, sans-serif" fontSize="65" fontWeight="900" textAnchor="middle">s</text>
                  </clipPath>
                </defs>

                <rect width="100" height="100" fill="#FFFFFF" className="transition-colors duration-500" />

                <g className={`transition-opacity duration-500 ${isSpecialTheme ? 'opacity-0' : 'opacity-100'}`}>
                  <use href="#poly-bg" />
                  <g filter="url(#m-shadow)">
                    <text x="38" y="80" fontFamily="Arial, sans-serif" fontSize="85" fontWeight="900" textAnchor="middle" letterSpacing="-4" fill="#FFFFFF">M</text>
                  </g>
                  <g filter="url(#s-shadow)">
                    <text x="74" y="80" fontFamily="Arial, sans-serif" fontSize="65" fontWeight="900" textAnchor="middle" fill="#FFFFFF">s</text>
                  </g>
                </g>

                <g className={`transition-opacity duration-500 ${isSpecialTheme ? 'opacity-100' : 'opacity-0'}`}>
                  <g clipPath="url(#m-clip)" filter="url(#m-shadow)">
                    <use href="#poly-bg" />
                  </g>
                  <g clipPath="url(#s-clip)" filter="url(#s-shadow)">
                    <use href="#poly-bg" />
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* クラブ選択＆クラブ登録・大会登録ボタン */}
          <div className="flex items-center gap-1 bg-white/75 backdrop-blur-md rounded-full pl-2.5 pr-1 py-1 border border-slate-300/70 shadow-sm">
            <Building2 className={`w-3.5 h-3.5 shrink-0 ${isSpecialTheme ? 'text-rose-600' : 'text-blue-600'}`} />
            <div className="relative flex items-center">
              <select
                value={currentClub.id}
                onChange={(e) => handleSelectClub(e.target.value)}
                className="bg-transparent text-[11px] font-black text-slate-800 outline-none cursor-pointer appearance-none pr-3.5 max-w-[90px] sm:max-w-[140px] truncate"
                title="操作対象のクラブを切り替え"
              >
                {clubs.map(c => (
                  <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-0 pointer-events-none" />
            </div>
            <button
              onClick={() => setIsClubModalOpen(true)}
              className="p-1 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors border border-slate-200/80"
              title="クラブの新規登録・編集"
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
            </button>
            <button
              onClick={() => setIsCompetitionModalOpen(true)}
              className={`relative p-1 rounded-full transition-colors border ${
                competitions.length > 0
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-300/80'
                  : 'bg-slate-100 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border-slate-200/80'
              }`}
              title={`大会登録・管理 (${currentClub.name}: ${competitions.length}/${MAX_COMPETITIONS}件)`}
            >
              <Trophy className="w-3 h-3" strokeWidth={2.5} />
              {competitions.length > 0 && (
                <span className="sr-only">{competitions.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* 右側: アクションボタンと固定トグル群（スマホ幅では横スワイプで全ボタンに届く） */}
        <div className="flex items-center gap-2 min-w-0 ml-2 overflow-x-auto hide-scrollbar relative z-10">
          
          {activeTab === 'workout' && workoutData && (
            <div className="flex items-center gap-1.5 pr-1.5 border-r border-slate-300/50">
              <button 
                onClick={saveCurrentWorkout} 
                className="relative group flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden border border-emerald-400/50" 
                title="一時保存"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 opacity-100 group-hover:brightness-110 transition-all"></div>
                <div className="pattern-overlay opacity-40"></div>
                {saveToast ? <Check className="w-3.5 h-3.5 relative z-10 text-white" strokeWidth={3} /> : <Save className="w-3.5 h-3.5 relative z-10 text-white" strokeWidth={2.5} />}
                <span className="relative z-10 drop-shadow-md whitespace-nowrap text-white tracking-wide hidden sm:inline-block">{saveToast ? '保存済' : '保存'}</span>
              </button>
              <button 
                onClick={copyWorkoutToClipboard} 
                className="relative group flex items-center gap-1 px-2 py-1.5 rounded-full transition-all active:scale-95 text-xs font-bold text-slate-700 bg-white/70 hover:bg-white shadow-sm border border-slate-300/60" 
                title="テキストとしてコピー（LINEやメールで共有）"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" strokeWidth={2.5} />
                <span className="whitespace-nowrap tracking-wide hidden md:inline-block">コピー</span>
              </button>
              <button 
                onClick={handleGenerateMagic} 
                className={`relative group flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden border ${useAiMode ? 'border-fuchsia-400/50 ring-1 ring-fuchsia-300' : 'border-blue-400/50'}`} 
                title="再生成"
              >
                <div className={`absolute inset-0 opacity-100 group-hover:brightness-110 transition-all ${useAiMode ? 'bg-gradient-to-r from-blue-600 via-fuchsia-500 to-purple-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'}`}></div>
                <div className="pattern-overlay opacity-50"></div>
                {useAiMode ? (
                  <Sparkles className="w-3.5 h-3.5 relative z-10 text-white animate-float-icon drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" strokeWidth={2.5} />
                ) : (
                  <PenTool className="w-3.5 h-3.5 relative z-10 text-white" strokeWidth={2.5} />
                )}
                <span className="relative z-10 drop-shadow-md whitespace-nowrap text-white tracking-wide hidden sm:inline-block">再生成</span>
              </button>
            </div>
          )}

          {/* 印刷タブ時のみ表示のスクショ＆画面ロック＆印刷ボタン */}
          {activeTab === 'print' && scheduledWorkoutData && (
            <div className="flex items-center gap-1.5 pr-1.5 border-r border-slate-300/50 animate-in fade-in zoom-in-95 duration-300">
              <button 
                onClick={() => {
                  setIsScreenLocked(false);
                  setIsScreenshotMode(true);
                }} 
                className="relative group flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95 text-xs font-black text-slate-700 bg-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-slate-300/50 hover:bg-white/80" 
                title="画面いっぱいに中央表示（スクリーンショットモード）"
              >
                <Camera className="w-3.5 h-3.5 relative z-10 text-blue-500 transition-transform group-hover:scale-110" strokeWidth={2.5} />
                <span className="relative z-10 drop-shadow-md whitespace-nowrap tracking-wide">スクショ</span>
              </button>
              <button 
                onClick={() => {
                  setIsScreenLocked(true);
                  setIsScreenshotMode(true);
                }} 
                className="relative group flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95 text-xs font-black text-amber-800 bg-amber-100/80 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-amber-300/70 hover:bg-amber-100" 
                title="誤タップ＆スリープ防止ロック付きで全画面表示"
              >
                <Lock className="w-3.5 h-3.5 relative z-10 text-amber-600 transition-transform group-hover:scale-110" strokeWidth={2.5} />
                <span className="relative z-10 drop-shadow-md whitespace-nowrap tracking-wide hidden sm:inline-block">画面ロック</span>
              </button>
              <button 
                onClick={() => window.print()} 
                className="relative group flex items-center gap-1 px-2.5 py-1.5 rounded-full transition-all active:scale-95 text-xs font-black text-slate-700 bg-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-slate-300/50 hover:bg-white/80" 
                title="紙やPDFに印刷"
              >
                <Printer className="w-3.5 h-3.5 relative z-10 text-emerald-600 transition-transform group-hover:scale-110" strokeWidth={2.5} />
                <span className="relative z-10 drop-shadow-md whitespace-nowrap tracking-wide hidden sm:inline-block">印刷/PDF</span>
              </button>
            </div>
          )}

          {/* 使い方ガイド＆設定ボタン（公開版用） */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="glass-btn p-1.5 rounded-full text-slate-600 hover:text-blue-600 transition-colors border-slate-300/50 shrink-0"
            title="使い方ガイド・バックアップ・API設定"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* ロジック設定ボタン */}
          <button
            onClick={() => {
              setTempSettings(JSON.parse(JSON.stringify(logicSettings)));
              setIsLogicSettingsOpen(true);
            }}
            className="glass-btn p-1.5 rounded-full text-slate-600 hover:text-slate-900 transition-colors border-slate-300/50 shrink-0"
            title="生成ロジック設定"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* AIモード切替トグル */}
          <button
            onClick={() => setUseAiMode(!useAiMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black transition-all duration-300 shrink-0 relative overflow-hidden ${
              useAiMode 
                ? 'text-white shadow-[0_2px_10px_rgba(217,70,239,0.4)] border border-fuchsia-300' 
                : 'glass-input text-slate-500 hover:bg-white/60 border-slate-300/60'
            }`}
          >
            {useAiMode && (
              <>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-fuchsia-500 to-orange-500 animate-gradient"></div>
                <div className="pattern-overlay opacity-40"></div>
              </>
            )}
            <Sparkles className={`w-3 h-3 relative z-10 transition-transform duration-300 ${useAiMode ? 'text-white scale-110 animate-pulse' : 'text-slate-400'}`} />
            <span className="relative z-10 tracking-wider">{useAiMode ? 'AI Mode' : 'Normal'}</span>
            <div className={`w-6 h-3.5 rounded-full transition-colors relative z-10 ${useAiMode ? 'bg-black/20' : 'bg-slate-300/80'}`}>
              <div className={`absolute top-[2px] w-2.5 h-2.5 rounded-full bg-white transition-transform duration-300 ease-in-out shadow-sm ${useAiMode ? 'translate-x-[12px]' : 'translate-x-[2px]'}`}></div>
            </div>
          </button>

        </div>
      </header>
      )}

      {saveToast && !isScreenshotMode && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 glass-panel text-slate-800 px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 animate-in slide-in-from-top-2 fade-in duration-300 border-emerald-200">
          <Check className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-black">「{currentClub.name}」にメニューを保存しました</span>
        </div>
      )}

      {infoToast && !isScreenshotMode && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[130] glass-panel text-slate-800 px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 animate-in slide-in-from-top-2 fade-in duration-300 border-blue-200">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-black whitespace-nowrap">{infoToast}</span>
        </div>
      )}

      {/* --- クラブ登録・管理モーダル --- */}
      {isClubModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[120] p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="glass-panel rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] bg-white/95 border-slate-300/60">
            <div className="bg-white/80 px-4 py-3 border-b border-slate-300/60 flex justify-between items-center shrink-0 backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-800 text-sm sm:text-base">クラブ登録・管理</h3>
              </div>
              <button onClick={() => setIsClubModalOpen(false)} className="glass-btn p-1.5 rounded-full text-slate-500 border-slate-300/50 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">新しいクラブを登録</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClubName}
                    onChange={(e) => setNewClubName(e.target.value)}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    onKeyDown={(e) => { if (isEnterWithoutIme(e)) handleAddClub(); }}
                    placeholder="例：渋谷スイミングクラブ"
                    className="flex-1 p-2.5 rounded-xl glass-input text-slate-800 font-bold text-xs focus:ring-2 focus:ring-blue-400 outline-none border-slate-300/80"
                  />
                  <button
                    onClick={handleAddClub}
                    disabled={!newClubName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 shadow-sm transition-all active:scale-95 shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> 登録
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">登録済みクラブ一覧（タップで切替）</label>
                <div className="space-y-1.5">
                  {clubs.map(club => {
                    const menuCount = savedWorkouts.filter(w => (w.clubId || DEFAULT_CLUBS[0].id) === club.id).length;
                    const isSelected = currentClub.id === club.id;
                    const isEditing = editingClubId === club.id;

                    return (
                      <div
                        key={club.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-400 shadow-sm'
                            : 'glass-panel border-slate-200/80 hover:bg-white/90'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={editingClubName}
                              onChange={(e) => setEditingClubName(e.target.value)}
                              onCompositionStart={handleCompositionStart}
                              onCompositionEnd={handleCompositionEnd}
                              onKeyDown={(e) => { if (isEnterWithoutIme(e)) handleSaveClubEdit(club.id); }}
                              className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-blue-400 text-xs font-black text-slate-800 outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveClubEdit(club.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-500 text-white text-[10px] font-black shrink-0"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingClubId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-[10px] font-black shrink-0"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSelectClub(club.id)}
                              className="flex-1 text-left flex items-center gap-2 min-w-0"
                            >
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-slate-300'}`}></div>
                              <span className={`font-black text-xs truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                                {club.name}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                                {menuCount}件
                              </span>
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingClubId(club.id);
                                  setEditingClubName(club.name);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors"
                                title="クラブ名を変更"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {clubs.length > 1 && (
                                <button
                                  onClick={() => handleDeleteClub(club.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/80 transition-colors"
                                  title="クラブを削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-3 bg-white/80 border-t border-slate-300/60 flex justify-between items-center shrink-0 backdrop-blur-md">
              <button
                onClick={() => {
                  setIsClubModalOpen(false);
                  setIsCompetitionModalOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all active:scale-95"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-600" />
                <span>{currentClub.name}の大会登録 ({competitions.length}/{MAX_COMPETITIONS})</span>
              </button>
              <button
                onClick={() => setIsClubModalOpen(false)}
                className="px-6 py-2 rounded-xl text-xs font-black text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all active:scale-95"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- クラブ別 大会登録・管理モーダル（最大8大会） --- */}
      {isCompetitionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[125] p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="glass-panel rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] bg-white/95 border-slate-300/60">
            <div className="bg-white/80 px-4 py-3 border-b border-slate-300/60 flex justify-between items-center shrink-0 backdrop-blur-md">
              <div className="flex items-center gap-1.5 min-w-0">
                <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="truncate">
                  <h3 className="font-black text-slate-800 text-sm sm:text-base truncate">大会登録・管理</h3>
                  <p className="text-[10px] font-bold text-slate-500 truncate">対象クラブ: {currentClub.name}（最大{MAX_COMPETITIONS}大会）</p>
                </div>
              </div>
              <button onClick={() => setIsCompetitionModalOpen(false)} className="glass-btn p-1.5 rounded-full text-slate-500 border-slate-300/50 hover:bg-slate-200 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5">
                <div className="text-[11px] font-bold text-amber-900 leading-snug">
                  登録した大会のうち、練習日（表示日）から最も近い大会名と残り日数がメニュー表示画面に自動表示されます。
                </div>
                <label className="flex items-center gap-1.5 shrink-0 ml-2 cursor-pointer select-none bg-white px-2.5 py-1.5 rounded-lg border border-amber-200 shadow-sm">
                  <input
                    type="checkbox"
                    checked={showCompetitionOnPrint}
                    onChange={(e) => setShowCompetitionOnPrint(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[10px] font-black text-slate-700">メニュー表示</span>
                </label>
              </div>

              {/* 新規大会追加フォーム */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">新しい大会を追加</label>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${competitions.length >= MAX_COMPETITIONS ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                    登録数: {competitions.length} / {MAX_COMPETITIONS}
                  </span>
                </div>

                {competitions.length >= MAX_COMPETITIONS ? (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-600 text-center">
                    最大{MAX_COMPETITIONS}大会まで登録済みです。新しく追加する場合は既存の大会を削除してください。
                  </div>
                ) : (
                  <div className="space-y-2 glass-panel p-2.5 rounded-xl border-slate-200/80">
                    <input
                      type="text"
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                      onKeyDown={(e) => { if (isEnterWithoutIme(e)) handleAddCompetition(); }}
                      placeholder="大会名（例：ジャパンマスターズ）"
                      className="w-full p-2 rounded-xl glass-input text-slate-800 font-bold text-xs focus:ring-2 focus:ring-amber-400 outline-none border-slate-300/80"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black text-slate-500 pl-1 shrink-0">開催期間:</span>
                      <input
                        type="date"
                        value={newCompStartDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewCompStartDate(val);
                          if (!newCompEndDate || newCompEndDate < val) {
                            setNewCompEndDate(val);
                          }
                        }}
                        className="flex-1 min-w-[115px] p-1.5 rounded-xl glass-input text-slate-800 font-bold text-[11px] focus:ring-2 focus:ring-amber-400 outline-none border-slate-300/80"
                      />
                      <span className="text-xs font-black text-slate-400">〜</span>
                      <input
                        type="date"
                        value={newCompEndDate}
                        min={newCompStartDate}
                        onChange={(e) => setNewCompEndDate(e.target.value)}
                        className="flex-1 min-w-[115px] p-1.5 rounded-xl glass-input text-slate-800 font-bold text-[11px] focus:ring-2 focus:ring-amber-400 outline-none border-slate-300/80"
                      />
                      <button
                        onClick={handleAddCompetition}
                        disabled={!newCompName.trim() || !newCompStartDate}
                        className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 shadow-sm transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> 追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 登録済み大会一覧 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">
                  {currentClub.name} の登録大会一覧
                </label>

                {competitions.length === 0 ? (
                  <div className="text-center p-6 rounded-2xl bg-slate-50/80 border border-dashed border-slate-300 text-slate-400 space-y-1">
                    <Trophy className="w-7 h-7 mx-auto opacity-40 text-amber-500" />
                    <p className="text-xs font-black">まだ大会が登録されていません</p>
                    <p className="text-[10px] font-bold">上のフォームから最大{MAX_COMPETITIONS}件まで大会を登録できます</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {competitions.map(comp => {
                      const days = getCompetitionDaysUntil(comp, printDate);
                      const isNearest = nearestCompetition?.id === comp.id;
                      const isEditing = editingCompId === comp.id;

                      return (
                        <div
                          key={comp.id}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isNearest
                              ? 'bg-amber-50/90 border-amber-400 shadow-sm'
                              : 'glass-panel border-slate-200/80'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editingCompName}
                                onChange={(e) => setEditingCompName(e.target.value)}
                                onCompositionStart={handleCompositionStart}
                                onCompositionEnd={handleCompositionEnd}
                                onKeyDown={(e) => { if (isEnterWithoutIme(e)) handleSaveCompetitionEdit(comp.id); }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-400 text-xs font-black text-slate-800 outline-none"
                                placeholder="大会名"
                                autoFocus
                              />
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-black text-slate-500">期間:</span>
                                <input
                                  type="date"
                                  value={editingCompStartDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingCompStartDate(val);
                                    if (!editingCompEndDate || editingCompEndDate < val) {
                                      setEditingCompEndDate(val);
                                    }
                                  }}
                                  className="flex-1 min-w-[110px] px-2 py-1 rounded-lg bg-white border border-amber-400 text-[11px] font-black text-slate-800 outline-none"
                                />
                                <span className="text-xs font-black text-slate-400">〜</span>
                                <input
                                  type="date"
                                  value={editingCompEndDate}
                                  min={editingCompStartDate}
                                  onChange={(e) => setEditingCompEndDate(e.target.value)}
                                  className="flex-1 min-w-[110px] px-2 py-1 rounded-lg bg-white border border-amber-400 text-[11px] font-black text-slate-800 outline-none"
                                />
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleSaveCompetitionEdit(comp.id)}
                                  className="px-3 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={() => setEditingCompId(null)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600 text-[10px] font-black"
                                >
                                  取消
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {isNearest && (
                                    <span className="text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded shadow-sm shrink-0">
                                      直近大会
                                    </span>
                                  )}
                                  <span className="font-black text-xs text-slate-800 truncate">{comp.name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-slate-500 flex-wrap">
                                  <span>📅 {formatCompetitionPeriod(comp, true)}</span>
                                  {days !== null && (
                                    <span className={`font-black px-1.5 py-0.2 rounded ${
                                      days === 0
                                        ? 'bg-rose-100 text-rose-600'
                                        : days > 0
                                          ? 'bg-amber-100/80 text-amber-800'
                                          : 'bg-slate-200 text-slate-500'
                                    }`}>
                                      {days === 0 ? '本日開催！' : days > 0 ? `あと${days}日` : `${Math.abs(days)}日前`}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    const sDate = comp.startDate || comp.date || getTodayDateStr();
                                    const eDate = comp.endDate || sDate;
                                    setEditingCompId(comp.id);
                                    setEditingCompName(comp.name);
                                    setEditingCompStartDate(sDate);
                                    setEditingCompEndDate(eDate);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors"
                                  title="大会を編集"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCompetition(comp.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white/80 transition-colors"
                                  title="大会を削除"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-white/80 border-t border-slate-300/60 flex justify-end shrink-0 backdrop-blur-md">
              <button
                onClick={() => setIsCompetitionModalOpen(false)}
                className="px-6 py-2 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-all active:scale-95"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 使い方ガイド・バックアップ・API設定モーダル（公開版用） --- */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[115] p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="glass-panel rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] bg-white/95 border-slate-300/60">
            <div className="bg-white/80 px-4 py-3 border-b border-slate-300/60 flex justify-between items-center shrink-0 backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-800 text-sm sm:text-base">ガイド & 各種設定</h3>
              </div>
              <button onClick={() => setIsHelpOpen(false)} className="glass-btn p-1.5 rounded-full text-slate-500 border-slate-300/50 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex bg-slate-100/80 p-1 shrink-0 border-b border-slate-300/50">
              {[
                { id: 'guide', name: '使い方ガイド' },
                { id: 'backup', name: 'データ引継ぎ' },
                { id: 'api', name: 'AIキー設定' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setHelpTab(tab.id)}
                  className={`flex-1 py-1.5 text-[11px] sm:text-xs font-black rounded-lg transition-all ${
                    helpTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:bg-white/50 border border-transparent'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs text-slate-700 leading-relaxed">
              {helpTab === 'guide' && (
                <div className="space-y-3">
                  <div className="glass-panel p-3 rounded-xl border-slate-200/80 space-y-1">
                    <div className="font-black text-blue-600 text-xs">1. クラブ登録・切替（左上）</div>
                    <p className="text-[11px] font-bold text-slate-600">
                      ヘッダー左上の「＋」からクラブを複数登録できます。条件設定・生成ロジック設定・保存メニューはすべて登録クラブごとに個別に管理されます。
                    </p>
                  </div>
                  <div className="glass-panel p-3 rounded-xl border-slate-200/80 space-y-1">
                    <div className="font-black text-blue-600 text-xs">2. 条件設定 ＆ メニュー自動生成</div>
                    <p className="text-[11px] font-bold text-slate-600">
                      レベル・期・目的・総距離・予定時刻を選んで「基本メニューを自動生成」または「AIで最適なメニューを生成」を押すと、時間計算付きの練習メニューが作られます。
                    </p>
                  </div>
                  <div className="glass-panel p-3 rounded-xl border-slate-200/80 space-y-1">
                    <div className="font-black text-blue-600 text-xs">3. メニュー表示・スクショ・画面ロック</div>
                    <p className="text-[11px] font-bold text-slate-600">
                      「メニュー表示」タブでは、直近大会のカウントダウン表示や日英中3ヶ国語の切り替え、フォント変更、画面中央に余白なしで最大表示する「スクショ」モード、水滴や誤タップを防ぐ「画面ロック」が使えます。
                    </p>
                  </div>
                </div>
              )}

              {helpTab === 'backup' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-600 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100">
                    登録したクラブ情報・各クラブの設定データ・保存済メニューをファイル（JSON）として書き出し、他の端末やブラウザへ引き継ぐことができます。
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={exportAppData}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      バックアップを書き出す
                    </button>
                    <label className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm transition-all active:scale-95 cursor-pointer">
                      <Upload className="w-4 h-4 text-emerald-600" />
                      バックアップを読み込む
                      <input type="file" accept=".json" onChange={importAppData} className="hidden" />
                    </label>
                  </div>
                </div>
              )}

              {helpTab === 'api' && (
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-600 bg-fuchsia-50/70 p-2.5 rounded-xl border border-fuchsia-100">
                    「Normalモード」および「内蔵辞書による多言語翻訳」はAPIキー不要でどなたでも無料でご利用いただけます。AI生成（AI Mode）や高精度AI翻訳を利用したい場合は、ご自身のGoogle Gemini APIキーを設定してください（お使いのブラウザ内にのみ保存されます）。
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 pl-1">
                      <Key className="w-3.5 h-3.5 text-fuchsia-500" /> Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      autoComplete="off"
                      className="w-full p-2.5 rounded-xl glass-input text-slate-800 font-mono text-xs focus:ring-2 focus:ring-fuchsia-400 outline-none border-slate-300/80"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 bg-white/70 p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div>APIキーは Google AI Studio で無料で発行できます：</div>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">https://aistudio.google.com/apikey</a>
                    <div className="text-slate-500">※ 共用の端末では入力しないでください。キーはこの端末のブラウザにだけ保存され、Google以外には送信されません。</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 pl-1">
                      <Sparkles className="w-3.5 h-3.5 text-fuchsia-500" /> 使用モデル（通常は空欄でOK）
                    </label>
                    <input
                      type="text"
                      value={geminiModel}
                      onChange={(e) => setGeminiModel(e.target.value)}
                      placeholder={GEMINI_DEFAULT_MODEL}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full p-2.5 rounded-xl glass-input text-slate-800 font-mono text-xs focus:ring-2 focus:ring-fuchsia-400 outline-none border-slate-300/80"
                    />
                    <div className="text-[10px] font-bold text-slate-500 pl-1">
                      空欄なら常に最新のFlashモデルを使い、上限に達したときは自動で {GEMINI_FALLBACK_MODEL} に切り替えます。
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-white/80 border-t border-slate-300/60 flex justify-end shrink-0 backdrop-blur-md">
              <button
                onClick={() => setIsHelpOpen(false)}
                className="px-6 py-2 rounded-xl text-xs font-black text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all active:scale-95"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 生成ロジック設定モーダル --- */}
      {isLogicSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="glass-panel rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] bg-white/95 border-slate-300/60">
            <div className="bg-white/80 px-4 py-3 border-b border-slate-300/60 flex justify-between items-center shrink-0 backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                <h3 className="font-black text-slate-800 text-sm sm:text-base">生成ロジック設定 ({currentClub.name})</h3>
              </div>
              <button onClick={() => setIsLogicSettingsOpen(false)} className="glass-btn p-1.5 rounded-full text-slate-500 border-slate-300/50 hover:bg-slate-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex bg-slate-100/80 p-1 shrink-0 border-b border-slate-300/50">
              {[
                { id: 'pace', name: 'ペース' },
                { id: 'menuDist', name: '生成距離' },
                { id: 'distance', name: '推定距離' },
                { id: 'ratio', name: '割合' },
                { id: 'period', name: '期別' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveLogicTab(tab.id)}
                  className={`flex-1 py-1.5 text-[11px] sm:text-xs font-black rounded-lg transition-all ${
                    activeLogicTab === tab.id 
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:bg-white/50 border border-transparent'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto space-y-4 flex-1">
              {activeLogicTab === 'pace' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-500 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    各レベルの「25mあたりの基準ペース（秒）」を設定します。この値をもとにサークルタイムが自動計算されます。
                  </div>
                  {['enjoy', 'special'].map(cat => (
                    <div key={cat} className="glass-panel p-3 rounded-xl border-slate-200/60 space-y-2">
                      <div className="text-xs font-black text-slate-700 border-b border-slate-300/50 pb-1.5 flex justify-between items-center">
                        <span className={cat === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}>
                          {cat === 'enjoy' ? 'エンジョイマスターズ' : 'スペシャルマスターズ'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">25m基準秒数</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {tempSettings.levels.filter(l => l.category === cat).map(lvl => (
                          <div key={lvl.id} className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-500 font-bold pl-1">{lvl.name}</span>
                            <div className="flex items-center glass-input px-2 py-1 rounded-lg bg-white/60 border-slate-200">
                              <input
                                type="number"
                                min="10"
                                max="90"
                                value={lvl.basePace25}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 10;
                                  setTempSettings(prev => ({
                                    ...prev,
                                    levels: prev.levels.map(item => item.id === lvl.id ? { ...item, basePace25: val } : item)
                                  }));
                                }}
                                className="w-full text-right bg-transparent text-sm font-black text-slate-800 outline-none"
                              />
                              <span className="text-[10px] text-slate-400 font-bold ml-1">秒</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeLogicTab === 'menuDist' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-500 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    メニュー生成時に使われる各パートの「1本あたりの基準距離(m)」や「最大距離上限」「Downの最低距離」をカテゴリ別に設定します（5m単位）。
                  </div>
                  {['enjoy', 'special'].map(cat => {
                    const distCfg = tempSettings.menuDistances?.[cat] || DEFAULT_LOGIC_SETTINGS.menuDistances[cat];
                    const updateMenuDist = (key, val) => {
                      setTempSettings(prev => ({
                        ...prev,
                        menuDistances: {
                          ...(prev.menuDistances || DEFAULT_LOGIC_SETTINGS.menuDistances),
                          [cat]: {
                            ...(prev.menuDistances?.[cat] || DEFAULT_LOGIC_SETTINGS.menuDistances[cat]),
                            [key]: Math.max(5, Number(val) || 0)
                          }
                        }
                      }));
                    };
                    const partLabels = [
                      { key: 'WUp', label: 'W-Up (1本)' },
                      { key: 'Kick', label: 'Kick (1本)' },
                      { key: 'Drill', label: 'Drill (1本)' },
                      { key: 'Pull', label: 'Pull (1本)' },
                      { key: 'Main', label: 'Main 通常 (1本)' },
                      { key: 'MainEndurance', label: 'Main 持久力 (1本)' },
                      { key: 'Down', label: 'Down (1本)' },
                      { key: 'maxRepDist', label: '1本の最大距離上限' },
                      { key: 'minDownTotal', label: 'Down 最低総距離' }
                    ];
                    return (
                      <div key={cat} className="glass-panel p-3 rounded-xl border-slate-200/60 space-y-2.5">
                        <div className="text-xs font-black text-slate-700 border-b border-slate-300/50 pb-1.5 flex justify-between items-center">
                          <span className={cat === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}>
                            {cat === 'enjoy' ? 'エンジョイマスターズ' : 'スペシャルマスターズ'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">単位: m</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {partLabels.map(item => (
                            <div key={item.key} className="flex flex-col gap-1">
                              <span className="text-[9.5px] text-slate-500 font-bold truncate" title={item.label}>{item.label}</span>
                              <div className="flex items-center glass-input px-1.5 py-1 rounded-lg bg-white/60 border-slate-200">
                                <input
                                  type="number"
                                  step="5"
                                  min="5"
                                  value={distCfg[item.key] ?? 25}
                                  onChange={(e) => updateMenuDist(item.key, e.target.value)}
                                  className="w-full text-right bg-transparent text-xs font-black text-slate-800 outline-none"
                                />
                                <span className="text-[9px] text-slate-400 font-bold ml-0.5">m</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeLogicTab === 'distance' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-500 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    60分泳いだ場合の「推定距離（上限・下限）」を設定します。この値と予定時刻から目標距離の目安が算出されます。
                  </div>
                  {['enjoy', 'special'].map(cat => (
                    <div key={cat} className="glass-panel p-3 rounded-xl border-slate-200/60 space-y-2">
                      <div className="text-xs font-black text-slate-700 border-b border-slate-300/50 pb-1.5 flex justify-between items-center">
                        <span className={cat === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}>
                          {cat === 'enjoy' ? 'エンジョイマスターズ' : 'スペシャルマスターズ'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-bold pl-1">下限 <span className="text-[8px] font-medium">(初級・スピード等)</span></span>
                          <div className="flex items-center glass-input px-2 py-1 rounded-lg bg-white/60 border-slate-200">
                             <input 
                               type="number" 
                               value={tempSettings.distanceLimits?.[cat]?.min ?? 0} 
                               onChange={(e) => {
                                 setTempSettings(prev => ({
                                   ...prev,
                                   distanceLimits: {
                                     ...prev.distanceLimits,
                                     [cat]: { ...prev.distanceLimits[cat], min: Number(e.target.value) || 0 }
                                   }
                                 }));
                               }}
                               step="100"
                               className="w-full text-right bg-transparent text-sm font-black text-slate-800 outline-none" 
                             />
                             <span className="text-[10px] text-slate-400 font-bold ml-1">m</span>
                          </div>
                        </div>
                        <div className="text-slate-300 font-black mt-4">-</div>
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-bold pl-1">上限 <span className="text-[8px] font-medium">(上級・持久力等)</span></span>
                          <div className="flex items-center glass-input px-2 py-1 rounded-lg bg-white/60 border-slate-200">
                             <input 
                               type="number" 
                               value={tempSettings.distanceLimits?.[cat]?.max ?? 0} 
                               onChange={(e) => {
                                 setTempSettings(prev => ({
                                   ...prev,
                                   distanceLimits: {
                                     ...prev.distanceLimits,
                                     [cat]: { ...prev.distanceLimits[cat], max: Number(e.target.value) || 0 }
                                   }
                                 }));
                               }}
                               step="100"
                               className="w-full text-right bg-transparent text-sm font-black text-slate-800 outline-none" 
                             />
                             <span className="text-[10px] text-slate-400 font-bold ml-1">m</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeLogicTab === 'ratio' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-500 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    目的ごとの各パートの距離割合（基本値）を % で設定します。合計が 100% に近くなるように設定してください。
                  </div>
                  {Object.entries(tempSettings.baseRatios).map(([purpKey, ratios]) => (
                    <div key={purpKey} className="glass-panel p-3 rounded-xl border-slate-200/60">
                      <div className="text-xs font-black text-slate-700 border-b border-slate-300/50 pb-1.5 mb-2.5 flex justify-between items-center">
                        <span>目的: <span className="text-blue-600">{PURPOSE_NAMES[purpKey] || purpKey}</span></span>
                        <span className="text-[10px] font-bold text-slate-400">
                          合計: {Object.values(ratios).reduce((a,b)=>a+b,0)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {PART_KEYS.map(part => (
                          <div key={part} className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-500 font-bold">{part}</span>
                            <div className="flex items-center glass-input px-1.5 py-1 rounded-lg bg-white/60 border-slate-200">
                               <input 
                                 type="number" 
                                 value={ratios[part]} 
                                 onChange={(e) => {
                                   setTempSettings(prev => ({
                                     ...prev,
                                     baseRatios: {
                                       ...prev.baseRatios,
                                       [purpKey]: { ...prev.baseRatios[purpKey], [part]: Number(e.target.value) || 0 }
                                     }
                                   }));
                                 }}
                                 className="w-full text-right bg-transparent text-xs font-black text-slate-800 outline-none" 
                               />
                               <span className="text-[9px] text-slate-400 font-bold ml-0.5">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeLogicTab === 'period' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-500 bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    トレーニング期によって「目的別割合」から加減算する値（%）を設定します。マイナスの値も設定可能です。
                  </div>
                  {Object.entries(tempSettings.periodAdjustments).map(([periodKey, adjs]) => (
                    <div key={periodKey} className="glass-panel p-3 rounded-xl border-slate-200/60">
                      <div className="text-xs font-black text-slate-700 border-b border-slate-300/50 pb-1.5 mb-2.5">
                        期: <span className="text-fuchsia-600">{PERIODS.find(p=>p.id===periodKey)?.name || periodKey}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {PART_KEYS.map(part => (
                          <div key={part} className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-500 font-bold">{part}</span>
                            <div className="flex items-center glass-input px-1.5 py-1 rounded-lg bg-white/60 border-slate-200">
                               <input 
                                 type="number" 
                                 value={adjs[part]} 
                                 onChange={(e) => {
                                   setTempSettings(prev => ({
                                     ...prev,
                                     periodAdjustments: {
                                       ...prev.periodAdjustments,
                                       [periodKey]: { ...prev.periodAdjustments[periodKey], [part]: Number(e.target.value) || 0 }
                                     }
                                   }));
                                 }}
                                 className={`w-full text-right bg-transparent text-xs font-black outline-none ${adjs[part] < 0 ? 'text-rose-500' : adjs[part] > 0 ? 'text-blue-600' : 'text-slate-800'}`} 
                               />
                               <span className="text-[9px] text-slate-400 font-bold ml-0.5">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-white/80 border-t border-slate-300/60 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
              <button 
                onClick={() => setTempSettings(cloneDefaultLogicSettings())}
                className="flex items-center gap-1 py-2 px-3 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                title="初期値に戻す"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 初期化
              </button>
              <div className="flex gap-2 flex-1">
                <button 
                  onClick={() => setIsLogicSettingsOpen(false)}
                  className="glass-btn flex-1 py-2 rounded-xl text-xs font-black text-slate-600 bg-white border-slate-300/50"
                >
                  キャンセル
                </button>
                <button 
                  onClick={() => {
                    setLogicSettings(tempSettings);
                    setIsLogicSettingsOpen(false);
                    showToast(`「${currentClub.name}」のロジック設定を保存しました`);
                  }}
                  className="flex-[1.5] py-2 rounded-xl text-xs font-black text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all active:scale-95 border border-blue-400"
                >
                  設定を保存する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main 
        className={`flex-1 relative transition-all duration-300 ${
          isScreenshotMode 
            ? 'fixed inset-0 z-[150] flex items-center justify-center overflow-hidden p-0 m-0 bg-slate-100 select-none cursor-pointer' 
            : 'overflow-y-auto pb-24 pt-1 md:pt-2'
        }`}
        onClick={() => {
          if (isScreenshotMode) {
            if (isScreenLocked) {
              triggerHintTemporarily(2500);
            } else {
              setIsScreenshotMode(false);
            }
          }
        }}
      >
        
        {/* --- 条件設定タブ --- */}
        {activeTab === 'settings' && (
          <div className="px-2 md:px-3 space-y-2.5 animate-in fade-in duration-300 max-w-2xl mx-auto">
            
            <div className="glass-panel rounded-[1.5rem] p-3 md:p-4 space-y-2.5">
              
              {/* 選択中クラブ＆登録大会一覧エリア */}
              <div className="bg-white/65 border border-slate-300/60 rounded-xl p-2.5 space-y-2 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className={`w-4 h-4 shrink-0 ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}`} />
                    <span className="text-xs font-black text-slate-800 truncate">{currentClub.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setIsCompetitionModalOpen(true)}
                      className="flex items-center gap-1 text-[10px] font-black text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-300/80 transition-colors shadow-sm"
                    >
                      <Trophy className="w-3 h-3 text-amber-600" />
                      <span>大会登録・編集 ({competitions.length}/{MAX_COMPETITIONS})</span>
                    </button>
                    <button
                      onClick={() => setIsClubModalOpen(true)}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 px-2 py-1 rounded-lg border border-blue-200/80 transition-colors"
                    >
                      クラブ管理
                    </button>
                  </div>
                </div>

                {/* 登録大会一覧 */}
                <div className="border-t border-slate-200/80 pt-2">
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className="text-[10px] font-black text-slate-500 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-500" />
                      登録大会一覧（{currentClub.name}）
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      レッスン日基準: {formatShortDateWithDay(printDate)}
                    </span>
                  </div>

                  {competitions.length === 0 ? (
                    <div
                      onClick={() => setIsCompetitionModalOpen(true)}
                      className="text-[10px] font-bold text-slate-400 bg-slate-50/70 hover:bg-amber-50/50 border border-dashed border-slate-300 rounded-lg py-2 px-3 text-center cursor-pointer transition-colors"
                    >
                      登録された大会はありません（タップして最大{MAX_COMPETITIONS}大会まで登録可能）
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                      {competitions.map(comp => {
                        const days = getCompetitionDaysUntil(comp, printDate);
                        const isNearest = nearestCompetition?.id === comp.id;
                        return (
                          <div
                            key={comp.id}
                            onClick={() => setIsCompetitionModalOpen(true)}
                            className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] cursor-pointer transition-all ${
                              isNearest
                                ? 'bg-amber-50/95 border-amber-400 shadow-sm'
                                : 'bg-white/80 border-slate-200/90 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              {isNearest && (
                                <span className="text-[8px] font-black bg-amber-500 text-white px-1 py-0.2 rounded shrink-0">
                                  直近
                                </span>
                              )}
                              <span className="font-black text-slate-800 truncate">{comp.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                                {formatCompetitionPeriod(comp)}
                              </span>
                              {days !== null && (
                                <span className={`font-black px-1.5 py-0.2 rounded text-[9px] whitespace-nowrap ${
                                  days === 0
                                    ? 'bg-rose-500 text-white'
                                    : days > 0
                                      ? 'bg-amber-100 text-rose-600 border border-amber-300'
                                      : 'bg-slate-200 text-slate-500'
                                }`}>
                                  {days === 0 ? '本日!' : days > 0 ? `あと${days}日` : `${Math.abs(days)}日前`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 泳力レベル設定 */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">泳力レベル</label>
                
                <div className="flex glass-input p-0.5 rounded-xl border-slate-300/50">
                  {LEVEL_CATEGORIES.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => {
                        setLevelCategory(cat.id);
                        const defaultLevel = logicSettings.levels.find(l => l.category === cat.id && l.name === '中級')?.id || logicSettings.levels.find(l => l.category === cat.id)?.id;
                        setLevelId(defaultLevel);
                      }}
                      className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all relative overflow-hidden ${
                        levelCategory === cat.id 
                          ? `glass-active shadow-sm border-slate-200/80 ${cat.id === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}` 
                          : 'text-slate-500 hover:bg-white/50 border-transparent'
                      }`}
                    >
                      {levelCategory === cat.id && <div className="pattern-overlay-dark opacity-30"></div>}
                      <span className="relative z-10">{cat.name}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                  {availableLevels.map(l => (
                    <button
                      key={l.id}
                      onClick={() => setLevelId(l.id)}
                      className={`glass-btn py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 border-slate-300/60 relative overflow-hidden ${
                        levelId === l.id 
                          ? `glass-active ring-1 ring-white shadow-sm ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}`
                          : 'text-slate-600'
                      }`}
                    >
                      {levelId === l.id && <div className="pattern-overlay-dark opacity-30"></div>}
                      <div className="font-black text-sm relative z-10">{l.name}</div>
                      <div className="text-[9px] opacity-80 line-clamp-1 relative z-10">{l.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* トレーニング期設定 */}
              <div className="space-y-1 pt-0.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">トレーニング期</label>
                <div className="flex flex-wrap gap-1.5">
                  {PERIODS.map(per => (
                    <button 
                      key={per.id}
                      onClick={() => setPeriod(per.id)}
                      className={`glass-btn flex-1 py-1.5 px-0.5 flex flex-col items-center justify-center rounded-xl min-w-[18%] border-slate-300/60 relative overflow-hidden ${
                        period === per.id 
                          ? `glass-active ring-1 ring-white shadow-sm ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}` 
                          : 'text-slate-600'
                      }`}
                    >
                      {period === per.id && <div className="pattern-overlay-dark opacity-30"></div>}
                      <span className="text-[10px] md:text-xs font-black tracking-tight mb-0.5 relative z-10">{per.name}</span>
                      <span className="text-[8px] opacity-80 leading-none whitespace-nowrap tracking-tighter relative z-10">{per.desc.split('・')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 目的選択 */}
              <div className="space-y-1 pt-0.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">本日の目的</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PURPOSES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPurpose(p.id)}
                      className={`glass-btn p-2 rounded-xl text-left flex flex-col justify-center border-slate-300/60 relative overflow-hidden ${
                        purpose === p.id 
                          ? `glass-active ring-1 ring-white shadow-sm ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}` 
                          : 'text-slate-600'
                      }`}
                    >
                      {purpose === p.id && <div className="pattern-overlay-dark opacity-30"></div>}
                      <div className="font-black text-xs mb-0.5 relative z-10">{p.name}</div>
                      <div className="text-[9px] opacity-80 line-clamp-1 relative z-10">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 練習量・スケジュール */}
              <div className="space-y-1.5 pt-0.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">練習量とスケジュール</label>
                
                <div className="flex gap-1.5">
                  <div className="glass-input p-1.5 rounded-xl flex flex-col justify-center gap-0.5 flex-1 border-slate-300/60">
                    <div className="flex items-center justify-between pl-1 pr-0.5">
                      <div className="text-[9px] font-black text-slate-500 flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5" /> レッスン日
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${levelCategory === 'enjoy' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'}`}>
                          {formatShortDateWithDay(printDate)}
                        </span>
                        {printDate !== getTodayDateStr() && (
                          <button
                            type="button"
                            onClick={() => setPrintDate(getTodayDateStr())}
                            className="text-[8px] font-black text-slate-500 hover:text-slate-800 bg-white/80 px-1 py-0.2 rounded border border-slate-300 transition-colors"
                          >
                            今日に戻す
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center bg-white/60 border border-slate-300/50 rounded-lg px-2 py-0.5 focus-within:bg-white/90 transition-all">
                      <input
                        type="date"
                        value={printDate}
                        onChange={(e) => setPrintDate(e.target.value)}
                        className="w-full py-0.5 text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="glass-input p-1.5 rounded-xl flex flex-col justify-center gap-0.5 w-[38%] shrink-0 border-slate-300/60">
                    <div className="text-[9px] font-black text-slate-500 pl-1">総距離</div>
                    <div className="flex items-center gap-1 bg-white/60 border border-slate-300/50 rounded-lg px-1.5 py-0.5 focus-within:bg-white/90 transition-all">
                      <input
                        type="number"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        step="50"
                        min="100"
                        className="w-full py-0.5 text-sm font-black text-slate-800 outline-none bg-transparent text-right"
                      />
                      <span className="font-black text-slate-500 text-[10px]">m</span>
                    </div>
                  </div>
                </div>

                <div className="glass-input p-1.5 rounded-xl flex flex-col justify-center gap-0.5 border-slate-300/60">
                  <div className="text-[9px] font-black text-slate-500 flex items-center gap-0.5 pl-1">
                    <Clock className="w-2.5 h-2.5" /> 予定時刻
                  </div>
                  <div className="flex items-center gap-1 bg-white/60 border border-slate-300/50 rounded-lg px-2 py-0.5 focus-within:bg-white/90 transition-all">
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-transparent text-xs font-black text-slate-800 outline-none text-center px-0.5 py-0.5"
                    />
                    <span className="font-black text-slate-400 text-xs shrink-0">~</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-transparent text-xs font-black text-slate-800 outline-none text-center px-0.5 py-0.5"
                    />
                  </div>
                </div>

                <div className="bg-white/50 border border-slate-300/60 p-2 rounded-xl flex items-start gap-1.5 text-[10px] transition-colors duration-300 mt-1.5 shadow-sm">
                  <AlertCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${levelCategory === 'enjoy' ? 'text-blue-500' : 'text-rose-500'}`} />
                  <div className="leading-snug text-slate-600 font-bold">
                    <span className="font-black text-slate-700">{currentLevelObj?.name}・{(PERIODS.find(p=>p.id===period) || PERIODS[1]).name}</span>ペースで泳ぐ場合、
                    総距離は<span className="font-black text-slate-700 text-xs mx-0.5">{estimatedDistForTime}</span>m 前後が目安です。
                  </div>
                </div>

              </div>
            </div>

            <button 
              onClick={handleGenerateMagic}
              className={`w-full relative group py-3.5 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.2)] flex items-center justify-center gap-2 transition-all active:scale-95 overflow-hidden mt-3 border border-white/20 ${useAiMode ? 'ring-2 ring-fuchsia-400/50 ring-offset-1 ring-offset-white/30' : ''}`}
            >
              <div className={`absolute inset-0 opacity-100 group-hover:brightness-110 transition-all animate-gradient ${useAiMode ? 'bg-gradient-to-r from-blue-600 via-fuchsia-500 to-purple-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'}`}></div>
              <div className="pattern-overlay opacity-30"></div>
              {useAiMode ? (
                 <Sparkles className="w-5 h-5 relative z-10 text-white animate-float-icon drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" strokeWidth={2.5} />
              ) : (
                 <PenTool className="w-5 h-5 relative z-10 text-white" strokeWidth={2.5} />
              )}
              <span className="relative z-10 tracking-wider text-white font-extrabold text-base drop-shadow-md">
                {useAiMode ? 'AIで最適なメニューを生成' : '基本メニューを自動生成'}
              </span>
            </button>
          </div>
        )}

        {/* --- ワークアウト（メニュー）タブ --- */}
        {activeTab === 'workout' && scheduledWorkoutData && (
          <div className="px-2 md:px-3 space-y-2 animate-in fade-in duration-300 max-w-2xl mx-auto">
            
            <div className={`mb-2 shadow-sm ${isCurrentAiGenerated ? 'magic-border-ai' : levelCategory === 'enjoy' ? 'magic-border-enjoy' : 'magic-border-special'}`}>
              <div className="magic-border-content p-3 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex flex-col gap-1.5 mb-2">
                    <div className="flex justify-between items-center border-b border-slate-300/60 pb-1.5">
                      <div className="relative flex-1 mr-2 max-w-[150px] md:max-w-[200px]">
                        <select 
                          value={levelCategory}
                          onChange={handleMenuCategoryChange}
                          className={`w-full bg-transparent text-sm md:text-base font-black outline-none cursor-pointer appearance-none pr-4 truncate drop-shadow-sm transition-colors ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}`}
                        >
                          {LEVEL_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id} className="text-slate-800 text-sm">{cat.name}</option>
                          ))}
                        </select>
                        <ChevronDown className={`w-3.5 h-3.5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 transition-colors ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}`} />
                      </div>
                      
                      <div className="flex items-center glass-input bg-white/50 hover:bg-white/70 focus-within:bg-white/80 rounded-lg px-2.5 py-0.5 transition-colors shrink-0 gap-1 border border-slate-300/60">
                        <span className="text-[9px] text-slate-500 font-bold hidden sm:inline">総泳距離</span>
                        <span className="text-[9px] text-slate-500 font-bold sm:hidden">距離</span>
                        <div className="flex items-baseline">
                          <input 
                            type="number"
                            value={distance}
                            onChange={(e) => setDistance(e.target.value)}
                            onBlur={(e) => regenerateWithNewParams(levelId, purpose, period, e.target.value)}
                            onKeyDown={(e) => { 
                              if(e.key === 'Enter') e.target.blur();
                            }}
                            step="50"
                            className="w-16 sm:w-20 bg-transparent text-slate-800 outline-none font-black text-lg text-right tracking-tight"
                          />
                          <span className="font-bold text-slate-500 text-[10px] ml-0.5">m</span>
                          <Edit2 className="w-2.5 h-2.5 ml-1 text-slate-400 shrink-0" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 mt-0.5">
                      <div className="flex items-center text-xs">
                        <span className="w-14 font-bold text-slate-500 shrink-0 text-[10px]">泳力レベル</span>
                        <div className="relative flex-1 max-w-[160px]">
                          <select 
                            value={levelId}
                            onChange={handleMenuLevelChange}
                            className="w-full glass-input bg-white/40 hover:bg-white/60 text-slate-800 rounded-md pl-1.5 pr-5 py-0.5 outline-none cursor-pointer font-bold appearance-none text-[10px] border-slate-300/60"
                          >
                            {availableLevels.map(l => (
                              <option key={l.id} value={l.id} className="text-slate-800">{l.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-2.5 h-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-slate-800" />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center text-xs flex-1 max-w-[140px]">
                          <span className="w-8 font-bold text-slate-500 shrink-0 text-[10px]">目的</span>
                          <div className="relative flex-1">
                            <select 
                              value={purpose}
                              onChange={handleMenuPurposeChange}
                              className="w-full glass-input bg-white/40 hover:bg-white/60 text-slate-800 rounded-md pl-1.5 pr-5 py-0.5 outline-none cursor-pointer font-bold appearance-none text-[10px] border-slate-300/60"
                            >
                              {PURPOSES.map(p => (
                                <option key={p.id} value={p.id} className="text-slate-800">{p.name.replace('向上','')}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-slate-800" />
                          </div>
                        </div>
                        
                        <div className="flex items-center text-xs flex-1 max-w-[120px]">
                          <span className="w-5 font-bold text-slate-500 shrink-0 text-[10px]">期</span>
                          <div className="relative flex-1">
                            <select 
                              value={period}
                              onChange={(e) => handleMenuPeriodChange(e.target.value)}
                              className="w-full glass-input bg-white/40 hover:bg-white/60 text-slate-800 rounded-md pl-1.5 pr-5 py-0.5 outline-none cursor-pointer font-bold appearance-none text-[10px] border-slate-300/60"
                            >
                              {PERIODS.map(p => (
                                <option key={p.id} value={p.id} className="text-slate-800">{p.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-2.5 h-2.5 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-slate-800" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center text-xs">
                        <span className="w-14 font-bold text-slate-500 shrink-0 text-[10px]">テーマ</span>
                        <div className="relative flex-1 max-w-[260px]">
                          <input 
                            type="text"
                            value={purposeDetail}
                            onChange={(e) => setPurposeDetail(e.target.value)}
                            placeholder="例：キャッチを意識する"
                            className="w-full glass-input bg-white/40 focus:bg-white/70 hover:bg-white/60 text-slate-800 rounded-md px-1.5 py-0.5 outline-none font-bold text-[10px] placeholder-slate-400 border-slate-300/60"
                          />
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="bg-white/40 rounded-lg p-1.5 flex flex-wrap items-center justify-between gap-1 text-xs mt-1.5 border border-slate-300/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]">
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="relative flex items-center gap-1 glass-input bg-white/60 hover:bg-white/80 rounded-md px-2 py-0.5 border border-slate-300/50 cursor-pointer">
                        <Calendar className="w-3 h-3 text-slate-500 shrink-0 pointer-events-none" />
                        <span className="text-slate-800 font-black text-xs whitespace-nowrap">{formatShortDateWithDay(printDate)}</span>
                        <input
                          type="date"
                          value={printDate}
                          onChange={(e) => setPrintDate(e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          title="レッスン日を変更"
                        />
                      </div>
                      <div className="flex items-center gap-1 glass-input bg-white/60 hover:bg-white/80 rounded-md px-2 py-0.5 border border-slate-300/50 focus-within:border-slate-400">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <input 
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="bg-transparent text-slate-800 font-black outline-none min-w-[68px] sm:min-w-[76px] text-center text-xs"
                        />
                        <span className="text-slate-400 font-bold text-xs shrink-0">~</span>
                        <input 
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="bg-transparent text-slate-800 font-black outline-none min-w-[68px] sm:min-w-[76px] text-center text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pr-1 shrink-0 ml-auto">
                      <span className="text-slate-500 font-bold text-[9px]">推定終了</span>
                      <span className={`font-black text-sm drop-shadow-sm ${scheduledWorkoutData.endTime > scheduledWorkoutData.targetEndTime ? 'text-amber-600' : 'text-slate-800'}`}>
                        {formatTimeObj(scheduledWorkoutData.endTime)}
                      </span>
                    </div>
                  </div>
                  {scheduledWorkoutData.endTime > scheduledWorkoutData.targetEndTime && (
                    <div className="text-[9px] font-black text-amber-600 text-right mt-1 pr-1 drop-shadow-sm">
                      ※予定時間をオーバーする可能性があります
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {scheduledWorkoutData.parts.map((part, index) => (
                <div key={part.id} className="glass-panel rounded-2xl overflow-hidden border border-slate-300/60 shadow-sm">
                  
                  <div className="bg-white/60 px-2.5 py-1.5 border-b border-slate-300/60 flex justify-between items-center backdrop-blur-md gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="flex items-center bg-transparent hover:bg-white/80 focus-within:bg-white/90 rounded-md px-1.5 py-0.5 -ml-0.5 transition-colors">
                        <input
                          type="text"
                          value={part.name}
                          onChange={(e) => updatePartName(part.id, e.target.value)}
                          className="font-black text-slate-800 text-sm bg-transparent outline-none w-20 sm:w-24"
                        />
                        <Edit2 className="w-2.5 h-2.5 text-slate-400 shrink-0 ml-0.5" />
                      </div>
                      
                      <div className="flex items-center glass-input bg-white/80 border border-slate-300/70 hover:border-blue-300 rounded-md px-2 py-0.5 transition-all shadow-sm shrink-0">
                        <input
                          type="number"
                          value={part.total}
                          onChange={(e) => handlePartTotalChange(part.id, e.target.value)}
                          onBlur={(e) => handlePartTotalCommit(part.id, e.target.value)}
                          onKeyDown={(e) => { 
                            if(e.key === 'Enter') e.target.blur();
                          }}
                          step="25"
                          className="w-12 sm:w-14 bg-transparent text-slate-800 font-black text-xs sm:text-sm text-right outline-none"
                        />
                        <span className="text-[10px] font-bold text-slate-500 ml-0.5 mr-1">m</span>
                        <Edit2 className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button 
                        onClick={() => openPartEditModal(part)}
                        className="glass-btn text-slate-500 hover:text-slate-800 flex items-center justify-center p-1.5 rounded-lg border-slate-300/50"
                        title="パート設定"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => deletePart(part.id)}
                        className="glass-btn text-slate-500 hover:text-red-500 flex items-center justify-center p-1.5 rounded-lg border-slate-300/50"
                        title="パートを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => addNewSetToPart(part.id)}
                        className="glass-btn text-blue-600 font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-0.5 ml-0.5 border-slate-300/50"
                      >
                        <Plus className="w-3 h-3" /> 追加
                      </button>
                    </div>
                  </div>
                  
                  <div className="p-1 space-y-0.5">
                    {part.sets.map((set) => (
                      <div 
                        key={set.id} 
                        className="flex items-stretch p-1.5 rounded-xl transition-all border border-transparent hover:bg-white/60 hover:border-slate-300/50 border-b border-slate-300/50 last:border-0"
                      >
                        <div className="flex flex-col items-center justify-center w-11 sm:w-12 shrink-0 border-r border-slate-300/60 mr-2 pr-1.5">
                          <div className="text-[10px] font-bold text-slate-500 whitespace-nowrap leading-none">{formatTimeObj(set.setStart)}</div>
                          <div className="h-2 w-px bg-slate-300/60 my-0.5"></div>
                          <div className="text-[10px] font-bold text-slate-500 whitespace-nowrap leading-none">{formatTimeObj(set.setEnd)}</div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center px-0.5 py-0.5 min-w-0">
                          <div className="flex items-center flex-nowrap gap-x-1 overflow-x-auto hide-scrollbar">
                            <div className="flex items-baseline whitespace-nowrap">
                              <span className="font-black text-base text-slate-800">{set.distance}</span>
                              <span className="text-[10px] font-bold text-slate-400 mx-0.5">×</span>
                              <span className="font-black text-base text-slate-800">{set.reps}</span>
                              
                              {set.setsCount > 1 && (
                                <>
                                  <span className="text-[10px] font-bold text-slate-400 mx-0.5">×</span>
                                  <span className="font-black text-base text-slate-800">{set.setsCount}</span>
                                  <span className="text-[8px] font-bold text-slate-500 ml-0.5">set</span>
                                </>
                              )}
                            </div>
                            <span className={`text-[9px] font-black px-1 py-0.5 rounded shrink-0 border bg-white/80 shadow-sm ${levelCategory === 'enjoy' ? 'text-blue-600 border-blue-200' : 'text-rose-600 border-rose-200'}`}>
                              {set.style}
                            </span>
                          </div>

                          {(set.description || (set.setsCount > 1 && set.restSeconds > 0)) && (
                            <div className="flex flex-col mt-0.5">
                              {set.setsCount > 1 && set.restSeconds > 0 && (
                                <div className="text-[9px] font-black text-orange-500 flex items-center gap-0.5">
                                  <Timer className="w-2.5 h-2.5" /> Set Rest {formatTime(set.restSeconds)}
                                </div>
                              )}
                              {set.description && (
                                <div className="text-[10px] font-bold text-slate-500 line-clamp-1 whitespace-pre-wrap leading-tight mt-[1px]">
                                  {set.description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 pl-2 border-l border-slate-300/60 shrink-0">
                          {set.circleSeconds > 0 ? (
                            <div className="w-[76px] md:w-[84px] text-right shrink-0 flex flex-col items-end justify-start pt-0.5 gap-0.5 pl-1">
                              <div className="font-black text-[12px] text-slate-800 flex items-center justify-between w-full">
                                <div className={`flex items-center gap-[2px] ${!set.circle ? 'invisible' : ''}`}>
                                  <Timer className={`w-3.5 h-3.5 text-slate-400 shrink-0`} strokeWidth={3} />
                                  <span className={`text-[8px] text-slate-400 font-black shrink-0 mt-[1px]`}>ｻｰｸﾙ</span>
                                </div>
                                <span className="shrink-0 text-right font-mono tracking-tighter ml-1">{set.circle || '-'}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-[4rem]"></div>
                          )}
                          
                          <div className="flex flex-col gap-1 ml-0.5">
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEditModal(part.id, set); }}
                              className="glass-btn flex items-center justify-center w-6 h-6 text-slate-500 rounded-md border-slate-300/50"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteSetDirect(part.id, set.id); }}
                              className="glass-btn flex items-center justify-center w-6 h-6 text-slate-500 hover:text-red-500 rounded-md border-slate-300/50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {part.sets.length === 0 && (
                      <div className="text-center p-4 text-xs font-bold text-slate-400 bg-white/40 rounded-xl m-1 border border-dashed border-slate-300/80">
                        メニューがありません
                      </div>
                    )}
                  </div>

                  {part.sets.length > 0 && (Number(part.partRestSeconds) > 0 || index < scheduledWorkoutData.parts.length - 1) && (
                    <div className="flex items-center justify-between p-1.5 px-2.5 bg-orange-50/70 backdrop-blur-sm border-t border-slate-300/60 text-[10px] text-orange-600 font-black">
                      <div className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        <span>Part Rest</span>
                        <div className="flex items-center gap-0.5 glass-input bg-white/80 border border-orange-200 hover:border-orange-300 focus-within:border-orange-400 rounded px-1.5 py-0.5 ml-1 shadow-sm transition-all">
                          <input
                            type="number"
                            value={Math.floor((Number(part.partRestSeconds) || 0) / 60).toString()}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              let val = parseInt(e.target.value) || 0;
                              updatePartRestDirect(part.id, val * 60 + ((Number(part.partRestSeconds) || 0) % 60));
                            }}
                            min="0"
                            className="w-6 text-right bg-transparent text-orange-600 font-black outline-none text-[10px]"
                          />
                          <span className="text-orange-600 font-black text-[9px] mx-0.5">分</span>
                          <input
                            type="number"
                            value={((Number(part.partRestSeconds) || 0) % 60).toString()}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              let val = parseInt(e.target.value) || 0;
                              if (val > 59) val = 59;
                              if (val < 0) val = 0;
                              updatePartRestDirect(part.id, Math.floor((Number(part.partRestSeconds) || 0) / 60) * 60 + val);
                            }}
                            min="0" max="59"
                            className="w-7 text-right bg-transparent text-orange-600 font-black outline-none text-[10px]"
                          />
                          <span className="text-orange-600 font-black text-[9px] ml-0.5 mr-0.5">秒</span>
                          <Edit2 className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                        </div>
                      </div>
                      {Number(part.partRestSeconds) > 0 && (
                        <div className="text-[9px] text-orange-500 font-mono font-black bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-orange-100">
                          {formatTimeObj(part.partRestStart)} ~ {formatTimeObj(part.partRestEnd)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addPart}
                className={`glass-btn w-full py-2.5 border border-dashed rounded-2xl font-black text-[11px] flex flex-col items-center justify-center gap-0.5 transition-all border-slate-400/80 ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}`}
              >
                <Plus className="w-4 h-4" />
                <span>新しいパートを追加</span>
              </button>
            </div>
          </div>
        )}

        {/* --- スクショ・印刷用タブ (Print) --- */}
        {activeTab === 'print' && scheduledWorkoutData ? (
          <div className={isScreenshotMode ? "flex items-center justify-center w-full h-full overflow-hidden p-0 m-0" : "py-2 px-1 pb-10 flex flex-col items-center animate-in fade-in duration-300 h-max w-full"}>
            
            <div 
              ref={printCardRef}
              style={isScreenshotMode ? { transform: `scale(${screenshotScale})`, transformOrigin: 'center center' } : undefined}
              className={`${isCurrentAiGenerated ? 'magic-border-print-ai shadow-[0_0_15px_rgba(217,70,239,0.25)]' : levelCategory === 'enjoy' ? 'magic-border-print-enjoy shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'magic-border-print-special shadow-[0_0_15px_rgba(225,29,72,0.2)]'} ${isScreenshotMode ? 'w-[380px] pointer-events-none' : 'w-full max-w-[420px]'} shrink-0 transition-transform duration-200`}
            >
              <div className={`magic-border-print-content w-full overflow-hidden print-area text-black flex flex-col ${PRINT_FONTS.find(f => f.id === printFont)?.className}`} style={{ WebkitFontSmoothing: 'antialiased' }}>
                
                {/* Summary Stats */}
                <div className="flex flex-col px-1.5 py-1.5 border-b-[1.5px] border-slate-300 bg-slate-50 w-full overflow-hidden shrink-0 gap-1">
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[8.5px] border border-slate-400 bg-white text-slate-800 px-1 py-0.5 rounded leading-none tracking-tighter font-extrabold truncate max-w-[110px]">
                        {currentClub.name}
                      </span>
                      <span className={`text-[8.5px] border px-1 py-0.5 rounded leading-none tracking-tighter whitespace-nowrap font-bold shrink-0 ${levelCategory === 'enjoy' ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-rose-400 text-rose-700 bg-rose-50'}`}>
                        {TRANSLATIONS[printLang][levelCategory]}
                      </span>
                    </div>
                    
                    <div className="flex items-center font-extrabold text-black gap-1 shrink min-w-0">
                      <div className="relative flex items-center bg-transparent hover:bg-slate-200 rounded px-1 transition-colors cursor-pointer shrink-0">
                        <span className="text-center min-w-[54px] inline-block tracking-tighter text-[9px] whitespace-nowrap">{formatShortDateWithDay(printDate)}</span>
                        <input type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                        <Calendar className="w-2.5 h-2.5 text-slate-500 shrink-0 ml-0.5 pointer-events-none" />
                      </div>
                      <div className="relative flex items-center bg-transparent hover:bg-slate-200 focus-within:bg-slate-200 rounded px-1 transition-colors shrink-0">
                        <input type="text" value={printTime} onChange={(e) => setPrintTime(e.target.value)} className="bg-transparent text-center outline-none w-[80px] font-extrabold tracking-tight text-[9px]"/>
                        <Edit2 className="w-2.5 h-2.5 text-slate-500 shrink-0 ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center w-full mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-baseline gap-0.5 shrink-0">
                        <span className="text-[7.5px] text-slate-500 font-extrabold">{TRANSLATIONS[printLang].period}</span>
                        <span className="font-extrabold text-[10px] text-black leading-none whitespace-nowrap">
                          {TRANSLATIONS[printLang].periods[period]}
                        </span>
                      </div>
                      <div className="w-[1px] h-2.5 bg-slate-300 shrink-0"></div>
                      <div className="flex items-baseline gap-0.5 shrink-0">
                        <span className="text-[7.5px] text-slate-500 font-extrabold">{TRANSLATIONS[printLang].purpose}</span>
                        <span className="font-extrabold text-[10px] text-black leading-none whitespace-nowrap">
                          {TRANSLATIONS[printLang].purposes[purpose]}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-0.5 shrink-0 justify-end">
                      <span className="text-[8px] font-extrabold text-slate-600">{TRANSLATIONS[printLang].totalDist}</span>
                      <span className="text-[14px] font-black text-black leading-none tracking-tighter">{actualTotalDistance}</span>
                      <span className="text-[8.5px] font-extrabold text-black">m</span>
                    </div>
                  </div>
                </div>

                {/* 直近の大会名 ＆ 大会までの日数表示バー */}
                {showCompetitionOnPrint && nearestCompetition && (
                  <div className="bg-amber-50/90 py-1 px-2 border-b-[1.5px] border-slate-300 flex items-center justify-between gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <span className="inline-flex items-center gap-0.5 text-[8px] text-amber-900 bg-amber-200/80 border border-amber-500 rounded px-1 py-[1px] font-extrabold leading-tight shrink-0">
                        <Trophy className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                        <span>{TRANSLATIONS[printLang].nextMeet}</span>
                      </span>
                      <span className="text-[10px] text-black font-extrabold truncate leading-tight">
                        {t_desc(nearestCompetition.name)}
                      </span>
                      <span className="text-[8.5px] text-slate-600 font-extrabold shrink-0 whitespace-nowrap">
                        ({formatCompetitionPeriod(nearestCompetition)})
                      </span>
                    </div>
                    <div className="flex items-baseline gap-0.5 shrink-0 bg-white border border-amber-400 rounded px-1.5 py-[1px] shadow-sm">
                      {nearestCompetition.daysUntil === 0 ? (
                        <span className="text-[10px] font-black text-rose-600 leading-none whitespace-nowrap">
                          {TRANSLATIONS[printLang].todayMeet}
                        </span>
                      ) : nearestCompetition.daysUntil > 0 ? (
                        <>
                          {TRANSLATIONS[printLang].daysLeftPrefix && (
                            <span className="text-[8px] font-extrabold text-slate-600">{TRANSLATIONS[printLang].daysLeftPrefix}</span>
                          )}
                          <span className="text-[12px] font-black text-rose-600 leading-none tracking-tighter mx-[1px]">
                            {nearestCompetition.daysUntil}
                          </span>
                          <span className="text-[8px] font-extrabold text-slate-700">{TRANSLATIONS[printLang].daysLeftSuffix}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-black text-slate-500 leading-none">
                            {Math.abs(nearestCompetition.daysUntil)}
                          </span>
                          <span className="text-[8px] font-extrabold text-slate-500">{TRANSLATIONS[printLang].pastMeetSuffix}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white py-0.5 px-2 border-b-[1.5px] border-slate-300 flex items-center gap-1 shrink-0">
                  <span className="text-[8px] text-black border border-slate-500 rounded px-1 font-extrabold leading-tight shrink-0">{TRANSLATIONS[printLang].theme}</span>
                  <span 
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setPurposeDetail(e.currentTarget.innerText)}
                    className="text-[10px] text-black font-extrabold flex-1 truncate leading-tight mt-[1px] outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 cursor-text transition-colors min-h-[14px]"
                  >
                    {t_desc(purposeDetail)}
                  </span>
                </div>

                {/* Menu List */}
                <div className="p-1 space-y-1 bg-white">
                  {scheduledWorkoutData.parts.map((part) => {
                    const colors = getPartColors(part.name);
                    return (
                      <div key={part.id} className={`rounded-sm border border-slate-100 overflow-hidden ${colors.setBg}`}>
                        <div className={`flex justify-between items-center border-l-[3px] ${colors.border} ${colors.headerBg} px-1.5 py-[3px]`}>
                          <span className={`font-extrabold text-[11px] ${colors.text} leading-none py-0.5`}>{part.name}</span>
                          <span className={`font-extrabold text-[10px] ${colors.text} leading-none py-0.5`}>{part.total}m</span>
                        </div>
                        
                        <div className="px-1 py-0.5">
                          {part.sets.map((set, setIndex) => (
                            <div key={set.id} className={`flex items-start gap-1 text-[10px] leading-tight py-[2px] ${setIndex > 0 ? 'border-t border-dashed border-slate-200/80' : ''}`}>
                              <div className="w-[36px] text-right text-[9px] font-extrabold text-slate-500 pt-[1px] shrink-0 tracking-tighter whitespace-nowrap">
                                {formatTimeObj(set.setStart)}
                              </div>
                              
                              <div className="flex-1 flex items-baseline min-w-0 gap-1.5 pt-[1px]">
                                <div className="flex items-baseline shrink-0 whitespace-nowrap">
                                  <span className="font-extrabold text-black text-[11px]">{set.distance}</span>
                                  <span className="text-slate-400 font-extrabold text-[9px] mx-[1px]">×</span>
                                  <span className="font-extrabold text-black text-[11px]">{set.reps}</span>
                                  {set.setsCount > 1 && (
                                    <>
                                      <span className="text-slate-400 font-extrabold text-[9px] mx-[1px]">×</span>
                                      <span className="font-extrabold text-black text-[11px]">{set.setsCount}</span>
                                      <span className="font-extrabold text-slate-500 text-[7.5px] ml-[1px]">set</span>
                                    </>
                                  )}
                                  <span 
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => updateSetStyleDirect(part.id, set.id, e.currentTarget.textContent)}
                                    className="inline text-[10px] font-extrabold text-slate-700 outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 cursor-text transition-colors ml-1.5"
                                  >
                                    {set.style}
                                  </span>
                                </div>
                                
                                <div className="flex-1 min-w-0 leading-tight break-words">
                                  <span 
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => updateSetDescriptionDirect(part.id, set.id, e.currentTarget.innerText)}
                                    className="block w-full text-[10px] text-slate-700 font-extrabold outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 cursor-text transition-colors whitespace-pre-wrap"
                                  >
                                    {t_desc(set.description)}
                                  </span>
                                </div>
                              </div>

                              <div className="w-[66px] text-right shrink-0 flex flex-col items-end justify-start pt-[1px] gap-[1px] pl-0.5">
                                <div className="font-extrabold text-[11px] text-black flex items-center justify-between w-full">
                                  <div className={`flex items-center gap-[1px] ${!set.circle ? 'invisible' : ''}`}>
                                    <Timer className="w-2.5 h-2.5 text-slate-400 shrink-0" strokeWidth={3} />
                                    <span className="text-[7px] text-slate-400 font-extrabold shrink-0 mt-[1px]">{TRANSLATIONS[printLang].circle}</span>
                                  </div>
                                  <span className="shrink-0 text-right">{set.circle || '-'}</span>
                                </div>
                                {set.setsCount > 1 && set.restSeconds > 0 && (
                                  <div className="text-[8px] text-orange-600 font-extrabold whitespace-nowrap mt-[1px] leading-none">
                                    ({TRANSLATIONS[printLang].setRest} {formatTime(set.restSeconds)})
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {part.partRestSeconds > 0 && part.sets.length > 0 && (
                            <div className="text-right text-[9px] text-orange-600 font-extrabold mt-0.5 pr-1 pb-0.5">
                              [ {TRANSLATIONS[printLang].rest} {formatTime(part.partRestSeconds)} ]
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {!isScreenshotMode && (
            <div className="mt-2 flex flex-col glass-panel p-2 rounded-xl w-full max-w-[420px] shadow-sm gap-2 border-slate-300/60 shrink-0 print:hidden">
              {/* 登録大会一覧パネル */}
              <div className="flex flex-col gap-1.5 pb-1.5 border-b border-slate-200/80">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[10px] font-black text-slate-700 truncate">
                      登録大会一覧（{currentClub.name}: {competitions.length}/{MAX_COMPETITIONS}）
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {competitions.length > 0 && (
                      <button
                        onClick={() => setShowCompetitionOnPrint(prev => !prev)}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black border transition-all ${
                          showCompetitionOnPrint
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white/70 text-slate-500 border-slate-300'
                        }`}
                      >
                        {showCompetitionOnPrint ? 'カード表示ON' : 'カード表示OFF'}
                      </button>
                    )}
                    <button
                      onClick={() => setIsCompetitionModalOpen(true)}
                      className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 transition-colors"
                    >
                      ＋追加・編集
                    </button>
                  </div>
                </div>

                {competitions.length === 0 ? (
                  <div
                    onClick={() => setIsCompetitionModalOpen(true)}
                    className="text-[10px] font-bold text-slate-400 bg-white/60 border border-dashed border-slate-300 rounded-lg py-1.5 px-2 text-center cursor-pointer hover:bg-white/90 transition-colors"
                  >
                    大会未登録（タップして登録すると直近大会と残り日数が表示されます）
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1 max-h-28 overflow-y-auto pr-0.5">
                    {competitions.map(comp => {
                      const days = getCompetitionDaysUntil(comp, printDate);
                      const isNearest = nearestCompetition?.id === comp.id;
                      return (
                        <div
                          key={comp.id}
                          onClick={() => setIsCompetitionModalOpen(true)}
                          className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg border text-[10px] cursor-pointer transition-colors ${
                            isNearest
                              ? 'bg-amber-50/90 border-amber-400 shadow-sm'
                              : 'bg-white/70 border-slate-200/80 hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            {isNearest && (
                              <span className="text-[8px] font-black bg-amber-500 text-white px-1 py-0.2 rounded shrink-0">
                                直近
                              </span>
                            )}
                            <span className="font-black text-slate-800 truncate">{comp.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                              {formatCompetitionPeriod(comp)}
                            </span>
                            {days !== null && (
                              <span className={`font-black px-1.5 py-0.2 rounded text-[9px] whitespace-nowrap ${
                                days === 0
                                  ? 'bg-rose-500 text-white'
                                  : days > 0
                                    ? 'bg-amber-100 text-rose-600 border border-amber-300'
                                    : 'bg-slate-200 text-slate-500'
                              }`}>
                                {days === 0 ? '本日開催!' : days > 0 ? `あと${days}日` : `${Math.abs(days)}日前`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex bg-white/50 p-0.5 rounded-lg w-full shadow-inner border border-white/60">
                  {PRINT_LANGS.map(lang => (
                    <button
                      key={lang.id}
                      onClick={() => handlePrintLangChange(lang.id)}
                      className={`flex-1 py-1 text-[9px] font-black rounded-md transition-all relative overflow-hidden ${
                        printLang === lang.id
                          ? 'text-white shadow-[0_2px_5px_rgba(217,70,239,0.3)]'
                          : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      {printLang === lang.id && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-fuchsia-400 to-orange-400"></div>
                          <div className="pattern-overlay opacity-60"></div>
                        </>
                      )}
                      <span className="relative z-10 whitespace-nowrap">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-[1.3]">
                <div className="flex bg-white/50 p-0.5 rounded-lg w-full overflow-x-auto hide-scrollbar shadow-inner border border-white/60">
                  {PRINT_FONTS.map(font => (
                    <button
                      key={font.id}
                      onClick={() => setPrintFont(font.id)}
                      className={`flex-1 py-1 px-1.5 text-[9px] font-black rounded-md transition-all relative overflow-hidden whitespace-nowrap ${
                        printFont === font.id
                          ? 'text-white shadow-[0_2px_5px_rgba(217,70,239,0.3)]'
                          : 'text-slate-600 hover:bg-white/60'
                      }`}
                    >
                      {printFont === font.id && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-fuchsia-400 to-orange-400"></div>
                          <div className="pattern-overlay opacity-60"></div>
                        </>
                      )}
                      <span className="relative z-10 whitespace-nowrap">{font.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              </div>
            </div>
            )}

          </div>
        ) : activeTab === 'saved' ? (
          <div className="px-2 md:px-3 space-y-2.5 animate-in fade-in duration-300 max-w-2xl mx-auto">
            
            {/* クラブ別の切り替えバー */}
            <div className="glass-panel p-2.5 rounded-2xl border-slate-300/80 shadow-sm space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>クラブ別メニュー一覧</span>
                </div>
                <button
                  onClick={() => setIsClubModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-3 h-3" strokeWidth={2.5} />
                  <span>クラブ登録・管理</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                <button
                  onClick={() => setFilterClubId('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                    filterClubId === 'all'
                      ? 'bg-slate-700 text-white border-slate-600 shadow-sm'
                      : 'bg-white/70 text-slate-500 border-slate-300/70 hover:bg-white'
                  }`}
                >
                  <span>すべて</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterClubId === 'all' ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-600'}`}>
                    {savedWorkouts.length}
                  </span>
                </button>
                {[
                  ...clubs.filter(c => c.id === currentClub.id),
                  ...clubs.filter(c => c.id !== currentClub.id)
                ].map(club => {
                  const count = savedWorkouts.filter(w => (w.clubId || DEFAULT_CLUBS[0].id) === club.id).length;
                  const isSelected = filterClubId === club.id;
                  const isCurrentSettingClub = club.id === currentClub.id;
                  return (
                    <button
                      key={club.id}
                      onClick={() => {
                        setFilterClubId(club.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : isCurrentSettingClub
                            ? 'bg-emerald-50/90 text-emerald-800 border-emerald-300 hover:bg-white'
                            : 'bg-white/70 text-slate-600 border-slate-300/70 hover:bg-white'
                      }`}
                    >
                      <span>{club.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-600'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-2xl space-y-3 border-slate-300/80 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 drop-shadow-sm" />
                <input 
                  type="text"
                  placeholder="検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 glass-input bg-white/70 focus:bg-white rounded-xl text-xs outline-none font-bold text-slate-800 placeholder-slate-500 border-slate-300/80 shadow-sm transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-[1.2]">
                  <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-700 drop-shadow-sm" />
                  <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full glass-input bg-white/70 focus:bg-white rounded-xl pl-8 pr-2 py-1.5 text-[11px] text-slate-800 outline-none appearance-none font-bold cursor-pointer transition-colors border-slate-300/80 shadow-sm"
                  >
                    <option value="all">カテゴリ</option>
                    <option value="enjoy">エンジョイ</option>
                    <option value="special">スペシャル</option>
                  </select>
                </div>
                <div className="relative flex-1">
                  <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-700 drop-shadow-sm" />
                  <select 
                    value={filterPurpose}
                    onChange={(e) => setFilterPurpose(e.target.value)}
                    className="w-full glass-input bg-white/70 focus:bg-white rounded-xl pl-8 pr-2 py-1.5 text-[11px] text-slate-800 outline-none appearance-none font-bold cursor-pointer transition-colors border-slate-300/80 shadow-sm"
                  >
                    <option value="all">目的</option>
                    {PURPOSES.map(p => <option key={p.id} value={p.id}>{p.name.substring(0,4)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-[1.2]">
                  <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-700 drop-shadow-sm" />
                  <select 
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className="w-full glass-input bg-white/70 focus:bg-white rounded-xl pl-8 pr-2 py-1.5 text-[11px] text-slate-800 outline-none appearance-none font-bold cursor-pointer transition-colors border-slate-300/80 shadow-sm"
                  >
                    <option value="all">期</option>
                    {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name.replace('期','')}</option>)}
                  </select>
                </div>
                <div className="relative flex-1">
                  <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-700 drop-shadow-sm" />
                  <select 
                    value={filterDistance}
                    onChange={(e) => setFilterDistance(e.target.value)}
                    className="w-full glass-input bg-white/70 focus:bg-white rounded-xl pl-8 pr-2 py-1.5 text-[11px] text-slate-800 outline-none appearance-none font-bold cursor-pointer transition-colors border-slate-300/80 shadow-sm"
                  >
                    <option value="all">距離</option>
                    <option value="under1000">~1000m</option>
                    <option value="1000-2000">1000~2000m</option>
                    <option value="over2000">2000m~</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredSavedWorkouts.length === 0 ? (
              <div className="text-center p-8 text-slate-500 glass-panel rounded-[1.5rem] border-slate-300/60">
                {savedWorkouts.length === 0 ? (
                  <>
                    <Save className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-600" />
                    <p className="font-black text-sm">保存されたメニューはありません</p>
                  </>
                ) : (
                  <>
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-600" />
                    <p className="font-black text-sm">該当するメニューが見つかりません</p>
                    <button onClick={clearFilters} className="mt-2 glass-btn px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg">クリア</button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSavedWorkouts.map(saved => (
                  <div key={saved.id} className={`glass-panel p-2.5 rounded-[1.5rem] flex flex-col gap-2 relative overflow-hidden transition-colors ${saved.levelCategory === 'special' ? 'border-orange-400/70 shadow-[0_4px_16px_-4px_rgba(242,160,61,0.4)] bg-gradient-to-br from-white/80 to-orange-50/60' : 'border-slate-300/60'}`}>
                    
                    {saved.levelCategory === 'special' && (
                      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                        <div className="absolute inset-0 animate-energy-flow mix-blend-color-dodge opacity-60"></div>
                      </div>
                    )}

                    <div className="flex justify-between items-center gap-1.5 relative z-10">
                      <button 
                        onClick={() => {
                          setIsGenerating(true);
                          setTimeout(() => {
                            loadWorkout(saved);
                          }, 300);
                          setTimeout(() => {
                            setIsGenerating(false);
                          }, 600);
                        }}
                        className={`relative group flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all active:scale-95 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden border shrink-0 ${saved.isAiGenerated ? 'border-fuchsia-400/50' : 'border-blue-400/50'}`} 
                        title="再読込"
                      >
                        <div className={`absolute inset-0 opacity-100 group-hover:brightness-110 transition-all ${saved.isAiGenerated ? 'bg-gradient-to-r from-blue-600 via-fuchsia-500 to-purple-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'}`}></div>
                        <div className="pattern-overlay opacity-40"></div>
                        {saved.isAiGenerated ? (
                          <Sparkles className="w-3.5 h-3.5 relative z-10 animate-float-icon text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" strokeWidth={2.5} />
                        ) : (
                          <PenTool className="w-3.5 h-3.5 relative z-10 text-white" strokeWidth={2.5} />
                        )}
                        <span className="relative z-10 drop-shadow-md whitespace-nowrap text-white tracking-wide">再読込</span>
                      </button>

                      <div className={`flex-1 flex items-center glass-input rounded-xl px-2 py-1 transition-colors ${saved.levelCategory === 'special' ? 'bg-white/80 border-orange-300/50' : 'border-slate-300/50'}`}>
                        <input
                          type="text"
                          value={saved.title || ''}
                          onChange={(e) => updateSavedWorkoutTitle(saved.id, e.target.value)}
                          placeholder="題名を入力..."
                          className="w-full bg-transparent outline-none font-black text-slate-800 text-xs placeholder:font-bold placeholder:text-slate-400"
                        />
                        <Edit2 className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
                      </div>

                      <button 
                        onClick={() => deleteSavedWorkout(saved.id)} 
                        className={`glass-btn flex items-center justify-center p-1.5 rounded-xl text-slate-500 hover:text-red-500 shrink-0 ${saved.levelCategory === 'special' ? 'bg-white/80 border-orange-300/50' : 'border-slate-300/50'}`}
                        title="削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pl-1 relative z-10">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <div className="font-black text-lg text-slate-800 tracking-tighter leading-none">{saved.distance}<span className="text-[10px] ml-[1px]">m</span></div>
                        {saved.lessonDate && (
                          <span className="text-[10px] font-black text-blue-700 bg-blue-50/90 border border-blue-200 px-1.5 py-0.2 rounded">
                            レッスン日: {formatShortDateWithDay(saved.lessonDate)}
                          </span>
                        )}
                        <div className="text-[9px] font-bold text-slate-500">保存: {saved.date}</div>
                      </div>
                      <div className="text-[9px] font-black text-slate-600 flex flex-wrap gap-1 justify-end items-center">
                        <div className="relative inline-flex items-center">
                          <select
                            value={saved.clubId || DEFAULT_CLUBS[0].id}
                            onChange={(e) => updateSavedWorkoutClub(saved.id, e.target.value)}
                            className="bg-emerald-50/90 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded shadow-sm outline-none cursor-pointer font-black text-[9px]"
                            title="所属クラブを変更"
                          >
                            {clubs.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        {saved.isAiGenerated && (
                          <span className="flex items-center gap-0.5 text-white bg-gradient-to-r from-blue-500 to-fuchsia-500 shadow-[0_2px_8px_rgba(217,70,239,0.3)] px-1.5 py-0.5 rounded border border-white/40">
                            <Sparkles className="w-2.5 h-2.5" /> <span className="drop-shadow-sm">AI</span>
                          </span>
                        )}
                        <span className={`px-1 py-0.5 rounded border shadow-sm ${saved.levelCategory === 'enjoy' ? 'bg-white/70 text-blue-700 border-blue-200' : 'bg-white/80 text-rose-700 border-orange-300 shadow-orange-500/20'}`}>
                          {saved.levelCategory === 'enjoy' ? 'エンジョイ' : 'スペシャル'}
                        </span>
                        <span className={`text-blue-700 bg-white/70 border px-1 py-0.5 rounded shadow-sm ${saved.levelCategory === 'special' ? 'border-orange-200/50' : 'border-blue-200'}`}>
                          {(PERIODS.find(p=>p.id===(saved.period || 'quantity')) || PERIODS[1]).name.replace('期','')}
                        </span>
                        <span className={`text-emerald-700 bg-white/70 border px-1 py-0.5 rounded shadow-sm ${saved.levelCategory === 'special' ? 'border-orange-200/50' : 'border-emerald-200'}`}>
                          {PURPOSES.find(p=>p.id===saved.purpose)?.name.substring(0,4)}
                        </span>
                      </div>
                    </div>
                    {saved.purposeDetail && (
                      <div className={`text-[10px] font-black text-slate-600 glass-input px-1.5 py-0.5 rounded-lg inline-block w-fit ml-1 relative z-10 ${saved.levelCategory === 'special' ? 'bg-white/80 border-orange-200/50' : 'border-slate-300/60'}`}>
                        テーマ: {saved.purposeDetail}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'competitions' ? (
          <div className="px-2 md:px-3 space-y-2.5 animate-in fade-in duration-300 max-w-2xl mx-auto">
            {/* クラブ切り替え＆ヘッダーカード */}
            <div className="glass-panel p-3 rounded-2xl border-slate-300/80 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>クラブ別 大会一覧・期間登録</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer select-none bg-amber-50 px-2.5 py-1 rounded-full border border-amber-300 shadow-sm">
                  <input
                    type="checkbox"
                    checked={showCompetitionOnPrint}
                    onChange={(e) => setShowCompetitionOnPrint(e.target.checked)}
                    className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[10px] font-black text-amber-900">メニュー表示に印字</span>
                </label>
              </div>

              {/* クラブ選択ピル */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                {clubs.map(club => {
                  const clubComps = club.id === currentClub.id
                    ? competitions
                    : (clubProfiles[club.id]?.competitions || []);
                  const isSelected = currentClub.id === club.id;
                  return (
                    <button
                      key={club.id}
                      onClick={() => handleSelectClub(club.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white/70 text-slate-600 border-slate-300/70 hover:bg-white'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{club.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}>
                        {clubComps.length}/{MAX_COMPETITIONS}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 新規大会（開催期間）登録カード */}
            <div className="glass-panel p-3.5 rounded-2xl border-slate-300/80 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span>「{currentClub.name}」に新しい大会を登録</span>
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  competitions.length >= MAX_COMPETITIONS ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-800'
                }`}>
                  登録数: {competitions.length} / {MAX_COMPETITIONS}
                </span>
              </div>

              {competitions.length >= MAX_COMPETITIONS ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-600 text-center">
                  最大{MAX_COMPETITIONS}大会まで登録済みです。新しく追加する場合は下のリストから不要な大会を削除してください。
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 pl-1">大会名</label>
                    <input
                      type="text"
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                      onKeyDown={(e) => { if (isEnterWithoutIme(e)) handleAddCompetition(); }}
                      placeholder="例：日本マスターズ水泳短水路大会"
                      className="w-full mt-0.5 p-2.5 rounded-xl glass-input bg-white/80 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-amber-400 outline-none border-slate-300/80"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 pl-1">開始日</label>
                        <input
                          type="date"
                          value={newCompStartDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewCompStartDate(val);
                            if (!newCompEndDate || newCompEndDate < val) {
                              setNewCompEndDate(val);
                            }
                          }}
                          className="w-full mt-0.5 p-2 rounded-xl glass-input bg-white/80 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-amber-400 outline-none border-slate-300/80"
                        />
                      </div>
                      <span className="font-black text-slate-400 text-sm pt-4">〜</span>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 pl-1">終了日</label>
                        <input
                          type="date"
                          value={newCompEndDate}
                          min={newCompStartDate}
                          onChange={(e) => setNewCompEndDate(e.target.value)}
                          className="w-full mt-0.5 p-2 rounded-xl glass-input bg-white/80 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-amber-400 outline-none border-slate-300/80"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddCompetition}
                      disabled={!newCompName.trim() || !newCompStartDate}
                      className="py-2.5 px-5 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 shadow-sm transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> 大会を登録
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 登録済み大会リスト */}
            <div className="glass-panel p-3.5 rounded-2xl border-slate-300/80 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-black text-slate-800">
                  {currentClub.name} の登録大会一覧
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  基準日: {formatShortDateWithDay(printDate)}
                </span>
              </div>

              {competitions.length === 0 ? (
                <div className="text-center p-8 rounded-2xl bg-white/60 border border-dashed border-slate-300 text-slate-400 space-y-1.5">
                  <Trophy className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
                  <p className="text-sm font-black text-slate-500">登録されている大会はありません</p>
                  <p className="text-[11px] font-bold">上のフォームから大会名と開催期間（開始日〜終了日）を登録してください</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {competitions.map(comp => {
                    const days = getCompetitionDaysUntil(comp, printDate);
                    const isNearest = nearestCompetition?.id === comp.id;
                    const isEditing = editingCompId === comp.id;

                    return (
                      <div
                        key={comp.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isNearest
                            ? 'bg-amber-50/95 border-amber-400 shadow-sm'
                            : 'bg-white/80 border-slate-200/90 hover:bg-white'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingCompName}
                              onChange={(e) => setEditingCompName(e.target.value)}
                              onCompositionStart={handleCompositionStart}
                              onCompositionEnd={handleCompositionEnd}
                              onKeyDown={(e) => { if (isEnterWithoutIme(e)) handleSaveCompetitionEdit(comp.id); }}
                              className="w-full px-3 py-1.5 rounded-xl bg-white border border-amber-400 text-xs font-black text-slate-800 outline-none"
                              placeholder="大会名"
                              autoFocus
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black text-slate-500">開催期間:</span>
                              <input
                                type="date"
                                value={editingCompStartDate}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditingCompStartDate(val);
                                  if (!editingCompEndDate || editingCompEndDate < val) {
                                    setEditingCompEndDate(val);
                                  }
                                }}
                                className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-xl bg-white border border-amber-400 text-xs font-black text-slate-800 outline-none"
                              />
                              <span className="text-xs font-black text-slate-400">〜</span>
                              <input
                                type="date"
                                value={editingCompEndDate}
                                min={editingCompStartDate}
                                onChange={(e) => setEditingCompEndDate(e.target.value)}
                                className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-xl bg-white border border-amber-400 text-xs font-black text-slate-800 outline-none"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                onClick={() => handleSaveCompetitionEdit(comp.id)}
                                className="px-4 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-black shadow-sm"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingCompId(null)}
                                className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-600 text-xs font-black"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isNearest && (
                                  <span className="text-[10px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md shadow-sm shrink-0">
                                    直近大会
                                  </span>
                                )}
                                <span className="font-black text-sm text-slate-800 truncate">{comp.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  {formatCompetitionPeriod(comp, true)}
                                </span>
                                {days !== null && (
                                  <span className={`font-black px-2 py-0.5 rounded-md text-[11px] ${
                                    days === 0
                                      ? 'bg-rose-500 text-white shadow-sm'
                                      : days > 0
                                        ? 'bg-amber-100 text-rose-600 border border-amber-300'
                                        : 'bg-slate-200 text-slate-500'
                                  }`}>
                                    {days === 0 ? '本日開催！' : days > 0 ? `あと${days}日` : `${Math.abs(days)}日前`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  const sDate = comp.startDate || comp.date || getTodayDateStr();
                                  const eDate = comp.endDate || sDate;
                                  setEditingCompId(comp.id);
                                  setEditingCompName(comp.name);
                                  setEditingCompStartDate(sDate);
                                  setEditingCompEndDate(eDate);
                                }}
                                className="glass-btn p-2 rounded-xl text-slate-600 hover:text-slate-900 border-slate-300/60"
                                title="編集"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCompetition(comp.id)}
                                className="glass-btn p-2 rounded-xl text-slate-400 hover:text-red-500 border-slate-300/60"
                                title="削除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'print' ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
             <List className="w-16 h-16 opacity-30" />
             <p className="font-black text-base">メニューがありません</p>
           </div>
        ) : null}

      </main>

      {/* --- ボトムナビゲーション --- */}
      {!isScreenshotMode && (
      <nav className="fixed bottom-0 w-full bg-white/40 backdrop-blur-xl border-t border-slate-300/60 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] safe-area-pb z-40 pb-2 transition-colors duration-1000 overflow-hidden print:hidden">
        <div className="pattern-overlay-dark opacity-10"></div>
        <div className="flex justify-around items-center p-1.5 max-w-lg mx-auto gap-1 relative z-10">
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 rounded-[1.25rem] transition-all overflow-hidden ${
              activeTab === 'settings' 
                ? 'glass-active text-fuchsia-500 scale-105 shadow-sm' 
                : 'text-slate-500 hover:bg-white/50 active:scale-95'
            }`}
          >
            {activeTab === 'settings' && (
              <>
                <div className={`absolute inset-0 blur-md rounded-full animate-pulse ${useAiMode ? 'bg-fuchsia-400/40' : 'bg-slate-400/20'}`}></div>
                <div className="pattern-overlay-dark rounded-full opacity-30"></div>
              </>
            )}
            <Settings className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-all ${activeTab === 'settings' ? 'drop-shadow-[0_0_8px_rgba(148,163,184,0.8)]' : ''} ${activeTab === 'settings' && useAiMode ? 'text-fuchsia-500 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]' : activeTab === 'settings' && !useAiMode ? 'text-slate-700' : ''}`} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            <span className="text-[10px] sm:text-xs font-black tracking-tight mt-1 relative z-10 whitespace-nowrap">条件設定</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('workout')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 rounded-[1.25rem] transition-all overflow-hidden ${
              activeTab === 'workout' 
                ? `glass-active scale-105 shadow-sm ${levelCategory === 'enjoy' ? 'text-blue-600' : 'text-rose-600'}` 
                : 'text-slate-500 hover:bg-white/50 active:scale-95'
            }`}
          >
            {activeTab === 'workout' && (
              <>
                <div className={`absolute inset-0 blur-md rounded-full animate-pulse ${levelCategory === 'enjoy' ? 'bg-blue-400/20' : 'bg-rose-400/20'}`}></div>
                <div className="pattern-overlay-dark rounded-full opacity-30"></div>
              </>
            )}
            <List className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-all ${activeTab === 'workout' ? `animate-pulse ${levelCategory === 'enjoy' ? 'drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]' : 'drop-shadow-[0_0_8px_rgba(225,29,72,0.8)]'}` : ''}`} strokeWidth={activeTab === 'workout' ? 2.5 : 2} />
            <span className="text-[10px] sm:text-xs font-black tracking-tight mt-1 relative z-10 whitespace-nowrap">メニュー</span>
          </button>

          <button 
            onClick={() => setActiveTab('saved')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 rounded-[1.25rem] transition-all overflow-hidden ${
              activeTab === 'saved' 
                ? 'glass-active text-emerald-500 scale-105 shadow-sm' 
                : 'text-slate-500 hover:bg-white/50 active:scale-95'
            }`}
          >
            {activeTab === 'saved' && (
              <>
                <div className="absolute inset-0 bg-emerald-400/20 blur-md rounded-full animate-pulse"></div>
                <div className="pattern-overlay-dark rounded-full opacity-30"></div>
              </>
            )}
            <Save className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-all ${activeTab === 'saved' ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse' : ''}`} strokeWidth={activeTab === 'saved' ? 2.5 : 2} />
            <span className="text-[10px] sm:text-xs font-black tracking-tight mt-1 relative z-10 whitespace-nowrap">保存済</span>
          </button>

          <button 
            onClick={() => setActiveTab('competitions')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 rounded-[1.25rem] transition-all overflow-hidden ${
              activeTab === 'competitions' 
                ? 'glass-active text-amber-500 scale-105 shadow-sm' 
                : 'text-slate-500 hover:bg-white/50 active:scale-95'
            }`}
          >
            {activeTab === 'competitions' && (
              <>
                <div className="absolute inset-0 bg-amber-400/25 blur-md rounded-full animate-pulse"></div>
                <div className="pattern-overlay-dark rounded-full opacity-30"></div>
              </>
            )}
            <Trophy className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-all ${activeTab === 'competitions' ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse' : ''}`} strokeWidth={activeTab === 'competitions' ? 2.5 : 2} />
            <span className="text-[10px] sm:text-xs font-black tracking-tight mt-1 relative z-10 whitespace-nowrap">大会一覧</span>
          </button>

          <button 
            onClick={() => setActiveTab('print')}
            className={`relative flex flex-col items-center justify-center py-2 px-1 flex-1 rounded-[1.25rem] transition-all overflow-hidden ${
              activeTab === 'print' 
                ? 'glass-active text-slate-700 scale-105 shadow-sm' 
                : 'text-slate-500 hover:bg-white/50 active:scale-95'
            }`}
          >
            {activeTab === 'print' && (
              <>
                <div className="absolute inset-0 bg-slate-400/20 blur-md rounded-full animate-pulse"></div>
                <div className="pattern-overlay-dark rounded-full opacity-30"></div>
              </>
            )}
            <Printer className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-all ${activeTab === 'print' ? 'drop-shadow-[0_0_8px_rgba(51,65,85,0.8)] animate-pulse' : ''}`} strokeWidth={activeTab === 'print' ? 2.5 : 2} />
            <span className="text-[10px] sm:text-xs font-black tracking-tight mt-1 relative z-10 whitespace-nowrap">メニュー表示</span>
          </button>

        </div>
      </nav>
      )}

      {/* スクショモード＆画面ロック用 コントロールオーバーレイ（無操作時は自動で透明化しスクショに映り込まない） */}
      {isScreenshotMode && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 transition-all duration-500 print:hidden ${
            showScreenshotHint ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <button
            onClick={() => {
              const nextLock = !isScreenLocked;
              setIsScreenLocked(nextLock);
              triggerHintTemporarily(2500);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black shadow-xl backdrop-blur-md border transition-all active:scale-95 ${
              isScreenLocked
                ? 'bg-amber-500/95 text-white border-amber-300'
                : 'bg-slate-800/85 text-white border-slate-600 hover:bg-slate-700'
            }`}
          >
            {isScreenLocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>ロック中（タップで解除）</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>画面をロックする</span>
              </>
            )}
          </button>

          {!isScreenLocked && (
            <button
              onClick={() => setIsScreenshotMode(false)}
              className="flex items-center gap-1 bg-white/90 text-slate-800 border border-slate-300 px-3.5 py-2 rounded-full text-xs font-black shadow-xl backdrop-blur-md active:scale-95 hover:bg-white"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>戻る</span>
            </button>
          )}
        </div>
      )}

      {/* --- パート編集モーダル --- */}
      {editingPart && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="glass-panel rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 bg-white/90 border-slate-300/60">
            <div className="bg-white/60 px-5 py-3 border-b border-slate-300/60 flex justify-between items-center backdrop-blur-md">
              <h3 className="font-black text-slate-800 text-base">パート設定</h3>
              <button onClick={() => setEditingPart(null)} className="glass-btn p-1.5 rounded-full text-slate-500 border-slate-300/50">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">パート名</label>
                <input 
                  type="text" 
                  value={editingPart.name}
                  onChange={(e) => setEditingPart(prev => ({...prev, name: e.target.value}))}
                  className="w-full p-2.5 rounded-xl glass-input text-slate-800 font-black text-sm focus:ring-2 focus:ring-blue-400 outline-none border-slate-300/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-orange-500 uppercase tracking-wider flex items-center gap-1 pl-1">
                  <Timer className="w-3 h-3" /> パート終了後の休憩 (Rest)
                </label>
                <div className="flex items-center justify-between glass-input bg-orange-50/70 rounded-2xl p-2 border-orange-200/50">
                  <button 
                    onClick={() => adjustPartRest(-30)}
                    className="glass-btn w-10 h-10 flex items-center justify-center bg-white/80 rounded-xl text-orange-500 border-slate-300/50"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <div className="text-xl font-black text-slate-800 font-mono w-16 text-center drop-shadow-sm">
                    {formatTime(editingPart.partRestSeconds)}
                  </div>
                  <button 
                    onClick={() => adjustPartRest(30)}
                    className="glass-btn w-10 h-10 flex items-center justify-center bg-white/80 rounded-xl text-orange-500 border-slate-300/50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-white/50 border-t border-slate-300/60 flex gap-2 backdrop-blur-md">
              <button 
                onClick={() => setEditingPart(null)}
                className="glass-btn flex-1 py-2.5 rounded-xl font-black text-xs text-slate-600 bg-white/60 border-slate-300/50"
              >
                キャンセル
              </button>
              <button 
                onClick={savePartEdit}
                className="flex-1 py-2.5 rounded-xl font-black text-xs text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all active:scale-95 border border-blue-400 relative overflow-hidden"
              >
                <div className="pattern-overlay opacity-40"></div>
                <span className="relative z-10">保存する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- セット編集モーダル --- */}
      {editingSet && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-2 animate-in fade-in duration-200">
          <div className="glass-panel rounded-[1.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] bg-white/90 border-slate-300/60">
            <div className="bg-white/60 px-4 py-2.5 border-b border-slate-300/60 flex justify-between items-center shrink-0 backdrop-blur-md">
              <h3 className="font-black text-slate-800 text-sm">メニューの編集</h3>
              <button onClick={() => setEditingSet(null)} className="glass-btn p-1 rounded-full text-slate-500 border-slate-300/50">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-3 space-y-3 overflow-y-auto">

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">種目 (Style)</label>
                <div className="flex flex-wrap gap-1">
                  {STYLES.map(s => (
                    <button
                      key={s}
                      onClick={() => setEditingSet(prev => ({...prev, style: s}))}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                        editingSet.style === s 
                          ? 'bg-blue-500 text-white shadow-sm scale-105 border border-blue-400' 
                          : 'glass-btn text-slate-600 border-slate-300/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">詳細・メモ</label>
                <input 
                  type="text"
                  value={editingSet.description}
                  onChange={(e) => setEditingSet(prev => ({...prev, description: e.target.value}))}
                  placeholder="例：イーブンペースを保つ"
                  className="w-full p-2 rounded-xl glass-input text-slate-800 text-xs font-black focus:ring-2 focus:ring-blue-400 outline-none border-slate-300/60"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider pl-1">距離 (m)</label>
                <div className="flex items-center justify-between glass-input rounded-xl p-1 border-slate-300/60">
                  <button 
                    onClick={() => setEditingSet(prev => ({...prev, distance: Math.max(25, prev.distance - 25)}))}
                    className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-blue-500 border-slate-300/50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="text-lg font-black text-slate-800 font-mono w-16 text-center drop-shadow-sm">
                    {editingSet.distance}
                  </div>
                  <button 
                    onClick={() => setEditingSet(prev => ({...prev, distance: prev.distance + 25}))}
                    className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-blue-500 border-slate-300/50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center pl-1 h-4">本数</label>
                  <div className="flex items-center justify-between glass-input rounded-xl p-1 border-slate-300/60">
                    <button 
                      onClick={() => setEditingSet(prev => ({...prev, reps: Math.max(1, prev.reps - 1)}))}
                      className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-blue-500 border-slate-300/50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="text-base font-black text-slate-800 font-mono text-center drop-shadow-sm">
                      {editingSet.reps}
                    </div>
                    <button 
                      onClick={() => setEditingSet(prev => ({...prev, reps: prev.reps + 1}))}
                      className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-blue-500 border-slate-300/50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-0.5 pl-1 h-4">
                    <Layers className="w-3 h-3" /> セット数
                  </label>
                  <div className="flex items-center justify-between glass-input bg-emerald-50/70 rounded-xl p-1 border-emerald-200/50">
                    <button 
                      onClick={() => setEditingSet(prev => ({...prev, setsCount: Math.max(1, prev.setsCount - 1)}))}
                      className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-emerald-500 border-slate-300/50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="text-base font-black text-slate-800 font-mono text-center drop-shadow-sm">
                      {editingSet.setsCount}
                    </div>
                    <button 
                      onClick={() => setEditingSet(prev => ({...prev, setsCount: prev.setsCount + 1}))}
                      className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-emerald-500 border-slate-300/50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1 pt-1.5 border-t border-slate-300/60">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-0.5 pl-1">
                  <Timer className="w-3 h-3" /> サークル (1本)
                </label>
                <div className="flex items-center justify-between glass-input rounded-xl p-1 border-slate-300/60">
                  <button 
                    onClick={() => adjustCircle(-5)}
                    className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-blue-500 border-slate-300/50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="text-lg font-black text-slate-800 font-mono w-16 text-center drop-shadow-sm">
                    {formatTime(editingSet.circleSeconds)}
                  </div>
                  <button 
                    onClick={() => adjustCircle(5)}
                    className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-blue-500 border-slate-300/50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`space-y-1 transition-opacity ${editingSet.setsCount > 1 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <label className="text-[10px] font-black text-orange-500 uppercase tracking-wider flex items-center gap-0.5 pl-1">
                  <Timer className="w-3 h-3" /> セット間 Rest
                </label>
                <div className="flex items-center justify-between glass-input bg-orange-50/70 rounded-xl p-1 border-orange-200/50">
                  <button 
                    onClick={() => adjustRest(-10)}
                    className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-orange-500 border-slate-300/50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="text-lg font-black text-slate-800 font-mono w-16 text-center drop-shadow-sm">
                    {formatTime(editingSet.restSeconds)}
                  </div>
                  <button 
                    onClick={() => adjustRest(10)}
                    className="glass-btn w-8 h-8 flex items-center justify-center bg-white/80 rounded-lg text-orange-500 border-slate-300/50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-white/50 border-t border-slate-300/60 flex gap-2 shrink-0 backdrop-blur-md">
              <button 
                onClick={() => setEditingSet(null)}
                className="glass-btn flex-1 py-2 rounded-lg text-xs font-black text-slate-600 bg-white/60 border-slate-300/50"
              >
                キャンセル
              </button>
              <button 
                onClick={saveEdit}
                className="flex-1 py-2 rounded-lg text-xs font-black text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-all active:scale-95 border border-blue-400 relative overflow-hidden"
              >
                <div className="pattern-overlay opacity-40"></div>
                <span className="relative z-10">保存する</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}