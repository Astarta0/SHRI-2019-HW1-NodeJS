import { INIT } from './constants';
import { compose } from './utils';

export default class Store {
    constructor(reducer, middlewares) {
        this._reducer = reducer;
        this._state = undefined;
        this._listeners = [];

        const middlewareAPI = {
            getState: this.getState,
            dispatch: (action, ...args) => this.dispatch(action, ...args)
        };

        console.log({ middlewares });

        const chain = middlewares.map(middleware => middleware(middlewareAPI));

        this.dispatch = compose(...chain)(this._dispatch);

        this._dispatch({
            type: INIT
        });
    }

    _notifyListeners = () => {
        this._listeners.forEach(listener => listener(this._state));
    };

    getState = () => {
        return this._state;
    };

    _dispatch = (action) => {
        this._state = this._reducer(this._state, action);
        this._notifyListeners();
    };

    subscribe = (cb) => {
        this._listeners.push(cb);

        return () => {
            const targetIdx = this._listeners.indexOf(cb);
            this._listeners.splice(targetIdx, 1);
        };
    };
}
