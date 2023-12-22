/**
 * @param {string} apiEndpoint
 * @returns body json if success
 */
async function fetchFromApi(apiEndpoint) {
  const response = await fetch(apiEndpoint);
  if (response.status !== 200) {
    throw new Error('could not successfully fetch from API');
  }

  return await response.json();
}

/**
 * @param {string} labelId
 * @returns element if exists
 */
function getLabel(labelId) {
  const labelElement = document.getElementById(labelId);
  if (!labelElement) {
    throw new Error(`element with id ${labelId} does not exist on page`);
  }

  return labelElement;
}

/**
 * @param {string} apiEndpoint
 * @param {string} property
 * @returns property value if exists
 */
async function fetchAndGetBodyProperty(apiEndpoint, property) {
  const body = await fetchFromApi(apiEndpoint);

  if (!body[property]) {
    throw new Error(`property ${property} does not exist in JSON body`);
  }

  return body[property];
}

/**
 * @param {string} apiEndpoint
 * @param {string} property
 * @param {string} labelId
 */
async function setLabelValueFromApi(apiEndpoint, property, labelId) {
  const labelElement = getLabel(labelId);

  labelElement.innerHTML = (
    await fetchAndGetBodyProperty(apiEndpoint, property)
  ).toLocaleString();
}

async function setTotalTaxonomicTreatments() {
  const totalTaxonomicTreatments = await fetchAndGetBodyProperty(
    'https://tb.plazi.org/GgServer/srsStaticStats/pubAndTreatmentCountsWithStubs.json',
    'DocCount'
  );

  const labelElement = getLabel('totalTaxonomicTreatments');
  labelElement.innerHTML = totalTaxonomicTreatments.toLocaleString();

  const bubbleLabelElement = getLabel('bubbleTotalTaxonomicTreatments');
  const roundedTotalTaxonomicTreatmentsInK = Math.round(
    totalTaxonomicTreatments / 1000
  );
  bubbleLabelElement.innerHTML = `${roundedTotalTaxonomicTreatmentsInK}K`;
}

async function setTotalTaxa() {
  const body = await fetchFromApi(
    'https://tb.plazi.org/GgServer/srsStats/stats?outputFields=tax.name+tax.rank&groupingFields=tax.rank&FP-tax.rank=species&format=JSON'
  );
  if (!body.data || !(body.data[0] ? body.data[0]['TaxName'] : undefined)) {
    throw new Error('could successfully fetch taxa from API');
  }

  const labelElement = getLabel('totalTaxa');
  labelElement.innerHTML = body.data[0].TaxName.toLocaleString();
}

async function setTotalMaterialsCitations() {
  await setLabelValueFromApi(
    'https://tb.plazi.org/GgServer/srsStaticStats/materialsCitationCount.json',
    'MatCitId',
    'totalMaterialsCitations'
  );
}

try {
  setTotalTaxonomicTreatments();
  setTotalTaxa();
  setTotalMaterialsCitations();
} catch (error) {
  console.error(error);
}
