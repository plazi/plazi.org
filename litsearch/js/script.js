import { getParamsFromUrl, hide, show, getResults } from './search.js';

const litsearchContainer = document.getElementById('litsearchContainer');
const loadingGif = document.getElementById('loadingGif');
const searchResultStatusTgt = document.getElementById('searchResultStatus');
const resultTgt = document.getElementById('result');
const resultTableTgt = document.getElementById('resultTable');
const formLinks = document.getElementById('formLinks');
const screen = window.screen.width < 500 ? 'mobile' : 'desktop';

// Hide the loading gif and the results div right off the bat
hide([loadingGif, resultTgt]);

// Arm the journal field so that the journal meta fields activate 
// only when something is entered in the journal field
const journalFld = document.querySelector('input[name=journal]');
const volumeFld = document.querySelector('input[name=volume]');
const issueFld = document.querySelector('input[name=issue]');
journalFld.addEventListener('input', function(event) {

    if (journalFld.value) {
        volumeFld.disabled = false;
        issueFld.disabled = false;
    }
    else {
        volumeFld.disabled = true;
        issueFld.disabled = true;
    }

});

const includeDeprecatedCheckbox = document.querySelector('input[name=include-deprecated]');

const { errorMsg, params } = getParamsFromUrl();

if (errorMsg) {
    searchResultStatusTgt.innerHTML = errorMsg;
    show([resultTgt]);
    hide([resultTableTgt, formLinks]);
}
else if (Object.keys(params).length) {
    params.litsearchContainer = litsearchContainer;
    params.resultTgt = resultTgt;
    params.searchResultStatusTgt = searchResultStatusTgt;
    params.resultTableTgt = resultTableTgt;
    params.formLinks = formLinks;
    params.screen = screen;
    show([loadingGif]);
    await getResults(params);
    hide([loadingGif]);
}

const searchButton = document.querySelector('#search');
searchButton.addEventListener('click', async function(event) {
    event.stopPropagation();
    event.preventDefault();

    show([loadingGif]);

    // Conduct search
    const communitiesFld = document.querySelectorAll('input[name=communities]');
    const includeDeprecated = includeDeprecatedCheckbox.checked 
    ? true 
    : false;
    const params = {
        communities: Array.from(communitiesFld).filter(c => c.checked)[0].value,
        authors: document.querySelector('input[name=authors]').value,
        year: document.querySelector('input[name=year]').value,
        title: document.querySelector('input[name=title]').value,
        journal: journalFld.value,
        volume: volumeFld.value,
        issue: issueFld.value,
        includeDeprecated,
        page: document.querySelector('input[name=page]').value,
        size: document.querySelector('input[name=size]').value,
        litsearchContainer,
        resultTgt,
        searchResultStatusTgt,
        resultTableTgt,
        formLinks,
        screen
    }
    
    await getResults(params);
    hide([loadingGif]);
});