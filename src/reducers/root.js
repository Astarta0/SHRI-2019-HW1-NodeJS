import repositoryReducer from './repository';

export default function rootReducer(state = {}, action) {
    return {
        repository: repositoryReducer(state.repository, action),
    };
}
