/// script.js

import { getParamsFromUrl, validateFormData, hide, show, getResults, formSchema, urlSchema } from './search.js';

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

if (window.location.search) {

    const urlParams = new URLSearchParams(window.location.search);
    const { errorMsg, params } = getParamsFromUrl(urlParams, urlSchema);

    if (errorMsg) {
        searchResultStatusTgt.innerHTML = errorMsg;
        show([resultTgt]);
        hide([resultTableTgt, formLinks]);
    }
    else {
        show([loadingGif]);
        await getResults({
            params,
            litsearchContainer,
            resultTgt,
            searchResultStatusTgt,
            resultTableTgt,
            formLinks,
            screen
        });
        hide([loadingGif]);
    }

}

const searchButton = document.querySelector('#search');
searchButton.addEventListener('click', async function(event) {
    event.stopPropagation();
    event.preventDefault();

    show([loadingGif]);

    // Conduct search
    const inputs = document.getElementById('litsearch').querySelectorAll('input');
    const formParams = {};
    inputs.forEach(input => {

        if (input.name === 'communities') {

            if (input.checked) {
                formParams[input.name] = input.value;
            }

        }
        else if (input.name === 'include-deprecated') {
            formParams[input.name] = input.checked ? true : false
        }
        else {
            formParams[input.name] = input.value;
        }
        
    });
    
    const { errorMsg, params } = validateFormData(formParams, formSchema);
    
    if (errorMsg) {
        searchResultStatusTgt.innerHTML = errorMsg;
        show([resultTgt]);
        hide([resultTableTgt, formLinks]);
    }
    else {
        show([loadingGif]);

        await getResults({
            params,
            litsearchContainer,
            resultTgt,
            searchResultStatusTgt,
            resultTableTgt,
            formLinks,
            screen
        });

        hide([loadingGif]);
    }
});