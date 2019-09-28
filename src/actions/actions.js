import axios from 'axios';

import * as TYPE from './types';
import { REPOSITORY_ID, COMMIT_HASH } from '../constants';

const AXIOS_INSTANCE = axios.create({
    baseURL: 'http://localhost:3000',
});

export function fetchFiles() {
    return async dispatch => {
        dispatch({
            type: TYPE.UPDATE_FILES_LIST_PENDING
        });

        try {
            const { data: { files } } = await AXIOS_INSTANCE.get('/api/repos/' + `${REPOSITORY_ID}/tree/${COMMIT_HASH}`);

            dispatch({
                type: TYPE.UPDATE_FILES_LIST_SUCCESS,
                payload: { files }
            });
        } catch (error) {
            dispatch({
                type: TYPE.UPDATE_FILES_LIST_FAILED,
                payload: { error: error.message }
            });
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

