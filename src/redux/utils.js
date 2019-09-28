export const compose = (...fn) => {
    return function (x) {
        if(!fn) return x;

        return fn.length > 1 ?
            fn.reduce((acc, curr) => {
                acc = curr(acc);
                return acc;
            }, x)
            : fn[0];
    }
};

export const loggerMiddleWare = store => next => action => {
    console.log('DISPATCH ->', action);
    const result = next(action);
    console.log('NEXT STATE: ', store.getState());
    return result;
};

export const thunk = store => next => action => {
    return typeof action === 'function'
        ? action(store.dispatch, store.getState)
        : next(action);
};
