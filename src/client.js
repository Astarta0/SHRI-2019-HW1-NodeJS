import Store from './redux/Store';
import { thunk, loggerMiddleWare } from './redux/utils';
import rootReducer from './reducers/root';
import * as actions from './actions/actions';

import FileRowView from './components/views/fileRowView';
import SearchView from './components/views/searchView';

import * as TYPES from './actions/types';
// ------------------------------
import hljs from 'highlight.js/lib/highlight';
import python from 'highlight.js/lib/languages/python';

hljs.registerLanguage('python', python);
hljs.initHighlightingOnLoad();

document.addEventListener("DOMContentLoaded", ready);

function ready() {
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

    const store = new Store(rootReducer, [ loggerMiddleWare, thunk ]);

    store.dispatch(actions.fetchFiles());

    const filesRootEl = document.querySelector('#files');
    const searchRootEl = document.querySelector('#search');
    const FileRowViewInstance = new FileRowView(filesRootEl, store);
    const SearchViewInstance = new SearchView(searchRootEl, store);
}


