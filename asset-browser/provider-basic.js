/*
  This file is meant to be used alongside asset-browser.html only.
  It requires the JS files already imported in that HTML in the ORDER that
  they were imported. This file should be last.
*/

// Debugging
window.onerror = (error) => { console.log(error); alert(error.message) }

$(document).ready(() => {
  const asset_browser = new AssetBrowser(
    // This is the authenticationCallback. It returns a promise with 
    // valid API credentials
    async () => {
      return {
        partner_id: '',
        auth_signature: '',
        auth_expires: 0
      }
    },
    {
      search: true,
      alignments: true,
      topics: true,
      artifacts: false,
      concepts: true,
      facets: [
        {
          api_facet_key: 'asset_types',
          api_attribute_key: 'asset_type',
          api_code: 'asset_type',
          api_descr: 'asset_type',
          html_name: 'Asset Type',
          html_class: 'types'
        },
        {
          api_facet_key: 'disciplines.subjects',
          api_attribute_key: 'disciplines.subjects.guid',
          api_code: 'guid',
          api_descr: 'descr',
          html_name: 'Subject',
          html_class: 'subjects'
        }
      ]
    }
  )
})