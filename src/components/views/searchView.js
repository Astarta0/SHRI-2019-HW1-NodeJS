import View from '../../redux/View';
import * as actions from '../../actions/actions';
import * as repositotySelectors from '../../selectors/repository';

import * as DOMUtils from '../../utils';

export default class SearchView extends View {
    constructor(el, store) {
        super(el, store);
        this._el.addEventListener('input', this._handleInput);
    }

    componentDidUpdate = () => {
        const input_el = this._el.querySelector('.search__input');
        DOMUtils.moveCursorToEnd(input_el);
    };

    _handleInput = (e) => {
        const { value } = e.target;
        this._store.dispatch(actions.searchFiles(value));
    };

    destroy = () => {
        this._el.removeAllListeners('input', this._handleInput);
        super.destory();
    };

    render(state) {
        const searchName = repositotySelectors.getSearchName(state);

        return `
            <input class="search__input input" value="${searchName}" autofocus placeholder="Filter by file name...">
        `;
    }
}
