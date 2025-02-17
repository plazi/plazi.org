/// search.js

const formSchema = {
    "communities": {
        "type": "string",
        "enum": [
            "biosyslit", "batlit", "Taxodros", "SiBILS"
        ],
        "default": "biosyslit"
    },
    "authors": {
        "type": "string"
    }, 
    "year": {
        "type": "string"
    }, 
    "title": {
        "type": "string"
    }, 
    "journal": {
        "type": "string"
    },
    "volume": {
        "type": "string"
    }, 
    "issue": {
        "type": "string"
    }, 
    "includeDeprecated": {
        "type": "boolean",
        "default": false
    },
    "page": {
        "type": "number",
        "default": 1
    }, 
    "size": {
        "type": "number",
        "default": 30
    }
}

const urlSchema = {
    "communities": {
        "type": "string",
        "enum": [
            "biosyslit", "batlit", "Taxodros", "SiBILS"
        ],
        "zenodoParam": {
            "type": "searchStr"
        },
        "isRequired": true
    },
    "authors": {
        "type": "string",
        "zenodoParam": {
            "type": "q",
            "key": "metadata.creators.person_or_org.name"
        }
    }, 
    "year": {
        "type": "range",
        "zenodoParam": {
            "type": "q",
            "key": "metadata.publication_date"
        }
    }, 
    "title": {
        "type": "string",
        "zenodoParam": {
            "type": "q",
            "key": "metadata.title"
        }
    }, 
    "journal": {
        "type": "string",
        "zenodoParam": {
            "type": "q",
            "key": "journal.title"
        }
    },
    "volume": {
        "type": "string",
        "zenodoParam": {
            "type": "q",
            "key": "journal.volume"
        }
    }, 
    "issue": {
        "type": "string",
        "zenodoParam": {
            "type": "q",
            "key": "journal.issue"
        }
    }, 
    "includeDeprecated": {
        "type": "boolean",
        "default": false,
        "zenodoParam": {
            "type": "q",
            "key": "metadata.creators.person_or_org.name",
            "val": "-DEPRECATED"
        }
    },
    "page": {
        "type": "number",
        "default": 1,
        "zenodoParam": {
            "type": "searchStr"
        }
    }, 
    "size": {
        "type": "number",
        "default": 30,
        "zenodoParam": {
            "type": "searchStr"
        }
    }
}

function validateFormData(data, schema) {
    const errorMsg = [];
    const params = {};

    for (const [sKey, sVal] of Object.entries(schema)) {

        if (sKey in data) {
            const dVal = data[sKey];

            if (dVal) {
                const dValType = typeof(dVal);
                const sValType = sVal.type;

                if (sValType === 'string') {

                    if (dValType === 'string') {

                        if (sVal.enum) {
                            
                            if (sVal.enum.includes(dVal)) {
                                params[sKey] = dVal;
                            }
                            else {
                                const validVals = sVal.enum.join(', ');
                                errorMsg.push(`"${sKey}" should be one of: ${validVals}`);
                            }

                        }
                        else {
                            params[sKey] = dVal;
                        }
                        
                    }
                    else {
                        params[sKey] = String(dVal);
                    }
                    
                }
                else if (sValType === 'boolean') {

                    if (dVal === "true") {
                        params[sKey] = true;
                    }
                    else if (dVal === "false") {
                        params[sKey] = false;
                    }
                    else {
                        errorMsg.push(`"${sKey}" should be true or false`);
                    }
                    
                }
                else if (sValType === 'number') {
                    const num = Number(dVal);

                    if (!Number.isNaN(num)) {
                        params[sKey] = num;
                    }
                    else {
                        errorMsg.push(`"${sKey}" should be a number`);
                    }
                    
                }

            }

        }
        else {

            if (sVal.required) {
                errorMsg.push(`"${sKey}" is required`);
            }
            else {
                if (sVal.default) {
                    params[sKey] = sVal.default;
                }
            }

        }

    }

    return {
        errorMsg: errorMsg.length ? errorMsg.join('; ') : false,
        params
    }
}

// Author name starts with Agosti
//
//      creators.person_or_org.name:/Agosti.*/ 
//
// or, since Elasticsearch already tokenizes the name into 
// individual components, no need for regular expressions
//
//      creators.person_or_org.name:Agosti
//
//  exact phrase
//
//      creators.person_or_org.name:"Agosti, Donat"
//
// Agosti AND Donat
//
//      creators.person_or_org.name:(Agosti AND Donat)

// Publication date is a full date, so you need a range query.
// all uploads with published from year1 to year2, entire years
// included (note the square brackets on either side)
//
//      publication_date:[1990 TO 1991]
//
// all uploads with published from year1-01-01 to year2-01-01, 
// first date included, last date excluded (note the curly bracket)
//
//      publication_date:[1990 TO 1991}
function data2Url(data, schema) {
    const litsearch = {
        tmp: '',
        srchParams: new URLSearchParams
    }

    const zenodo = {
        tmp: '',
        metadata: [],
        searchStr: [],
        srchParams: []
    }

    const pager = {
        page: 0,
        size: 0
    }

    function makeParams(zenodoParam, dKey, zenodo) {
        const key = zenodoParam.key ?? dKey;
        const val = zenodoParam.val ?? zenodo.tmp;
        const sep = zenodoParam.type === 'q' ? ':' : '=';
        const paramType = zenodoParam.type === 'q' ? 'metadata' : 'searchStr';
        zenodo[paramType].push(`${key}${sep}${val}`);
    }

    for (const [sKey, sVal] of Object.entries(schema)) {
        const dVal = data[sKey];
        const zenodoParam = sVal.zenodoParam;

        if (dVal) {
            const dKey = sKey;
            const sValType = sVal.type;

            if (sValType === 'string') {
                
                // split on space *not* contained within double quotes
                // https://stackoverflow.com/a/16261693
                // 
                // regex explained
                //
                // (?:         # non-capturing group
                //   [^\s"]+   # anything that's not a space or a double-quote
                //   |         #   or…
                //   "         # opening double-quote
                //     [^"]*   # …followed by 0 or more chars not a double-quote
                //   "         # …closing double-quote
                // )+          # one or more of the above described group
                const arr = dVal.match(/(?:[^\s"]+|"[^"]*")+/g);
                
                if (arr.length > 1) {
                    zenodo.tmp = `(${arr.join(' AND ')})`;
                    litsearch.tmp = arr.join(' AND ');
                }
                else {
                    zenodo.tmp = arr[0];
                    litsearch.tmp = arr[0];
                }

                litsearch.srchParams.set(sKey, litsearch.tmp);
                makeParams(zenodoParam, dKey, zenodo);
                
            }
            else if (sValType === 'range') {
                let from;
                let to;

                if (dVal.indexOf('-') > -1) {
                    [ from, to ] = dVal.split(/\s*-\s*/);
                    litsearch.tmp = `${from} TO ${to}`;
                }
                else {
                    from = dVal;
                    to = +from + 1;
                    litsearch.tmp = from;
                }

                litsearch.srchParams.set(sKey, litsearch.tmp);
                zenodo.tmp = `[${from}-01-01 TO ${to}-01-01}`;
                makeParams(zenodoParam, dKey, zenodo);
 
            }
            else if (sValType === 'number') {

                if (dKey === 'page') {
                    pager.page = Number(dVal);
                }
                else if (dKey === 'size') {
                    pager.size = Number(dVal);
                }
  
            }
            else if (sValType === 'boolean') {
  
                if (dVal) {
                    litsearch.srchParams.set(sKey, dVal);
                    makeParams(zenodoParam, dKey, zenodo);
                }

            }

        }
    }

    if (zenodo.metadata.length) {
        const params = `+${zenodo.metadata.join(' +')}`;
        const encodedParams = encodeURIComponent(params);
        zenodo.srchParams.push(`q=${encodedParams}`);
    }
    
    if (zenodo.searchStr.length) {
        zenodo.srchParams.push(`${zenodo.searchStr.join('&')}`);
    }

    return {
        litsearch: {
            base: '',
            qs: litsearch.srchParams.toString()
        },
        zenodo: {
            base: 'https://zenodo.org/api/records',
            qs: zenodo.srchParams.join('&')
        },
        pager
    }
}

async function getJson(url) {
    const fetchOptions = {};

    return await fetch(url, fetchOptions)
        .then(res => res.json())
        .then(result => {
            const hits = result.hits.hits;
            const total = result.hits.total;
            return { hits, total };
        })
}

function armDownloadButton({ button, page, size, total, hits, to, from }) {
    let downloadName = '';
    let downloadValue = '';

    if (size === 'all') {
        downloadName = `rows-${total}.csv`;
        downloadValue = `download all ${niceNum(total)}`;
    }
    else if (total === 1) {
        downloadName = `row.csv`;
        downloadValue = `download this`;
    }
    else if (total <= size) {
        downloadName = `rows-${from}-${to}.csv`;
        downloadValue = `download these ${niceNum(total)}`;
    }
    else {
        downloadName = `rows-${from}-${to}.csv`;
        downloadValue = `download rows ${from}-${to}`;
    }

    const csv = json2csv(hits);
    const createDownloadLink = function(event) {
        const hiddenDownloadLink = document.createElement('a');
        hiddenDownloadLink.id = 'tmp';
        hiddenDownloadLink.target = '_blank';
        hiddenDownloadLink.href = `data:application/csv;charset=utf-8,${csv}`;
        hiddenDownloadLink.download = downloadName;
        hiddenDownloadLink.click();
        button.removeEventListener('click', createDownloadLink);
    }
    
    const tmp = document.getElementById('tmp');
    if (tmp) {
        tmp.remove();
    }

    // https://stackoverflow.com/a/24898081
    button.addEventListener('click', createDownloadLink);
    button.textContent = downloadValue;
}

function niceNum(num) {
    const lookup = {
        '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
        '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
    }

    return lookup[num]
}

function toAndFrom(page, size, total) {
    let from = ((page - 1) * parseInt(size)) + 1;
    if (from > total) from = 1;

    let to = from + parseInt(size) - 1;
    if (to > total) to = total;

    return { to, from }
}

function makeSearchResultStatus({ 
    searchResultStatusTgt,
    total, 
    page, 
    size,
    to,
    from
}) {
    //const { to, from } = toAndFrom(page, size, total);

    let disp;

    if (total === 1) {
        disp = 'one record';
    }
    else if (total < 10) {
        disp = `${niceNum(total)} records`;
    }
    else {
        disp = `${total} records`;
    }

    let searchResult = total === 0
        ? `Nothing found, please try again`
        : `Found ${disp}`;
    
    if (total > size) searchResult += ` — displaying ${from} to ${to}`;

    searchResultStatusTgt.innerHTML = `<h3>${searchResult}</h3>`;
}

function makeTable({ resultTableTgt, hits, total, screen = 'mobile' }) { 
    function makeRow(hit, screen = 'mobile') {
        const authors = hit.metadata.creators;
        let journal = '';

        if (hit.metadata.journal) {
            journal = hit.metadata.journal.title;
        
            if (hit.metadata.journal.volume) {
                journal += `, vol. ${hit.metadata.journal.volume}`;
            }
        
            if (hit.metadata.journal.issue) {
                journal += `, issue ${hit.metadata.journal.issue}`;
            }
        
            if (hit.metadata.journal.pages) {
                journal += `, pp. ${hit.metadata.journal.pages}`;
            }
        }

        const row = [
            authors.map(a => a.name).join('; '),
            hit.metadata.publication_date,
            hit.metadata.title,
            journal,
            `<a href="https://zenodo.org/records/${hit.id}">${hit.id}</a>`,
            `<a href="https://doi.org/${hit.doi}">${hit.doi}</a>`
        ]

        if (screen === 'mobile') {
            return `
            <tr>
                <td>
                    ${row.map(el => '<div>' + el + '</div>').join('\n')}
                </td>
            </tr>
            `
        }
        else {
            return `
            <tr>
                ${row.map(el => '<td>' + el + '</td>').join('\n')}
            </tr>
            `
        }
    }

    const rows = hits.map(hit => makeRow(hit, screen));
    
    function makeHeader(row, screen = 'mobile') {
        if (screen === 'mobile') {
            return '<td>\n' + 
            row.map(el => `<div class="header">${el}</div>`).join('\n') +
            '</td>'
        }
        else {
            return row.map(el => `<th>${el}</th>`).join('\n')
        }
    }

    const row = [ 'Authors', 'Year', 'Title', 'Journal', 'Zenodo URL', 'DOI' ];
    resultTableTgt.innerHTML = `
        <table id="resultsTable">
            <thead>
                <tr>
                    ${makeHeader(row, screen)}
                </tr>
            </thead>
            <tbody>
                ${rows.join('\n')}
            </tbody>
        </table>
    `; 
}

function json2csv(hits) {
    const data = hits.map(hit => {
        const authors = hit.metadata.creators.map(a => a.name).join(', ');

        let journal = '';
        let volume = '';
        let issue = '';
        let pages = '';

        if (hit.metadata.journal) {
            journal = hit.metadata.journal.title;

            if (hit.metadata.journal.volume) {
                volume = hit.metadata.journal.volume;
            }
    
            if (hit.metadata.journal.issue) {
                issue = hit.metadata.journal.issue;
            }
    
            if (hit.metadata.journal.pages) {
                pages = hit.metadata.journal.pages;
            }
        }

        return [
            authors,
            hit.metadata.publication_date,
            hit.metadata.title,
            journal,
            volume,
            issue,
            pages,
            `https://zenodo.org/records/${hit.id}`,
            hit.doi
        ].map(el => {
            if (el === null) {
                return ''
            }
            else if (el.indexOf(',') > -1) {
                return `"${el}"`
            }
            else {
                return el
            }
        })
    })

    const headers = ['Authors','Year','Title','Journal','Vol.','Issue','Pages','Zenodo URL','DOI'];
    data.unshift(headers);
    return encodeURI(data.map(row => row.join(',')).join('\n'));
}

function getParamsFromUrl(searchParams, schema) {    
    const errorMsg = [];
    const params = {};

    for (const [key, val] of Object.entries(schema)) {
        
        if (searchParams.has(key)) {
            let spVal = searchParams.get(key);

            if (val.enum) {

                if (val.enum.includes(spVal)) {
                    params[key] = spVal;
                }
                else {
                    errorMsg.push(`"${key}" should be one of "${val.enum.join('", "')}")`);
                }
                
            }
            else if (val.type === 'number') {
                spVal = Number(spVal);

                if (typeof(spVal) === 'number' && !isNaN(spVal)) {
                    params[key] = spVal;
                }
                else {
                    errorMsg.push(`"${key}" should be a number`);
                }

            }
            else if (val.type === 'boolean') {
                spVal = Boolean(spVal);
                params[key] = spVal;
            }
            else {
                params[key] = spVal;
            }

        }
        else {
            
            if (val.isRequired) {
                errorMsg.push(`"${key}" is required`);
            }
            else if ('default' in val) {
                params[key] = val.default;
            }

        }

    }
    
    return { errorMsg: errorMsg.join('; '), params }
}

function hide(elements) {
    if (Array.isArray(elements)) {
        elements.forEach(element => {
            if (!element.classList.contains('hidden')) {
                element.classList.add('hidden');
            }
        })
    }
    else {
        if (!elements.classList.contains('hidden')) {
            elements.classList.add('hidden');
        }
    }
}

function show(elements) {
    if (Array.isArray(elements)) {
        elements.forEach(element => {

            if (element.classList.contains('hidden')) {
                element.classList.remove('hidden');
            }

        })
    }
    else {

        if (elements.classList.contains('hidden')) {
            elements.classList.remove('hidden');
        }

    }
}

function updatePagerLinks(page, urlBase, qs, size, pagerLinks) {
    const prevPage = page === 1 ? 1 : page - 1;
    const prevHref = `${urlBase}?${qs}&page=${prevPage}&size=${size}`;
    const nextPage = parseInt(page) + 1;
    const nextHref = `${urlBase}?${qs}&page=${nextPage}&size=${size}`;

    const prev = pagerLinks.querySelector("#prev");
    prev.href = prevHref;
    prev.dataset.page = prevPage;

    const next = pagerLinks.querySelector("#next");
    next.href = nextHref;
    next.dataset.page = nextPage;
}

async function getResults({ 
    params,
    litsearchContainer,
    resultTgt,
    searchResultStatusTgt,
    resultTableTgt,
    formLinks,
    screen
}) {
    //const { errorMsg, validatedParams } = validateFormData(params, formSchema);

    const urls = data2Url(params, urlSchema);
    const page = urls.pager.page;
    const size = urls.pager.size;
    const pagerQs = `page=${page}&size=${size}`;
    const zenodoUrlPaged = `${urls.zenodo.base}?${urls.zenodo.qs}&${pagerQs}`;
    const litsearchQsPaged = `${urls.litsearch.qs}&${pagerQs}`;
    const { hits, total } = await getJson(zenodoUrlPaged);
    const zenodoUrlAll = `${urls.zenodo.base}?${urls.zenodo.qs}&size=${total}`;

    // Show results
    const { to, from } = toAndFrom(page, size, total);
    makeSearchResultStatus({ searchResultStatusTgt, total, page, size, to, from });
    makeTable({ 
        resultTableTgt, 
        hits, 
        total, 
        screen
    });
    updatePagerLinks(page, urls.litsearch.base, urls.litsearch.qs, size, formLinks);
    armDownloadButton({
        button: formLinks.querySelector("#download-page"),
        page,
        size,
        total,
        hits,
        to,
        from
    });
    history.pushState({}, '', `?${litsearchQsPaged}`);
    show([resultTgt]);
    show([resultTableTgt, formLinks]);

    const linksPager = formLinks.querySelectorAll(".litsearch-pager");
    linksPager.forEach(link => link.addEventListener('click', async function(event) {
        event.stopPropagation();
        event.preventDefault();

        // Conduct search
        const link = new URL(event.target.href);
        const urlParams = link.searchParams;
        const { errorMsg, params } = getParamsFromUrl(urlParams, urlSchema);

        if (errorMsg) {
            searchResultStatusTgt.innerHTML = errorMsg;
            show([resultTgt]);
            hide([resultTableTgt, formLinks]);
        }
        else {
            const urls = data2Url(params, urlSchema);
            const page = urls.pager.page;
            const size = urls.pager.size;
            const pagerQs = `page=${page}&size=${size}`;
            const zenodoUrlPaged = `${urls.zenodo.base}?${urls.zenodo.qs}&${pagerQs}`;
            const litsearchQsPaged = `${urls.litsearch.qs}&${pagerQs}`;
            const { hits, total } = await getJson(zenodoUrlPaged);
            const zenodoUrlAll = `${urls.zenodo.base}?${urls.zenodo.qs}&size=${total}`;

            // Show results
            const { to, from } = toAndFrom(page, size, total);
            makeSearchResultStatus({ searchResultStatusTgt, total, page, size, to, from });
            makeTable({ resultTableTgt, hits, total, screen });
            updatePagerLinks(page, urls.litsearch.base, urls.litsearch.qs, size, formLinks);
            armDownloadButton({
                button: formLinks.querySelector("#download-page"),
                page,
                size,
                total,
                hits,
                to,
                from
            });
            history.pushState({}, '', `?${litsearchQsPaged}`);
        }

    }));
    
    litsearchContainer.open = false;
}

function testData2Url() {
    const formData = {
        communities: 'batlit',
        authors: 'Montani',
        year: '2000-2002',
        title: 'article title',
        journal: '"Check List"',
        volume: '1',
        issue: '2b',
        includeDeprecated: "true",
        page: 1,
        size: 30
    }

    const { errorMsg, validatedParams } = validateFormData(formData, formSchema);

    if (!errorMsg) {
        console.log(validatedParams);
        const urls = data2Url(validatedParams, urlSchema);
        console.log(urls);
    }
}

function testGetParamsFromUrl() {
    const search = '?communities=foo&authors=Montani&size=30';
    const { errorMsg, params } = getParamsFromUrl(search, urlSchema);
    console.log(errorMsg);
    console.log(params);
}

//testGetParamsFromUrl();
export { getParamsFromUrl, validateFormData, hide, show, getResults, formSchema, urlSchema }