import Store from './redux/Store';
import { thunk, loggerMiddleWare } from './redux/utils';
import rootReducer from './reducers/root';
import * as actions from './actions/actions';

import FileRowView from './components/views/fileRowView';
import SearchView from './components/views/searchView';

import hljs from 'highlight.js/lib/highlight';
import python from 'highlight.js/lib/languages/python';

hljs.registerLanguage('python', python);
hljs.initHighlightingOnLoad();

document.addEventListener("DOMContentLoaded", ready);

function ready() {
    const dropdowns = document.querySelectorAll('.dropDown');
    for (const dropdown of dropdowns) {
        dropdown.addEventListener('click', e => {
            dropdown.classList.toggle('dropDown_expanded');
        });
    }

    const branchSelectors = document.querySelectorAll('.branchSelector');
    for (const branchSelector of branchSelectors) {
        branchSelector.addEventListener('click', e => {
            branchSelector.classList.toggle('branchSelector_expanded');
        });
    }

    const store = new Store(rootReducer, [ loggerMiddleWare, thunk ]);

    store.dispatch(actions.fetchFiles());

    const filesRootEl = document.querySelector('#files');
    const searchRootEl = document.querySelector('#search');
    const FileRowViewInstance = new FileRowView(filesRootEl, store);
    const SearchViewInstance = new SearchView(searchRootEl, store);
}


