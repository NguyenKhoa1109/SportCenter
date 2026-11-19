/**
 * Utility functions for cleaning and normalizing Markdown text.
 */

/**
 * Removes raw Markdown syntax (**, ##, ###, ---, *, etc.)
 * leaving clean, well-spaced plain text suitable for textareas or plain-text inputs.
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanMarkdownText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Remove headers (# Heading -> Heading)
    .replace(/^#{1,6}\s*(.+)$/gm, '$1')
    // Remove horizontal rules (--- or *** or ___)
    .replace(/^([-*]{3,}|_{3,})$/gm, '')
    // Remove bold and bold-italic
    .replace(/\*\*\*([^*]+?)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/___([^_]+?)___/g, '$1')
    .replace(/__([^_]+?)__/g, '$1')
    // Remove italics (only if wrapped without outer spaces)
    .replace(/(^|\s)\*([^*\s][^*]*?)\*($|\s)/g, '$1$2$3')
    .replace(/(^|\s)_([^_\s][^_]*?)_($|\s)/g, '$1$2$3')
    // Remove inline code
    .replace(/`([^`]+?)`/g, '$1')
    // Convert * or + bullet points to clean dash -
    .replace(/^[*+]\s+/gm, '- ')
    // Normalize excessive blank lines (max 2 newlines)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const METADATA_LINE_RE = /^(?:tên\s*lớp|lớp\s*học|thời\s*gian|ngày\s*(?:học|tập)|học\s*viên|huấn\s*luyện\s*viên|hlv|trình\s*độ|thể\s*trạng|sĩ\s*số|địa\s*điểm|phòng\s*tập|bộ\s*môn|chủ\s*đề|tổng\s*quan|giới\s*thiệu)(?=$|[:\s-])/i;
const SECTION_PREFIX_RE = /^(?:phần\s*\d+|giai\s*đoạn\s*\d+|bước\s*\d+)\s*[:\-–.]\s*/i;
const NON_EXERCISE_LINE_RE = /^(?:tên\s*lớp|lớp\s*học|thời\s*gian|ngày\s*(?:học|tập)|học\s*viên|huấn\s*luyện\s*viên|hlv|trình\s*độ|thể\s*trạng|sĩ\s*số|địa\s*điểm|phòng\s*tập|bộ\s*môn|chủ\s*đề|tổng\s*quan|giới\s*thiệu|phần\s*\d+|giai\s*đoạn\s*\d*|khởi\s*động|hồi\s*phục|giãn\s*cơ|dặn\s*dò|lưu\s*ý|mục\s*tiêu|ghi\s*chú|nhận\s*xét|dinh\s*dưỡng|warmup|cool[\s-]?down|homework)/i;

function parseExerciseLine(line) {
  const cleaned = line.replace(/^(?:\d+[.)]|[-•])\s+/, '').trim();
  if (!cleaned || cleaned.length > 160 || NON_EXERCISE_LINE_RE.test(cleaned)) {
    return null;
  }

  const colonIdx = cleaned.indexOf(':');
  const head = colonIdx > 0 ? cleaned.slice(0, colonIdx).trim() : cleaned;
  const tail = colonIdx > 0 ? cleaned.slice(colonIdx + 1).trim() : cleaned;
  if ((colonIdx > 0 && !tail) || NON_EXERCISE_LINE_RE.test(head)) {
    return null;
  }

  const srMatch = cleaned.match(
    /(\d+)\s*(?:hiệp|sets?|vòng|lượt)?\s*[x×*]\s*(\d+)(?:\s*[-–]\s*\d+)?\s*(?:reps?|lần|nhịp|s|giây|phút)?/i
  );
  const setsMatch = !srMatch ? cleaned.match(/(\d+)\s*(?:hiệp|sets?)/i) : null;
  const repsMatch = !srMatch ? cleaned.match(/(\d+)\s*(?:reps?|lần)/i) : null;
  const weightMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);

  if (!srMatch && !setsMatch && !weightMatch && colonIdx < 0) {
    return null;
  }

  const sets = srMatch ? Number(srMatch[1]) : setsMatch ? Number(setsMatch[1]) : 3;
  const reps = srMatch ? Number(srMatch[2]) : repsMatch ? Number(repsMatch[1]) : 10;
  const weightKg = weightMatch ? Number(weightMatch[1].replace(',', '.')) : 0;

  let name = head
    .replace(/\((?:[^)]*(?:hiệp|sets?|reps?|lần|kg|x|×)[^)]*)\)/gi, '')
    .replace(/[-–]\s*\d+\s*(?:hiệp|sets?|x|×).*$/i, '')
    .trim();
  if (!name || name.length < 2) {
    name = head.slice(0, 80).trim();
  }

  let note = '';
  if (colonIdx > 0 && tail) {
    note = tail
      .replace(/^\d+\s*(?:hiệp|sets?|vòng|lượt)?\s*[x×*]\s*\d+(?:\s*[-–]\s*\d+)?\s*(?:reps?|lần|nhịp|s|giây|phút)?\s*/i, '')
      .replace(/^\(?\d+(?:[.,]\d+)?\s*kg\)?[,;.\s-]*/i, '')
      .replace(/^[-–,;\s]+/, '')
      .trim();
  }

  return {
    name: name.slice(0, 100),
    sets: Number.isFinite(sets) && sets > 0 ? sets : 3,
    reps: Number.isFinite(reps) && reps > 0 ? reps : 10,
    weightKg: Number.isFinite(weightKg) && weightKg >= 0 ? weightKg : 0,
    note: note.slice(0, 180),
  };
}

export function parseAiWorkoutPlan(rawText, fallback = {}) {
  const cleaned = cleanMarkdownText(rawText);
  if (!cleaned) {
    return null;
  }

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = {
    goal: [],
    warmup: [],
    main: [],
    cooldown: [],
    homework: [],
  };
  let activeSection = 'main';

  for (const line of lines) {
    const stripped = line.replace(/^(?:\d+[.)]|[-•])\s+/, '').replace(SECTION_PREFIX_RE, '').trim();
    const lower = stripped.toLowerCase();
    if (METADATA_LINE_RE.test(lower)) {
      continue;
    }
    if (/^(?:mục tiêu|goal)(?:\s*:|\s*$)/i.test(lower)) {
      activeSection = 'goal';
      const rest = stripped.replace(/^[^:]+:\s*/, '');
      if (rest && rest !== stripped) sections.goal.push(rest);
      continue;
    }
    if (/^(?:khởi động|warm[\s-]?up)(?:\s*:|\s*$)/i.test(lower)) {
      activeSection = 'warmup';
      const rest = stripped.replace(/^[^:]+:\s*/, '');
      if (rest && rest !== stripped) sections.warmup.push(rest);
      continue;
    }
    if (/^(?:bài tập chính|nội dung chính|lộ trình|chương trình tập|main)(?:\s*:|\s*$)/i.test(lower)) {
      activeSection = 'main';
      continue;
    }
    if (/^(?:hồi phục|giãn cơ|cool[\s-]?down|lưu ý an toàn|nhận xét)(?:\s*:|\s*$)/i.test(lower)) {
      activeSection = 'cooldown';
      const rest = stripped.replace(/^[^:]+:\s*/, '');
      if (rest && rest !== stripped) sections.cooldown.push(rest);
      continue;
    }
    if (/^(?:dặn dò|bài tập về nhà|dinh dưỡng|lời khuyên|homework)(?:\s*:|\s*$)/i.test(lower)) {
      activeSection = 'homework';
      const rest = stripped.replace(/^[^:]+:\s*/, '');
      if (rest && rest !== stripped) sections.homework.push(rest);
      continue;
    }
    if (SECTION_PREFIX_RE.test(line)) {
      continue;
    }
    sections[activeSection].push(line);
  }

  const candidateLines = sections.main.length > 0 ? sections.main : lines;
  const exercises = [];
  for (const line of candidateLines) {
    const parsed = parseExerciseLine(line);
    if (parsed) {
      exercises.push(parsed);
      if (exercises.length >= 8) break;
    }
  }

  if (exercises.length === 0) {
    for (const line of lines) {
      if (/^(?:\d+[.)]|[-•])\s+/.test(line)) {
        const cleanedBullet = line.replace(/^(?:\d+[.)]|[-•])\s+/, '').trim();
        if (NON_EXERCISE_LINE_RE.test(cleanedBullet)) continue;
        const name = cleanedBullet.split(':')[0].trim();
        if (name && name.length >= 3 && name.length <= 90) {
          exercises.push({ name, sets: 3, reps: 10, weightKg: 0, note: '' });
          if (exercises.length >= 5) break;
        }
      }
    }
  }

  const goalText = sections.goal.join(' ').trim() || fallback.goal || '';
  const warmupSummary = sections.warmup.slice(0, 2).join('; ');
  const cooldownSummary = sections.cooldown.join(' ').trim();
  const homeworkText = sections.homework.join(' ').trim();

  return {
    goal: goalText.slice(0, 300),
    exercises,
    sessionResult: warmupSummary ? `Khởi động: ${warmupSummary}`.slice(0, 350) : fallback.sessionResult || '',
    coachFeedback: (cooldownSummary || cleaned.slice(0, 350)).slice(0, 450),
    homework: (homeworkText || sections.cooldown.slice(-1)[0] || fallback.homework || '').slice(0, 350),
  };
}
