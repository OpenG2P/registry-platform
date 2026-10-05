function parseDate(value?: string | null): Date | null {
    if (!value) return null;

    let safeValue = String(value).trim();
    if (!safeValue) return null;

    if (!safeValue.includes('T') && safeValue.includes(' ')) {
        safeValue = safeValue.replace(' ', 'T');
    }

    if (!safeValue.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(safeValue)) {
        safeValue = `${safeValue}Z`;
    }

    const date = new Date(safeValue);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

export function formatDateTime(value?: string | null, fallback = '-- -- ----') {
    const date = parseDate(value);
    if (!date) return fallback;

    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const minutes = date.getMinutes();
    let hours = date.getHours();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const time = minutes === 0
        ? `${hours}${period}`
        : `${hours}:${String(minutes).padStart(2, '0')} ${period}`;

    return `${month} ${day} ${year} ${time}`;
}

export function formatDate(value?: string | null, fallback = '-- -- ----') {
    if (!value) return fallback;

    let safeValue = value;
    if (!safeValue.includes('T') && safeValue.includes(' ')) {
        safeValue = safeValue.replace(' ', 'T');
    }

    const [dp, tp] = safeValue.split(/[T ]/);
    const [y, m, d] = dp.split('-').map(Number);
    const [h, mi] = (tp || '00:00').split(':').map(Number);

    const date = new Date(y, m - 1, d, h, mi);
    if (Number.isNaN(date.getTime())) return fallback;

    const month = date.toLocaleString('en-US', { month: 'short' });
    return `${month} ${date.getDate()} ${date.getFullYear()}`;
}

export function formatDuration(
    start?: string | null,
    end?: string | null,
    fallback = '—',
) {
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) return fallback;

    const ms = endDate.getTime() - startDate.getTime();
    if (!Number.isFinite(ms) || ms < 0) return fallback;

    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 1) return '< 1 sec';

    const weekSeconds = 7 * 24 * 3600;
    const daySeconds = 24 * 3600;
    const weeks = Math.floor(totalSeconds / weekSeconds);
    const days = Math.floor((totalSeconds % weekSeconds) / daySeconds);
    const hours = Math.floor((totalSeconds % daySeconds) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (weeks) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
    if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    if (hours) parts.push(`${hours} hr`);
    if (minutes) parts.push(`${minutes} min`);
    if (seconds || parts.length === 0) parts.push(`${seconds} sec`);
    return parts.join(' ');
}
