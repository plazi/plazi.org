let searchVisible = true; 

// allow us to delay loading json data unless search activated
let firstRun = true;

// targets the <ul>
const list = document.getElementById('searchResults'); 

// first child of search list
let first = list.firstChild; 

// last child of search list
let last = list.lastChild; 

// input box for search
const maininput = document.getElementById('searchInput'); 

// Did we get any search results?
let resultsAvailable = false; 

if(firstRun) {

    // loads our json data and builds the search index
    loadSearch(); 

    // let's never do this again
    firstRun = false; 
}

const stopWords = new Set(['and', 'or', 'to', 'in', 'a', 'the', /* ...and more */ ]);

// Perform custom term processing (here discarding stop words and downcasing)
let miniSearch = new MiniSearch({

    // fields to index for full-text search
    fields: ['contents'],

    processTerm: (term, _fieldName) => stopWords.has(term) ? null : term.toLowerCase(),

    searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2
    },

    // fields to return with search results
    storeFields: ['title', 'contents', 'permalink'] 
});

// ==========================================
// execute search as each character is typed
//
document.getElementById("searchInput").onkeyup = function(e) { 
    executeSearch(this.value);
}

function fetchJSONFile(path, callback) {
    const httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState === 4) {
            if (httpRequest.status === 200) {
                const data = JSON.parse(httpRequest.responseText);
                if (callback) callback(data);
            }
        }
    };

    httpRequest.open('GET', path);
    httpRequest.send(); 
  }

function loadSearch() {
    fetchJSONFile('/index.json', function(data){
        miniSearch.addAll(data);
    });
}

function executeSearch(term) {
  
    // the actual query being run using miniSearch.js
    let results = miniSearch.search(term); 
    
    // our results bucket
    let searchitems = ''; 

    // no results based on what was typed into the input box
    if (results.length === 0) { 
        resultsAvailable = false;
    } 

    // build our html
    else {

        // https://stackoverflow.com/a/36744732/183692
        // dedupe the results based on permalink
        results = results.filter((value, index, self) =>
            index === self.findIndex((t) => (
                t.title === value.title
            ))
        );

        //console.log(`results" ${results.length}`)

        const snippetLength = 400;
        const side = snippetLength / 2;

        results.forEach(item => {

//         contents: "…"
//         id: 32
//         match: Object { digitize: (1) […] }
//         permalink: "http://localhost:1313/posts/bhl-and-plazi-partnership/"
//         score: 1.7846304978818683
//         terms: Array [ "digitize" ]
//         title: "BHL and Plazi partnership"

        //const item = i.item;
        const terms = item.terms;
        const permalink = item.permalink;
        const title = item.title;
        //let content = item.contents.substring(0, 200);
        let content = item.contents;

        terms.forEach(term => {
            const re = new RegExp(`(${term})`, 'i');
            const matchInfo = content.match(re);
            const left = matchInfo.index - side;
            const right = matchInfo.index + term.length + side;
            content = content.substring(left, right);
            //content = content.replace(re, '<span class="hilite">$1</span>');
            content = content.replace(re, '<mark>$1</mark>');
        })
        
  
        searchitems = searchitems + 
            `<li>
            <a href="${permalink}" tabindex="0">
                <h2 class="title">${title}</h2>
                <p>${content}…</p>
            </a>
            </li>`
        });
  
        resultsAvailable = true;
    }
  
    document.getElementById("searchResults").innerHTML = searchitems;
    if (results.length > 0) {

        // first result container — used for checking against keyboard up/down location
        first = list.firstChild.firstElementChild; 

        // last result container — used for checking against keyboard up/down location
        last = list.lastChild.firstElementChild; 
    }
}