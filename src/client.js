import hljs from 'highlight.js/lib/highlight';
import python from 'highlight.js/lib/languages/python';
hljs.registerLanguage('python', python);
hljs.initHighlightingOnLoad();

const dropdowns = document.querySelectorAll('.dropDown');
for (const dropdown of dropdowns) {
    let timer;
    dropdown.addEventListener('mouseenter', e => {
        clearTimeout(timer);
        e.target.classList.add('dropDown_expanded');
    });
    dropdown.addEventListener('mouseleave', e => {
        timer = setTimeout(() => e.target.classList.remove('dropDown_expanded'), 300);
    });
}

const branchSelectors = document.querySelectorAll('.branchSelector');
for (const branchSelector of branchSelectors) {
    let timer;
    branchSelector.addEventListener('mouseenter', e => {
        clearTimeout(timer);
        e.target.classList.add('branchSelector_expanded');
    });
    branchSelector.addEventListener('mouseleave', e => {
        timer = setTimeout(() => e.target.classList.remove('branchSelector_expanded'), 300);
    });
}
