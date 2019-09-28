import * as TYPE from '../actions/types';

const INITIAL_STATE = {
    files: [],
    searchName: '',
    waiting: false,
    error: null
};

export default function(state = INITIAL_STATE, action) {
    switch(action.type) {
        case TYPE.UPDATE_FILES_LIST_PENDING: {
            return {
                ...state,
                waiting: true,
                error: null
            };
        }

        case TYPE.UPDATE_FILES_LIST_FAILED: {
            return {
                ...state,
                waiting: false,
                error: action.payload.error
            };
        }

        case TYPE.UPDATE_FILES_LIST_SUCCESS: {
            return {
                ...state,
                files: action.payload.files,
                waiting: false,
            };
        }

        case TYPE.SEARCH_FILES_BY_NAME: {}
            return {
            ...state,
                searchName: action.payload.searchName
            };

        default:
            return INITIAL_STATE;
    }
};
