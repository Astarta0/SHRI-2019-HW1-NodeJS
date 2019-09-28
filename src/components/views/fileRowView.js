import View from '../../redux/View';

import * as repositorySelectors from '../../selectors/repository';
import { convertTimestampToDate } from '../../utils';

export default class FileRowView extends View {
    constructor(el, store) {
        super(el, store);
    }

    destroy = () => {
        super.destory();
    };

    render(state) {
        const files = repositorySelectors.filterFilesBySearchName(state);
        const waiting = repositorySelectors.getWaiting(state);
        const error = repositorySelectors.getError(state);
        const searchName = repositorySelectors.getSearchName(state);

        if (!files.length) {
            let content = '';
            if (searchName && !error) {
                content = 'Sorry, no files found :c';
            } else {
                content = waiting ? 'Load data...' : `${error}`;
            }

            return `
                <span class="table__infoBlock ${
                    error ? 'table__infoBlock_error' : ''
                }">${content}</span>
            `;
        }

        return `
            <div class="table__content">
                ${files
                    .sort((f1, f2) => f2.date - f1.date)
                    .map(
                        ({
                            type,
                            name,
                            commitHash,
                            commitMessage,
                            committerName,
                            committerEmail,
                            date,
                        }) => {
                            return `
                        <div class="table__row row">
                        <div class="table__cell cell table__cell_name">
                            <span class="icon cell__icon ${
                                type === 'blob'
                                    ? 'icon_file_code'
                                    : 'icon_folder'
                            }"></span>
                            <span class="cell__folderName cell__folderName_font_medium">${name}</span>
                        </div>
                        <div class="table__cell cell table__cell_commit">
                            <a class="link" href="/" target="_blank">${commitHash}</a>
                        </div>
                        <div class="table__cell cell table__cell_message">
                        <span>
                            <!--<a class="link">ARCADIA-771</a>-->
                            ${commitMessage}
                        </span>
                            <div class="cell__arrowButton">
                                <svg width="10" height="20" viewBox="0 0 10 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M0.9375 1.02344L0.15625 1.76562C0 1.96094 0 2.27344 0.15625 2.42969L7.22656 9.5L0.15625 16.6094C0 16.7656 0 17.0781 0.15625 17.2734L0.9375 18.0156C1.13281 18.2109 1.40625 18.2109 1.60156 18.0156L9.80469 9.85156C9.96094 9.65625 9.96094 9.38281 9.80469 9.1875L1.60156 1.02344C1.40625 0.828125 1.13281 0.828125 0.9375 1.02344Z"
                                          fill="#E5E5E5"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="table__cell cell table__cell_committer">
                            <a class="cell__committerEmail committer committer_email">${committerEmail.split('@')[0]}</a>
                            <a class="cell__committerName committer"> by ${committerName}, </a>
                        </div>
                        <div class="table__cell cell table__cell_updated">
                            <span class="cell__apdateData">${convertTimestampToDate(date)}</span>
                        </div>
                    </div>  
                    `;
                        }
                    )
                    .join('')}
            </div>
        `;
    }
}
