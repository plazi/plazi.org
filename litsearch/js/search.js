function makeUrl({
    communities,
    authors,
    year,
    title,
    journal,
    volume,
    issue,
    page = 1,
    size = 30
}) {
    if (!communities) {
        communities = 'batlit';
    }

    let urlBase = 'https://zenodo.org/api/records';
    let qs = `communities=${communities}`;
    const searchStr = [];
    const metadata = [];
    
    if (authors) {
        authors = authors.split(/\s+/);
        let creators = '';

        if (authors.length > 1) {

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
            if (authors.query_mod === 'all') {
                creators = `(${authors.names.join(' AND ')})`;
            }

            // Agosti OR Donat
            //
            //      creators.name:(Agosti Donat)
            else if (authors.query_mod === 'any') {
                creators = `(${authors.names.join(' OR ')})`;
            }
            else {
                creators = `(${authors.join(' ')})`;
            }
        }
        else {
            creators = `(${authors[0]})`;
        }

        metadata.push(`creators.person_or_org.name:${creators}`);

    }
    
    if (year) {
        let publication_date = '';

        //Publication date is a full date, so you need a range query.
        let from;
        let to;

        if (year.indexOf('-') > -1) {

            // all uploads with published from year1 to year2, entire years
            // included (note the square brackets on either side)
            //
            //      publication_date:[1990 TO 1991]
            [from, to] = year.split(/\s*-\s*/);
            to = `${to}-12-31`;
            publication_date = `[${from} TO ${to}]`;
        } 
        else {

            // all uploads with published from year1-01-01 to year2-01-01, 
            // first date included, last date excluded (note the curly bracket)
            //
            //      publication_date:[1990 TO 1991}
            from = year;
            to = +year + 1;
            publication_date = `[${from} TO ${to}}`;
        }

        metadata.push(`publication_date:${publication_date}`);
    }
    
    if (title) {
        metadata.push(`title:(${title})`);
    }

    if (journal) {
        searchStr.push(`journal.title:(${journal})`);

        if (volume) {
            searchStr.push(`journal.volume:(${volume})`);
        }

        if (issue) {
            searchStr.push(`journal.issue:(${issue})`);
        }
    }
    
    let q;

    if (metadata.length) {
        q = `+metadata.${metadata.join(' +metadata.')}`;
    }
    
    if (searchStr.length) {
        q = `+${searchStr.join('&')}`;
    }

    if (q) {
        qs += `&q=${encodeURIComponent(q)}`;
    }

    return { 
        urlBase, 
        qs,
        qsPaged: `${qs}&page=${page}&size=${size}` 
    };
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

function armDownloadButton({ button, page, size, hits }) {
    let downloadName = '';

    if (size === 'all') {
        downloadName = `rows-${size}.csv`;
    }
    else {
        const from = ((page - 1) * size) + 1;
        const to = from + size - 1;
        downloadName = `rows-${from}-${to}.csv`;
    }

    const csv = json2csv(hits);

    // https://stackoverflow.com/a/24898081
    button.addEventListener('click', function(event) {
        const hiddenElement = document.createElement('a');
        hiddenElement.href = `data:application/csv;charset=utf-8,${csv}`;
        hiddenElement.target = '_blank';
        hiddenElement.download = downloadName;
        hiddenElement.click();
    });
}

function niceNum(num) {
    const lookup = {
        '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
        '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine'
    }

    return lookup[num]
}

function makeSearchResultStatus({ 
    searchResultStatusTgt,
    total, 
    page, 
    size 
}) {
    let from = ((page - 1) * parseInt(size)) + 1;
    if (from > total) from = 1;

    let to = from + parseInt(size) - 1;
    if (to > total) to = total;

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
    const data = [
        ['Authors','Year','Title','Journal','Zenodo URL','DOI']
    ]

    hits.forEach(hit => {
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

        data.push([
            `"${authors.map(a => a.name).join('; ')}"`,
            `"${hit.metadata.publication_date}"`,
            `"${hit.metadata.title}"`,
            `"${journal}"`,
            `https://zenodo.org/records/${hit.id}`,
            hit.doi
        ]);
    });

    return encodeURI(data.map(row => row.join(',')).join('\n'));
}

function getParamsFromUrl() {
    const loc = window.location;
    const qs = new URLSearchParams(loc.search);
    
    // Valid params and their default values
    const validParams = {
        communities: ['batlit', 'Taxodros', 'BHL-SIBiLS'],
        authors: '', 
        year: '', 
        title: '', 
        journals: '', 
        volume: '', 
        issue: '', 
        page: 1, 
        size: 30
    }

    let errorMsg = [];
    const params = {};

    if (qs) {
        for (const [key, value] of qs) {
            if (key in validParams) {
                if (Array.isArray(validParams[key])) {
                    if (validParams[key].includes(value)) {
                        params[key] = value;
                    }
                }
                else if (typeof(validParams[key]) === 'number') {
                    if (value) {
                        if (!isNaN(value)) {
                            params[key] = value;
                        }
                        else {
                            errorMsg.push(`"${key}" should be a number`);
                        }
                    }
                    else {
                        params[key] = validParams[key];
                    }
                }
                else {
                    params[key] = value;
                }
            }
        }
    }

    if (Object.keys(params).length) {
        if (!('communities' in params)) {
            errorMsg.push('a valid "community" is required');
        }

        if (!('page' in params)) {
            params.page = validParams.page;
        }

        if (!('size' in params)) {
            params.size = validParams.size;
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

async function getResults(params) {
    const { 
        communities, 
        authors, 
        year, 
        title, 
        journals, 
        volume, 
        issue, 
        page, 
        size,
        resultTgt,
        searchResultStatusTgt,
        resultTableTgt,
        pagerLinks,
    } = params;

    const { urlBase, qs, qsPaged } = makeUrl({ 
        communities, 
        authors, 
        year, 
        title, 
        journals, 
        volume, 
        issue, 
        page, 
        size 
    });
    const urlPaged = `${urlBase}?${qsPaged}`;
    const { hits, total } = await getJson(urlPaged);
    const urlAll = `${urlBase}?${qs}&size=${total}`;

    // Show results
    makeSearchResultStatus({ searchResultStatusTgt, total, page, size });
    makeTable({ 
        resultTableTgt, 
        hits, 
        total, 
        screen
    });
    updatePagerLinks(page, urlBase, qs, size, pagerLinks);
    armDownloadButton({
        button: document.getElementById("download-page"),
        page,
        size,
        hits
    });
    show([resultTgt]);
    show([resultTableTgt, formLinks]);

    const linksPager = document.querySelectorAll(".litsearch-pager");
    linksPager.forEach(link => link.addEventListener('click', async function(event) {
        event.stopPropagation();
        event.preventDefault();

        // Conduct search
        const page = event.target.dataset.page;
        const urlPaged = event.target.href;
        const { hits, total } = await getJson(urlPaged);

        // Show results
        makeSearchResultStatus({ searchResultStatusTgt, total, page, size });
        makeTable({ resultTableTgt, hits, total, screen });
        updatePagerLinks(page, urlBase, qs, size, pagerLinks);
        armDownloadButton({
            button: document.getElementById("download-page"),
            page,
            size,
            hits
        });
    }));
    
    litsearchContainer.open = false;
    history.pushState({}, '', `?${qs}`);
}

export { getParamsFromUrl, hide, show, getResults }