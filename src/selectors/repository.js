const getAll = state => {
    return state.repository;
};

export const getFiles = state => {
    return getAll(state).files;
};

export const getSearchName = state => {
    return getAll(state).searchName;
};

export const getWaiting = state => {
    return getAll(state).waiting;
};

export const getError = state => {
    return getAll(state).error;
};

export const filterFilesBySearchName = state => {
    const searchName = getSearchName(state).toLocaleLowerCase();
    return getAll(state).files.filter(({ name }) => {
        return name.toLocaleLowerCase().includes(searchName);
    });
};
