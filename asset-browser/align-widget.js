const SELECTED = 'selected';
const STANDARDS_BROWSER_SELECTOR = '.standardsSelect .standard';

class AlignFilter {
  browser
  config

  standards_browser_config
  standardsList = {}

  constructor(browser, config){
    this.browser = browser
    this.set_config(config)
  }

  build_filter(){
    const guids = Object.keys(this.standardsList)

    if(!guids.length){
      return ''
    }
    return `(alignments.id IN (${guids.join(', ')}))`
  }

  set_config(config){
    // This is required to be exactly 'standards' for filtering to work correctly
    config.api_attribute_key = 'alignments'
    this.config = config
  }

  // Attach the dialog modal to the DOM
  show_dialog(){
    // Reload the standards browser in order to apply our new filters
    this.reconfigure_standards_browser()

    mdc.dialog.MDCDialog.attachTo(document.querySelector('.ab-standards-dialog')).show()
  }

  // Make note of the selected standards and save the configuration for later. Update the search
  save_standards() {

    // Remember the settings so we can start where we were
    this.standards_browser_config = ($(STANDARDS_BROWSER_SELECTOR).standardsBrowser('getConfiguration'))

    // Loop over the assets, construct the label and add them to the supplied list
    var chipSpace = $('.standardsChips');
    chipSpace.empty();

    Object.keys(this.standardsList).forEach(GUID => {

      // If we have no number, use up to the first 10 characters of the statement
      var number = this.standardsList[GUID].number;
      if (!number) {
        const statement = this.standardsList[GUID].statement
        number = statement.substr(0, Math.min(statement.length, 10))
      }

      // the line format is "<number> <statement>"
      chipSpace.append(`
        <span class="mdl-chip mdl-chip--deletable">
            <span class="mdl-chip__text" title="${this.standardsList[GUID].statement}" value="${GUID}">${number} </span>
            <button
              type="button"
              class="mdl-chip__action"
              value="${GUID}"
            ><i class="material-icons">cancel</i></button>
        </span>`
      );
    })

    // Attach the click handlers for removing chips
    chipSpace.find('button.mdl-chip__action').click((event) => {
      const guid = $(event.target).closest('.mdl-chip__action').attr('value')

      delete this.standardsList[guid]; 
      this.save_standards()
    })

    this.browser.search()
  }

  async refresh_counts() {
    // Get the list of aligned standards
    $('.standardsChips .mdl-chip__text').get().forEach(async chip => {
      const standardGUID = $(chip).attr('value')

      var facetFilter = await this.browser.get_filters('alignments')

      // include the appropriate relationships in the search
      var standardsFilter = "alignments.meta.disposition in ('accepted')";
      if (this.config.predicted){
        standardsFilter = "alignments.meta.disposition in ('accepted', 'predicted')"
      }
      standardsFilter += ` and alignments.id eq ${standardGUID}`

      // Add our filters to the ones we got from the browser (if we did get some)
      if(facetFilter == '') {
        facetFilter = `filter[assets]=(${standardsFilter})`
      }
      else {
        // We remove the trailing parenthesis and then tack our filter on the end
        facetFilter = facetFilter.substring(0, facetFilter.length - 1);
        facetFilter += ' and ' + standardsFilter + ')'
      }

      // Call the API to get the current matching count
      const data = await this.browser.sdk.get(`${BASE_URL}/assets/?${facetFilter}&limit=0`)

      // Strip the existing number off the chip
      var number = $(chip).text()
      number = number.replace(/\(\d+\)$/, '')

      // Add the new number
      number += '(' + data.meta.count + ')';

      // Update the chip with the new text
      $(chip).text(number);
      })
  }

  // (re)create the standards browser. Called at the beginning as well as
  // when they reopen the widget (so that the new filters are applied)
  async reconfigure_standards_browser() {
    var config = {
      selectMode: 'multiple',
      enableDoubleClick: true,
      showAssetCount: true,
      onStandardDoubleClick: (event, GUID) => {
        this.add_standard(GUID);
      },
      onStandardSelect: (event, GUID) => {
        this.standards_changed();
      },
      onStandardDeselect: (event, GUID) => {
        this.standards_changed();
      },
      onError: (event, message) => {
        alert(message);
      }
    };

    // Map the authentication credentails to the standards browser config
    let credentials = await this.browser.authenticationCallback()

    config.authCredentials = {
      ID: credentials.partner_id,
      signature: credentials.auth_signature,
      expires: credentials.auth_expires 
    }

    // This stores the currently selected standards browser state
    if (this.standards_browser_config) {
      config.uiEntityState = this.standards_browser_config;
    }

    // Get the current asset filter. Strip off the leading filter[assets]=( and
    // the trailing )
    let filter = (await this.browser.get_filters('alignments'))
      .replace(/^filter\[assets\]=\(/, '')
      .replace(/\)$/, ' and ')

    // Add our disposition filter
    if(this.config.predicted){
      filter += "alignments.meta.disposition IN ('accepted', 'predicted')"
    }
    else {
      filter += "alignments.meta.disposition IN ('accepted')"
    }

    // Pass to the standards browser
    config.assetCountFilter = filter

    // If we already have a standards browser loaded, destroy it
    try {
      $(STANDARDS_BROWSER_SELECTOR).standardsBrowser('destroy')
    } catch (e) { }
    
    $(STANDARDS_BROWSER_SELECTOR).standardsBrowser(config);
  }

  // Ready the AlignFilter to be attached to the DOM
  async initialize_filter() {
    // Add the modal HTML to the DOM so we have somewhere to attach the 
    // standards browser widget ot 
    this.attach_standards_browser_to_DOM()

    // Attach the standards browser JS to the modal we just created
    await this.reconfigure_standards_browser()

    // Load the select list (on the right of the modal) based on the currently
    // selected standards
    var list = $( "ul.standardsList");
    list.empty();
    for (const GUID in this.standardsList) {
      var label = '';
      if (this.standardsList[GUID].number) label += this.standardsList[GUID].number + ' ';
      label += this.standardsList[GUID].statement; // build the visual element

      const $item = $(`
        <li class="mdc-list-item" value="${GUID}">
          <div class="limitItem">
            ${label}
          </div>
        </li>
      `);

      $item.click(event => this.toggle_standard(event))

      list.append($item);
    }
    this.standards_changed(); // update the buttons

    // Add the widget to the filter list on the left
    const $return_html = $(`
      <div class="standardsAligned">
        <details>
            <summary>
              Aligned Standards
            </summary>
            <div class="content">
              <div class="selectedStandards">
              </div>
              <div class="standardsChips">
              </div>
              <div class="buttonArea">
                <button class="mdc-fab mdc-fab--mini material-icons" aria-label="Add">
                  <span class="mdc-fab__icon"> add </span>
                </button>
              </div>
            </div>
        </details>
      </div>
    `)

    $return_html.find('.buttonArea button').click(
      () => this.show_dialog()
    )

    return $return_html
  }

  // This HTML is a modal we load the standards browser widget into
  async attach_standards_browser_to_DOM(){
    
    const $standards_browser = $(`
      <div class="standardsSelect">
        <aside id="mdc-dialog-with-list"
          class="mdc-dialog ab-standards-dialog"
          role="alertdialog"
          aria-labelledby="mdc-dialog-with-list-label"
          aria-describedby="mdc-dialog-with-list-description">
          <div class="mdc-dialog__surface">
            <header class="mdc-dialog__header">
              <h2 id="mdc-dialog-with-list-label" class="mdc-dialog__header__title">
                Select Standards
              </h2>
            </header>
            <section id="mdc-dialog-with-list-description" class="mdc-dialog__body" width="1400" height="800">
              <div class="struct">
                <div class="content">
                  <div class="standard"></div>
                </div>
                <div class="arrowSpace">
                    <div class="buttonArea">
                      <button class="mdc-fab mdc-fab--mini material-icons addStandards" aria-label="Add" disabled>
                        <span class="mdc-fab__icon">
                          add
                        </span>
                      </button>
                    </div>
                    <div class="buttonArea">
                      <button class="mdc-fab mdc-fab--mini material-icons removeStandards" aria-label="Remove" disabled>
                        <span class="mdc-fab__icon">
                          remove
                        </span>
                      </button>
                    </div>
                </div>
                <div class="selectedArea">
                  <ul class="mdc-list mdc-list--dense standardsList">
                  </ul>
                </div>
              </div>
            </section>
            <footer class="mdc-dialog__footer">
              <button type="button" class="mdc-button mdc-dialog__footer__button mdc-dialog__footer__button--cancel">Cancel</button>
              <button type="button" class="mdc-button mdc-dialog__footer__button mdc-dialog__footer__button--accept">OK</button>
            </footer>
          </div>
          <div class="mdc-dialog__backdrop"></div>
        </aside>
      </div>
    `)


    // Attach button click handlers
    $standards_browser.find('button[aria-label=Add]').click(
      () => this.add_standards()
    )
    $standards_browser.find('button[aria-label=Remove]').click(
      () => this.remove_standards()
    )
    $standards_browser.find('button.mdc-dialog__footer__button--accept').click(
      () => this.save_standards()
    )

    $('.page .struct').append($standards_browser)
  }

  // Update the arrow buttons in the standards browser widget
  standards_changed() {

    // Get the current standards highlighted (on the left) in the browser
    var selection = $(STANDARDS_BROWSER_SELECTOR).standardsBrowser('getSelection')

    // If there are any, enable any disabled buttons
    $('.addStandards')
      .prop('disabled', selection.length == 0)

    // Get the current standards highlighted (on the right) in the browser
    selection = $(".standardsList ." + SELECTED)

    // If there are any, enable any disabled buttons
    $('.removeStandards')
      .prop('disabled', selection.length == 0)

    // Get all of the standards on the 
    selection = $(".standardsList .mdc-list-item")

    // If there are any, enable any disabled buttons
    $('.save')
      .prop('disabled', selection.length == 0);
  }

  // Add the currently selected standards to the list window
  add_standards() {
    // Get a list of the current standard GUIDs from list on the right
    const currentStandards = $('ul.standardsList')
      .find('li.mdc-list-item')
      .get()
      .map(node => $(node).attr('value'))

    // Get a list of GUIDs to add to the list on the right 
    const guidList = $(STANDARDS_BROWSER_SELECTOR)
      // Ask the standards browser for the selected standards
      .standardsBrowser('getSelection')
      // Filter out existing standards
      .filter(guid => !currentStandards.includes(guid))
      // Surrounds with quote marks
      .map(guid => "'" + guid + "'")
      // Join with comma (suitable for use in the IN() statement below)
      .join(', ')

    // Bail if we filtered out all of our potential standards
    if(!guidList){
      return
    }

    var sourceUrl = BASE_URL + '/standards?filter[standards]=(' + encodeURIComponent('id in (' + guidList + ')') + ')&facet_summary=_none&fields[standards]=number,statement'

    this.browser.sdk.get(sourceUrl).then((data) => this.add_standards_to_list(data))
  }

  // Add a standard to the list window (in response to a double click event)
  add_standard(GUID) {
    // Get a list of the current standard GUIDs from list on the right
    const currentStandards = $('ul.standardsList')
      .find('li.mdc-list-item')
      .get()
      .map(node => $(node).attr('value'))

    // Bail if the standards already exists on the right
    if(currentStandards.includes(GUID)){
      return
    }

    var sourceUrl = BASE_URL + '/standards?filter[standards]=(' + encodeURIComponent("id eq '" + GUID + "'") + ')&fields[standards]=number,statement&facet_summary=_none'

    this.browser.sdk.get(sourceUrl).then((data) => this.add_standards_to_list(data))
  }
  // addStandardsToList - Add standards to the list window (if any are selected)
  //  data - the response from the API call
  //
  add_standards_to_list(data) {
    var list = $( "ul.standardsList");

    // Loop over the standards we got back from the API
    for (const standard of data.data) {

      this.standardsList[standard.id] = {
        number: standard.attributes.number.enhanced,
        statement: standard.attributes.statement.descr
      }; // track the list of selected standards
      
      var label = '';
      if (standard.attributes.number.enhanced) label += standard.attributes.number.enhanced + ' ';
      label += standard.attributes.statement.descr; // build the visual element

      var $item = $(`
        <li class="mdc-list-item" value="${standard.id}">
          <div class="limitItem">
            ${label}
          </div>
        </li>
      `);

      $item.click(event => this.toggle_standard(event))

      list.append($item);
    }
    this.standards_changed(); // update the buttons
  }

  // Mark a standard as selected when clicked in the standards browser
  toggle_standard(ev) {
    $(ev.target).parent().toggleClass(SELECTED);
    
    this.standards_changed();
  }

  // Removethe highlighetd standards from the list window
  remove_standards() {
    var selection = $(".standardsList ." + SELECTED);

    for (const selected of selection) {
      delete this.standardsList[ selected.attributes['value'].value ];
      selection.remove();
    }

    this.standards_changed();
  }

}