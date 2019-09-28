export default class View {
    constructor(el, store) {
        this._el = el;
        this._store = store;
        this._unsubscribe = store.subscribe(this._prepareRender);

        this._prepareRender(store.getState());
    }

    _prepareRender = (state) => {
        this._el.innerHTML = this.render(state);
        this.componentDidUpdate();
    };

    componentDidUpdate = () => {};

    render() {
        throw new Error('Method render should be overriden!');
    }

    destroy = () => {
        this._el.innerHTML = '';
        this._unsubscribe();
    }
}
