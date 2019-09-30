import axios from 'axios';

import * as TYPE from './types';
import { REPOSITORY_ID, COMMIT_HASH } from '../constants';

const AXIOS_INSTANCE = axios.create({
    baseURL: 'http://localhost:3000',
});

export function fetchFiles() {
    return async dispatch => {
        dispatch(updateFilesListPending());

        try {
            const { data: { files } } = await AXIOS_INSTANCE.get('/api/repos/' + `${REPOSITORY_ID}/tree/${COMMIT_HASH}`);

            dispatch(updateFilesListSuccess(files));
        } catch (error) {
            dispatch(updateFilesListFailed(error));
        }
    };
}

export function searchFiles(searchName) {
    return {
        type: TYPE.SEARCH_FILES_BY_NAME,
        payload: {
            searchName
        }
    };
}

export function updateFilesListPending() {
    return {
        type: TYPE.UPDATE_FILES_LIST_PENDING
    };
}

export function updateFilesListSuccess(files) {
    return {
        type: TYPE.UPDATE_FILES_LIST_SUCCESS,
        payload: { files }
    };
}

export function updateFilesListFailed(error) {
    return {
        type: TYPE.UPDATE_FILES_LIST_FAILED,
        payload: { error: error.message }
    };
}

