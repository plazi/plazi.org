const search = function(e) {
    const q = document.getElementById('q')
    const search_tb_results = document.getElementById('search_tb_results')
    //const tb = 'https://tb.plazi.org/GgServer/search?fullText.matchMode=prefix&fullText.ftQuery=' + q.value
    const z = 'https://test.zenodeo.org/v3/treatments?q=' + q.value

    fetch(z)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('HTTP error, status = ' + response.status);
            }
            return response.json();
        })
        .then(function(response) {
            //console.log(response)
            let res = '<h2>Treatments search results</h2>'
            response.item.records.forEach(r => {
                res += `<details>
                    <summary>${r.treatmentTitle}</summary>
                    <p>${r.articleTitle}, ${r.journalTitle}</p>
                </details>`
            })
            search_tb_results.innerHTML = res
        })

    e.stopPropagation()
    e.preventDefault()
}

window.onload = function(e) {
    const searchBtn = document.getElementById('searchBtn')
    searchBtn.addEventListener('click', search)
}()
