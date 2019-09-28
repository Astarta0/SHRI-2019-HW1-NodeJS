import { DateTime } from 'luxon';

// https://css-tricks.com/snippets/jquery/move-cursor-to-end-of-textarea-or-input/
export const moveCursorToEnd = el => {
    el.focus();
    if (el.setSelectionRange) {
        const len = el.value.length * 2;
        el.setSelectionRange(len, len);
    } else {
        el.value = el.value;
    }
    el.scrollTop = 999999;
};

export const convertTimestampToDate = (timestamp) => {
    const date = DateTime.fromMillis(timestamp * 1000);
    return date.setLocale('en-US').toLocaleString({ weekday: 'short',day: '2-digit', month: 'short'});
};
