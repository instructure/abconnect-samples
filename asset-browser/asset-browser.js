const BASE_URL = 'https://api.academicbenchmarks.com/rest/v4.1'

class AssetBrowser {

  config
  authentication
  authenticationCallback

  pictureCallback

  pager
  sdk

  include_predicted_alignments

  filters
  extraFilters
  extraFields

  extraItemAttributes

  current_list_style
  current_page
  page_size

  // @params 
  //  Authentication: A async callback that returns an object with the following
  //    - partner_id
  //    - auth_signature
  //    - auth_expires
  //
  //  Config: An object with any of the following
  //    - search: a boolean to enable text search
  //    - alignments: a boolean to enable saerching by alignment
  //    - topics: a boolean to enable searching by topic
  //    - concepts: a boolean to enable searching by concepts
  //    
  //    - include_predicted_alignments: Include alignments with a disposition
  //      of predicted in the alignment widget and when zooming into an asset
  //
  //    - facets: An array of objects with all of the following
  //      - api_facet_key:     The name of the facet (in meta.facets.facet)
  //      - api_attribute_key: The name of the attribute (in data.attributes)
  //      - api_descr:         The field in meta.facets.details.data to show to the user in the filter list
  //      - api_code:          The code to use to search the API
  //      - html_name:         The header to show the user in the filter pane
  //      - html_class:        The class to use when creating the facet DOM node
  //    
  //    - extraFields: A comma-separated list of fields to include. Ensure you
  //      inlucde ALL the fields you plan to use in the following 2 config opts
  //
  //    - extraFilters: A comma-separated list of filters to ALWAYS include
  //
  //    - extraItemAttributes: An array of objects with the following fields.
  //      These will be shown when zooming into an asset. Useful for displaying
  //      custom asset properties
  //        - attribute_name: The name of the attribute (for the UI)
  //        - attribute_key:  The field in the API to use to get the attribute
  //          list. `data.attributes.` is implied at the beginning 
  //        - attribute_inner_key: (optional) If present, use as a key on the
  //          list from attribute_key (for when said list is a list of objects)
  //
  //    - extraItemRelationships: An array of objects with the following fields.
  //      These will be shown when zooming into an asset. Used for displaying
  //      relationships to your asset (like alignment donors)
  //        - relationship_name: The name of the relationship (for the UI)
  //        - relationship_type: The relationship target type suitable for
  //          fields[{--HERE--}]. For example, alignment_donors -> asset
  //        - relationship_key:  The field in the API you're interested in
  //
  //    - pictureCallback: A callback that recieves asset data (from the API)
  //      and returns a URL to a picture. Defaults to the Certica Logo
  //
  //    - renderCallback: A callback that is executed after each results
  //      render. Useful for modifying the look & feel of the results
  constructor(authenticationCallback, config) {
    this.config = config
    this.authenticationCallback = authenticationCallback

    // basic/expand/grid, set by the icons in the UI
    this.current_list_style = 'grid'

    // Default page size
    this.page_size = 25

    this.filters = []
    this.extraFilters = config.extraFilters

    this.include_predicted_alignments = !!config.include_predicted_alignments

    this.extraFields = config.extraFields || ''
    this.extraItemAttributes = config.extraItemAttributes || []
    this.extraItemRelationships = config.extraItemRelationships || []

    this.renderCallback = config.renderCallback || (() => {})

    this.sdk = new ABAPI(
      this.authenticationCallback
    );

    // Default pictureCallback is to return the Certica logo
    this.pictureCallback = config.pictureCallback
    if (!this.pictureCallback) {
      this.pictureCallback = (asset) => {
        return 'img/logo.png'
      }
    }

    this.initialize_filters()
      .then(() => {
        this.search()
      })
      .catch(this.handle_api_errors)
  }

  // Initialize the asset filters based on the user config
  async initialize_filters() {
    // Ensure we are authenticated
    this.authentication = await this.authenticationCallback();

    if (this.config.search) {
      await this.initialize_search_filter()
    }
    if (this.config.alignments) {
      await this.initialize_alignment_filter()
    }
    if (this.config.facets) {
      await this.initialize_facet_filters()
    }
    if (this.config.artifacts) {
      await this.initialize_artifact_filter()
    }
    if (this.config.topics) {
      await this.initialize_topic_filter()
    }
    if (this.config.concepts) {
      await this.initialize_concept_filter()
    }

  }

  async initialize_artifact_filter() {
    // Initialize a cloud filter pointed at Artifacts
    // Same properties as the browser config's facet[] properties, plus api_context
    let artifactFilter = new CloudFilter(this, {
      html_class:        'artifactsCloud',
      html_name:         'Artifacts',
      api_facet_key:     'artifacts.artifact_type',
      api_attribute_key: 'artifacts.artifact_type',
      api_descr:         'descr',
      api_code:          'guid',

      // Controls hovertext
      api_context:       'parent_descr' 
    })

    // Append the initial HTML for the filter
    $('.filters').append(
      await artifactFilter.initialize_filter()
    )

    artifactFilter.refresh_counts(this)

    // Attach to the filters property so we know to refresh it
    this.filters.push(artifactFilter)
  }

  async initialize_topic_filter() {
    
    // Initialize a cloud filter pointed at Topics
    // Same properties as the browser config's facet[] properties, plus api_context
    let topicFilter = new CloudFilter(this, {
      html_class:        'topicsCloud',
      html_name:         'Topics',
      api_facet_key:     'topics',
      api_attribute_key: 'topics',
      api_descr:         'descr',
      api_code:          'guid',

      // Controls hovertext
      api_context:       'parent_descr' 
    })

    // Append the initial HTML for the filter
    $('.filters').append(
      await topicFilter.initialize_filter()
    )

    topicFilter.refresh_counts(this)

    // Attach to the filters property so we know to refresh it
    this.filters.push(topicFilter)
  }

  async initialize_concept_filter() {
    
    // Initialize a cloud filter pointed at Concepts
    // Same properties as the browser config's facet[] properties, plus api_context
    let conceptFilter = new CloudFilter(this, {
      html_class:        'conceptsCloud',
      html_name:         'Concepts',
      api_facet_key:     'concepts',
      api_attribute_key: 'concepts',
      api_descr:         'descr',
      api_code:          'guid',

      // Controls hovertext
      api_context:       'context' 
    })

    // Append the initial HTML for the filter
    $('.filters').append(
      await conceptFilter.initialize_filter()
    )

    conceptFilter.refresh_counts()

    // Attach to the filters property so we know to refresh it
    this.filters.push(conceptFilter)
  }

  async initialize_alignment_filter() {
    const alignment = new AlignFilter(this, {
      predicted: this.include_predicted_alignments
    });
    $('.filters').append(await alignment.initialize_filter())

    this.filters.push(alignment)
  }

  async initialize_facet_filters() {
    let requested_facet_list = this.config.facets.map(facet => facet.api_facet_key).join(',')

    const enforced_fitler = this.extraFilters ? `&filter[assets]=(${this.extraFilters})` : ''
    // Use the API to determine valid values/counts for each facet (filter option)
    let facets = (await this.sdk.get(`${BASE_URL}/assets?limit=0&facet=${requested_facet_list}${enforced_fitler}`)).meta.facets

    // Sort the facets (by their index in facet_config) so they're consistent in the UI
    facets = facets.sort( (a,b) => 
      this.config.facets.findIndex(config => config.api_facet_key == a.facet) - 
      this.config.facets.findIndex(config => config.api_facet_key == b.facet)
    )

    // Create a DOM element to put the filters
    let $facet_area_html = $(`<div class='facet_area'></div>`)

    // Iterate over the facets from the config and create their HTML
    for await (const facet of facets){
      // Create a new facet filter based on its config
      const facet_filter = new FacetFilter(
        this,

        // Current facet config
        this.config.facets
          .filter((facet_config) => facet_config.api_facet_key == facet.facet)
          [0]
      )
      this.filters.push(facet_filter)

      let $facet_filter_html = await facet_filter.initialize_filter(facet)

      // Attach our now-compete facet filter node the facet list
      $facet_area_html.append($facet_filter_html)
    }

    // When a filter criteria is changed, update the asset search & counts accordingly
    $facet_area_html.find('input[type=checkbox]').click(
      () => { this.search() }
    )

    // Attach our now-complete filter to the DOM.
    $('.filters').append($facet_area_html)
  }

  // Attach the search box to the filter pane
  async initialize_search_filter() {
    const search = new SearchFilter(this, {})
    $('.filters').append(await search.initialize_filter())

    // Save for later
    this.filters.push(search)
  }

  async refresh_filter_counts() {
    // Iterate over our list of configured facet filters
    for (const filter of this.filters){
      filter.refresh_counts(this)
    }

  }

  // Return a string in the form of (filter[assets]=...) based on the
  // filters you selected on the left
  async get_filters(skip_facet_key) {
    const filters = this.filters
      // If the consumer asked us to skip a facet, do so
      .filter(filter => filter.config.api_attribute_key != skip_facet_key)
      // Turn the filter object into an api-compatible filter string
      .map(filter => filter.build_filter())
      // Add additional filters provided in the constructor (we use concat so 
      // we can continue our chain)
      .concat([this.extraFilters] || [''])
      // Remove empty strings
      .filter(filter => filter !== '')
      // Join together using AND's
      .join(' and ')

    // If there are filters to return, do so
    if (filters.length) {
      return `filter[assets]=(${filters})`
    }

    return ''
  }

  async get_fields(){
    let fields = 'title,disciplines.subjects,education_levels.grades,client_id'

    if(this.extraFields){
      fields = fields + ',' + this.extraFields
    }

    return `fields[assets]=${fields}`
  }

  // This is ran every time you need a NEW pager (ie, you change the filters)
  async search() {
    let filters = await this.get_filters()

    // TODO: set fields to only needed
    const pager = this.sdk.pager(`${BASE_URL}/assets?${filters}&${await this.get_fields()}&limit=${this.page_size}`)

    // Refresh our filter counts with our new query
    this.refresh_filter_counts()

    // rebind the click handlers to call the new pager variable
    $('.nextPage')
      .off('click')
      .click(() => {
        this.render_results(pager.next('next'))
      })

    $('.prevPage')
      .off('click')
      .click(() => {
        this.render_results(pager.next('prev'))
      })

    $('.firstPage')
      .off('click')
      .click(() => {
        this.render_results(pager.next('first'))
      })

    $('.lastPage')
      .off('click')
      .click(() => {
        this.render_results(pager.next('last'))
      })

    // Rebind the 'list style' and 'page size' UI switches to the appropriate action and show
    $('.page25').off('click').click(async () => {
        await this.set_page_size(25)
        this.search()
      })
      .css('visibility', 'visible')

    $('.page50').off('click').click(async () => {
        await this.set_page_size(50)
        this.search()
      })
      .css('visibility', 'visible')

    $('.page100').off('click').click(async () => {
        await this.set_page_size(100)
        this.search()
      })
      .css('visibility', 'visible')

    $('.view_basic').off('click').click(async () => {
      this.set_list_style('basic')
      this.render_results()
    })
    $('.view_expand').off('click').click(async () => {
      this.set_list_style('expand')
      this.render_results()
    })
    $('.view_grid').off('click').click(async () => {
      this.set_list_style('grid')
      this.render_results()
    })

    // Get the first page
    this.render_results(pager.next())
  }

  // UI Controls for how we display the resulting assets
  async set_page_size(size) {
    this.page_size = size
    $(`.pageSize`).children().removeClass('active')
    $(`.page${size}`).addClass('active')
  }

  async set_list_style(style){
    this.current_list_style = style
    $('.viewLayout').children().removeClass('active')
    $(`.viewLayout .view_${style}`).addClass('active')
  }

  /* Render Methods */
  async render_results(result_promise) {
    // First, we grey out the asset list to show the user something is happening
    $('.assetList').addClass('disabledDiv')

    // If we are rendering a new result (we have a promise), await the API call
    if (result_promise) {
      try{
        this.current_page = (await result_promise).value
      }
      catch (error) {
        this.handle_api_errors(error)
        return
      }
    }

    // Render the current page
    let results = this.current_page

    // Render the correct list based on the current choice
    if (this.current_list_style == 'basic') {
      await this.render_basic_list(results.data)
    }
    else if (this.current_list_style == 'expand') {
      await this.render_expand_list(results.data)
    }
    else if (this.current_list_style == 'grid') {
      await this.render_tile_list(results.data)
    }
    else {
      alert('Invalid list style!')
    }

    // Show/Hide the paging buttons based on what is available
    $('.nextPage').css('visibility', results.links.next ? 'visible' : 'hidden')
    $('.prevPage').css('visibility', results.links.prev ? 'visible' : 'hidden')
    $('.firstPage').css('visibility', results.links.first ? 'visible' : 'hidden')
    $('.lastPage').css('visibility', results.links.last ? 'visible' : 'hidden')

    // Update the page counter
    $('.position').text(`Page ${1 + (results.meta.offset / results.meta.limit)} of ${Math.ceil(results.meta.count / results.meta.limit)}`)

    // Exec the user-provided callback
    this.renderCallback(this.current_page)

    // Re-enable (un-grey) the asset list
    $('.assetList').removeClass('disabledDiv')
  }

  async render_basic_list(data) {
    let $asset_list = $('.assetList')

    $asset_list.empty()

    // Set the appropriate classes for basic list
    $asset_list.attr('class', 'assetList mdc-list mdc-list--two-line my-border-list')

    data.forEach(asset => {
      const subjects = asset.attributes.disciplines.subjects.map(subject => subject.descr).join(', ')
      const grades = asset.attributes.education_levels.grades.map(grade => grade.descr).join(', ')
      
      const item = $(`
        <li class="mdc-list-item">
          <span class="mdc-list-item__text">
            <div class="titleRow">
              <div class="clientID">${asset.attributes.client_id}</div>
              <div class="ABTitle" value="${asset.id}" title="${asset.attributes.title}">${asset.attributes.title}</div>
            </div>
            <span class="mdc-list-item__text__secondary" title="${subjects} ${grades}">
              <div class="ABSubject">${subjects}</div>
              <div class="ABGrade">${grades}</div>
            </span>
          </span>
          <a 
            href="#"
            class="mdc-list-item__end-detail material-icons"
            aria-label="More Information"
            title="More Information"
            value="${asset.id}"
          > info </a>
        </li>
      `)
      $asset_list.append(item)

      // Set up the click handler for activating the modal
      const modal_title = asset.attributes.title + ` (${asset.attributes.client_id})` 
      item.find('a[aria-label="More Information"]').click(event => {
        const guid = $(event.target).attr('value')
        this.render_item_modal(guid, modal_title)
      })
    })
  }

  async render_expand_list(data) {
    let $asset_list = $('.assetList')

    $asset_list.empty()

    // Set the appropriate classes for basic list
    $asset_list.attr('class', 'assetList mdc-list mdc-list--two-line my-border-list')

    data.forEach(asset => {
      $asset_list.append(`
        <details data-id='${asset.id}'>
          <summary>
             <ul>
               <li class="titleName">
                 <div
                   class="ABTitle"
                   value="${asset.id}"
                   title="${asset.attributes.title}"
                 >
                   ${asset.attributes.title}
                 </div>
               </li>
             </ul>
          </summary>
          <div class="content">
          </div>
        </details>`
      )
    })

    // Attach a click handler to expand asset detail data
    $asset_list.find('details').click(async (event) => {
      let $expand_list = $(event.target).closest('details')

      if($expand_list.find('div.content section').length == 0){
        const guid = $expand_list.data('id')
        $expand_list.find('div.content').append(
          await (this.render_item(guid))
        )

      }
    })
  }

  async render_tile_list(data) {
    const $assets = $('.assetList')
    $assets.empty()

    // Set the appropriate classes for basic list
    $assets.attr('class', 'assetList gridList mdc-grid-list mdc-grid-list--with-icon-align-end')

    const $asset_list = $(`
     <ul class="mdc-grid-list__tiles" />
    `)

    data.forEach(asset => {
      const subjects = asset.attributes.disciplines.subjects.map(subject => subject.descr).join(', ')
      const grades = asset.attributes.education_levels.grades.map(grade => grade.descr).join(', ')

      const item = $(`
        <li class="mdc-grid-tile">
          <div class="mdc-grid-tile__primary">
            <div class="mdc-grid-tile__primary-content" style="background-image: url(${this.pictureCallback(asset)});/"></div>
          </div>
          <span class="mdc-grid-tile__secondary">
            <i class="mdc-grid-tile__icon material-icons" aria-label="More Information" title="More Information" value="${asset.id}">info</i>
            <span class="mdc-grid-tile__title">
              <div
                class="ABTitle"
                value="${asset.id}"
                title="${asset.attributes.title}"
              >
                ${asset.attributes.title}
              </div>
            </span>
            <span
              class="mdc-grid-tile__support-text"
              title="${subjects} ${grades}"
            >
              <div class="ABSubject">${subjects}</div>
              <div class="ABGrade">${grades}</div>
            </span>
          </span>
        </li>
      `)
      $asset_list.append(item)
  
      const modal_title = asset.attributes.title + ` (${asset.attributes.client_id})`
      item.find('i[aria-label="More Information"]').click(event => {
        const guid = $(event.target).attr('value')
        this.render_item_modal(guid, modal_title)
      })
    })

    $assets.append($asset_list)
  }

  async render_item(guid) {
    let $return_html = $(`<section/>`)

    const asset_data = await this.sdk.get(`${BASE_URL}/assets/${guid}?${await this.get_fields()}`)

    // Append Subject info to the return
    if(this.config.list_subjects && asset_data.data.attributes.disciplines.subjects){
      $return_html.append(
        this.render_item_property(
          'Subjects',
          asset_data.data.attributes.disciplines.subjects
            .map(subject => subject.descr)
        )
      )
    }

    // Append Grade info to the return
    if(this.config.list_grades && asset_data.data.attributes.education_levels.grades.length){
      $return_html.append(
        this.render_item_property(
          'Grades',
          asset_data.data.attributes.education_levels.grades
            .map(grade => grade.descr)
        )
      )
    }

    // Same thing as the 2 above but for user-supplied attributes
    for(const extraItemAttribute of this.extraItemAttributes){
      const data = jsonpath.query(
        asset_data,
        `$.data.attributes.${extraItemAttribute.attribute_key}`
      )
        // If they provided an inner key, use it
        .map(attribute => 
          extraItemAttribute.attribute_inner_key 
            ? attribute[extraItemAttribute.attribute_inner_key]
            : attribute
        )

      if(data.length){
        $return_html.append(
          this.render_item_property(
            extraItemAttribute.attribute_name,
            data
          )
        )
      }
   }

    // Set up loading screens for topics, concepts, and alignments
    let $topics_node = this.render_item_property('Topics', ['Loading...'])
    $return_html.append($topics_node)

    let $concepts_node = this.render_item_property('Concepts', ['Loading...'])
    $return_html.append($concepts_node)

    if(this.extraItemRelationships) {
      for(const relationship of this.extraItemRelationships){
        relationship.node = this.render_item_property(relationship.relationship_name, ['Loading...'])
        $return_html.append(relationship.node)
      }
    }

    // Alignments come last because they reflow the UI a lot
    let $alignments_node = this.render_item_property('Alignments', ['Loading...'])
    $return_html.append($alignments_node);

    // Run the rest of the code aynchronously so that the user gets the data
    // we have as soon as we have it
    (async () => {
      // Page through all of the topics on the asset
      let topics = []
      for await (const response of this.sdk.pager(`${BASE_URL}/assets/${guid}/topics?fields[topics]=section.descr,descr&limit=100`)) {
        topics.push(...(response.data))
      }
      if(topics.length){
        $topics_node.replaceWith(
          this.render_item_property(
            'Topics',
            topics.map(topic => topic.attributes.section.descr + " > " + topic.attributes.descr)
          )
        )
      }
      else {
        $topics_node.remove()
      }

      // Page through all of the concepts on the asset
      let concepts = []
      for await (const response of this.sdk.pager(`${BASE_URL}/assets/${guid}/concepts?fields[concepts]=context,descr&limit=100`)) {
        concepts.push(...(response.data))
      }
      if(concepts.length){
        $concepts_node.replaceWith(
          this.render_item_property(
            'Concepts',
            concepts.map(concept => concept.attributes.context + " > " + concept.attributes.descr)
          )
        )
      }
      else {
        $concepts_node.remove()
      }

      if(this.extraItemRelationships) {
        for(const relationship of this.extraItemRelationships){
          // Page through all of the related type for this asset
          let related = []
          for await (const response of this.sdk.pager(`${BASE_URL}/assets/${guid}/${relationship.relationship_key}?fields[${relationship.relationship_type}]=${relationship.relationship_field}&limit=100`)) {
            related.push(...(response.data))
          }
          if(related.length){
            relationship.node.replaceWith(
              this.render_item_property(
                relationship.relationship_name,
                related.map(relate => jsonpath.query(relate, `$.attributes.${relationship.relationship_field}`))
              )
            )
          }
          else {
            relationship.node.remove()
          }
        }
      }

      const alignment_filter = `&filter[standards]=meta.disposition IN('accepted'${this.include_predicted_alignments ? ", 'predicted" : ''})`

      // Page through all of the alignments on the asset. Unlike the other
      // relationships, we render immediately after getting each API page.
      // This is done by filling our map object and completely reflowing.
      let alignments_by_authority = new Map()
      for await (const response of this.sdk.pager(`${BASE_URL}/assets/${guid}/alignments&fields[standards]=document.publication.authorities,statement,number${alignment_filter}&limit=100`)) {
        // Just a simple partitioning algorithm on authority descr
        for (const alignment of response.data) {
          // If the alignment has no data for some reason, just skip it
          if(!alignment.attributes) continue
          // An alignment can technically have multiple authorities, albiet rarely
          for (const authority of alignment.attributes.document.publication.authorities) {
            // Either create or append to the array corresponding to our auth
            if(!alignments_by_authority.has(authority.descr)){
              alignments_by_authority.set(authority.descr, [])
            }
            alignments_by_authority.get(authority.descr).push(alignment)
          }
        }
        if(response.data.length){
          const $alignments = $(`<div/>`)
          $alignments.append(`
            <div class='asset-attribute-title'>Alignments</div>
          `)

          // Append the alignments, grouped by authority, to our HTML node
          const $authority_list = $(`<div class='asset-attribute-value'>`)
          // Most of the muck here is in order to get a sorted array of entries
          for (const authority_alignments of Array.from(alignments_by_authority.entries()).sort((a,b) => a[0].localeCompare(b[0]))){
            // Decompose the result of the entries() iterator
            const authority_descr = authority_alignments[0]
            const alignments = authority_alignments[1]
 
            // Title
            $authority_list.append(`<div class="authority">${authority_descr}</div>`)

            // Alignments
            $authority_list.append(`
              <div class="standardList">${
                alignments.map(alignment => `
                  <div
                    class='standard'
                    title='${alignment.attributes.statement.descr}'
                  >${alignment.attributes.number.enhanced}</div>
                `).join('')
              }</div>
            `)
          }

          // Add our alignment list to our full node
          $alignments.append($authority_list)

          // Append the full alignment node the the HTML
          $alignments_node.replaceWith($alignments)

          // Replace our $alignments_node reference with the new DOM element
          // so that in the next iteration, we replace the new node.
          $alignments_node = $alignments
        }
        else {
          // This will only happen if we got 0 in our _first_ call, since
          // we wouldn't be paging otherwise
          $alignments_node.remove()
        }
      }


    })()

    return $return_html
    
  }

  async render_item_modal(guid, title){
    const $modal = $('.ab-details-dialog')

    // Set the title
    $modal.find('.mdc-dialog__header__title').text(title)

    // Set the content
    $modal.find('.mdc-dialog__body')
      .replaceWith(
        (await (this.render_item(guid)))
          // And set a few properties for the framework to pretty it up for us
          .attr('class', 'mdc-dialog__body mdc-dialog__body--scrollable')
          .attr('id', 'mdc-dialog-with-list-description')
      )

    // Show the modal
    const dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('.ab-details-dialog'));
    dialog.show()
  }

  render_item_property(property_name, property_list, property_title_list) {

    // When a title list is given, we render a bit differently
    if(property_title_list){
      return $(`
        <div>
          <div class='asset-attribute-title'>
            ${property_name}
          </div>
          <div class='asset-attribute-value-list'>
            ${(property_list
              // Zip the property & title lists
              .map( (property, i) => [property, property_title_list[i]])
              // Convert to HTML
              .map( properties => `
                <div class='asset-attribute-value'>
                  ${properties[1]}
                </div>
                <div class='asset-attribute-value-list'>
                  <div class='asset-attribute-title'> Rationale </div>
                  <div class='asset-attribute-value'> ${properties[0]} </div>
                </div>
              `)
              .join("\n"))
            }
          </div>
        </div>
      `)
    }
    return $(`
      <div>
        <div class='asset-attribute-title'>
          ${property_name}
        </div>
        <div class='asset-attribute-value-list'>
          ${(property_list
            .map( property => `
              <div class='asset-attribute-value'>
                ${property}
              </div>  
            `)
            .join("\n"))
          }
        </div>
      </div>
    `)
  }

  // error should be an Error() with a message equal to a HTTP status code
  handle_api_errors(error) {
    console.log(error)

    // Custom error message for errors we know about
    if(error.message == '429'){
      alert('The system appears to be busy right now.  Wait for a short period and try again.')
    }
    else if(error.message == '401'){
      alert('There was a problem with your authentication')
    }
    else {
      alert('An unknown error has occurred. See the console for details.')
      throw error;
    }
  }

}

class SearchFilter {
  config
  browser
  
  constructor(browser, config){
    this.config = config
    this.browser = browser

    // This is required to be exactly this for filtering to work
    this.config.api_attribute_key = 'Search'
  }

  async initialize_filter(browser){
    const $return_html = $(`
      <div class="textSearch">
        <input type="search" class="search" placeholder="Full text search..." />
      </div>
    `)

    // Attach a DOM handler to update asset query when the user searches
    $return_html.find('input.search').on('blur', () => { this.browser.search() })
    $return_html.find('input.search').on('search', () => { this.browser.search() })

    return $return_html
  }

  // The search filter has no counts to refresh
  async refresh_counts(){

  }

  build_filter(){
    // Text Search (alpha-numeric only to prevent injection)
    let search = $('.textSearch input').val().replace(/[^a-zA-Z0-9]+/g, '')
    if(search){
      // We search on both title and 'all' to boost the score of title-text matches
      return `(query(title,'${search}') OR query('${search}'))`
    }
    return ''
  }
}

// Word clouds. Set to a hardcoded limit of 20 currently.
class CloudFilter {
  config
  browser

  top_limit = 20

  constructor(browser, config){
    this.browser = browser
    this.config = config
  }

  // @param: response.meta.facets[api_facet_key]
  async initialize_filter(facet){
    const $return_html = $(`
      <div class="${this.config.html_class}">
        <details>
            <summary>
              ${this.config.html_name}
            </summary>
            <div class="content more">
              <div class="chips"> </div>
              <div class="tags common">
                <ul> </ul>
              </div>
              <a href='#' class='morelink'>More...</a>
            </div>
        </details>
      </div>
    `)

    $return_html.find('.morelink').click(() => {
      if(this.top_limit == 0) {
        this.top_limit = 20 // hardcoded atm
        $return_html.find('.morelink').text('More...')
      }
      else {
        this.top_limit = 0
        $return_html.find('.morelink').text('Less...')
      }

      this.refresh_counts()
    })

    return $return_html
  }

  async refresh_counts(){
    const filters = await this.browser.get_filters(this.config.api_attribute_key)
    const response = await this.browser.sdk.get(`${BASE_URL}/assets?${filters}&facet=${this.config.api_facet_key}&limit=0`)

    let new_facets = response.meta.facets.filter((facet) => facet.facet == this.config.api_facet_key)[0].details

    // Limit to the top X (0 for all)
    if(this.top_limit){
      new_facets = new_facets.sort((a, b) => b.count - a.count).slice(0,this.top_limit)
    }

    // In order to scale, we need to know the smallest & largest counts.
    // Ignore 0's
    let all_nonzero_counts = new_facets
      .map(facet => facet.count)
      .filter(count => count != 0)

    const lowest_count   = Math.min(...all_nonzero_counts)
    const highest_count  = Math.max(...all_nonzero_counts)

    // Insert the new tags in the HTML
    const $tag_list = $(`.${this.config.html_class} .tags ul`)
    $tag_list.empty()

    // Sort the facets alphabetically
    new_facets.sort((a, b) => a.data[this.config.api_descr].localeCompare(b.data[this.config.api_descr]))

    // Attach to DOM
    new_facets.forEach((facet) => {
      $tag_list.append($(`
        <li
          style="font-size: ${
            facet.count == 0 || lowest_count == highest_count 
              ? 100
              : Math.floor(
                (facet.count - lowest_count) / 
                (highest_count - lowest_count) * 75
              ) + 125
          }%;"
          
          title="${facet.data[this.config.api_context]}"
          value="${facet.data[this.config.api_code]}"
        >
          ${facet.data[this.config.api_descr]} (${facet.count})</li>
      `))
    })

    // Attach click handlers to add/remove chips
    $tag_list.children().click(event => {
      let $node = $(event.target)
      let $chip_list = $(`.${this.config.html_class} .chips`)

      $chip_list.append(`
        <span class="mdl-chip mdl-chip--deletable">
          <span
             class="mdl-chip__text"
             title="${$node.attr('title')}"
             value="${$node.attr('value')}"
          >${$node.text()}</span>
          <button
            type="button"
            class="mdl-chip__action"
            value="${$node.attr('value')}"
          >
            <i class="material-icons">cancel</i>
          </button>
        </span>
      `)

      // Chip remover handler
      $chip_list.find('.mdl-chip button').click(event => {
        let $chip = $(event.target).closest('.mdl-chip')
        $chip.remove()

        // Refresh search to exclude deleted filter
        this.browser.search()
      })

      // Refresh search to include new filter
      this.browser.search()
    })
  }

  build_filter(){
    let facets = [];
    $(`.${this.config.html_class} .chips`).find('.mdl-chip__text').get().forEach(chip => {
      facets.push($(chip).attr('value'))
    })
    
    if(facets.length) {
      return `(${this.config.api_attribute_key}.guid IN (${facets.map(facet => '\'' + facet + '\'').join(',')}))`
    }
    return ''
  }
}

class FacetFilter {
  config
  browser
  
  constructor(browser, config){
    this.browser = browser
    this.config = config
  }

  // @param: response.meta.facets[api_facet_key]
  async initialize_filter(facet){
    let facet_config = this.config

    // Create a (detached) DOM node representing the facet
    let facet_node = $(`
      <div class='${facet_config.html_class}'>
        <details>
          <summary>${facet_config.html_name}</summary>
          <div class='content more' />
        </details>
      </div>
    `)

    // Grab the 'content' div of the DOM node we just created and append our
    // all the valid values for our facet and their count.
    const facet_list_node = facet_node.find('.content')
    facet.details.forEach(detail => {

      // On custom properties, detail.data is a string, so we need to
      // coerce our code below to use that value. Hacky, but oh well
      if(typeof(detail.data) !==  'object'){
        const value = detail.data
        detail.data = {}
        detail.data[facet_config.api_code] = value
        detail.data[facet_config.api_descr] = value
      }

      facet_list_node.append(`
        <div 
          class='mdc-form-field'
          data-id="${detail.data[facet_config.api_code]}"
        >
          <div class='mdc-checkbox'>
            <input type="checkbox"
              id="${detail.data[facet_config.api_code]}"
              value="${detail.data[facet_config.api_code]}"
              class="mdc-checkbox__native-control"
             />

            <div class="mdc-checkbox__background">
              <svg class="mdc-checkbox__checkmark"
                   viewBox="0 0 24 24">
                <path class="mdc-checkbox__checkmark__path"
                      fill="none"
                      stroke="white"
                      d="M1.73,12.91 8.1,19.28 22.79,4.59"/>
              </svg>
              <div class="mdc-checkbox__mixedmark"></div>
            </div>
          </div>

          <label
            for="${detail.data[facet_config.api_code]}"
          > ${detail.data[facet_config.api_descr]} (<span class='facet-api-count'>${detail.count}</span>) </label>
        </div>
      `)
    })

    return facet_node
  }

  async refresh_counts() {
    const facet_config = this.config
    const requested_facet_list = this.browser.config.facets.map(facet => facet.api_facet_key).join(',')

    // fetch the updated facet information for the new query. We EXCLUDE the
    // facet we're iterating over so that having selected a value for this
    // facet doesn't exclude all the others (i.e., selecting MATH would
    // otherwise give SCI a count of zero since they are exclusive)
    const filters = await this.browser.get_filters(facet_config.api_attribute_key)
    const response = await this.browser.sdk.get(`${BASE_URL}/assets?${filters}&facet=${requested_facet_list}&limit=0`)

    const new_facets = response.meta.facets.filter((facet) => facet.facet == facet_config.api_facet_key)[0].details

    // For each facet on the screen...
    $(`.facet_area .${facet_config.html_class}`).find('.mdc-form-field').get().forEach(elem => {
      // Find the corresponding facet from the API call
      const new_facet = new_facets.filter(facet => facet['data'][facet_config.api_code] == $(elem).data('id') || facet.data == $(elem).data('id'))[0]
      const new_count = new_facet ? new_facet.count : 0

      // Set the count in then display
      $(elem).find('label .facet-api-count').text(new_count)

      // If the count is 0, disable selecting the facet detail
      $(elem).toggleClass('disabledDiv', new_count == 0)
    })
    new_facets.forEach(facet => {
      $(`.facet_area .${facet_config.html_class} label[for="${facet[facet_config.api_descr]}"]`)
    })
  }

  build_filter(){
    // We OR together facets of the same kind
    let facet_choices = []

    // Get the currently checked options (checkboxes) from the UI
    $(`.${this.config.html_class} .content input:checked`)
      .map((_, node) => $(node).val())
      .get()
      .forEach(code => {
        facet_choices.push(`(${this.config.api_attribute_key} eq '${code}')`)
      })

    // If there were selected facet_choices, return them
    if (facet_choices.length) {
      return `(${facet_choices.join(' or ')})`
    }

    return ''
  }
}